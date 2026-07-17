import React, { useEffect, useState } from "react";
import { Plus, Trash2, Calendar, FileText, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "../services/api";

export function AccountingView() {
  const [stats, setStats] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNontaxableReport, setShowNontaxableReport] = useState(false);

  // Expense forms
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseData, setExpenseData] = useState({ category: "RENT", amount: "", description: "", date: "" });

  const loadAccountingData = async () => {
    setLoading(true);
    try {
      const [statsRes, expRes, logRes] = await Promise.all([
        api.get("/accounting/dashboard", {
          params: { nontaxable: showNontaxableReport ? "true" : "false" }
        }),
        api.get("/accounting/expenses"),
        api.get("/accounting/logs").catch(() => ({ data: [] })), // Gracefully fall back if no permission
      ]);
      setStats(statsRes.data);
      setExpenses(expRes.data);
      setAuditLogs(logRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountingData();
  }, [showNontaxableReport]);

  const handleExpenseSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/accounting/expenses", {
        ...expenseData,
        amount: parseFloat(expenseData.amount),
      });
      setShowExpenseModal(false);
      setExpenseData({ category: "RENT", amount: "", description: "", date: "" });
      loadAccountingData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save expense record");
    }
  };

  const handleExpenseDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      await api.delete(`/accounting/expenses/${id}`);
      loadAccountingData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting & Auditing</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Profit and Loss calculations, expense registers, and security audit trail logs.
          </p>
        </div>

        {/* Toggle Report Type */}
        <div className="flex rounded-lg border border-slate-200 p-1 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold self-start sm:self-auto shrink-0 shadow-sm select-none">
          <button
            onClick={() => setShowNontaxableReport(false)}
            className={`px-3 py-1.5 rounded-md transition-all ${
              !showNontaxableReport
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-950 dark:hover:text-slate-200"
            }`}
          >
            Taxable (VAT) Sales Report
          </button>
          <button
            onClick={() => setShowNontaxableReport(true)}
            className={`px-3 py-1.5 rounded-md transition-all ${
              showNontaxableReport
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-950 dark:hover:text-slate-200"
            }`}
          >
            Non-Taxable Sales Report
          </button>
        </div>
      </div>

      {/* Financial P&L Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Sales</span>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            P{stats?.grossRevenue?.toLocaleString() || "0"}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Total checkout invoices</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cost of Goods Sold (COGS)</span>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            P{stats?.costOfGoodsSold?.toLocaleString() || "0"}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Product purchase costs</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Total Expenses</span>
          <div className="mt-2 text-xl font-bold text-rose-600">
            P{stats?.totalExpenses?.toLocaleString() || "0"}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Store operations overhead</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Net Profit</span>
          <div className="mt-2 text-xl font-bold text-emerald-600">
            P{stats?.netProfit?.toLocaleString() || "0"}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Gross Sales - COGS - Expenses</p>
        </div>
      </div>

      {/* Tabs / Grids */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expenses List */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col h-[450px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <h2 className="text-base font-bold tracking-tight">Expense Ledger</h2>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-1 rounded bg-sky-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
            >
              <Plus className="h-3.5 w-3.5" /> Log Expense
            </button>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 pr-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 font-semibold text-slate-500 dark:border-slate-800">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2.5 text-slate-400">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="py-2.5 font-semibold text-slate-900 dark:text-slate-100">{e.category}</td>
                    <td className="py-2.5 text-slate-500 max-w-[150px] truncate">{e.description}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-rose-500">P{e.amount}</td>
                    <td className="py-2.5 text-center">
                      <button
                        onClick={() => handleExpenseDelete(e.id)}
                        className="text-rose-500 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      No expense records logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Trail Logs */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col h-[450px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-5 w-5 text-sky-500" />
              <h2 className="text-base font-bold tracking-tight">Security Audit Logs (SOC2)</h2>
            </div>
            <button
              onClick={loadAccountingData}
              className="text-xs text-slate-500 hover:text-slate-600 flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1 text-[10px]">
            {auditLogs.map((log) => (
              <div key={log.id} className="bg-slate-50 p-3 rounded-lg dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-500 uppercase tracking-wider">{log.action}</span>
                  <span className="text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-slate-600 dark:text-slate-400 mt-1">
                  Entity: <span className="font-semibold text-slate-700 dark:text-slate-300">{log.entity}</span> (ID: {log.entityId || "N/A"})
                </div>
                <div className="text-slate-400 mt-1 flex justify-between">
                  <span>Operator: {log.user?.email || "System"}</span>
                  <span className="font-mono">IP: {log.ipAddress || "N/A"}</span>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="text-center py-20 text-xs text-slate-400">
                No logs loaded (requires permissions).
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleExpenseSave}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <h3 className="text-lg font-bold">Log Store Expense</h3>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Category *</label>
              <select
                required
                value={expenseData.category}
                onChange={(e) => setExpenseData({ ...expenseData, category: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="RENT">Rent</option>
                <option value="SALARIES">Salaries & Labor</option>
                <option value="UTILITIES">Utilities (Power/Net)</option>
                <option value="SUPPLIES">Supplies / Tools</option>
                <option value="MARKETING">Marketing / Ads</option>
                <option value="OTHER">Other Expenses</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Amount (P) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={expenseData.amount}
                onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Expense Date</label>
              <input
                type="date"
                value={expenseData.date}
                onChange={(e) => setExpenseData({ ...expenseData, date: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Description</label>
              <textarea
                value={expenseData.description}
                onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                placeholder="e.g. Meralco bill June 2026"
                rows={2}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Log Expense
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
