import React, { useEffect, useState } from "react";
import { Plus, Search, FileDown, FileUp, Cpu, RefreshCw, AlertTriangle, ArrowUpDown, ArrowLeftRight, History, Send } from "lucide-react";
import { api } from "../services/api";

export function ProductsView() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);

  // Tab switcher
  const [activeSubTab, setActiveSubTab] = useState<"REGISTRY" | "TRANSFERS">("REGISTRY");

  // Stores and transfers state
  const [stores, setStores] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transferFormData, setTransferFormData] = useState({
    sourceStoreId: "",
    targetStoreId: "",
    productId: "",
    quantity: 1,
  });
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Edit / Add modal
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    sku: "",
    barcode: "",
    name: "",
    brand: "",
    category: "",
    description: "",
    purchaseCost: 0,
    sellingPrice: 0,
    wholesalePrice: 0,
    quantity: 0,
    minStock: 5,
    maxStock: 100,
    reorderLevel: 10,
    warranty: "",
    location: "",
    serialized: false,
    taxable: true,
  });

  // Stock adjustment modal
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjData, setAdjData] = useState({ productId: "", type: "IN", quantity: 1, reason: "", storeId: "" });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products?search=${search}&lowStock=${lowStock}`);
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadStoresAndTransfers = async () => {
    try {
      const [storeRes, transRes] = await Promise.all([
        api.get("/stores"),
        api.get("/transfers"),
      ]);
      setStores(storeRes.data);
      setTransfers(transRes.data);
      if (storeRes.data && storeRes.data.length > 0) {
        setTransferFormData((prev) => ({
          ...prev,
          sourceStoreId: prev.sourceStoreId || storeRes.data[0].id,
          targetStoreId: prev.targetStoreId || (storeRes.data[1] ? storeRes.data[1].id : storeRes.data[0].id),
        }));
      }
    } catch (err) {
      console.error("Failed to load stores or transfers:", err);
    }
  };

  useEffect(() => {
    loadProducts();
    loadStoresAndTransfers();
  }, [search, lowStock, activeSubTab]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      sku: "",
      barcode: "",
      name: "",
      brand: "",
      category: "",
      description: "",
      purchaseCost: 0,
      sellingPrice: 0,
      wholesalePrice: 0,
      quantity: 0,
      minStock: 5,
      maxStock: 100,
      reorderLevel: 10,
      warranty: "",
      location: "",
      serialized: false,
      taxable: true,
      storeId: stores[0]?.id || "",
    });
    setShowModal(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setFormData({
      ...p,
      storeId: p.storeInventories?.[0]?.storeId || stores[0]?.id || "",
    });
    setShowModal(true);
  };

  const openAdjModal = (p: any) => {
    setAdjData({ productId: p.id, type: "IN", quantity: 1, reason: "", storeId: stores[0]?.id || "" });
    setShowAdjModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        purchaseCost: parseFloat(formData.purchaseCost),
        sellingPrice: parseFloat(formData.sellingPrice),
        wholesalePrice: parseFloat(formData.wholesalePrice),
        quantity: parseInt(formData.quantity, 10),
        minStock: parseInt(formData.minStock, 10),
        maxStock: parseInt(formData.maxStock, 10),
        reorderLevel: parseInt(formData.reorderLevel, 10),
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      setShowModal(false);
      loadProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save product");
    }
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/products/adjust", {
        ...adjData,
        quantity: parseInt(adjData.quantity as any, 10),
      });
      setShowAdjModal(false);
      loadProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Stock adjustment failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await api.delete(`/products/${id}`);
      loadProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferFormData.sourceStoreId === transferFormData.targetStoreId) {
      alert("Source and target store locations cannot be the same.");
      return;
    }
    setSubmittingTransfer(true);
    try {
      await api.post("/transfers", {
        ...transferFormData,
        quantity: parseInt(transferFormData.quantity as any, 10),
      });
      alert("Inventory transfer executed successfully!");
      setTransferFormData((prev) => ({ ...prev, quantity: 1 }));
      loadStoresAndTransfers();
      loadProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Transfer failed");
    } finally {
      setSubmittingTransfer(false);
    }
  };

  // Import file handler
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append("file", file);

    try {
      await api.post("/products/import", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Spreadsheet imported successfully!");
      loadProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Import failed");
    }
  };

  const handleExport = () => {
    window.open("/api/v1/products/export", "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products & Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Catalog database, serialized items, reorder triggers, and stock movement logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
            <FileUp className="h-3.5 w-3.5" /> Import spreadsheet
            <input type="file" onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden" />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
          >
            <FileDown className="h-3.5 w-3.5" /> Export catalog
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Sub-tab selection */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveSubTab("REGISTRY")}
          className={`flex items-center gap-1.5 py-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === "REGISTRY"
              ? "border-sky-500 text-sky-500"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Cpu className="h-4 w-4" /> Stock Registry
        </button>
        <button
          onClick={() => setActiveSubTab("TRANSFERS")}
          className={`flex items-center gap-1.5 py-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === "TRANSFERS"
              ? "border-sky-500 text-sky-500"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" /> Stock Transfers
        </button>
      </div>

      {activeSubTab === "REGISTRY" ? (
        <>
          {/* Filters and search */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by SKU, name, brand, category, store/branch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-10 pr-4 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-950"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={lowStock}
                  onChange={(e) => setLowStock(e.target.checked)}
                  className="rounded border-slate-200 text-sky-500 dark:border-slate-800 dark:bg-slate-950"
                />
                Show Low Stock Alerts
              </label>
            </div>
          </div>

          {/* Grid listing */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  <th className="p-4">SKU / Barcode</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Brand</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 text-right">Purchase Cost</th>
                  <th className="p-4 text-right">Selling Price</th>
                  <th className="p-4 text-center">Qty / Location Stocks</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-sky-500" />
                    </td>
                  </tr>
                ) : products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td className="p-4">
                      <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {p.sku}
                        {p.taxable === false && (
                          <span className="ml-1.5 px-1 py-0.2 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 rounded text-[8px] font-bold">
                            NON-TAXABLE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{p.barcode || "No Barcode"}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">{p.name}</td>
                    <td className="p-4 text-slate-500">{p.brand}</td>
                    <td className="p-4 text-slate-500">{p.category}</td>
                    <td className="p-4 text-right font-mono">P{p.purchaseCost.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono font-bold">P{p.sellingPrice.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-full ${
                              p.quantity <= p.reorderLevel
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            }`}
                          >
                            Total: {p.quantity}
                          </span>
                          {p.quantity <= p.reorderLevel && (
                            <span title="Low Stock Warning">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                        {/* Per-store allocations display list */}
                        {p.storeInventories && p.storeInventories.length > 0 && (
                          <div className="text-[9px] text-slate-400 space-y-0.5 font-semibold mt-1 w-full max-w-[150px]">
                            {p.storeInventories.map((inv: any) => (
                              <div key={inv.id} className="flex justify-between border-t border-slate-100/50 dark:border-slate-800/50 pt-0.5">
                                <span className="truncate pr-1 text-slate-500 dark:text-slate-450">{inv.store.name}</span>
                                <span className="text-slate-700 dark:text-slate-300 font-bold">{inv.quantity}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-1">{p.status}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openAdjModal(p)}
                          className="rounded bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-600 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="rounded bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="rounded bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      No products registered in this catalog database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Create Transfer panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 h-fit space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-150">New Stock Transfer</h3>
              <p className="text-[11px] text-slate-400">Move inventory stock quantities between branch outlets.</p>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Source Store (From)</label>
                <select
                  required
                  value={transferFormData.sourceStoreId}
                  onChange={(e) => setTransferFormData({ ...transferFormData, sourceStoreId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 dark:border-slate-800 dark:bg-slate-950 font-semibold"
                >
                  <option value="">-- Select Source Branch --</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>🏢 {s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Store (To)</label>
                <select
                  required
                  value={transferFormData.targetStoreId}
                  onChange={(e) => setTransferFormData({ ...transferFormData, targetStoreId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 dark:border-slate-800 dark:bg-slate-950 font-semibold"
                >
                  <option value="">-- Select Target Branch --</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>🏢 {s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Product</label>
                <select
                  required
                  value={transferFormData.productId}
                  onChange={(e) => setTransferFormData({ ...transferFormData, productId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">-- Select Product --</option>
                  {products.map((p) => {
                    const srcQty = p.storeInventories?.find((i: any) => i.storeId === transferFormData.sourceStoreId)?.quantity ?? 0;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} (SKU: {p.sku}) [Avail: {srcQty}]
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity to Move</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={transferFormData.quantity}
                  onChange={(e) => setTransferFormData({ ...transferFormData, quantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 dark:border-slate-800 dark:bg-slate-950 font-mono font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={submittingTransfer}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2.5 text-xs font-bold text-white hover:bg-sky-600 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {submittingTransfer ? "Executing..." : "Execute Stock Transfer"}
              </button>
            </form>
          </div>

          {/* Transfers History List */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5 text-slate-850 dark:text-slate-100">
                <History className="h-4.5 w-4.5 text-sky-500" />
                <span>Stock Transfer Audit Log</span>
              </h3>
              <p className="text-[11px] text-slate-400">Archived register of past inventory stock movements between stores.</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                    <th className="p-3">Transfer Date</th>
                    <th className="p-3">Product Info</th>
                    <th className="p-3">From Location</th>
                    <th className="p-3">To Location</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400">
                        No stock transfers recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="p-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{t.product.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">SKU: {t.product.sku}</div>
                        </td>
                        <td className="p-3 font-semibold text-rose-600 dark:text-rose-405">{t.sourceStore.name}</td>
                        <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-405">{t.targetStore.name}</td>
                        <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-150">{t.quantity}</td>
                        <td className="p-3 text-slate-500 truncate max-w-[120px]" title={t.createdBy}>{t.createdBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold">{editingProduct ? "Edit Product" : "Add Product"}</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Product SKU *</label>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Barcode</label>
                <input
                  type="text"
                  value={formData.barcode || ""}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Product Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Brand *</label>
                <input
                  type="text"
                  required
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Category *</label>
                <input
                  type="text"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Purchase Cost *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchaseCost}
                  onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Wholesale Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.wholesalePrice}
                  onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Qty *</label>
                <input
                  type="number"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Reorder Level</label>
                <input
                  type="number"
                  required
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Min Stock</label>
                <input
                  type="number"
                  required
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Max Stock</label>
                <input
                  type="number"
                  required
                  value={formData.maxStock}
                  onChange={(e) => setFormData({ ...formData, maxStock: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Warranty</label>
                <input
                  type="text"
                  value={formData.warranty || ""}
                  onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Shelf Location</label>
                <input
                  type="text"
                  value={formData.location || ""}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Target Store Branch *</label>
                <select
                  required
                  value={formData.storeId || ""}
                  onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">-- Choose Branch --</option>
                  {stores.map((st) => (
                    <option key={st.id} value={st.id}>
                      🏢 {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="taxable"
                  checked={formData.taxable !== false}
                  onChange={(e) => setFormData({ ...formData, taxable: e.target.checked })}
                  className="rounded border-slate-200 text-sky-500 h-4 w-4"
                />
                <label htmlFor="taxable" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                  Taxable Item (12% VAT)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="serialized"
                  checked={formData.serialized}
                  onChange={(e) => setFormData({ ...formData, serialized: e.target.checked })}
                  className="rounded border-slate-200 text-sky-500 h-4 w-4"
                />
                <label htmlFor="serialized" className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                  Serialized Product
                </label>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Description</label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Save Product
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleAdjustment}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <h3 className="text-lg font-bold">Approved Stock Adjustment</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Adjustment Type</label>
                <select
                  value={adjData.type}
                  onChange={(e) => setAdjData({ ...adjData, type: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="IN">Stock In (+)</option>
                  <option value="OUT">Stock Out (-)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Adjustment Quantity</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={adjData.quantity}
                  onChange={(e) => setAdjData({ ...adjData, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Branch to Adjust *</label>
              <select
                required
                value={(adjData as any).storeId || ""}
                onChange={(e) => setAdjData({ ...adjData, storeId: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="">-- Choose Branch --</option>
                {stores.map((st) => (
                  <option key={st.id} value={st.id}>
                    🏢 {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Reason / Description *</label>
              <input
                type="text"
                required
                value={adjData.reason}
                onChange={(e) => setAdjData({ ...adjData, reason: e.target.value })}
                placeholder="e.g. Audit check deficit, damaged transit, etc."
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAdjModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Apply Adjustment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
