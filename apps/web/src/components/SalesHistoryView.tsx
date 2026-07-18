import React, { useEffect, useState } from "react";
import { 
  Search, 
  RefreshCw, 
  ShoppingBag, 
  CreditCard, 
  Ban, 
  FileText, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Award,
  Filter,
  Printer
} from "lucide-react";
import { api } from "../services/api";

export function SalesHistoryView() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [voiding, setVoiding] = useState(false);

  // Print options modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printInvoiceId, setPrintInvoiceId] = useState<string | null>(null);

  const [showingNontaxable, setShowingNontaxable] = useState(false);

  const loadSales = async () => {
    setLoading(true);
    try {
      const res = await api.get("/sales", {
        params: { nontaxable: showingNontaxable ? "true" : "false" }
      });
      setSales(res.data);
      // Auto-update selected sale if it changes (e.g. voided)
      if (selectedSale) {
        const updated = res.data.find((s: any) => s.id === selectedSale.id);
        if (updated) setSelectedSale(updated);
        else setSelectedSale(null);
      }
    } catch (err) {
      console.error("Failed to load sales history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [showingNontaxable]);

  // Filter sales based on inputs
  const filteredSales = sales.filter((s) => {
    const query = search.toLowerCase();
    const matchesSearch = 
      s.invoiceNo.toLowerCase().includes(query) ||
      (s.customer && `${s.customer.firstName} ${s.customer.lastName}`.toLowerCase().includes(query)) ||
      s.createdBy.toLowerCase().includes(query);

    const matchesPayment = paymentFilter === "" || s.paymentType === paymentFilter;
    const matchesStatus = statusFilter === "" || s.status === statusFilter;

    return matchesSearch && matchesPayment && matchesStatus;
  });

  const handleVoidSale = async (saleId: string) => {
    if (!confirm("Are you sure you want to VOID this transaction? This action is irreversible, and stock quantities will be returned to inventory.")) return;
    setVoiding(true);
    try {
      await api.post(`/sales/${saleId}/void`);
      alert("Transaction voided successfully.");
      loadSales();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to void transaction");
    } finally {
      setVoiding(false);
    }
  };

  // Printable receipt blob download trigger (with Auth header)
  const viewReceiptPdf = async (saleId: string, type: 'direct' | 'pdf') => {
    try {
      const response = await api.get(`/sales/${saleId}/receipt`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      if (type === 'direct') {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
          }, 1000);
        };
      } else {
        window.open(url, "_blank");
      }
    } catch (err) {
      console.error("Failed to fetch receipt PDF:", err);
      alert("Failed to load receipt PDF.");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Left List Pane */}
      <div className="md:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 select-none">
            <span
              onDoubleClick={() => {
                setShowingNontaxable(!showingNontaxable);
                setSelectedSale(null);
              }}
              title="Double-click to toggle taxable/non-taxable registry"
              className="cursor-pointer"
            >
              <FileText
                className={`h-6 w-6 transition-colors ${showingNontaxable ? "text-emerald-500 hover:text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}
              />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {showingNontaxable ? "Non-Taxable Sales Invoice Registry" : "Sales Invoice Registry"}
              </h1>
              <p className="text-xs text-slate-505">
                {showingNontaxable 
                  ? "Bury/hidden log tracking for non-taxable sales." 
                  : "Comprehensive transaction registry and BIR compliant log tracking."}
              </p>
            </div>
          </div>
          <button
            onClick={loadSales}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 transition-colors"
            title="Refresh Sales"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice, customer, cashier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-10 pr-4 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="">All Payment Types</option>
              <option value="CASH">Cash</option>
              <option value="GCASH">GCash</option>
              <option value="MAYA">Maya</option>
              <option value="CREDIT_CARD">Credit Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="SPLIT">Split Payment</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="VOID">Voided</option>
            </select>
          </div>
        </div>

        {/* Transactions Table Grid */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                <th className="p-3">Invoice No</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Cashier</th>
                <th className="p-3">Date</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-sky-500" />
                  </td>
                </tr>
              ) : filteredSales.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedSale(s)}
                  className={`cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors ${
                    selectedSale?.id === s.id ? "bg-sky-500/5 dark:bg-sky-950/20" : ""
                  }`}
                >
                  <td className="p-3 font-mono font-bold text-slate-950 dark:text-slate-200">{s.invoiceNo}</td>
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-150">
                    {s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : <span className="text-slate-400 font-normal">Walk-in Customer</span>}
                  </td>
                  <td className="p-3 text-slate-500 truncate max-w-[120px]" title={s.createdBy}>{s.createdBy}</td>
                  <td className="p-3 text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                    P{s.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide ${
                        s.status === "COMPLETED" 
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-450 border border-emerald-350/20" 
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-450 border border-rose-350/20"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    No transactions found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Details Pane */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 h-fit space-y-6">
        {selectedSale ? (
          <>
            {/* Header section */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 p-5 text-white shadow-md border border-slate-200/10">
              <div className="flex items-start justify-between relative z-10">
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold tracking-tight">{selectedSale.invoiceNo}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>{new Date(selectedSale.createdAt).toLocaleDateString()}</span>
                    <Clock className="h-3 w-3 shrink-0 ml-1.5" />
                    <span>{new Date(selectedSale.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${
                  selectedSale.status === "COMPLETED"
                    ? "bg-emerald-500/20 text-emerald-450 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-450 border border-rose-500/30"
                }`}>
                  {selectedSale.status}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center relative z-10">
                <button
                  onClick={() => {
                    setPrintInvoiceId(selectedSale.id);
                    setShowPrintModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-sky-600 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" /> View/Print Invoice
                </button>
                {selectedSale.status === "COMPLETED" && (
                  <button
                    onClick={() => handleVoidSale(selectedSale.id)}
                    disabled={voiding}
                    className="flex items-center gap-1 rounded-lg bg-rose-600/80 border border-rose-500/20 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-rose-600 transition-all disabled:opacity-50"
                  >
                    <Ban className="h-3.5 w-3.5" /> Void Sale
                  </button>
                )}
              </div>
            </div>

            {/* Operator and Client details */}
            <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Cashier Operator</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={selectedSale.createdBy}>
                  {selectedSale.createdBy}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Client Profile</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedSale.customer 
                    ? `${selectedSale.customer.firstName} ${selectedSale.customer.lastName}`
                    : "Walk-in Customer"
                  }
                </p>
              </div>
            </div>

            {/* BIR Compliance Sales Tax Breakdowns */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/20 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-350">
                <Award className="h-4 w-4 text-sky-500" />
                <span>BIR COMPLIANCE SALES TAX REPORT</span>
              </div>
              
              <div className="space-y-1.5 text-[11px] font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-400">VATable Sales (VAT Exclusive)</span>
                  <span className="text-slate-800 dark:text-slate-250">
                    P{(selectedSale.vatableSales ?? (selectedSale.tax > 0 ? selectedSale.total / 1.12 : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">VAT Amount (12%)</span>
                  <span className="text-slate-800 dark:text-slate-250">
                    P{(selectedSale.vatAmount ?? (selectedSale.tax > 0 ? (selectedSale.total / 1.12) * 0.12 : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100/50 pt-1.5 mt-1.5">
                  <span className="text-slate-400">VAT Exempt Sales</span>
                  <span className="text-slate-800 dark:text-slate-250">
                    P{(selectedSale.vatExemptSales ?? (selectedSale.tax === 0 ? selectedSale.total : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Zero-Rated Sales</span>
                  <span className="text-slate-800 dark:text-slate-250">
                    P{(selectedSale.zeroRatedSales ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200/80 pt-2 mt-2 text-xs font-bold">
                  <span className="text-slate-800 dark:text-slate-200">Total Amount Received</span>
                  <span className="text-sky-600 dark:text-sky-400">
                    P{selectedSale.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Senior Citizen / PWD Details block */}
            {(selectedSale.scPwdId || selectedSale.scPwdName) && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/20 p-4 dark:border-amber-900/20 dark:bg-amber-950/10 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 font-bold">
                  <Sparkles className="h-4 w-4" />
                  <span>SC/PWD Discount Verification Info</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-350">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">SC/PWD Name</span>
                    {selectedSale.scPwdName}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">SC/PWD ID Card</span>
                    {selectedSale.scPwdId}
                  </div>
                  {selectedSale.scPwdTin && (
                    <div className="col-span-2 mt-1">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Taxpayer TIN</span>
                      {selectedSale.scPwdTin}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment breakdowns list */}
            <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <h4 className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <CreditCard className="h-3.5 w-3.5" /> Payments Received ({selectedSale.payments?.length || 0})
              </h4>
              <div className="space-y-2">
                {selectedSale.payments?.map((pay: any) => (
                  <div key={pay.id} className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg dark:bg-slate-950/40 text-[11px] flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">{pay.type}</span>
                      {pay.reference && <span className="text-slate-400 ml-2">Ref: {pay.reference}</span>}
                    </div>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">
                      P{pay.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Items detail list */}
            <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <h4 className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <ShoppingBag className="h-3.5 w-3.5" /> Items Purchased ({selectedSale.items?.length || 0})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {selectedSale.items?.map((item: any) => (
                  <div key={item.id} className="bg-slate-50 border border-slate-100 p-3 rounded-lg dark:bg-slate-950/40 text-[11px] space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-900 dark:text-slate-100 truncate pr-4">{item.product.name}</span>
                      <span className="text-slate-950 dark:text-slate-100 shrink-0">
                        P{(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                      <span>{item.quantity} units x P{item.price.toFixed(2)}</span>
                      {item.warranty && <span>Warranty: {item.warranty}</span>}
                    </div>
                    {item.serialNo && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        S/N: {item.serialNo}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-32 text-xs text-slate-400 space-y-3">
            <div className="text-3xl">🧾</div>
            <p>Select a sales transaction to inspect details, print BIR invoice receipt, or issue void adjustments.</p>
          </div>
        )}
      </div>

      {showPrintModal && printInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Printer className="h-5 w-5 text-sky-500" />
              Print Receipt Options
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Choose how you would like to output the invoice receipt:
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => {
                  viewReceiptPdf(printInvoiceId, 'direct');
                  setShowPrintModal(false);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 transition-colors"
              >
                <Printer className="h-4 w-4" /> Print to Default Printer
              </button>
              <button
                onClick={() => {
                  viewReceiptPdf(printInvoiceId, 'pdf');
                  setShowPrintModal(false);
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-850 dark:bg-slate-950/20 dark:text-slate-350 dark:hover:bg-slate-900 transition-colors"
              >
                <FileText className="h-4 w-4" /> Print to PDF / View
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="mt-2 text-center text-xs text-slate-450 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
