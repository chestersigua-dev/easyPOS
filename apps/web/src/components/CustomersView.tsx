import React, { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  RefreshCw, 
  ShoppingBag, 
  Wrench, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Cake, 
  Award, 
  FileText, 
  Sparkles 
} from "lucide-react";
import { api } from "../services/api";

export function CustomersView() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [selectedCust, setSelectedCust] = useState<any>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [repairHistory, setRepairHistory] = useState<any[]>([]);

  // Modals & Validation Errors
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [errors, setErrors] = useState<any>({});
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
    status: "ACTIVE",
  });

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/customers?search=${search}`);
      setCustomers(res.data);
      // Auto-update selected customer data to reflect edit changes
      if (selectedCust) {
        const updatedSelected = res.data.find((c: any) => c.id === selectedCust.id);
        if (updatedSelected) {
          setSelectedCust(updatedSelected);
        }
      }
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
    setErrors({});
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
      status: "ACTIVE",
    });
    setShowModal(true);
  };

  const openEditModal = (cust: any) => {
    setEditingCustomer(cust);
    setErrors({});
    setFormData({
      firstName: cust.firstName || "",
      lastName: cust.lastName || "",
      middleName: cust.middleName || "",
      mobile: cust.mobile || "",
      email: cust.email || "",
      address: cust.address || "",
      city: cust.city || "",
      province: cust.province || "",
      birthday: cust.birthday ? cust.birthday.slice(0, 10) : "",
      gender: cust.gender || "Male",
      notes: cust.notes || "",
      status: cust.status || "ACTIVE",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, formData);
      } else {
        await api.post("/customers", formData);
      }
      setShowModal(false);
      loadCustomers();
    } catch (err: any) {
      if (err.response?.data?.error?.fieldErrors) {
        setErrors(err.response.data.error.fieldErrors);
      } else {
        alert(err.response?.data?.error || "Failed to save customer");
      }
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

  // Helper: Determine loyalty membership tier
  const getLoyaltyTier = (points: number) => {
    if (points >= 1000) {
      return { 
        name: "Platinum Member", 
        color: "text-slate-950 bg-slate-100 border-slate-350 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700", 
        bgGrad: "from-slate-100 via-slate-200 to-slate-350 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950" 
      };
    }
    if (points >= 500) {
      return { 
        name: "Gold Member", 
        color: "text-amber-800 bg-amber-50 border-amber-300 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30", 
        bgGrad: "from-amber-100 via-amber-200 to-yellow-300 dark:from-amber-950/40 dark:to-yellow-900/20" 
      };
    }
    if (points >= 100) {
      return { 
        name: "Silver Member", 
        color: "text-slate-650 bg-slate-50 border-slate-250 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", 
        bgGrad: "from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900" 
      };
    }
    return { 
      name: "Bronze Member", 
      color: "text-amber-700 bg-orange-50/50 border-amber-200 dark:bg-amber-950/10 dark:text-amber-550 dark:border-amber-900/20", 
      bgGrad: "from-orange-50 to-amber-100 dark:from-orange-950/20 dark:to-amber-900/10" 
    };
  };

  // Helper: Progress to next milestone tier
  const getTierProgress = (points: number) => {
    if (points >= 1000) return { percent: 100, nextMilestone: null };
    if (points >= 500) return { percent: ((points - 500) / 500) * 100, nextMilestone: 1000 };
    if (points >= 100) return { percent: ((points - 100) / 400) * 100, nextMilestone: 500 };
    return { percent: (points / 100) * 100, nextMilestone: 100 };
  };

  // Helper: Calculate age from birthdate
  const calculateAge = (birthdayStr: string) => {
    if (!birthdayStr) return null;
    try {
      const birthday = new Date(birthdayStr);
      const ageDifMs = Date.now() - birthday.getTime();
      const ageDate = new Date(ageDifMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
    } catch {
      return null;
    }
  };

  // PDF Download Trigger via Axios (attaches Authorization Bearer Header)
  const viewReceiptPdf = async (saleId: string) => {
    try {
      const response = await api.get(`/sales/${saleId}/receipt`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Failed to fetch receipt PDF:", err);
      alert("Failed to load receipt PDF.");
    }
  };

  const viewRepairPdf = async (ticketId: string) => {
    try {
      const response = await api.get(`/repairs/${ticketId}/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Failed to fetch repair PDF:", err);
      alert("Failed to load repair PDF.");
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
            className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Profile
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, name, email, or phone number..."
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
                  className={`cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors ${
                    selectedCust?.id === c.id ? "bg-sky-500/5 dark:bg-sky-950/20" : ""
                  }`}
                >
                  <td className="p-3 font-mono font-bold text-slate-950 dark:text-slate-200">{c.id}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-2">
                      <span>{c.firstName} {c.lastName}</span>
                      {c.loyaltyPoints >= 100 && (
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold tracking-wider ${
                          c.loyaltyPoints >= 1000 
                            ? "bg-slate-250 text-slate-800 dark:bg-slate-850 dark:text-slate-300" 
                            : c.loyaltyPoints >= 500 
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                          {c.loyaltyPoints >= 1000 ? "PLATINUM" : c.loyaltyPoints >= 500 ? "GOLD" : "SILVER"}
                        </span>
                      )}
                    </div>
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
            {/* Profile Card Header */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 p-5 text-white shadow-md border border-slate-200/10">
              {/* Dynamic Tier Background Glow */}
              <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-20 blur-xl ${getLoyaltyTier(selectedCust.loyaltyPoints).bgGrad}`} />
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xl font-bold uppercase shadow-md">
                  {selectedCust.firstName[0]}{selectedCust.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-extrabold tracking-tight">
                    {selectedCust.firstName} {selectedCust.middleName ? `${selectedCust.middleName} ` : ""}{selectedCust.lastName}
                  </h3>
                  <p className="font-mono text-[10px] text-slate-400 mt-0.5">{selectedCust.id}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase ${
                      selectedCust.status === "ACTIVE" 
                        ? "bg-emerald-500/20 text-emerald-450 border border-emerald-500/30" 
                        : "bg-rose-500/20 text-rose-450 border border-rose-500/30"
                    }`}>
                      {selectedCust.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase border ${getLoyaltyTier(selectedCust.loyaltyPoints).color}`}>
                      {getLoyaltyTier(selectedCust.loyaltyPoints).name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-4 border-t border-white/10 flex justify-end gap-2 relative z-10">
                <button
                  onClick={() => openEditModal(selectedCust)}
                  className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1 text-[10px] font-bold text-white hover:bg-white/20 transition-all"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => handleDelete(selectedCust.id)}
                  className="rounded-lg bg-rose-600/80 border border-rose-500/20 px-3 py-1 text-[10px] font-bold text-white hover:bg-rose-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Loyalty Program Section */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-350">
                  <Award className="h-4 w-4 text-sky-500" />
                  <span>LOYALTY BALANCE</span>
                </div>
                <span className="font-mono text-xs font-extrabold text-sky-650 dark:text-sky-400">
                  {selectedCust.loyaltyPoints} PTS
                </span>
              </div>

              {/* Progress bar towards next tier */}
              {(() => {
                const { percent, nextMilestone } = getTierProgress(selectedCust.loyaltyPoints);
                return (
                  <div className="space-y-1.5">
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-505"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    {nextMilestone ? (
                      <div className="flex justify-between text-[9px] text-slate-400 font-semibold">
                        <span>{nextMilestone - selectedCust.loyaltyPoints} points to next tier</span>
                        <span>{nextMilestone} PTS</span>
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-450 font-semibold flex items-center gap-0.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>Maximum level achieved</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Profile Grid Details */}
            <div className="space-y-3.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demographics & Contact Info</h4>
              
              <div className="grid gap-3.5 text-xs">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Mobile Phone</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-200">{selectedCust.mobile}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Email Address</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-200 truncate">
                      {selectedCust.email || "No email registered"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Gender</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-200">{selectedCust.gender || "Unspecified"}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Cake className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Birthday</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-200">
                        {selectedCust.birthday 
                          ? `${new Date(selectedCust.birthday).toLocaleDateString()} (${calculateAge(selectedCust.birthday)} y/o)`
                          : "Unspecified"
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Address / Location</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-200 leading-relaxed">
                      {selectedCust.address || selectedCust.city || selectedCust.province
                        ? [selectedCust.address, selectedCust.city, selectedCust.province].filter(Boolean).join(", ")
                        : "No address registered"
                      }
                    </div>
                  </div>
                </div>

                {selectedCust.notes && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Notes / Preferences</div>
                      <div className="text-slate-605 dark:text-slate-350 italic mt-1 leading-relaxed bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800">
                        "{selectedCust.notes}"
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Purchase History */}
            <div className="space-y-3.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <h4 className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <ShoppingBag className="h-3.5 w-3.5" /> Purchase Log ({purchaseHistory.length})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {purchaseHistory.map((s) => (
                  <div key={s.id} className="group bg-slate-50 border border-slate-100 hover:border-slate-200 dark:border-slate-800/60 p-3 rounded-lg dark:bg-slate-950/40 text-[11px] flex justify-between items-center transition-all">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{s.invoiceNo}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className="font-extrabold text-slate-950 dark:text-slate-100">
                          P{s.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{s.paymentType}</div>
                      </div>
                      <button
                        onClick={() => viewReceiptPdf(s.id)}
                        className="opacity-80 hover:opacity-100 text-sky-500 hover:text-sky-650 transition-colors p-1"
                        title="View Receipt PDF"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {purchaseHistory.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-4 border border-dashed rounded-lg">
                    No transactions registered.
                  </div>
                )}
              </div>
            </div>

            {/* Repair history */}
            <div className="space-y-3.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <h4 className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Wrench className="h-3.5 w-3.5" /> Repair Tickets ({repairHistory.length})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {repairHistory.map((rep) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case "PENDING": return "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-300/30";
                      case "COMPLETED": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-300/30";
                      case "CLAIMED": return "bg-sky-100 text-sky-800 dark:bg-sky-950/30 dark:text-sky-400 border border-sky-300/30";
                      case "CANCELLED": return "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-455 border border-rose-300/30";
                      default: return "bg-slate-100 text-slate-850 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/30";
                    }
                  };
                  return (
                    <div key={rep.id} className="group bg-slate-50 border border-slate-100 hover:border-slate-200 dark:border-slate-800/60 p-3 rounded-lg dark:bg-slate-950/40 text-[11px] flex justify-between items-center transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{rep.ticketNo}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold ${getStatusColor(rep.status)}`}>
                            {rep.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {rep.brand} {rep.model}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="font-extrabold text-slate-950 dark:text-slate-100">
                            P{rep.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            {new Date(rep.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => viewRepairPdf(rep.id)}
                          className="opacity-80 hover:opacity-100 text-sky-500 hover:text-sky-655 transition-colors p-1"
                          title="View Repair PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {repairHistory.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-4 border border-dashed rounded-lg">
                    No repair tickets registered.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-32 text-xs text-slate-400 space-y-3">
            <div className="text-3xl">👤</div>
            <p>Select a customer profile to view metrics and transactional logs.</p>
          </div>
        )}
      </div>

      {/* Profile Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold">{editingCustomer ? "Edit Customer Profile" : "Register Customer"}</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                />
                {errors.firstName && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.firstName.join(", ")}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Middle Name</label>
                <input
                  type="text"
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                />
                {errors.middleName && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.middleName.join(", ")}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                />
                {errors.lastName && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.lastName.join(", ")}</p>
                )}
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
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                />
                {errors.mobile && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.mobile.join(", ")}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                />
                {errors.email && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.email.join(", ")}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.gender.join(", ")}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Birthday</label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                />
                {errors.birthday && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.birthday.join(", ")}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                />
                {errors.address && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.address.join(", ")}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                />
                {errors.city && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.city.join(", ")}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Province</label>
                <input
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                />
                {errors.province && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.province.join(", ")}</p>
                )}
              </div>
            </div>

            {editingCustomer && (
              <div>
                <label className="text-[10px] font-bold text-slate-400">Account Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                {errors.status && (
                  <p className="text-[10px] text-rose-500 mt-1">{errors.status.join(", ")}</p>
                )}
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-400">Notes / Preferences</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 focus:ring-1 focus:ring-sky-500 outline-none focus:border-sky-500"
              />
              {errors.notes && (
                <p className="text-[10px] text-rose-500 mt-1">{errors.notes.join(", ")}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 transition-colors"
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
