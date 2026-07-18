const { PrismaClient } = require("@prisma/client");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const prisma = new PrismaClient();

async function run() {
  console.log("Starting missing inventory seeder for existing tenants...");
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        stores: true,
        products: true
      }
    });

    for (const tenant of tenants) {
      console.log(`Checking tenant: ${tenant.name} (${tenant.id})...`);
      
      let store = tenant.stores[0];
      if (!store) {
        console.log(`Creating default store branch for tenant: ${tenant.name}`);
        store = await prisma.store.create({
          data: {
            name: `${tenant.name} Main Branch`,
            address: "Default Branch Location Address",
            tenantId: tenant.id
          }
        });
      }

      if (tenant.products.length === 0) {
        console.log(`Seeding default products for tenant: ${tenant.name}`);
        const defaultProducts = [
          {
            sku: "PROD-I9-14900K",
            barcode: "5032037278850",
            name: "Intel Core i9-14900K Processor",
            brand: "Intel",
            category: "Processors",
            description: "24 Cores (8 P-cores + 16 E-cores) LGA1700 Socket Desktop CPU",
            purchaseCost: 28500.0,
            sellingPrice: 34500.0,
            wholesalePrice: 32000.0,
            quantity: 15,
            minStock: 5,
            maxStock: 50,
            reorderLevel: 8,
            warranty: "3 Years Local Supplier Warranty",
            location: "Shelf A-3",
            serialized: false,
            taxable: true
          },
          {
            sku: "PROD-RTX-4090-ROG",
            barcode: "4711081936992",
            name: "ASUS ROG Strix GeForce RTX 4090 OC Edition 24GB",
            brand: "ASUS",
            category: "Graphics Cards",
            description: "PCIe 4.0 DLSS 3 flagship graphics card with custom cooling.",
            purchaseCost: 95000.0,
            sellingPrice: 115000.0,
            wholesalePrice: 108000.0,
            quantity: 4,
            minStock: 2,
            maxStock: 10,
            reorderLevel: 3,
            warranty: "1 Year Store, 3 Years Manufacturer",
            location: "Display Cabinet B-1",
            serialized: true,
            serialNumbers: JSON.stringify(["ROG4090-001", "ROG4090-002", "ROG4090-003", "ROG4090-004"]),
            taxable: true
          },
          {
            sku: "PROD-SSD-990PRO-2TB",
            barcode: "8806094215038",
            name: "Samsung 990 Pro 2TB NVMe M.2 SSD",
            brand: "Samsung",
            category: "Storage",
            description: "PCIe Gen 4.0 x4, NVMe 2.0 with heatsink.",
            purchaseCost: 7500.0,
            sellingPrice: 9950.0,
            wholesalePrice: 9000.0,
            quantity: 40,
            minStock: 10,
            maxStock: 100,
            reorderLevel: 15,
            warranty: "5 Years Limited Warranty",
            location: "Shelf C-12",
            serialized: false,
            taxable: true
          },
          {
            sku: "PROD-RAM-DOM-64GB",
            barcode: "840006699318",
            name: "Corsair Dominator Platinum RGB 64GB (2x32GB) DDR5 6000MHz",
            brand: "Corsair",
            category: "RAM / Memory",
            description: "High-performance DDR5 RAM optimized for Intel systems.",
            purchaseCost: 14000.0,
            sellingPrice: 18500.0,
            wholesalePrice: 17000.0,
            quantity: 8,
            minStock: 3,
            maxStock: 20,
            reorderLevel: 5,
            warranty: "Lifetime Warranty",
            location: "Shelf C-5",
            serialized: false,
            taxable: true
          },
          {
            sku: "PROD-PSU-RM1000X",
            barcode: "840006637846",
            name: "Corsair RM1000x 1000W 80+ Gold Fully Modular Power Supply",
            brand: "Corsair",
            category: "Power Supplies",
            description: "Ultra-low noise modular power supply.",
            purchaseCost: 7500.0,
            sellingPrice: 9450.0,
            wholesalePrice: 8800.0,
            quantity: 2,
            minStock: 5,
            maxStock: 25,
            reorderLevel: 5,
            warranty: "10 Years Warranty",
            location: "Shelf D-1",
            serialized: false,
            taxable: false
          }
        ];

        for (const p of defaultProducts) {
          const prod = await prisma.product.create({
            data: {
              ...p,
              tenantId: tenant.id
            }
          });

          await prisma.storeInventory.create({
            data: {
              productId: prod.id,
              storeId: store.id,
              quantity: prod.quantity
            }
          });
        }
        console.log(`Seeded default products for tenant: ${tenant.name} successfully.`);
      }
    }
    console.log("All tenants checked and seeded successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
