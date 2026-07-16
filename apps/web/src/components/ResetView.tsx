import React, { useEffect, useState } from "react";
import { ShieldAlert, RefreshCw, AlertTriangle, FileSpreadsheet, KeyRound, Download, Play } from "lucide-react";
import { api } from "../services/api";

export function ResetView() {
  // Password check
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");

  // Target inputs
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [confirmAppName, setConfirmAppName] = useState("");

  // Backups list
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // Checkboxes
  const [options, setOptions] = useState({
    dataReset: true,
    productReset: "KEEP", // KEEP, DELETE_ALL
    userReset: "KEEP_ALL", // KEEP_ALL, REMOVE_ALL_EXCEPT_SUPERADMIN
    inventoryReset: "KEEP", // KEEP, RESET_QUANTITIES_ZERO
    repairReset: "KEEP", // KEEP, DELETE_ALL
    customerReset: "KEEP", // KEEP, DELETE_ALL
    supplierReset: false,
    settingsReset: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [resetSuccessReport, setResetSuccessReport] = useState<any>(null);

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await api.get("/system/backups");
      setBackups(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleDeploymentReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || confirmPhrase !== "RESET APPLICATION" || !confirmAppName) {
      alert("Please satisfy all confirmation fields first.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/system/reset", {
        password,
        totpCode,
        confirmPhrase,
        confirmAppName,
        options,
      });
      setResetSuccessReport({
        type: "DEPLOYMENT",
        message: "Application cleaned and sanitized successfully.",
        backupFile: res.data.backup.filename,
        backupChecksum: res.data.backup.checksum,
      });
      setPassword("");
      setTotpCode("");
      setConfirmPhrase("");
      setConfirmAppName("");
      loadBackups();
    } catch (err: any) {
      alert(err.response?.data?.error || "Reset aborted or failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFactoryReset = async () => {
    const pass = prompt("WARNING: This will purge ALL data, users, and customizations. Enter your SuperAdmin password to perform Factory Reset:");
    if (!pass) return;

    setSubmitting(true);
    try {
      const res = await api.post("/system/factory-reset", { password: pass });
      setResetSuccessReport({
        type: "FACTORY_RESET",
        message: "Factory Reset complete. System returned to default seed setup.",
        backupFile: res.data.backup.filename,
      });
      loadBackups();
    } catch (err: any) {
      alert(err.response?.data?.error || "Factory reset failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrepareForDeployment = async () => {
    if (!confirm("This will purge all demo sales, demo repairs, and clear the customer list. Continue?")) return;

    setSubmitting(true);
    try {
      const res = await api.post("/system/initialize-production");
      setResetSuccessReport({
        type: "PREPARE_PRODUCTION",
        message: "Production Initialization complete.",
        tasks: res.data.report.tasks,
        backupFile: res.data.report.backupFile,
      });
      loadBackups();
    } catch (err: any) {
      alert(err.response?.data?.error || "Deployment prep failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (backup: any) => {
    const pass = prompt(`Enter your password to restore database from backup file: ${backup.filename}`);
    if (!pass) return;

    try {
      await api.post("/system/backups/restore", {
        filename: backup.filename,
        checksum: backup.checksum,
        password: pass,
      });
      alert("Database snapshot restored successfully! Please reload the page.");
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to restore backup snapshot");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Reset Wizard */}
      <div className="md:col-span-2 space-y-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50/20 p-6 shadow-sm dark:border-rose-950 dark:bg-rose-950/10">
          <h2 className="text-base font-bold tracking-tight mb-2 flex items-center gap-2 text-rose-950 dark:text-rose-400">
            <ShieldAlert className="h-5 w-5 text-rose-500 animate-pulse" /> Deployment Sanitization Wizard
          </h2>
          <p className="text-xs text-rose-800/80 dark:text-rose-500 mb-6">
            Safely prepare the database before customer handover or production release. A safety snapshot backup is compiled automatically before execute.
          </p>

          <form onSubmit={handleDeploymentReset} className="space-y-4 text-xs">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400">SuperAdmin Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">TOTP/MFA Token (If enabled)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none"
                />
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Reset Configurations</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.dataReset}
                    onChange={(e) => setOptions({ ...options, dataReset: e.target.checked })}
                    className="rounded text-rose-500 focus:ring-rose-500"
                  />
                  Delete Sales, Repairs, Expenses
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.supplierReset}
                    onChange={(e) => setOptions({ ...options, supplierReset: e.target.checked })}
                    className="rounded text-rose-500 focus:ring-rose-500"
                  />
                  Delete Suppliers Database
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.settingsReset}
                    onChange={(e) => setOptions({ ...options, settingsReset: e.target.checked })}
                    className="rounded text-rose-500"
                  />
                  Wipe Custom Settings & Themes
                </label>
                <div>
                  <label className="font-bold text-slate-400">Products Option:</label>
                  <select
                    value={options.productReset}
                    onChange={(e) => setOptions({ ...options, productReset: e.target.value })}
                    className="w-full mt-1 border rounded px-2 py-1 bg-slate-50 dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="KEEP">Keep Products List</option>
                    <option value="DELETE_ALL">Delete All Products</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-400">Inventory Stock Counts:</label>
                  <select
                    value={options.inventoryReset}
                    onChange={(e) => setOptions({ ...options, inventoryReset: e.target.value })}
                    className="w-full mt-1 border rounded px-2 py-1 bg-slate-50 dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="KEEP">Keep Stock Levels</option>
                    <option value="RESET_QUANTITIES_ZERO">Reset Stock Quantities to Zero</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-400">Customers Option:</label>
                  <select
                    value={options.customerReset}
                    onChange={(e) => setOptions({ ...options, customerReset: e.target.value })}
                    className="w-full mt-1 border rounded px-2 py-1 bg-slate-50 dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="KEEP">Keep Customers</option>
                    <option value="DELETE_ALL">Delete All Customers</option>
                    <option value="DELETE_ALL_KEEP_LOYALTY">Wipe profiles, preserve loyalty counters</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-400">User accounts Option:</label>
                  <select
                    value={options.userReset}
                    onChange={(e) => setOptions({ ...options, userReset: e.target.value })}
                    className="w-full mt-1 border rounded px-2 py-1 bg-slate-50 dark:bg-slate-950 dark:border-slate-800"
                  >
                    <option value="KEEP_ALL">Keep All Accounts</option>
                    <option value="REMOVE_ALL_EXCEPT_SUPERADMIN">Remove All Except SuperAdmin</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Confirmation phrases */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Type exact phrase: "RESET APPLICATION" *</label>
                <input
                  type="text"
                  required
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2.5 dark:border-slate-800 dark:bg-slate-950 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Confirm Current App Brand Name *</label>
                <input
                  type="text"
                  required
                  value={confirmAppName}
                  onChange={(e) => setConfirmAppName(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2.5 dark:border-slate-800 dark:bg-slate-950 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                {submitting ? "Resetting application..." : "Execute Deployment Reset"}
              </button>
            </div>
          </form>
        </div>

        {/* Rapid wizard buttons */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="font-bold text-sm">Prepare for Deployment</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated script checks. Deletes sample customers, sample suppliers, and test invoice sales records. Optimizes databases.
            </p>
            <button
              onClick={handlePrepareForDeployment}
              className="w-full rounded-lg bg-sky-500 py-2.5 text-xs font-semibold text-white hover:bg-sky-600"
            >
              Run Deployment Wizard
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="font-bold text-sm">Factory Reset System</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Restore the application to the original default seed installation. Empties all tables and resets settings configuration.
            </p>
            <button
              onClick={handleFactoryReset}
              className="w-full rounded-lg border border-rose-200 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-850"
            >
              Execute Factory Reset
            </button>
          </div>
        </div>
      </div>

      {/* Backups sidebar recovery */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 h-fit space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight mb-2">Backups Snapshot List</h2>
          <button
            onClick={loadBackups}
            className="text-xs text-slate-500 hover:text-slate-600 flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Reload
          </button>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {backups.map((b) => (
            <div key={b.filename} className="bg-slate-50 p-3.5 rounded-lg dark:bg-slate-950 space-y-2 text-[10px]">
              <div className="flex justify-between items-start font-bold">
                <span className="truncate max-w-[120px]" title={b.filename}>
                  {b.filename}
                </span>
                <span className="text-slate-400">{(b.size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="text-slate-400 font-mono select-all">SHA256: {b.checksum.slice(0, 20)}...</div>
              <div className="flex justify-between items-center pt-1 border-t dark:border-slate-900">
                <span className="text-slate-400">{new Date(b.createdAt).toLocaleDateString()}</span>
                <button
                  onClick={() => handleRestore(b)}
                  className="flex items-center gap-1 text-sky-500 hover:underline font-bold"
                >
                  <Play className="h-2.5 w-2.5" /> Restore
                </button>
              </div>
            </div>
          ))}
          {backups.length === 0 && !loadingBackups && (
            <div className="text-center text-xs text-slate-400 py-10">No snapshot backups found.</div>
          )}
        </div>
      </div>

      {/* Reset report Modal */}
      {resetSuccessReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-emerald-600">Action Completed Successfully</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {resetSuccessReport.message}
            </p>

            <div className="bg-slate-50 p-3 rounded-lg dark:bg-slate-950 text-[10px] space-y-1">
              <div>
                <span className="font-bold">Backup File:</span> {resetSuccessReport.backupFile}
              </div>
              {resetSuccessReport.backupChecksum && (
                <div className="font-mono text-slate-400">
                  Checksum: {resetSuccessReport.backupChecksum}
                </div>
              )}
            </div>

            {resetSuccessReport.tasks && (
              <div className="text-[10px] space-y-1">
                <span className="font-bold">Tasks executed:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                  {resetSuccessReport.tasks.map((task: string, i: number) => (
                    <li key={i}>{task}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t dark:border-slate-800">
              <button
                onClick={() => setResetSuccessReport(null)}
                className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
