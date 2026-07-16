import { create } from "zustand";

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  purchaseCost: number;
  quantity: number;
  maxQuantity: number;
  serialNo?: string;
  warranty?: string;
}

interface HeldTransaction {
  id: string;
  name: string;
  items: CartItem[];
  discount: number;
  customer: any | null;
  heldAt: Date;
}

interface CartState {
  items: CartItem[];
  discount: number;
  customer: any | null;
  heldTransactions: HeldTransaction[];
  addToCart: (product: any, serialNo?: string) => void;
  removeFromCart: (productId: string) => void;
  updateQty: (productId: string, quantity: number) => void;
  updatePrice: (productId: string, price: number) => void;
  setDiscount: (discount: number) => void;
  setCustomer: (customer: any | null) => void;
  holdSale: (holdName: string) => void;
  resumeSale: (id: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: 0,
  customer: null,
  heldTransactions: [],

  addToCart: (product, serialNo) => {
    const { items } = get();
    const existingIndex = items.findIndex(
      (item) => item.productId === product.id && item.serialNo === serialNo
    );

    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      set({ items: updated });
    } else {
      set({
        items: [
          ...items,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            price: product.sellingPrice,
            purchaseCost: product.purchaseCost,
            quantity: 1,
            maxQuantity: product.quantity,
            serialNo,
            warranty: product.warranty,
          },
        ],
      });
    }
  },

  removeFromCart: (productId) => {
    set({ items: get().items.filter((item) => item.productId !== productId) });
  },

  updateQty: (productId, quantity) => {
    if (quantity <= 0) return;
    set({
      items: get().items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      ),
    });
  },

  updatePrice: (productId, price) => {
    if (price < 0) return;
    set({
      items: get().items.map((item) =>
        item.productId === productId ? { ...item, price } : item
      ),
    });
  },

  setDiscount: (discount) => {
    set({ discount });
  },

  setCustomer: (customer) => {
    set({ customer });
  },

  holdSale: (name) => {
    const { items, discount, customer, heldTransactions } = get();
    if (items.length === 0) return;

    const newHold: HeldTransaction = {
      id: Math.random().toString(36).substring(7),
      name: name || `Hold #${heldTransactions.length + 1}`,
      items,
      discount,
      customer,
      heldAt: new Date(),
    };

    set({
      heldTransactions: [...heldTransactions, newHold],
      items: [],
      discount: 0,
      customer: null,
    });
  },

  resumeSale: (id) => {
    const { heldTransactions } = get();
    const target = heldTransactions.find((h) => h.id === id);
    if (!target) return;

    set({
      items: target.items,
      discount: target.discount,
      customer: target.customer,
      heldTransactions: heldTransactions.filter((h) => h.id !== id),
    });
  },

  clearCart: () => {
    set({ items: [], discount: 0, customer: null });
  },
}));
