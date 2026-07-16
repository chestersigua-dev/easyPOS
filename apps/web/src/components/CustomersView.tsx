import React, { useEffect, useState } from "react";
import { Plus, Search, RefreshCw, ShoppingBag, Wrench } from "lucide-react";
import { api } from "../services/api";

export function CustomersView() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [selectedCust, setSelectedCust] = useState<any>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [repairHistory, setRepairHistory] = useState<any[]>([]);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    mobile: "",
    email: "",
    address: "",
    city: "",
    province: "",
    birthday: "",
    gender: "Male",
    notes: "",
  });

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/customers?search=${search}`);
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const viewCustomerDetails = async (cust: any) => {
    setSelectedCust(cust);
    try {
      const [salesRes, repairsRes] = await Promise.all([
        api.get(`/customers/${cust.id}/sales`),
        api.get(`/customers/${cust.id}/repairs`),
      ]);
      setPurchaseHistory(salesRes.data);
      setRepairHistory(repairsRes.data);
    } catch (err) {
      console.error("Failed to load customer history:", err);
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      firstName: "",
      lastName: "",
      middleName: "",
      mobile: "",
      email: "",
      address: "",
      city: "",
      province: "",
      birthday: "",
      gender: "Male",
      notes: "",
    });
    setShowModal(true);
  };

  const openEditModal = (cust: any) => {
    setEditingCustomer(cust);
    setFormData({
      ...cust,
      birthday: cust.birthday ? cust.birthday.slice(0, 10) : "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, formData);
      } else {
        await api.post("/customers", formData);
      }
      setShowModal(false);
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save customer");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await api.delete(`/customers/${id}`);
      setSelectedCust(null);
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Left List Pane */}
      <div className="md:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Customer Database</h1>
            <p className="text-xs text-slate-500">Auto-generated IDs, purchase metrics, and loyalty rewards.</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
          >
            <Plus className="h-4 w-4" /> Add Profile
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, name, or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-10 pr-4 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-900"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                <th className="p-3">Customer ID</th>
                <th className="p-3">Full Name</th>
                <th className="p-3">Mobile Phone</th>
                <th className="p-3">Loyalty Points</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-sky-500" />
                  </td>
                </tr>
              ) : customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => viewCustomerDetails(c)}
                  className={`cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/10 ${
                    selectedCust?.id === c.id ? "bg-sky-500/5 dark:bg-sky-950/20" : ""
                  }`}
                >
                  <td className="p-3 font-mono font-bold text-slate-950 dark:text-slate-200">{c.id}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="p-3 text-slate-500">{c.mobile}</td>
                  <td className="p-3 font-bold text-sky-600">{c.loyaltyPoints} PTS</td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Details Pane */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 h-fit space-y-6">
        {selectedCust ? (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-slate-100">
                  {selectedCust.firstName} {selectedCust.lastName}
                </h3>
                <span className="font-mono text-xs text-slate-400">{selectedCust.id}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(selectedCust)}
                  className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 dark:border-slate-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(selectedCust.id)}
                  className="rounded border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-800"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-slate-100 pt-4 dark:border-slate-800">
              <div>
                <span className="font-bold text-slate-400">Mobile:</span> {selectedCust.mobile}
              </div>
              <div>
                <span className="font-bold text-slate-400">Email:</span> {selectedCust.email || "N/A"}
              </div>
              <div>
                <span className="font-bold text-slate-400">Address:</span> {selectedCust.address || "N/A"}
              </div>
              {selectedCust.notes && (
                <div>
                  <span className="font-bold text-slate-400">Notes:</span> {selectedCust.notes}
                </div>
              )}
            </div>

            {/* Purchase History */}
            <div className="space-y-2">
              <h4 className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <ShoppingBag className="h-3.5 w-3.5" /> Purchase Log ({purchaseHistory.length})
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {purchaseHistory.map((s) => (
                  <div key={s.id} className="bg-slate-50 p-2.5 rounded-lg dark:bg-slate-950 text-[10px]">
                    <div className="flex justify-between font-bold">
                      <span>{s.invoiceNo}</span>
                      <span>P{s.total.toLocaleString()}</span>
                    </div>
                    <div className="text-slate-400 mt-0.5">{new Date(s.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
                {purchaseHistory.length === 0 && (
                  <div className="text-[10px] text-slate-400 text-center py-2">No purchases logged.</div>
                )}
              </div>
            </div>

            {/* Repair history */}
            <div className="space-y-2">
              <h4 className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Wrench className="h-3.5 w-3.5" /> Repair Tickets ({repairHistory.length})
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {repairHistory.map((rep) => (
                  <div key={rep.id} className="bg-slate-50 p-2.5 rounded-lg dark:bg-slate-950 text-[10px]">
                    <div className="flex justify-between font-bold">
                      <span>{rep.ticketNo}</span>
                      <span>{rep.status}</span>
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {rep.brand} {rep.model} - Cost: P{rep.cost}
                    </div>
                  </div>
                ))}
                {repairHistory.length === 0 && (
                  <div className="text-[10px] text-slate-400 text-center py-2">No repairs logged.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-xs text-slate-400">
            Select a customer profile to view metrics and transactional logs.
          </div>
        )}
      </div>

      {/* Profile Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold">{editingCustomer ? "Edit Customer" : "Register Customer"}</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Mobile Phone *</label>
                <input
                  type="text"
                  required
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Birthday</label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Notes / Preferences</label>
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
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
