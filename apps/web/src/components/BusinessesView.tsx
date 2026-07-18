import React, { useState, useEffect } from "react";
import {
  Building,
  Plus,
  Trash2,
  Edit,
  Globe,
  Calendar,
  User,
  CreditCard,
  Layers,
  MapPin,
  RefreshCw,
  Lock,
  X,
  FileText
} from "lucide-react";
import { api } from "../services/api";
import { useToastStore } from "../store/toast";

export function BusinessesView() {
  const addToast = useToastStore((state) => state.addToast);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Business details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailedBusiness, setDetailedBusiness] = useState<any>(null);

  const openDetailsModal = (biz: any) => {
    setDetailedBusiness(biz);
    setShowDetailsModal(true);
  };

  // Editing business state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [plan, setPlan] = useState("ENTERPRISE");
  const [status, setStatus] = useState("ACTIVE");
  const [sla, setSla] = useState("STANDARD");
  const [ownerName, setOwnerName] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");

  // License Expiry Selectors
  const [expiryOption, setExpiryOption] = useState("1_YEAR");
  const [customExpiryDate, setCustomExpiryDate] = useState("");

  // Localization settings
  const [currency, setCurrency] = useState("PHP");
  const [taxRate, setTaxRate] = useState("12");
  const [timezone, setTimezone] = useState("Asia/Manila");
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");

  // Admin Credentials Creation Options
  const [configureAdmin, setConfigureAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");

  // Branch (Store) Management states
  const [showBranchesModal, setShowBranchesModal] = useState(false);
  const [activeTenant, setActiveTenant] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchEditingId, setBranchEditingId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchSubmitting, setBranchSubmitting] = useState(false);

  // Plan Details helper
  const availablePlanModules: { [key: string]: string[] } = {
    STARTER: ["DASHBOARD", "POS", "CUSTOMERS"],
    PROFESSIONAL: ["DASHBOARD", "POS", "PRODUCTS", "CUSTOMERS", "SUPPLIERS"],
    ENTERPRISE: ["DASHBOARD", "POS", "PRODUCTS", "REPAIRS", "CUSTOMERS", "SUPPLIERS", "ACCOUNTING"],
  };

  const [customModules, setCustomModules] = useState<string[]>([
    "DASHBOARD",
    "POS",
    "PRODUCTS",
    "REPAIRS",
    "CUSTOMERS",
    "SUPPLIERS",
    "ACCOUNTING",
  ]);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const res = await api.get("/system/tenants");
      setBusinesses(res.data);
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to load businesses list", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setName("");
    setSubdomain("");
    setPlan("ENTERPRISE");
    setStatus("ACTIVE");
    setSla("STANDARD");
    setOwnerName("");
    setTinNumber("");
    setPhoneNumber("");
    setEmail("");
    setExpiryOption("1_YEAR");
    setCustomExpiryDate("");
    setCurrency("PHP");
    setTaxRate("12");
    setTimezone("Asia/Manila");
    setReceiptHeader("");
    setReceiptFooter("");
    setConfigureAdmin(true); // default to true for new tenants
    setAdminEmail("");
    setAdminPassword("");
    setAdminFirstName("");
    setAdminLastName("");
    setShowModal(true);
  };

  const openEditModal = (biz: any) => {
    setEditingId(biz.id);
    setName(biz.name);
    setSubdomain(biz.subdomain || "");
    setPlan(biz.plan);
    setStatus(biz.status);
    setSla(biz.sla || "STANDARD");
    setOwnerName(biz.ownerName || "");
    setTinNumber(biz.tinNumber || "");
    setPhoneNumber(biz.phoneNumber || "");
    setEmail(biz.email || "");

    // Expiry evaluation
    if (!biz.licenseExpiresAt) {
      setExpiryOption("LIFETIME");
      setCustomExpiryDate("");
    } else {
      setExpiryOption("CUSTOM");
      setCustomExpiryDate(new Date(biz.licenseExpiresAt).toISOString().split("T")[0]);
    }

    // Localization
    const s = biz.settings || {};
    setCurrency(s.CURRENCY || "PHP");
    setTaxRate(s.TAX_RATE || "12");
    setTimezone(s.TIMEZONE || "Asia/Manila");
    setReceiptHeader(s.RECEIPT_HEADER || "");
    setReceiptFooter(s.RECEIPT_FOOTER || "");

    // Admin Credentials (default false/blank for edit)
    setConfigureAdmin(false);
    setAdminEmail(biz.adminEmail || "");
    setAdminPassword("");
    setAdminFirstName("");
    setAdminLastName("");
    setShowModal(true);
  };

  const handleDelete = async (id: string, bizName: string) => {
    if (!confirm(`CAUTION: Are you sure you want to delete ${bizName}? This will permanently purge all sales transactions, inventory records, and user accounts associated with this tenant.`)) return;

    try {
      await api.delete(`/system/tenants/${id}`);
      addToast(`${bizName} has been permanently deleted.`, "success");
      loadBusinesses();
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to delete business", "error");
    }
  };

  // Branch CRUD Logic
  const loadBranches = async (tenantId: string) => {
    setBranchesLoading(true);
    try {
      const res = await api.get(`/system/tenants/${tenantId}/stores`);
      setBranches(res.data);
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to load branches", "error");
    } finally {
      setBranchesLoading(false);
    }
  };

  const openBranchesModal = (biz: any) => {
    setActiveTenant(biz);
    setBranchEditingId(null);
    setBranchName("");
    setBranchAddress("");
    loadBranches(biz.id);
    setShowBranchesModal(true);
  };

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setBranchSubmitting(true);

    try {
      const payload = {
        name: branchName,
        address: branchAddress || null,
      };

      if (branchEditingId) {
        await api.put(`/system/tenants/${activeTenant.id}/stores/${branchEditingId}`, payload);
        addToast("Branch location updated successfully!", "success");
      } else {
        await api.post(`/system/tenants/${activeTenant.id}/stores`, payload);
        addToast("New branch registered successfully!", "success");
      }

      setBranchEditingId(null);
      setBranchName("");
      setBranchAddress("");
      loadBranches(activeTenant.id);
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to save branch", "error");
    } finally {
      setBranchSubmitting(false);
    }
  };

  const handleBranchDelete = async (storeId: string, storeName: string) => {
    if (!activeTenant) return;
    if (!confirm(`Are you sure you want to delete branch "${storeName}"? This will cascade delete its product stock inventories, transfers, and transactions.`)) return;

    try {
      await api.delete(`/system/tenants/${activeTenant.id}/stores/${storeId}`);
      addToast(`Branch "${storeName}" has been successfully deleted.`, "success");
      loadBranches(activeTenant.id);
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to delete branch", "error");
    }
  };

  const editBranch = (store: any) => {
    setBranchEditingId(store.id);
    setBranchName(store.name);
    setBranchAddress(store.address || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Compute licenseExpiresAt based on options
    let licenseExpiresAt: string | null = null;
    if (expiryOption === "1_YEAR") {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      licenseExpiresAt = d.toISOString();
    } else if (expiryOption === "2_YEARS") {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 2);
      licenseExpiresAt = d.toISOString();
    } else if (expiryOption === "5_YEARS") {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 5);
      licenseExpiresAt = d.toISOString();
    } else if (expiryOption === "CUSTOM" && customExpiryDate) {
      licenseExpiresAt = new Date(customExpiryDate).toISOString();
    }

    const payload: any = {
      name,
      subdomain: subdomain || null,
      plan,
      status,
      ownerName: ownerName || null,
      tinNumber: tinNumber || null,
      phoneNumber: phoneNumber || null,
      email: email || null,
      licenseExpiresAt,
      sla,
      // Localization defaults
      currency,
      taxRate,
      timezone,
      receiptHeader,
      receiptFooter,
    };

    if (configureAdmin) {
      payload.adminEmail = adminEmail;
      payload.adminPassword = adminPassword;
      payload.adminFirstName = adminFirstName;
      payload.adminLastName = adminLastName;
    }

    try {
      if (editingId) {
        await api.put(`/system/tenants/${editingId}`, payload);
        addToast("Subscription tier and business settings updated successfully!", "success");
      } else {
        await api.post("/system/tenants", payload);
        addToast("Business subscription and default administrator account created successfully!", "success");
      }
      setShowModal(false);
      loadBusinesses();
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to save subscription settings", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics calculations
  const totalBiz = businesses.length;
  const activeBiz = businesses.filter((b) => b.status === "ACTIVE").length;
  const planStarter = businesses.filter((b) => b.plan === "STARTER").length;
  const planProfessional = businesses.filter((b) => b.plan === "PROFESSIONAL").length;
  const planEnterprise = businesses.filter((b) => b.plan === "ENTERPRISE" || b.plan === "CUSTOM").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building className="h-6 w-6 text-sky-500" /> Business Subscription Registry
          </h1>
          <p className="text-xs text-slate-400">
            Centrally manage easyPOS tenant businesses, license tiers, localization defaults, and admin accounts.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-600 shadow-sm transition-all duration-200"
        >
          <Plus className="h-4 w-4" /> Add New Business
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Businesses</span>
          <span className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mt-1 block">{totalBiz}</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Licenses</span>
          <span className="text-xl font-extrabold text-emerald-500 mt-1 block">{activeBiz}</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Starter Tiers</span>
          <span className="text-xl font-extrabold text-sky-500 mt-1 block">{planStarter}</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Professional Tiers</span>
          <span className="text-xl font-extrabold text-indigo-500 mt-1 block">{planProfessional}</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Enterprise Tiers</span>
          <span className="text-xl font-extrabold text-amber-500 mt-1 block">{planEnterprise}</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="h-6 w-6 text-sky-500 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Fetching multi-tenant subscription accounts...</span>
          </div>
        ) : businesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-3xl">🏢</span>
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No businesses registered yet</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Use the "Add New Business" button to create a tenant POS account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950">
                  <th className="p-4">Brand & Subdomain</th>
                  <th className="p-4">Plan & Expiry</th>
                  <th className="p-4">Owner Profile</th>
                  <th className="p-4">Localization Settings</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {businesses.map((biz) => {
                  const hasExpired = biz.licenseExpiresAt && new Date(biz.licenseExpiresAt) < new Date();
                  return (
                    <tr key={biz.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      {/* Name & Subdomain */}
                      <td className="p-4">
                        <button
                          onClick={() => openDetailsModal(biz)}
                          className="font-bold text-slate-900 dark:text-slate-100 text-sm hover:text-sky-500 hover:underline text-left outline-none transition-colors"
                        >
                          {biz.name}
                        </button>
                        <div className="text-slate-400 font-mono text-[10px] mt-0.5">
                          {biz.subdomain ? `${biz.subdomain}.easypos.com` : "no-subdomain"}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            ID: {biz.id.substring(0, 8)}
                          </span>
                          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-600 dark:bg-sky-950/20 dark:text-sky-400 flex items-center gap-0.5">
                            👤 {biz.usersCount} User{biz.usersCount !== 1 ? "s" : ""}
                          </span>
                          {biz.hasAdmin && (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 flex items-center gap-0.5">
                              🔑 Admin Configured
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Plan / SaaS license details */}
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              biz.plan === "STARTER"
                                ? "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400"
                                : biz.plan === "PROFESSIONAL"
                                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400"
                                : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                            }`}
                          >
                            {biz.plan}
                          </span>
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                              biz.sla === "GOLD"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : biz.sla === "PLATINUM"
                                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                : biz.sla === "CUSTOM"
                                ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                            }`}
                          >
                            SLA: {biz.sla || "STANDARD"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>
                            {biz.licenseExpiresAt ? (
                              <span className={hasExpired ? "text-rose-500 font-semibold" : ""}>
                                Expires: {new Date(biz.licenseExpiresAt).toLocaleDateString()} {hasExpired ? "(Expired)" : ""}
                              </span>
                            ) : (
                              "Lifetime / No Expiry"
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Owner Profile details */}
                      <td className="p-4 space-y-0.5">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {biz.ownerName || <span className="text-slate-400 italic">No Owner Name</span>}
                        </div>
                        {biz.email && <div className="text-[10px] text-slate-400 font-semibold">{biz.email}</div>}
                        {biz.phoneNumber && <div className="text-[10px] text-slate-400">{biz.phoneNumber}</div>}
                        {biz.tinNumber && (
                          <div className="text-[9px] text-slate-400 font-mono uppercase">TIN: {biz.tinNumber}</div>
                        )}
                      </td>

                      {/* Localization Settings */}
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {biz.settings?.CURRENCY || "PHP"}
                          </span>
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            VAT: {biz.settings?.TAX_RATE || "12"}%
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 truncate max-w-[200px]" title={biz.settings?.TIMEZONE}>
                          🌐 Timezone: {biz.settings?.TIMEZONE || "Asia/Manila"}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            biz.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
                          }`}
                        >
                          {biz.status}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openBranchesModal(biz)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-500 dark:hover:bg-slate-800"
                            title="Manage Branches"
                          >
                            <MapPin className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(biz)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-800"
                            title="Edit Subscription Details"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(biz.id, biz.name)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                            title="Delete Business Account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog for Add / Edit Business */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building className="h-5 w-5 text-sky-500" />
                {editingId ? `Edit Subscription: ${name}` : "Register New Business Tenant"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-6">
              
              {/* SECTION 1: Plan & Expiration Settings */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" /> SaaS Subscription Settings
                </h3>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Business Brand Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. PC Express Davao"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 font-semibold outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Subdomain Prefix</label>
                    <input
                      type="text"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      placeholder="e.g. pcexpress-davao"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 font-semibold outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">License Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 font-semibold outline-none"
                    >
                      <option value="ACTIVE">ACTIVE (Authorized Access)</option>
                      <option value="SUSPENDED">SUSPENDED (Access Blocked)</option>
                    </select>
                  </div>
                </div>

                <div className={`grid gap-4 sm:grid-cols-${expiryOption === "CUSTOM" ? "4" : "3"}`}>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">SaaS License Tier</label>
                    <select
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 font-semibold outline-none"
                    >
                      <option value="STARTER">Starter Tier (POS & CRM only)</option>
                      <option value="PROFESSIONAL">Professional Tier (POS, CRM, Stock & Suppliers)</option>
                      <option value="ENTERPRISE">Enterprise Tier (All Modules)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Licensing Duration *</label>
                    <select
                      value={expiryOption}
                      onChange={(e) => setExpiryOption(e.target.value)}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 font-semibold outline-none"
                    >
                      <option value="1_YEAR">1 Year Plan (Extend 365 Days)</option>
                      <option value="2_YEARS">2 Years Plan (Extend 730 Days)</option>
                      <option value="5_YEARS">5 Years Plan (Extend 1,825 Days)</option>
                      <option value="LIFETIME">Lifetime License (No Expiry)</option>
                      <option value="CUSTOM">Custom Expiry Date</option>
                    </select>
                  </div>

                  {expiryOption === "CUSTOM" && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">Custom Expiry Date *</label>
                      <input
                        type="date"
                        required
                        value={customExpiryDate}
                        onChange={(e) => setCustomExpiryDate(e.target.value)}
                        className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-slate-400">SLA Support Tier</label>
                    <select
                      value={sla}
                      onChange={(e) => setSla(e.target.value)}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 font-semibold outline-none"
                    >
                      <option value="STANDARD">Standard SLA (24h Response)</option>
                      <option value="GOLD">Gold SLA (4h Response, 99.9% Uptime)</option>
                      <option value="PLATINUM">Platinum SLA (1h Response, 99.99% Uptime)</option>
                      <option value="CUSTOM">Custom SLA / Custom Agreement</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Owner profile details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="h-4 w-4" /> Owner Profile & Billing Contacts
                </h3>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Owner Name</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Owner TIN Number</label>
                    <input
                      type="text"
                      value={tinNumber}
                      onChange={(e) => setTinNumber(e.target.value)}
                      placeholder="123-456-789-000"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Owner Phone Number</label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0917xxxxxxx"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Billing Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Localization Settings (Moved from general settings view) */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> Localization & Print Settings
                </h3>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Store Currency Code</label>
                    <input
                      type="text"
                      required
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      maxLength={3}
                      placeholder="PHP"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Tax VAT Rate (%)</label>
                    <input
                      type="number"
                      required
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Store Timezone</label>
                    <input
                      type="text"
                      required
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="Asia/Manila"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Thermal Receipt Header</label>
                    <textarea
                      value={receiptHeader}
                      onChange={(e) => setReceiptHeader(e.target.value)}
                      placeholder="e.g. PC EXPRESS STORE BRANCH&#10;123 Tech Center, Cyberzone"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none h-16 font-mono resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Thermal Receipt Footer</label>
                    <textarea
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      placeholder="Thank you for buying. Warranty claims require official receipt."
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none h-16 font-mono resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Administrator Credentials Option */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800 space-y-4">
                <label className="flex items-center gap-2.5 rounded-lg border border-sky-500 bg-sky-50/20 dark:bg-sky-950/20 p-3 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={configureAdmin}
                    onChange={(e) => setConfigureAdmin(e.target.checked)}
                    className="rounded border-slate-300 text-sky-500 focus:ring-sky-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-slate-950 dark:text-slate-50 font-bold block">
                      {editingId ? "Reset / Create Store Administrator Account" : "Initialize Administrator Account"}
                    </span>
                    <span className="text-slate-400 text-[10px] mt-0.5 block">
                      Check this option to configure or overwrite administrative credentials to manage this business store.
                    </span>
                  </div>
                </label>

                {configureAdmin && (
                  <div className="grid gap-4 sm:grid-cols-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">Admin Email Address *</label>
                      <input
                        type="email"
                        required={configureAdmin}
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@brand.com"
                        className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">Admin Password *</label>
                      <input
                        type="password"
                        required={configureAdmin}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">Admin First Name</label>
                      <input
                        type="text"
                        value={adminFirstName}
                        onChange={(e) => setAdminFirstName(e.target.value)}
                        placeholder="Manager"
                        className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400">Admin Last Name</label>
                      <input
                        type="text"
                        value={adminLastName}
                        onChange={(e) => setAdminLastName(e.target.value)}
                        placeholder="Store"
                        className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-sky-500 hover:bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? "Saving subscription details..." : editingId ? "Save Changes" : "Create Business Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog for Manage Branches (Stores) */}
      {showBranchesModal && activeTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-500" />
                  Manage Branches: {activeTenant.name}
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Create, update, and remove branch locations (stores) for this business subscription.
                </p>
              </div>
              <button
                onClick={() => setShowBranchesModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Branch Creation / Editing Form */}
            <form onSubmit={handleBranchSubmit} className="mt-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                {branchEditingId ? "Edit Branch details" : "Register a new Branch"}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 mt-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400">Branch Location Name *</label>
                  <input
                    type="text"
                    required
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Davao HQ, Tagum Branch"
                    className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-900 font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400">Physical Address</label>
                  <input
                    type="text"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    placeholder="e.g. 123 Roxas Ave, Davao City"
                    className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-900 font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                {branchEditingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setBranchEditingId(null);
                      setBranchName("");
                      setBranchAddress("");
                    }}
                    className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={branchSubmitting}
                  className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  {branchSubmitting ? "Saving Branch..." : branchEditingId ? "Save Branch details" : "Add Branch"}
                </button>
              </div>
            </form>

            {/* List of Registered Branches */}
            <div className="mt-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                Registered Branch Locations ({branches.length})
              </h3>
              {branchesLoading ? (
                <div className="flex items-center justify-center py-10 gap-2">
                  <RefreshCw className="h-5 w-5 text-emerald-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-medium">Loading branches...</span>
                </div>
              ) : branches.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No branches registered for this business. New businesses must have at least one branch to conduct POS sales.
                </div>
              ) : (
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950">
                        <th className="p-3">Branch Name</th>
                        <th className="p-3">Address</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {branches.map((store) => (
                        <tr key={store.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                            {store.name}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {store.address || <span className="italic text-slate-500">No Address Specified</span>}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => editBranch(store)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-800"
                                title="Edit Branch details"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleBranchDelete(store.id, store.name)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                                title="Delete Branch location"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBranchesModal(false)}
                className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Dialog for Business Details */}
      {showDetailsModal && detailedBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto space-y-6">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Building className="h-5 w-5 text-sky-500" />
                  <span>{detailedBusiness.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${detailedBusiness.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"}`}>
                    {detailedBusiness.status}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Tenant Subscription ID: {detailedBusiness.id}
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Details Grid */}
            <div className="grid gap-6 sm:grid-cols-2">
              
              {/* Box 1: Plan & SLA */}
              <div className="rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/80 space-y-3">
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" /> Subscription & SLA Tiers
                </h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-850">
                    <span className="text-slate-400">License Tier</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">{detailedBusiness.plan}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-850">
                    <span className="text-slate-400">Support SLA Agreement</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">{detailedBusiness.sla || "STANDARD"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-850">
                    <span className="text-slate-400">Subdomain Access</span>
                    <span className="font-mono font-bold text-sky-500">{detailedBusiness.subdomain ? `${detailedBusiness.subdomain}.easypos.com` : "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">License Expiry</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">
                      {detailedBusiness.licenseExpiresAt 
                        ? new Date(detailedBusiness.licenseExpiresAt).toLocaleDateString(undefined, { dateStyle: 'long' })
                        : "LIFETIME / NO EXPIRY"
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 2: Owner Contact */}
              <div className="rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/80 space-y-3">
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="h-4 w-4" /> Owner & Billing Details
                </h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-850">
                    <span className="text-slate-400">Owner Name</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">{detailedBusiness.ownerName || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-850">
                    <span className="text-slate-400">Billing Email</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">{detailedBusiness.email || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-850">
                    <span className="text-slate-400">Owner TIN</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">{detailedBusiness.tinNumber || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contact Number</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">{detailedBusiness.phoneNumber || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Localization Defaults */}
              <div className="rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/80 space-y-3">
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Localization Defaults
                </h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-850">
                    <span className="text-slate-400">Store Currency</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">{detailedBusiness.settings?.CURRENCY || "PHP"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-850">
                    <span className="text-slate-400">VAT Tax Rate</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">{detailedBusiness.settings?.TAX_RATE || "12"}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">System Timezone</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">{detailedBusiness.settings?.TIMEZONE || "Asia/Manila"}</span>
                  </div>
                </div>
              </div>

              {/* Box 4: Print Receipt Template */}
              <div className="rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/80 space-y-3">
                <h3 className="text-xs font-bold text-sky-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Print Receipt Template
                </h3>
                
                <div className="space-y-2 text-[11px] font-mono leading-tight bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-850 text-slate-600 dark:text-slate-400 max-h-[85px] overflow-y-auto">
                  <div className="text-center font-bold text-slate-850 dark:text-slate-200">
                    {detailedBusiness.settings?.RECEIPT_HEADER || "EASYPOS HUB RECEIPT"}
                  </div>
                  <div className="border-t border-dashed border-slate-200 my-1 dark:border-slate-800" />
                  <div className="text-center italic">
                    {detailedBusiness.settings?.RECEIPT_FOOTER || "Thank you for buying!"}
                  </div>
                </div>
              </div>

            </div>

            {/* Branches Sub-registry */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Registered Physical Store Branches ({detailedBusiness.stores?.length || 0})
              </h3>
              
              {!detailedBusiness.stores || detailedBusiness.stores.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No store branches registered yet for this business subscription.
                </div>
              ) : (
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/50">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950">
                        <th className="p-3">Branch Name</th>
                        <th className="p-3">Physical Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                      {detailedBusiness.stores.map((st: any) => (
                        <tr key={st.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>🏢</span> {st.name}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px] font-medium">
                            {st.address || <span className="italic text-slate-500">No Address Provided</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="rounded-lg bg-sky-500 hover:bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
