import React, { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, RefreshCw, AlertTriangle, Cpu, DollarSign, Banknote, Users, Shield, Building, Calendar, CreditCard, Globe, Sliders, CheckCircle, Save, X, FileText } from "lucide-react";
import { api } from "../services/api";
import { useAuthStore } from "../store/auth";
import { useToastStore } from "../store/toast";

export function DashboardView() {
  const { user } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const isSuperAdmin = user?.role === "SUPERADMIN";

  // Shared loading/stats state
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // SuperAdmin specific states
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [editingTierIndex, setEditingTierIndex] = useState<number | null>(null);
  const [editingRate, setEditingRate] = useState<string>("");
  const [editingAnnualRate, setEditingAnnualRate] = useState<string>("");
  const [savingTiers, setSavingTiers] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly");

  // Detailed modal overlay state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailedBusiness, setDetailedBusiness] = useState<any>(null);

  const openDetailsModal = (biz: any) => {
    setDetailedBusiness(biz);
    setShowDetailsModal(true);
  };

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      if (isSuperAdmin) {
        // Fetch all businesses list & default pricing tiers
        const [bizRes, tiersRes] = await Promise.all([
          api.get("/system/tenants"),
          api.get("/system/license-tiers")
        ]);
        setBusinesses(bizRes.data);
        setTiers(tiersRes.data);
      } else {
        // Fetch store specific executive statistics
        const res = await api.get("/accounting/dashboard");
        setStats(res.data);
      }
    } catch (err) {
      console.error("Dashboard stats load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [isSuperAdmin]);

  // Handle tier rate saving
  const handleSaveTierRate = async (index: number) => {
    if (!editingRate || isNaN(Number(editingRate))) {
      return addToast("Please specify a valid monthly rate.", "info");
    }
    if (editingAnnualRate && isNaN(Number(editingAnnualRate))) {
      return addToast("Annual rate must be a valid number.", "info");
    }

    setSavingTiers(true);
    try {
      const updatedTiers = [...tiers];
      updatedTiers[index] = {
        ...updatedTiers[index],
        rate: Number(editingRate),
        annualRate: editingAnnualRate ? Number(editingAnnualRate) : null
      };

      await api.post("/system/license-tiers", updatedTiers);
      setTiers(updatedTiers);
      setEditingTierIndex(null);
      addToast(`License rates for ${updatedTiers[index].name} successfully updated!`, "success");
    } catch (err) {
      addToast("Failed to save license rates.", "error");
    } finally {
      setSavingTiers(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  // --- RENDER 1: SUPERADMIN CONSOLE ---
  if (isSuperAdmin) {
    const totalBusinesses = businesses.length;
    const activeLicenses = businesses.filter(b => b.status === "ACTIVE").length;
    const suspendedLicenses = businesses.filter(b => b.status === "SUSPENDED").length;
    
    // Sum pricing rates based on active subscriptions
    const potentialMonthlyRevenue = businesses.reduce((acc, curr) => {
      const tier = tiers.find(t => t.key === curr.plan);
      const tierRate = tier?.rate || 0;
      return curr.status === "ACTIVE" ? acc + tierRate : acc;
    }, 0);
    const potentialAnnualRevenue = businesses.reduce((acc, curr) => {
      const tier = tiers.find(t => t.key === curr.plan);
      const annualRate = tier?.annualRate ?? ((tier?.rate || 0) * 12);
      return curr.status === "ACTIVE" ? acc + annualRate : acc;
    }, 0);
    const displayRevenue = billingCycle === "annually" ? potentialAnnualRevenue : potentialMonthlyRevenue;

    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="h-7 w-7 text-sky-500 animate-pulse" />
              <span>csERP SaaS Multi-Tenant ERP</span>
            </h1>
            <p className="text-xs text-slate-400">
              System performance monitor, billing tiers registry, and business license expiries control center.
            </p>
          </div>
          <button
            onClick={fetchDashboardStats}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload Hub
          </button>
        </div>

        {/* Executive SaaS Metrics Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Businesses</span>
            <div className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Building className="h-6 w-6 text-sky-500" />
              <span>{totalBusinesses}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-500" />
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Licenses</span>
            <div className="mt-2 text-2xl font-extrabold text-emerald-500 flex items-center gap-2">
              <CheckCircle className="h-6 w-6" />
              <span>{activeLicenses}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Suspended Accounts</span>
            <div className="mt-2 text-2xl font-extrabold text-rose-500 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              <span>{suspendedLicenses}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{billingCycle === "annually" ? "ARR Potential" : "MRR Potential"}</span>
              {/* Monthly / Annually toggle */}
              <div className="flex items-center gap-0.5 rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                    billingCycle === "monthly"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Mo
                </button>
                <button
                  onClick={() => setBillingCycle("annually")}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                    billingCycle === "annually"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Yr
                </button>
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-indigo-500 flex items-center gap-1">
              <Banknote className="h-6 w-6 shrink-0" />
              <span>${displayRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {billingCycle === "annually" ? "yr" : "mo"}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* List of Business Subscriptions with Expiry */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Building className="h-4.5 w-4.5 text-sky-500" />
              <span>Active Business Licenses & Expiries</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950/20">
                    <th className="p-3">Business / Tenant</th>
                    <th className="p-3">Plan Tier</th>
                    <th className="p-3 text-center">License Expiry</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {businesses.map((biz) => {
                    const hasExpired = biz.licenseExpiresAt && new Date(biz.licenseExpiresAt) < new Date();
                    return (
                      <tr key={biz.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        {/* Name Link */}
                        <td className="p-3">
                          <button
                            onClick={() => openDetailsModal(biz)}
                            className="font-bold text-slate-900 dark:text-slate-100 text-[13px] hover:text-sky-500 hover:underline text-left outline-none transition-colors"
                          >
                            {biz.name}
                          </button>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {biz.subdomain ? `${biz.subdomain}.easypos.com` : "no-subdomain"}
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider ${
                            biz.plan === "STARTER" 
                              ? "bg-sky-55/10 text-sky-600 dark:text-sky-400" 
                              : biz.plan === "PROFESSIONAL" 
                              ? "bg-indigo-55/10 text-indigo-600 dark:text-indigo-400" 
                              : "bg-amber-55/10 text-amber-600 dark:text-amber-400"
                          }`}>
                            {biz.plan}
                          </span>
                        </td>

                        {/* Expiry */}
                        <td className={`p-3 text-center font-semibold ${hasExpired ? "text-rose-500" : "text-slate-500 dark:text-slate-400"}`}>
                          <div className="flex items-center justify-center gap-1 text-[11px]">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {biz.licenseExpiresAt
                                ? new Date(biz.licenseExpiresAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                                : "LIFETIME LICENSE"
                              }
                            </span>
                          </div>
                          {hasExpired && <span className="text-[9px] font-bold block text-rose-500 mt-0.5 uppercase tracking-wider">Expired</span>}
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            biz.status === "ACTIVE" 
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}>
                            {biz.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing & License Tiers Manager */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <CreditCard className="h-4.5 w-4.5 text-sky-500" />
                <span>SaaS Pricing & License Tiers</span>
              </h2>
              {/* Billing cycle indicator */}
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                billingCycle === "annually"
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}>
                {billingCycle === "annually" ? "Annual" : "Monthly"} rates
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Centrally edit subscription plans pricing rates. Changes modify billing metrics dynamically.
            </p>

            <div className="space-y-4">
              {tiers.map((tier, index) => {
                const isEditing = editingTierIndex === index;
                const annualDisplayRate = tier.annualRate ?? tier.rate * 12;
                const monthlyDisplayRate = tier.rate;
                return (
                  <div key={tier.key} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{tier.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-slate-200 dark:bg-slate-800`}>
                        {tier.key}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        {/* Monthly rate row */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 w-14 shrink-0">Monthly</span>
                          <span className="text-xs font-bold text-slate-400">$</span>
                          <input
                            type="number"
                            required
                            placeholder="Monthly rate"
                            value={editingRate}
                            onChange={(e) => setEditingRate(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-700 dark:bg-slate-900 outline-none font-bold"
                          />
                        </div>
                        {/* Annual rate row */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 w-14 shrink-0">Annual</span>
                          <span className="text-xs font-bold text-slate-400">$</span>
                          <input
                            type="number"
                            placeholder={`${(Number(editingRate) * 12).toFixed(2)} (×12 default)`}
                            value={editingAnnualRate}
                            onChange={(e) => setEditingAnnualRate(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-1 text-xs dark:border-slate-700 dark:bg-slate-900 outline-none font-bold"
                          />
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-1.5 pt-0.5">
                          <button
                            onClick={() => handleSaveTierRate(index)}
                            disabled={savingTiers}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500 text-white text-[10px] font-bold hover:bg-sky-600 disabled:opacity-50"
                          >
                            <Save className="h-3 w-3" /> Save
                          </button>
                          <button
                            onClick={() => setEditingTierIndex(null)}
                            className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-500 text-[10px] hover:bg-slate-50 dark:border-slate-800"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-end justify-between pt-1">
                        <div>
                          <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                            ${(billingCycle === "annually" ? annualDisplayRate : monthlyDisplayRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-[10px] text-slate-400 font-normal ml-1">/ {billingCycle === "annually" ? "yr" : tier.billing}</span>
                          </span>
                          {/* Secondary rate hint */}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {billingCycle === "annually"
                              ? `$${monthlyDisplayRate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo`
                              : tier.annualRate
                                ? `$${annualDisplayRate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / yr`
                                : `$${(tier.rate * 12).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / yr (×12)`
                            }
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditingTierIndex(index);
                            setEditingRate(String(tier.rate));
                            setEditingAnnualRate(tier.annualRate != null ? String(tier.annualRate) : "");
                          }}
                          className="text-xs text-sky-500 hover:text-sky-600 hover:underline font-bold"
                        >
                          Edit rates
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

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
                    <Users className="h-4 w-4" /> Owner & Billing Details
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

  // --- RENDER 2: STANDARD TENANT DASHBOARD ---
  const statCards = [
    {
      title: "Total Revenue",
      value: `P${stats?.grossRevenue?.toLocaleString() || "0"}`,
      desc: "Gross sales logged",
      icon: DollarSign,
      color: "from-sky-500 to-blue-600",
    },
    {
      title: "Net Profit",
      value: `P${stats?.netProfit?.toLocaleString() || "0"}`,
      desc: "Revenue - COGS - Expenses",
      icon: TrendingUp,
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "Inventory Asset Value",
      value: `P${stats?.inventoryAssetValue?.toLocaleString() || "0"}`,
      desc: "Valued at purchase cost",
      icon: Cpu,
      color: "from-indigo-500 to-purple-600",
    },
    {
      title: "Pending Repairs",
      value: stats?.pendingRepairs || "0",
      desc: "Device tickets in progress",
      icon: AlertTriangle,
      color: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time shop performance analytics and metrics.
          </p>
        </div>
        <button
          onClick={fetchDashboardStats}
          className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reload Stats
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((c, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.title}</span>
              <c.icon className="h-5 w-5 text-sky-500" />
            </div>
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{c.desc}</p>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${c.color}`} />
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold tracking-tight">Sales Revenue Trend (Past 30 Days)</h2>
          <div className="h-64 mt-6">
            {stats?.dailySalesChart?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.dailySalesChart}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" tickFormatter={(str) => str.slice(5)} stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                No recent sales to plot.
              </div>
            )}
          </div>
        </div>

        {/* Top Products sold */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold tracking-tight">Top 5 Products Sold</h2>
          <div className="h-64 mt-6">
            {stats?.topProducts?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topProducts}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" tickFormatter={(str) => `${str.slice(0, 10)}...`} stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="quantity" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                No sales data recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Health Status / Auditing banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-sky-100 bg-sky-50/50 p-6 dark:border-sky-950 dark:bg-sky-950/20 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sky-900 dark:text-sky-400 text-sm">SOC2 Type II Aligned Security Protocol</h3>
            <p className="text-xs text-sky-800/80 dark:text-sky-500 mt-0.5">
              Role-Based Access Control and permanent database auditing are active. All login sessions are encrypted.
            </p>
          </div>
        </div>
        <div className="text-xs bg-emerald-500/10 text-emerald-600 font-semibold px-2.5 py-1 rounded-full w-fit self-start">
          Health Checks Online
        </div>
      </div>
    </div>
  );
}
