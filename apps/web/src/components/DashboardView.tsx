import React, { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, RefreshCw, AlertTriangle, Cpu, DollarSign, Users, Shield } from "lucide-react";
import { api } from "../services/api";

export function DashboardView() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const res = await api.get("/accounting/dashboard");
      setStats(res.data);
    } catch (err) {
      console.error("Dashboard stats load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

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
