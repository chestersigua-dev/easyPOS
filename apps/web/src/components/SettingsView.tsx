import React, { useEffect, useState } from "react";
import { ShieldAlert, KeyRound, Save, Plus, Trash2, Smartphone, ShieldCheck, User } from "lucide-react";
import { api } from "../services/api";
import { useAuthStore } from "../store/auth";
import { useToastStore } from "../store/toast";
import { ThemeView } from "./ThemeView";

export function SettingsView() {
  const { user, updateUser } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const [settings, setSettings] = useState<any>({
    APP_NAME: "EasyPOS Store",
    TAX_RATE: "12",
    CURRENCY: "PHP",
    TIMEZONE: "Asia/Manila",
    RECEIPT_HEADER: "",
    RECEIPT_FOOTER: "",
  });

  // SaaS License states (SuperAdmin only)
  const [saasPlan, setSaasPlan] = useState<string>("ENTERPRISE");
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [savingSaas, setSavingSaas] = useState(false);

  // User profile states
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    password: "",
  });
  const [profilePhoto, setProfilePhoto] = useState<string>(user?.profilePhoto || "");
  const [profileSaving, setProfileSaving] = useState(false);

  // User list management
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ email: "", password: "", firstName: "", lastName: "", roleId: "", status: "ACTIVE" });

  // Store list management
  const [storesList, setStoresList] = useState<any[]>([]);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [newStoreData, setNewStoreData] = useState({ name: "", address: "" });

  // MFA setup states
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaQrUrl, setMfaQrUrl] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaStep, setMfaStep] = useState<"IDLE" | "SETUP" | "VERIFIED">("IDLE");

  const [saving, setSaving] = useState(false);

  const presetTiers: { [key: string]: string[] } = {
    STARTER: ["DASHBOARD", "POS", "CUSTOMERS"],
    PROFESSIONAL: ["DASHBOARD", "POS", "PRODUCTS", "CUSTOMERS", "SUPPLIERS"],
    ENTERPRISE: ["DASHBOARD", "POS", "PRODUCTS", "REPAIRS", "CUSTOMERS", "SUPPLIERS", "ACCOUNTING"],
  };

  const loadData = async () => {
    try {
      if (user?.role === "SUPERADMIN" || user?.role === "ADMIN") {
        const [settingsRes, rolesRes, usersRes, storesRes] = await Promise.all([
          api.get("/system/settings"),
          api.get("/auth/roles"),
          api.get("/auth/users"),
          api.get("/stores").catch(() => ({ data: [] })),
        ]);
        setSettings(settingsRes.data);
        setRoles(rolesRes.data);
        setUsers(usersRes.data);
        setStoresList(storesRes.data);

        // Load SaaS details
        const plan = settingsRes.data.SAAS_PLAN || "ENTERPRISE";
        setSaasPlan(plan);

        const modulesStr = settingsRes.data.ENABLED_MODULES;
        const modules = modulesStr
          ? modulesStr.split(",")
          : ["DASHBOARD", "POS", "PRODUCTS", "REPAIRS", "CUSTOMERS", "SUPPLIERS", "ACCOUNTING"];
        setEnabledModules(modules);
      }
    } catch (err) {
      console.error("Failed to load settings data:", err);
    }
  };

  useEffect(() => {
    loadData();
    if (user?.mfaEnabled) {
      setMfaStep("VERIFIED");
    }
    if (user) {
      setProfileData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: "",
      });
      setProfilePhoto(user.profilePhoto || "");
    }
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await api.put("/auth/me", {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        password: profileData.password || undefined,
        profilePhoto: profilePhoto || null,
      });
      updateUser(res.data.user);
      setProfileData((prev) => ({ ...prev, password: "" }));
      addToast("Profile details updated successfully!", "success");
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to save profile details", "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image file size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePlanChange = (plan: string) => {
    setSaasPlan(plan);
    if (plan !== "CUSTOM") {
      setEnabledModules(presetTiers[plan]);
    }
  };

  const handleModuleToggle = (module: string) => {
    if (saasPlan !== "CUSTOM") return;
    setEnabledModules((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module]
    );
  };

  const handleSaasSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSaas(true);
    try {
      await api.post("/system/settings", {
        SAAS_PLAN: saasPlan,
        ENABLED_MODULES: enabledModules.join(","),
      });

      if (user) {
        updateUser({
          enabledModules: enabledModules,
        });
      }

      addToast("SaaS license tier and modules updated successfully!", "success");
    } catch (err) {
      addToast("Failed to save SaaS license settings", "error");
    } finally {
      setSavingSaas(false);
    }
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/system/settings", settings);
      addToast("Settings saved successfully!", "success");
    } catch (err) {
      addToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUserCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/auth/users", newUserData);
      setShowUserModal(false);
      setNewUserData({ email: "", password: "", firstName: "", lastName: "", roleId: "", status: "ACTIVE" });
      addToast("User created successfully!", "success");
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to create user", "error");
    }
  };

  const handleUserDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/auth/users/${id}`);
      addToast("User deleted successfully!", "success");
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to delete user", "error");
    }
  };

  const handleStoreCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/stores", newStoreData);
      setShowStoreModal(false);
      setNewStoreData({ name: "", address: "" });
      addToast("Store location created successfully!", "success");
      loadData();
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to create store location", "error");
    }
  };

  // MFA bindings
  const initiateMfa = async () => {
    try {
      const res = await api.post("/auth/mfa/setup");
      setMfaSecret(res.data.secret);
      setMfaQrUrl(res.data.qrDataUrl);
      setMfaStep("SETUP");
      addToast("MFA secret generated. Scan the QR code to proceed.", "info");
    } catch (err) {
      addToast("MFA initialization failed", "error");
    }
  };

  const verifyAndEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/auth/mfa/verify", { token: mfaToken });
      updateUser({ mfaEnabled: true });
      setMfaStep("VERIFIED");
      setMfaToken("");
      addToast("Multi-Factor Authentication enabled successfully!", "success");
    } catch (err: any) {
      addToast(err.response?.data?.error || "Verification failed", "error");
    }
  };

  const disableMfa = async () => {
    if (!confirm("Are you sure you want to disable Multi-Factor Authentication?")) return;
    try {
      await api.post("/auth/mfa/disable");
      updateUser({ mfaEnabled: false });
      setMfaStep("IDLE");
      setMfaSecret("");
      setMfaQrUrl("");
      addToast("Multi-Factor Authentication disabled", "info");
    } catch (err) {
      addToast("Failed to disable MFA", "error");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Settings Form Column */}
      <div className="md:col-span-2 space-y-6">

        {/* Personal Profile Settings */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold tracking-tight mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-sky-500" /> Personal Profile Details
          </h2>

          <form onSubmit={handleProfileSave} className="space-y-4">
            {/* Profile Photo Upload */}
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="relative h-16 w-16 shrink-0 rounded-xl bg-slate-100 border border-slate-200 dark:border-slate-800 dark:bg-slate-950 flex items-center justify-center overflow-hidden shadow-inner">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl text-slate-400">👤</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profile Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="text-xs text-slate-500 file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-600 dark:file:bg-sky-950/40 dark:file:text-sky-300 hover:file:bg-sky-100 cursor-pointer"
                />
                {profilePhoto && (
                  <button
                    type="button"
                    onClick={() => setProfilePhoto("")}
                    className="text-[10px] text-rose-500 hover:underline font-semibold w-fit"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400">First Name</label>
                <input
                  type="text"
                  required
                  value={profileData.firstName}
                  onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Last Name</label>
                <input
                  type="text"
                  required
                  value={profileData.lastName}
                  onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Email Address</label>
              <input
                type="email"
                required
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Change Password (Leave blank to keep current)</label>
              <input
                type="password"
                value={profileData.password}
                onChange={(e) => setProfileData({ ...profileData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {profileSaving ? "Saving profile..." : "Save Profile Details"}
            </button>
          </form>
        </div>

        {user?.role === "ADMIN" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold tracking-tight mb-4 flex items-center gap-2">
              <Save className="h-5 w-5 text-sky-500" /> Business Profile & Localization
            </h2>

            <form onSubmit={handleSettingsSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400">Application Brand Name</label>
                  <input
                    type="text"
                    value={settings.APP_NAME}
                    onChange={(e) => setSettings({ ...settings, APP_NAME: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400">Tax VAT Rate (%)</label>
                  <input
                    type="number"
                    value={settings.TAX_RATE}
                    onChange={(e) => setSettings({ ...settings, TAX_RATE: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400">Store Currency Code</label>
                  <input
                    type="text"
                    value={settings.CURRENCY}
                    onChange={(e) => setSettings({ ...settings, CURRENCY: e.target.value })}
                    maxLength={3}
                    className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400">Local Timezone</label>
                  <input
                    type="text"
                    value={settings.TIMEZONE}
                    onChange={(e) => setSettings({ ...settings, TIMEZONE: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400">Thermal Receipt Header</label>
                <textarea
                  value={settings.RECEIPT_HEADER}
                  onChange={(e) => setSettings({ ...settings, RECEIPT_HEADER: e.target.value })}
                  rows={2}
                  placeholder="Business Name, address, phone info..."
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400">Thermal Receipt Footer</label>
                <textarea
                  value={settings.RECEIPT_FOOTER}
                  onChange={(e) => setSettings({ ...settings, RECEIPT_FOOTER: e.target.value })}
                  rows={2}
                  placeholder="Thank you note, warranty policies..."
                  className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600"
              >
                {saving ? "Saving settings..." : "Save Settings"}
              </button>
            </form>
          </div>
        )}

        {/* User Account Registry (Admins only) */}
        {(user?.role === "SUPERADMIN" || user?.role === "ADMIN") && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-sky-500" /> User Accounts Registry
              </h2>
              {user?.role !== "SUPERADMIN" && (
                <button
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center gap-1 rounded bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-600"
                >
                  <Plus className="h-3 w-3" /> Add Account
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                    <th className="pb-2">Name</th>
                    {user?.role === "SUPERADMIN" && <th className="pb-2">Business</th>}
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 font-semibold">
                        {u.firstName} {u.lastName}
                      </td>
                      {user?.role === "SUPERADMIN" && (
                        <td className="py-2.5 font-semibold text-sky-500">
                          {u.businessName || "System / Global"}
                        </td>
                      )}
                      <td className="py-2.5 text-slate-500">{u.email}</td>
                      <td className="py-2.5 text-slate-900 dark:text-slate-200 font-bold">{u.role}</td>
                      <td className="py-2.5">
                        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          onClick={() => handleUserDelete(u.id)}
                          className="text-rose-500 hover:text-rose-600 disabled:opacity-50"
                          disabled={u.email === "superadmin@easypos.com"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Store Locations Registry (Tenant Admins only) */}
        {user?.role === "ADMIN" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-sky-500" /> Store Locations Registry
              </h2>
              <button
                onClick={() => setShowStoreModal(true)}
                className="flex items-center gap-1 rounded bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-600"
              >
                <Plus className="h-3 w-3" /> Add Location
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                    <th className="pb-2">Branch / Store Name</th>
                    <th className="pb-2">Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {storesList.map((st) => (
                    <tr key={st.id}>
                      <td className="py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                        🏢 {st.name}
                      </td>
                      <td className="py-2.5 text-slate-500">{st.address || "No address provided"}</td>
                    </tr>
                  ))}
                  {storesList.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-2.5 text-center text-slate-400">
                        No store locations registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Theme Settings (Admin/SuperAdmin only) */}
        {(user?.role === "ADMIN" || user?.role === "SUPERADMIN") && (
          <ThemeView />
        )}
      </div>

      {/* Multi-Factor Authentication (All users) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 h-fit space-y-6">
        <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-sky-500" /> Multi-Factor Authentication
        </h2>

        {mfaStep === "IDLE" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Enhance account security by configuring Time-based One-Time Passwords (TOTP) from an authenticator app (Google Authenticator, Duo).
            </p>
            <button
              onClick={initiateMfa}
              className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Set Up Authenticator
            </button>
          </div>
        )}

        {mfaStep === "SETUP" && (
          <form onSubmit={verifyAndEnableMfa} className="space-y-4 text-xs">
            <p className="text-slate-500 leading-relaxed">
              1. Scan this QR Code with your Google Authenticator or copy key:
            </p>
            {mfaQrUrl && (
              <img src={mfaQrUrl} alt="MFA QR Code" className="mx-auto border border-slate-100 rounded-lg p-2 bg-white" />
            )}
            <div className="font-mono bg-slate-50 p-2 rounded text-center border dark:bg-slate-950">
              Key: {mfaSecret}
            </div>

            <p className="text-slate-500 leading-relaxed">
              2. Enter the 6-digit confirmation code generated by your app:
            </p>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="000000"
              value={mfaToken}
              onChange={(e) => setMfaToken(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-center text-sm font-bold tracking-widest outline-none dark:border-slate-800 dark:bg-slate-950"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-sky-500 py-2 text-xs font-semibold text-white hover:bg-sky-600"
            >
              Verify & Enable
            </button>
          </form>
        )}

        {mfaStep === "VERIFIED" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <div>
                <div className="text-xs font-bold">MFA Enabled</div>
                <div className="text-[10px] opacity-80 mt-0.5">TOTP passcode verification is active.</div>
              </div>
            </div>
            <button
              onClick={disableMfa}
              className="w-full rounded-lg border border-rose-200 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-800"
            >
              Disable MFA
            </button>
          </div>
        )}
      </div>

      {/* User Create Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleUserCreate}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <h3 className="text-lg font-bold">Add User Account</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400">First Name *</label>
                <input
                  type="text"
                  required
                  value={newUserData.firstName}
                  onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">Last Name *</label>
                <input
                  type="text"
                  required
                  value={newUserData.lastName}
                  onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Email Address *</label>
              <input
                type="email"
                required
                value={newUserData.email}
                onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Password *</label>
              <input
                type="password"
                required
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Security Role *</label>
              <select
                value={newUserData.roleId}
                required
                onChange={(e) => setNewUserData({ ...newUserData, roleId: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="">-- Choose Role --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.description})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800"
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Store Create Modal */}
      {showStoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleStoreCreate}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <h3 className="text-lg font-bold">Add Store Location</h3>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Store Name *</label>
              <input
                type="text"
                required
                value={newStoreData.name}
                onChange={(e) => setNewStoreData({ ...newStoreData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400">Address / Location Details</label>
              <input
                type="text"
                value={newStoreData.address}
                onChange={(e) => setNewStoreData({ ...newStoreData, address: e.target.value })}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowStoreModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800"
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
              >
                Create Location
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
