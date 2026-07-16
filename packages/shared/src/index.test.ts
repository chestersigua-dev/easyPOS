import { describe, it, expect } from "vitest";
import { ProductSchema, CustomerSchema, SaleSchema, SettingSchema } from "./index";

describe("Validation Schemas", () => {
  it("validates correct product structures", () => {
    const validProduct = {
      sku: "PROD-I9-14900K",
      name: "Intel Core i9 Processor",
      brand: "Intel",
      category: "Processors",
      purchaseCost: 28500,
      sellingPrice: 34500,
      wholesalePrice: 32000,
      quantity: 10,
    };
    const result = ProductSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("fails product structures with negative pricing", () => {
    const badProduct = {
      sku: "PROD-BAD",
      name: "Bad Item",
      brand: "Unknown",
      category: "Misc",
      purchaseCost: -100,
      sellingPrice: 200,
      wholesalePrice: 150,
      quantity: 1,
    };
    const result = ProductSchema.safeParse(badProduct);
    expect(result.success).toBe(false);
  });

  it("validates correct customer data", () => {
    const validCust = {
      firstName: "James",
      lastName: "Bond",
      mobile: "+639170070007",
      email: "bond@mi6.gov.uk",
    };
    const result = CustomerSchema.safeParse(validCust);
    expect(result.success).toBe(true);
  });

  it("validates settings maps", () => {
    const validSettings = {
      appName: "EasyPOS Store Dashboard",
      taxRate: 12,
      currency: "PHP",
      timezone: "Asia/Manila",
    };
    const result = SettingSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });
});
