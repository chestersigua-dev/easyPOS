import { FastifyInstance } from "fastify";
import { SaleSchema } from "../utils/shared";
import { prisma, nontaxablePrisma } from "../utils/prisma";
import { requirePermission } from "../middleware/auth";
import { logAudit } from "../utils/audit";
import { generateReceiptPdf } from "../utils/pdf";

async function generateInvoiceNumber(tenantId: string, isNonTaxable: boolean): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = isNonTaxable ? `NTX-${dateStr}-` : `INV-${dateStr}-`;

  const [countMain, countNontax] = await Promise.all([
    prisma.sale.count({
      where: {
        tenantId,
        invoiceNo: { startsWith: prefix },
      },
    }),
    nontaxablePrisma.sale.count({
      where: {
        tenantId,
        invoiceNo: { startsWith: prefix },
      },
    }),
  ]);

  const count = countMain + countNontax;
  const nextNum = String(count + 1).padStart(4, "0");
  return `${prefix}${nextNum}`;
}

export async function saleRoutes(fastify: FastifyInstance) {
  // Get all sales (taxable or non-taxable depending on query parameters)
  fastify.get("/", { preHandler: requirePermission("sales:read") }, async (request) => {
    const { nontaxable } = request.query as { nontaxable?: string };
    const dbSalesClient = nontaxable === "true" ? nontaxablePrisma : prisma;
    const whereClause: any = { tenantId: request.user!.tenantId };

    // For PostgreSQL/Neon where nontaxablePrisma === prisma, apply filtering by tax
    if (nontaxablePrisma === prisma) {
      if (nontaxable === "true") {
        whereClause.tax = 0;
      } else {
        whereClause.tax = { gt: 0 };
      }
    }

    return dbSalesClient.sale.findMany({
      where: whereClause,
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  // Create Sale
  fastify.post("/", { preHandler: requirePermission("sales:create") }, async (request, reply) => {
    const parseResult = SaleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.flatten() });
    }

    const data = parseResult.data;
    const tenantId = request.user!.tenantId;
    const createdBy = `${request.user!.email}`;
    const isNonTaxable = data.tax === 0 || data.vatAmount === 0 || !data.vatableSales;

    // Process sale transaction atomically
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Generate Invoice No
        const invoiceNo = await generateInvoiceNumber(tenantId, isNonTaxable);

        // 2. Validate and adjust product quantities
        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product || product.tenantId !== tenantId) {
            throw new Error(`Product ${item.productId} not found`);
          }

          let movementOldQty = product.quantity;
          let movementNewQty = product.quantity - item.quantity;

          if (data.storeId) {
            const storeInv = await tx.storeInventory.findUnique({
              where: { productId_storeId: { productId: item.productId, storeId: data.storeId } },
            });
            if (!storeInv || storeInv.quantity < item.quantity) {
              throw new Error(`Insufficient stock for product: ${product.name} at the selected store location. Available: ${storeInv?.quantity || 0}`);
            }

            movementOldQty = storeInv.quantity;
            movementNewQty = storeInv.quantity - item.quantity;

            // Update store inventory
            await tx.storeInventory.update({
              where: { productId_storeId: { productId: item.productId, storeId: data.storeId } },
              data: { quantity: { decrement: item.quantity } },
            });

            // Sync store inventory update to nontaxable db
            try {
              if (nontaxablePrisma !== prisma) {
                await nontaxablePrisma.storeInventory.update({
                  where: { productId_storeId: { productId: item.productId, storeId: data.storeId } },
                  data: { quantity: { decrement: item.quantity } },
                });
              }
            } catch (err) {}
          } else {
            if (product.quantity < item.quantity) {
              throw new Error(`Insufficient stock for product: ${product.name}. Available: ${product.quantity}`);
            }
          }

          const oldQty = product.quantity;
          const newQty = oldQty - item.quantity;

          // If product is serialized, remove selected serial number
          let updatedSerialsStr = product.serialNumbers;
          if (product.serialized && item.serialNo && product.serialNumbers) {
            const serials = JSON.parse(product.serialNumbers) as string[];
            const index = serials.indexOf(item.serialNo);
            if (index > -1) {
              serials.splice(index, 1);
              updatedSerialsStr = JSON.stringify(serials);
            } else {
              throw new Error(`Serial number ${item.serialNo} not found on product ${product.name}`);
            }
          }

          // Update product table
          await tx.product.update({
            where: { id: item.productId },
            data: {
              quantity: newQty,
              serialNumbers: updatedSerialsStr,
            },
          });

          // Sync product table update to nontaxable db
          try {
            if (nontaxablePrisma !== prisma) {
              await nontaxablePrisma.product.update({
                where: { id: item.productId },
                data: {
                  quantity: newQty,
                  serialNumbers: updatedSerialsStr,
                },
              });
            }
          } catch (err) {}

          // Log stock movement
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "OUT",
              quantity: item.quantity,
              reason: `Sale ${invoiceNo} ${data.storeId ? `(Store: ${data.storeId})` : ""}`,
              oldQuantity: movementOldQty,
              newQuantity: movementNewQty,
              createdBy,
            },
          });
        }

        // 3. Award loyalty points if customer exists
        if (data.customerId) {
          // Award 1 loyalty point per 100 PHP spent
          const pointsEarned = Math.floor(data.total / 100);
          await tx.customer.update({
            where: { id: data.customerId },
            data: {
              loyaltyPoints: { increment: pointsEarned },
            },
          });

          // Sync loyalty points to nontaxable db
          try {
            if (nontaxablePrisma !== prisma) {
              await nontaxablePrisma.customer.update({
                where: { id: data.customerId },
                data: {
                  loyaltyPoints: { increment: pointsEarned },
                },
              });
            }
          } catch (err) {}
        }

        // 4. Create Sale
        let sale;
        if (isNonTaxable && nontaxablePrisma !== prisma) {
          sale = await nontaxablePrisma.sale.create({
            data: {
              invoiceNo,
              customerId: data.customerId || null,
              subtotal: data.subtotal,
              tax: data.tax,
              discount: data.discount,
              total: data.total,
              paymentType: data.paymentType,
              status: data.status,
              tenantId,
              createdBy,
              storeId: data.storeId || null,
              vatableSales: data.vatableSales ?? null,
              vatAmount: data.vatAmount ?? null,
              vatExemptSales: data.vatExemptSales ?? null,
              zeroRatedSales: data.zeroRatedSales ?? null,
              scPwdId: data.scPwdId ?? null,
              scPwdName: data.scPwdName ?? null,
              scPwdTin: data.scPwdTin ?? null,
              items: {
                create: data.items.map((it) => ({
                  productId: it.productId,
                  quantity: it.quantity,
                  price: it.price,
                  serialNo: it.serialNo || null,
                  warranty: it.warranty || null,
                })),
              },
              payments: {
                create: data.payments?.map((pay) => ({
                  amount: pay.amount,
                  type: pay.type,
                  reference: pay.reference || null,
                })) || [],
              },
            },
            include: {
              items: { include: { product: true } },
              payments: true,
            },
          });
        } else {
          sale = await tx.sale.create({
            data: {
              invoiceNo,
              customerId: data.customerId || null,
              subtotal: data.subtotal,
              tax: data.tax,
              discount: data.discount,
              total: data.total,
              paymentType: data.paymentType,
              status: data.status,
              tenantId,
              createdBy,
              storeId: data.storeId || null,
              vatableSales: data.vatableSales ?? null,
              vatAmount: data.vatAmount ?? null,
              vatExemptSales: data.vatExemptSales ?? null,
              zeroRatedSales: data.zeroRatedSales ?? null,
              scPwdId: data.scPwdId ?? null,
              scPwdName: data.scPwdName ?? null,
              scPwdTin: data.scPwdTin ?? null,
              items: {
                create: data.items.map((it) => ({
                  productId: it.productId,
                  quantity: it.quantity,
                  price: it.price,
                  serialNo: it.serialNo || null,
                  warranty: it.warranty || null,
                })),
              },
              payments: {
                create: data.payments?.map((pay) => ({
                  amount: pay.amount,
                  type: pay.type,
                  reference: pay.reference || null,
                })) || [],
              },
            },
            include: {
              items: { include: { product: true } },
              payments: true,
            },
          });
        }

        return sale;
      }, { timeout: 25000 });

      if (!isNonTaxable) {
        await logAudit({
          userId: request.user!.id,
          action: "CREATE_SALE",
          entity: "Sale",
          entityId: result.id,
          newValue: { invoiceNo: result.invoiceNo, total: result.total },
          tenantId,
        });
      }

      return result;
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || "Sale transaction failed" });
    }
  });

  // Void Sale
  fastify.post("/:id/void", { preHandler: requirePermission("sales:void") }, async (request, reply) => {
    const { id } = request.params as { id: string };

    let sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    let isNontaxable = false;
    if (!sale) {
      sale = await nontaxablePrisma.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (sale) {
        isNontaxable = true;
      }
    }

    if (!sale || sale.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Sale invoice not found" });
    }

    if (sale.status === "VOID") {
      return reply.status(400).send({ error: "Sale is already voided" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Revert product quantities
        for (const item of sale.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            const oldQty = product.quantity;
            const newQty = oldQty + item.quantity;

            // Re-add serial number if product was serialized
            let updatedSerialsStr = product.serialNumbers;
            if (product.serialized && item.serialNo) {
              const serials = product.serialNumbers ? (JSON.parse(product.serialNumbers) as string[]) : [];
              if (!serials.includes(item.serialNo)) {
                serials.push(item.serialNo);
                updatedSerialsStr = JSON.stringify(serials);
              }
            }

            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: newQty,
                serialNumbers: updatedSerialsStr,
              },
            });

            // Sync updated quantity to nontaxable db
            try {
              if (nontaxablePrisma !== prisma) {
                await nontaxablePrisma.product.update({
                  where: { id: item.productId },
                  data: {
                    quantity: newQty,
                    serialNumbers: updatedSerialsStr,
                  },
                });
              }
            } catch (err) {}

            let movementOldQty = oldQty;
            let movementNewQty = newQty;

            if (sale.storeId) {
              const storeInv = await tx.storeInventory.findUnique({
                where: { productId_storeId: { productId: item.productId, storeId: sale.storeId } },
              });
              const currentStoreQty = storeInv?.quantity || 0;
              movementOldQty = currentStoreQty;
              movementNewQty = currentStoreQty + item.quantity;

              // Revert store inventory in main db
              await tx.storeInventory.upsert({
                where: { productId_storeId: { productId: item.productId, storeId: sale.storeId } },
                create: { productId: item.productId, storeId: sale.storeId, quantity: item.quantity },
                update: { quantity: { increment: item.quantity } },
              });

              // Revert store inventory in nontaxable db
              try {
                if (nontaxablePrisma !== prisma) {
                  await nontaxablePrisma.storeInventory.upsert({
                    where: { productId_storeId: { productId: item.productId, storeId: sale.storeId } },
                    create: { productId: item.productId, storeId: sale.storeId, quantity: item.quantity },
                    update: { quantity: { increment: item.quantity } },
                  });
                }
              } catch (err) {}
            }

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: "IN",
                quantity: item.quantity,
                reason: `Void of sale ${sale.invoiceNo}`,
                oldQuantity: movementOldQty,
                newQuantity: movementNewQty,
                createdBy: request.user!.id,
              },
            });
          }
        }

        // Deduct loyalty points
        if (sale.customerId) {
          const pointsEarned = Math.floor(sale.total / 100);
          await tx.customer.update({
            where: { id: sale.customerId },
            data: {
              loyaltyPoints: { decrement: pointsEarned },
            },
          });

          // Sync loyalty points deduction to nontaxable db
          try {
            if (nontaxablePrisma !== prisma) {
              await nontaxablePrisma.customer.update({
                where: { id: sale.customerId },
                data: {
                  loyaltyPoints: { decrement: pointsEarned },
                },
              });
            }
          } catch (err) {}
        }

        // Mark invoice status as VOID in the respective database
        if (isNontaxable && nontaxablePrisma !== prisma) {
          await nontaxablePrisma.sale.update({
            where: { id },
            data: { status: "VOID" },
          });
        } else {
          await tx.sale.update({
            where: { id },
            data: { status: "VOID" },
          });
        }
      });

      if (!isNontaxable) {
        await logAudit({
          userId: request.user!.id,
          action: "VOID_SALE",
          entity: "Sale",
          entityId: id,
          oldValue: { status: sale.status },
          newValue: { status: "VOID" },
          tenantId: request.user!.tenantId,
        });
      }

      return { success: true };
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || "Failed to void sale" });
    }
  });

  // Get printable receipt PDF
  fastify.get("/:id/receipt", { preHandler: requirePermission("sales:read") }, async (request, reply) => {
    const { id } = request.params as { id: string };

    let sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
    });

    if (!sale) {
      sale = await nontaxablePrisma.sale.findUnique({
        where: { id },
        include: {
          items: { include: { product: true } },
          payments: true,
        },
      });
    }

    if (!sale || sale.tenantId !== request.user!.tenantId) {
      return reply.status(404).send({ error: "Invoice not found" });
    }

    const settingsList = await prisma.setting.findMany({
      where: { tenantId: request.user!.tenantId },
    });

    const settings: any = {};
    settingsList.forEach((s) => {
      settings[s.key] = s.value;
      if (s.key === "APP_NAME") settings.appName = s.value;
      if (s.key === "RECEIPT_HEADER") settings.receiptHeader = s.value;
      if (s.key === "RECEIPT_FOOTER") settings.receiptFooter = s.value;
    });

    const pdfBuffer = await generateReceiptPdf(sale, settings);

    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename=receipt_${sale.invoiceNo}.pdf`)
      .send(pdfBuffer);
  });
}
