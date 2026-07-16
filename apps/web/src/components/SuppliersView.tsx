import React, { useEffect, useState } from "react";
import { Plus, Search, RefreshCw, Mail, Phone, MapPin } from "lucide-react";
import { api } from "../services/api";

export function SuppliersView() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    tin: "",
    notes: "",
    balance: 0,
  });

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/suppliers?search=${search}`);
      setSuppliers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [search]);

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      companyName: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      tin: "",
      notes: "",
      balance: 0,
    });
    setShowModal(true);
  };

  const openEditModal = (sup: any) => {
    setEditingSupplier(sup);
    setFormData({ ...sup });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        balance: parseFloat(formData.balance as any),
      };

      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, payload);
      } else {
        await api.post("/suppliers", payload);
      }
      setShowModal(false);
      loadSuppliers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save supplier");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      await api.delete(`/suppliers/${id}`);
      loadSuppliers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers Directory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            CRUD suppliers database, contact details, notes, and balance indicators.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" /> Add Supplier
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by company name, contact, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 py-1.5 pl-10 pr-4 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-900"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-3 text-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-sky-500" />
          </div>
        ) : suppliers.map((sup) => (
          <div
            key={sup.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-slate-900 dark:text-slate-100">{sup.companyName}</h3>
                <span className="text-[10px] font-bold text-slate-400">TIN: {sup.tin || "N/A"}</span>
              </div>
              <p className="text-xs font-semibold text-sky-500 mt-1">Contact: {sup.contactPerson}</p>

              <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{sup.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{sup.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{sup.address}</span>
                </div>
              </div>

              {sup.notes && (
                <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:border-slate-800">
                  {sup.notes}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance Due</span>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  P{sup.balance.toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(sup)}
                  className="rounded bg-slate-50 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(sup.id)}
                  className="rounded bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {suppliers.length === 0 && !loading && (
          <div className="col-span-3 text-center py-10 text-xs text-slate-400">
            No supplier entries matched.
          </div>
        )}
      </div>

      {/* Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold">{editingSupplier ? "Edit Supplier" : "Register Supplier"}</h3>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Company Name *</label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Contact Person *</label>
                <input
                  type="text"
                  required
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">TIN Number</label>
                <input
                  type="text"
                  value={formData.tin}
                  onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Phone *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Supplier Address *</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Outstanding Balance (P)</label>
              <input
                type="number"
                step="0.01"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800"
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Save Supplier
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
