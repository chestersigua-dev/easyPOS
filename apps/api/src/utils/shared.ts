/**
 * Inlined validation schemas — copied from @easypos/shared so the API
 * compiles on deployment servers (e.g. Render) without requiring the
 * workspace packages to be pre-built.
 */
import { z } from "zod";

// --- AUTHENTICATION ---
export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const MfaVerifySchema = z.object({
  token: z.string().length(6, "TOTP token must be exactly 6 digits"),
});
export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;

// --- CUSTOMERS ---
export const CustomerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  middleName: z.string().optional().nullable(),
  mobile: z.string().min(7, "Mobile number is too short"),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export type CustomerInput = z.infer<typeof CustomerSchema>;

// --- SUPPLIERS ---
export const SupplierSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  phone: z.string().min(7, "Phone number is too short"),
  email: z.string().email("Invalid email"),
  address: z.string().min(1, "Address is required"),
  tin: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  balance: z.number().default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export type SupplierInput = z.infer<typeof SupplierSchema>;

// --- PRODUCTS ---
export const ProductSchema = z.object({
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  barcode: z.string().optional().nullable(),
  name: z.string().min(1, "Product name is required"),
  brand: z.string().min(1, "Brand name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional().nullable(),
  purchaseCost: z.number().min(0, "Purchase cost cannot be negative"),
  sellingPrice: z.number().min(0, "Selling price cannot be negative"),
  wholesalePrice: z.number().min(0, "Wholesale price cannot be negative"),
  quantity: z.number().int().min(0, "Stock quantity cannot be negative").default(0),
  minStock: z.number().int().min(0).default(5),
  maxStock: z.number().int().min(0).default(100),
  reorderLevel: z.number().int().min(0).default(10),
  warranty: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  serialized: z.boolean().default(false),
  serialNumbers: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  taxable: z.boolean().default(true),
  storeId: z.string().optional().nullable(),
});
export type ProductInput = z.infer<typeof ProductSchema>;

// --- SALES ---
export const SaleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive("Quantity must be positive"),
  price: z.number().min(0),
  serialNo: z.string().optional().nullable(),
  warranty: z.string().optional().nullable(),
});

export const PaymentInputSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["CASH", "GCASH", "MAYA", "CREDIT_CARD", "BANK_TRANSFER"]),
  reference: z.string().optional().nullable(),
});

export const SaleSchema = z.object({
  customerId: z.string().optional().nullable(),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  discount: z.number().min(0).default(0),
  total: z.number().min(0),
  paymentType: z.enum(["CASH", "GCASH", "MAYA", "CREDIT_CARD", "BANK_TRANSFER", "SPLIT"]),
  status: z.enum(["COMPLETED", "VOID", "HOLD", "QUOTE"]).default("COMPLETED"),
  items: z.array(SaleItemSchema).min(1, "At least one item is required"),
  payments: z.array(PaymentInputSchema).optional(),
  vatableSales: z.number().optional().nullable(),
  vatAmount: z.number().optional().nullable(),
  vatExemptSales: z.number().optional().nullable(),
  zeroRatedSales: z.number().optional().nullable(),
  scPwdId: z.string().optional().nullable(),
  scPwdName: z.string().optional().nullable(),
  scPwdTin: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
});
export type SaleInput = z.infer<typeof SaleSchema>;

// --- REPAIRS ---
export const RepairSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  accessories: z.string().optional().nullable(),
  issueDescription: z.string().min(1, "Issue description is required"),
  internalNotes: z.string().optional().nullable(),
  repairNotes: z.string().optional().nullable(),
  cost: z.number().min(0).default(0),
  status: z.enum([
    "PENDING",
    "DIAGNOSING",
    "WAITING_PARTS",
    "REPAIRING",
    "COMPLETED",
    "CLAIMED",
    "EXPIRED",
    "CANCELLED",
  ]).default("PENDING"),
  technicianId: z.string().uuid().optional().nullable(),
  customerSignature: z.string().optional().nullable(),
  technicianSignature: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
});
export type RepairInput = z.infer<typeof RepairSchema>;

// --- DEPLOYMENT RESET & SAFETY ---
export const DeploymentResetSchema = z.object({
  password: z.string().min(1, "SuperAdmin password is required"),
  totpCode: z.string().length(6, "TOTP is required if enabled").optional().or(z.literal("")),
  confirmPhrase: z.literal("RESET APPLICATION", {
    errorMap: () => ({ message: "Must type 'RESET APPLICATION' to confirm" }),
  }),
  confirmAppName: z.string().min(1, "Must confirm application name"),
  options: z.object({
    dataReset: z.boolean().default(true),
    productReset: z.enum(["KEEP", "DELETE_ALL", "DELETE_PRODUCTS_KEEP_CATS"]).default("KEEP"),
    userReset: z.enum(["KEEP_ALL", "KEEP_ONLY_CURRENT_SUPERADMIN", "REMOVE_ALL_EXCEPT_SUPERADMIN"]).default("KEEP_ALL"),
    inventoryReset: z.enum(["KEEP", "RESET_QUANTITIES_ZERO", "DELETE_ALL"]).default("KEEP"),
    repairReset: z.enum(["KEEP", "DELETE_HISTORY", "DELETE_ALL"]).default("KEEP"),
    customerReset: z.enum(["KEEP", "DELETE_ALL_KEEP_LOYALTY", "DELETE_ALL"]).default("KEEP"),
    supplierReset: z.boolean().default(false),
    settingsReset: z.boolean().default(false),
    saasReset: z.boolean().default(false),
  }),
});
export type DeploymentResetInput = z.infer<typeof DeploymentResetSchema>;

// --- SETTINGS & BRANDING ---
export const SettingSchema = z.object({
  appName: z.string().min(1),
  taxRate: z.number().min(0),
  currency: z.string().length(3),
  timezone: z.string(),
  receiptHeader: z.string().optional().nullable(),
  receiptFooter: z.string().optional().nullable(),
  themeColor: z.string().optional().nullable(),
});
export type SettingInput = z.infer<typeof SettingSchema>;
