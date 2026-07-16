import React, { useEffect, useState, useRef } from "react";
import { Plus, Search, Calendar, Cpu, CheckCircle, RefreshCw, Printer, PenTool } from "lucide-react";
import { api } from "../services/api";

// Simple drawing canvas for digital signatures
function SignaturePad({ onSave, label }: { onSave: (dataUrl: string) => void; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSave("");
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-slate-400">{label}</label>
        <button
          type="button"
          onClick={clear}
          className="text-[10px] font-semibold text-rose-500 hover:underline"
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={200}
        height={80}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="border border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-crosshair dark:border-slate-800 dark:bg-slate-950"
      />
    </div>
  );
}

export function RepairsView() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    customerId: "",
    brand: "",
    model: "",
    serialNumber: "",
    accessories: "",
    issueDescription: "",
    internalNotes: "",
    repairNotes: "",
    cost: 0,
    status: "PENDING",
    technicianId: "",
    customerSignature: "",
    technicianSignature: "",
    expirationDate: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [ticketRes, custRes, userRes] = await Promise.all([
        api.get(`/repairs?status=${statusFilter}`),
        api.get("/customers"),
        api.get("/auth/users"),
      ]);
      setTickets(ticketRes.data);
      setCustomers(custRes.data);
      setTechnicians(userRes.data.filter((u: any) => u.role === "REPAIRS" || u.role === "ADMIN" || u.role === "SUPERADMIN"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const openAddModal = () => {
    setEditingTicket(null);
    setFormData({
      customerId: "",
      brand: "",
      model: "",
      serialNumber: "",
      accessories: "",
      issueDescription: "",
      internalNotes: "",
      repairNotes: "",
      cost: 0,
      status: "PENDING",
      technicianId: "",
      customerSignature: "",
      technicianSignature: "",
      expirationDate: "",
    });
    setShowModal(true);
  };

  const openEditModal = (t: any) => {
    setEditingTicket(t);
    setFormData({
      ...t,
      expirationDate: t.expirationDate ? t.expirationDate.slice(0, 10) : "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        cost: parseFloat(formData.cost),
        technicianId: formData.technicianId || null,
        expirationDate: formData.expirationDate || null,
      };

      if (editingTicket) {
        await api.put(`/repairs/${editingTicket.id}`, payload);
      } else {
        await api.post("/repairs", payload);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save repair ticket");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this repair ticket?")) return;
    try {
      await api.delete(`/repairs/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };

  const printTicket = (id: string) => {
    window.open(`/api/v1/repairs/${id}/pdf`, "_blank");
  };

  const statusColors: any = {
    PENDING: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300",
    DIAGNOSING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    WAITING_PARTS: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    REPAIRING: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    CLAIMED: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
    EXPIRED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hardware Repairs Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create tickets, log status history updates, assign technicians, and capture canvas signatures.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" /> Open Repair Ticket
        </button>
      </div>

      {/* Filter panel */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="text-xs font-semibold text-slate-500">Filter Status:</label>
        <div className="flex flex-wrap gap-2">
          {["", "PENDING", "DIAGNOSING", "WAITING_PARTS", "REPAIRING", "COMPLETED", "CLAIMED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1 text-xs font-medium border shadow-sm ${
                statusFilter === st
                  ? "bg-sky-500 text-white border-sky-500"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {st || "All Tickets"}
            </button>
          ))}
        </div>
      </div>

      {/* Repairs database table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <th className="p-4">Ticket No</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Device Brand/Model</th>
              <th className="p-4">Reported Issue</th>
              <th className="p-4">Technician</th>
              <th className="p-4 text-right">Cost</th>
              <th className="p-4 text-center">Status</th>
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
            ) : tickets.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                <td className="p-4">
                  <div className="font-bold text-slate-950 dark:text-slate-100">{t.ticketNo}</div>
                  <div className="text-[10px] text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</div>
                </td>
                <td className="p-4">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {t.customer.firstName} {t.customer.lastName}
                  </div>
                  <div className="text-[10px] text-slate-400">{t.customer.mobile}</div>
                </td>
                <td className="p-4">
                  <div className="font-bold">{t.brand} {t.model}</div>
                  <div className="text-[10px] text-slate-400 font-mono">SN: {t.serialNumber}</div>
                </td>
                <td className="p-4 text-slate-500 max-w-xs truncate">{t.issueDescription}</td>
                <td className="p-4 text-slate-600">
                  {t.technician ? `${t.technician.firstName} ${t.technician.lastName}` : "Unassigned"}
                </td>
                <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                  P{t.cost.toLocaleString()}
                </td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[t.status]}`}>
                    {t.status}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => printTicket(t.id)}
                      className="rounded p-1 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      title="Print Work Ticket PDF"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(t)}
                      className="rounded bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-600 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-slate-400">
                  No repair tickets registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[95vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold">{editingTicket ? "Update Repair Ticket" : "Open Repair Ticket"}</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Customer *</label>
                <select
                  required
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400">Assign Technician</label>
                <select
                  value={formData.technicianId || ""}
                  onChange={(e) => setFormData({ ...formData, technicianId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">-- Unassigned --</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.firstName} {tech.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <label className="text-[10px] font-bold text-slate-400">Model *</label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Serial Number *</label>
                <input
                  type="text"
                  required
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">Estimated Cost *</label>
                <input
                  type="number"
                  required
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Expiration Date</label>
                <input
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="PENDING">Pending</option>
                  <option value="DIAGNOSING">Diagnosing</option>
                  <option value="WAITING_PARTS">Waiting Parts</option>
                  <option value="REPAIRING">Repairing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CLAIMED">Claimed</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Accessories Included</label>
              <input
                type="text"
                value={formData.accessories || ""}
                onChange={(e) => setFormData({ ...formData, accessories: e.target.value })}
                placeholder="e.g. Heatsink, original box, power cable"
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Issue Description *</label>
              <textarea
                required
                value={formData.issueDescription}
                onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Repair Action Notes</label>
              <textarea
                value={formData.repairNotes || ""}
                onChange={(e) => setFormData({ ...formData, repairNotes: e.target.value })}
                placeholder="Detailed log of what was fixed"
                rows={2}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            {/* Signature canvases */}
            {!editingTicket && (
              <div className="grid grid-cols-2 gap-4">
                <SignaturePad
                  label="Customer Signature (Consent)"
                  onSave={(data) => setFormData((prev: any) => ({ ...prev, customerSignature: data }))}
                />
                <SignaturePad
                  label="Technician Signature"
                  onSave={(data) => setFormData((prev: any) => ({ ...prev, technicianSignature: data }))}
                />
              </div>
            )}

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
                Save Ticket
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
