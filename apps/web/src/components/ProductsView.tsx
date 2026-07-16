import React, { useEffect, useState } from "react";
import { Plus, Search, FileDown, FileUp, Cpu, RefreshCw, AlertTriangle, ArrowUpDown } from "lucide-react";
import { api } from "../services/api";

export function ProductsView() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);

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
  });

  // Stock adjustment modal
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjData, setAdjData] = useState({ productId: "", type: "IN", quantity: 1, reason: "" });

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

  useEffect(() => {
    loadProducts();
  }, [search, lowStock]);

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
    });
    setShowModal(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setFormData({ ...p });
    setShowModal(true);
  };

  const openAdjModal = (p: any) => {
    setAdjData({ productId: p.id, type: "IN", quantity: 1, reason: "" });
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

      {/* Filters and search */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SKU, name, brand, category..."
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
              <th className="p-4 text-center">Qty / Status</th>
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
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{p.sku}</div>
                  <div className="text-[10px] text-slate-400">{p.barcode || "No Barcode"}</div>
                </td>
                <td className="p-4 font-bold text-slate-900 dark:text-slate-100 max-w-xs truncate">{p.name}</td>
                <td className="p-4 text-slate-500">{p.brand}</td>
                <td className="p-4 text-slate-500">{p.category}</td>
                <td className="p-4 text-right font-mono">P{p.purchaseCost.toLocaleString()}</td>
                <td className="p-4 text-right font-mono font-bold">P{p.sellingPrice.toLocaleString()}</td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full ${
                        p.quantity <= p.reorderLevel
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {p.quantity}
                    </span>
                    {p.quantity <= p.reorderLevel && (
                      <span title="Low Stock Warning">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{p.status}</div>
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="serialized"
                checked={formData.serialized}
                onChange={(e) => setFormData({ ...formData, serialized: e.target.checked })}
                className="rounded border-slate-200 text-sky-500"
              />
              <label htmlFor="serialized" className="text-xs font-semibold text-slate-500">
                Serialized Product (Requires serial number entries during purchase)
              </label>
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
