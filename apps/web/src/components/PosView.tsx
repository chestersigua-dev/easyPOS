import React, { useState, useEffect, useRef } from "react";
import { Search, ShoppingCart, Trash2, Tag, UserPlus, CreditCard, Gift, Pause, Play, Printer, Check, RefreshCw } from "lucide-react";
import confetti from "canvas-confetti";
import { api } from "../services/api";
import { useCartStore } from "../store/cart";

export function PosView() {
  const {
    items,
    discount,
    customer,
    heldTransactions,
    addToCart,
    removeFromCart,
    updateQty,
    updatePrice,
    setDiscount,
    setCustomer,
    holdSale,
    resumeSale,
    clearCart,
  } = useCartStore();

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Split-payment state
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentType, setPaymentType] = useState<string>("CASH");
  const [payments, setPayments] = useState<any[]>([{ amount: 0, type: "CASH", reference: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);

  // New customer registration modal
  const [showCustModal, setShowCustModal] = useState(false);
  const [newCust, setNewCust] = useState({ firstName: "", lastName: "", mobile: "", email: "" });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Hotkey focus barcode scanner (Alt+F or Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, custRes] = await Promise.all([
        api.get("/products"),
        api.get("/customers"),
      ]);
      setProducts(prodRes.data);
      setCustomers(custRes.data);
    } catch (err) {
      console.error("Failed to load products/customers in POS:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter products by search query
  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.status === "ACTIVE" &&
      p.quantity > 0 &&
      (p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.includes(query)) ||
        p.brand.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query))
    );
  });

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.12 * 100) / 100; // 12% standard
  const total = Math.max(0, subtotal + tax - discount);

  // Handle barcode scanning matching exactly
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const match = products.find(
      (p) =>
        p.status === "ACTIVE" &&
        p.quantity > 0 &&
        ((p.barcode && p.barcode === searchQuery) || p.sku.toLowerCase() === searchQuery.toLowerCase())
    );

    if (match) {
      addToCart(match);
      setSearchQuery("");
    }
  };

  // Add customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/customers", newCust);
      setCustomers([res.data, ...customers]);
      setCustomer(res.data);
      setShowCustModal(false);
      setNewCust({ firstName: "", lastName: "", mobile: "", email: "" });
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create customer");
    }
  };

  // Pre-fill payment modal amounts
  const openPaymentModal = () => {
    setPayments([{ amount: total, type: "CASH", reference: "" }]);
    setShowPayModal(true);
  };

  // Submit sale transaction to API
  const handleCheckout = async () => {
    setSubmitting(true);
    try {
      const salePayload = {
        customerId: customer?.id || null,
        subtotal,
        tax,
        discount,
        total,
        paymentType: payments.length > 1 ? "SPLIT" : payments[0].type,
        status: "COMPLETED",
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          price: it.price,
          serialNo: it.serialNo || null,
          warranty: it.warranty || null,
        })),
        payments: payments.map((p) => ({
          amount: parseFloat(p.amount),
          type: p.type,
          reference: p.reference || null,
        })),
      };

      const res = await api.post("/sales", salePayload);
      setCreatedInvoice(res.data);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      clearCart();
      setShowPayModal(false);
      loadData(); // reload inventory counts
    } catch (err: any) {
      alert(err.response?.data?.error || "Transaction checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = (invoiceId: string) => {
    window.open(`/api/v1/sales/${invoiceId}/receipt`, "_blank");
  };

  return (
    <div className="grid h-[calc(100vh-140px)] gap-6 lg:grid-cols-5">
      {/* Products list panel */}
      <div className="lg:col-span-3 flex flex-col space-y-4 h-full overflow-hidden">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products by SKU, name, brand, or scan barcode (Alt+F)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
          >
            Enter
          </button>
        </form>

        <div className="flex-1 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-sky-500" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-sky-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="text-xs font-semibold text-sky-500">{p.brand}</div>
                  <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 h-10">
                    {p.name}
                  </div>
                  <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    SKU: <span className="font-mono text-[10px]">{p.sku}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      P{p.sellingPrice.toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        p.quantity <= p.reorderLevel
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      Qty: {p.quantity}
                    </span>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-3 text-center py-10 text-xs text-slate-400">
                  No match found or product out of stock.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cart details checkout panel */}
      <div className="lg:col-span-2 flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 h-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-sky-500" />
            <h2 className="text-lg font-bold">Checkout Cart</h2>
          </div>
          <button
            onClick={clearCart}
            disabled={items.length === 0}
            className="text-xs font-semibold text-rose-500 hover:text-rose-600 disabled:opacity-50"
          >
            Clear All
          </button>
        </div>

        {/* Selected Customer & Actions */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <select
              value={customer?.id || ""}
              onChange={(e) => {
                const found = customers.find((c) => c.id === e.target.value);
                setCustomer(found || null);
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">-- Select Customer (Walk-in) --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.id})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowCustModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
          >
            <UserPlus className="h-3.5 w-3.5" /> New
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-2">
          {items.map((item) => (
            <div
              key={item.productId + (item.serialNo || "")}
              className="flex items-start justify-between gap-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-950"
            >
              <div className="flex-1">
                <div className="text-xs font-bold">{item.name}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  SKU: {item.sku}
                </div>
                {/* Serial number selection if product has serialNumbers */}
                {item.serialNo && (
                  <div className="text-[10px] bg-sky-500/10 text-sky-500 font-semibold px-2 py-0.5 rounded w-fit mt-1">
                    SN: {item.serialNo}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(item.productId, item.quantity - 1)}
                    className="h-5 w-5 rounded bg-slate-200 text-xs font-bold hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    -
                  </button>
                  <span className="text-xs font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.productId, item.quantity + 1)}
                    className="h-5 w-5 rounded bg-slate-200 text-xs font-bold hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    +
                  </button>
                </div>
                <div className="text-xs font-bold">
                  P{(item.price * item.quantity).toLocaleString()}
                </div>
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-rose-500 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <ShoppingCart className="h-8 w-8 text-slate-300" />
              <p className="text-xs text-slate-400 mt-2">Shopping cart is empty.</p>
            </div>
          )}
        </div>

        {/* Pricing Summary */}
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800 space-y-2">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Subtotal</span>
            <span>P{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>VAT (12%)</span>
            <span>P{tax.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Discount (P)</span>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-20 rounded border border-slate-200 px-2 py-0.5 text-right text-xs outline-none dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-bold dark:border-slate-800">
            <span>Total Amount</span>
            <span>P{total.toLocaleString()}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <button
            onClick={() => holdSale("")}
            disabled={items.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-950"
          >
            <Pause className="h-3.5 w-3.5" /> Suspend
          </button>
          <button
            onClick={openPaymentModal}
            disabled={items.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 py-3 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50"
          >
            <CreditCard className="h-3.5 w-3.5" /> Pay Now
          </button>
        </div>

        {/* Suspended Holds Resume list */}
        {heldTransactions.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Suspended Sales ({heldTransactions.length})
            </h4>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {heldTransactions.map((h) => (
                <button
                  key={h.id}
                  onClick={() => resumeSale(h.id)}
                  className="flex shrink-0 items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-sky-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-sky-950"
                >
                  <Play className="h-2.5 w-2.5" /> {h.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invoice Created Notification Success Banner */}
      {createdInvoice && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 rounded-xl border border-sky-100 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold">Checkout Successful!</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Invoice: {createdInvoice.invoiceNo}</div>
          </div>
          <button
            onClick={() => {
              printReceipt(createdInvoice.id);
              setCreatedInvoice(null);
            }}
            className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-sky-600"
          >
            <Printer className="h-3 w-3" /> Print Receipt
          </button>
        </div>
      )}

      {/* Payment / Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold">Select Payment Methods</h3>
            <p className="text-xs text-slate-500 mt-1">Total due: P{total.toLocaleString()}</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400">Payment Type</label>
                <select
                  value={payments[0].type}
                  onChange={(e) => {
                    const newPays = [...payments];
                    newPays[0].type = e.target.value;
                    setPayments(newPays);
                  }}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="CASH">Cash</option>
                  <option value="GCASH">GCash</option>
                  <option value="MAYA">Maya</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              {payments[0].type !== "CASH" && (
                <div>
                  <label className="text-xs font-semibold text-slate-400">Transaction Reference No.</label>
                  <input
                    type="text"
                    value={payments[0].reference || ""}
                    onChange={(e) => {
                      const newPays = [...payments];
                      newPays[0].reference = e.target.value;
                      setPayments(newPays);
                    }}
                    placeholder="Ref # (Optional)"
                    className="w-full mt-1 rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                onClick={() => setShowPayModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={submitting}
                className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600"
              >
                {submitting ? "Processing..." : "Complete Sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Create Modal */}
      {showCustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleCreateCustomer}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <h3 className="text-lg font-bold">Register Customer</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">First Name</label>
                <input
                  type="text"
                  required
                  value={newCust.firstName}
                  onChange={(e) => setNewCust({ ...newCust, firstName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Last Name</label>
                <input
                  type="text"
                  required
                  value={newCust.lastName}
                  onChange={(e) => setNewCust({ ...newCust, lastName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Mobile Number</label>
              <input
                type="text"
                required
                value={newCust.mobile}
                onChange={(e) => setNewCust({ ...newCust, mobile: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Email (Optional)</label>
              <input
                type="email"
                value={newCust.email}
                onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCustModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
