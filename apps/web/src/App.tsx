import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Cpu,
  Wrench,
  Users,
  Building,
  BarChart3,
  Settings,
  ShieldAlert,
  LogOut,
  Sun,
  Moon,
  Laptop,
  Lock,
  Mail,
  ShieldCheck,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useAuthStore } from "./store/auth";
import { api } from "./services/api";

// Page Views
import { DashboardView } from "./components/DashboardView";
import { PosView } from "./components/PosView";
import { ProductsView } from "./components/ProductsView";
import { RepairsView } from "./components/RepairsView";
import { CustomersView } from "./components/CustomersView";
import { SuppliersView } from "./components/SuppliersView";
import { AccountingView } from "./components/AccountingView";
import { SettingsView } from "./components/SettingsView";
import { ResetView } from "./components/ResetView";

type Tab =
  | "DASHBOARD"
  | "POS"
  | "PRODUCTS"
  | "REPAIRS"
  | "CUSTOMERS"
  | "SUPPLIERS"
  | "ACCOUNTING"
  | "SETTINGS"
  | "RESET";

export default function App() {
  const { user, accessToken, setAuth, logout } = useAuthStore();

  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>("DASHBOARD");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // App Settings Cache (Brand Name)
  const [appName, setAppName] = useState("EasyPOS Hub");

  // Load app name from settings
  const fetchSettings = async () => {
    try {
      const res = await api.get("/system/settings");
      if (res.data?.APP_NAME) {
        setAppName(res.data.APP_NAME);
      }
    } catch (err) {
      console.log("Failed to load business brand settings");
    }
  };

  useEffect(() => {
    if (accessToken && user) {
      fetchSettings();
      // Set default tab based on role permissions and active licensing modules
      let preferred: Tab = "DASHBOARD";
      if (user.role === "SALES") {
        preferred = "POS";
      } else if (user.role === "REPAIRS") {
        preferred = "REPAIRS";
      }

      const isEnabled = !user.enabledModules || user.enabledModules.includes(preferred);
      if (isEnabled) {
        setActiveTab(preferred);
      } else if (user.enabledModules && user.enabledModules.length > 0) {
        const firstEnabled = navigationItems.find((item) => user.enabledModules!.includes(item.id));
        if (firstEnabled) {
          setActiveTab(firstEnabled.id as Tab);
        }
      }
    }
  }, [accessToken, user]);

  // Ensure active tab remains within enabled modules if modified dynamically
  useEffect(() => {
    if (user && user.enabledModules && !user.enabledModules.includes(activeTab)) {
      const firstEnabled = navigationItems.find((item) => user.enabledModules!.includes(item.id));
      if (firstEnabled) {
        setActiveTab(firstEnabled.id as Tab);
      }
    }
  }, [user, activeTab]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoggingIn(true);

    try {
      const res = await api.post("/auth/login", { email, password });

      if (res.data?.mfaRequired) {
        setMfaRequired(true);
        setMfaUserId(res.data.userId);
      } else {
        setAuth(res.data.accessToken, res.data.user);
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || "Login credentials rejected.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoggingIn(true);

    try {
      const res = await api.post("/auth/login/mfa", { userId: mfaUserId, token: mfaCode });
      setAuth(res.data.accessToken, res.data.user);
      setMfaRequired(false);
      setMfaUserId("");
      setMfaCode("");
    } catch (err: any) {
      setAuthError(err.response?.data?.error || "Invalid verification code.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error(err);
    } finally {
      logout();
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Define sidebar navigation tabs with RBAC controls
  const navigationItems = [
    { id: "DASHBOARD", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPERADMIN", "ADMIN", "ACCOUNTING"] },
    { id: "POS", label: "POS Screen", icon: ShoppingCart, roles: ["SUPERADMIN", "ADMIN", "SALES"] },
    { id: "PRODUCTS", label: "Inventory", icon: Cpu, roles: ["SUPERADMIN", "ADMIN", "ACCOUNTING", "REPAIRS"] },
    { id: "REPAIRS", label: "Repairs", icon: Wrench, roles: ["SUPERADMIN", "ADMIN", "REPAIRS"] },
    { id: "CUSTOMERS", label: "Customers", icon: Users, roles: ["SUPERADMIN", "ADMIN", "SALES", "REPAIRS"] },
    { id: "SUPPLIERS", label: "Suppliers", icon: Building, roles: ["SUPERADMIN", "ADMIN"] },
    { id: "ACCOUNTING", label: "Accounting", icon: BarChart3, roles: ["SUPERADMIN", "ADMIN", "ACCOUNTING"] },
    { id: "SETTINGS", label: "Profile & Settings", icon: Settings, roles: ["SUPERADMIN", "ADMIN", "ACCOUNTING", "SALES", "REPAIRS"] },
    { id: "RESET", label: "Sanitize Reset", icon: ShieldAlert, roles: ["SUPERADMIN"] },
  ];

  const visibleNavs = navigationItems.filter(
    (item) =>
      user &&
      item.roles.includes(user.role) &&
      (!user.enabledModules || user.enabledModules.includes(item.id))
  );

  // --- UNAUTHENTICATED SCREEN (LOGIN) ---
  if (!accessToken || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="text-center">
            <span className="text-4xl">💻</span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">EasyPOS Hub Login</h2>
            <p className="mt-1.5 text-xs text-slate-400">
              Computer Parts Shop Enterprise Point of Sale
            </p>
          </div>

          {authError && (
            <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-600 dark:bg-rose-950/20">
              {authError}
            </div>
          )}

          {!mfaRequired ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Email Address</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@easypos.com"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="mt-6 w-full rounded-xl bg-sky-500 py-3 text-xs font-bold text-white shadow-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loggingIn ? "Signing In..." : "Sign In to POS"}
              </button>
            </form>
          ) : (
            /* MFA Token Verification Form */
            <form onSubmit={handleMfaSubmit} className="mt-6 space-y-4">
              <div className="text-center bg-sky-500/10 rounded-lg p-3 text-sky-600 dark:bg-sky-950/20 text-xs font-semibold flex items-center gap-2 justify-center">
                <ShieldCheck className="h-4 w-4" /> Multi-Factor Authentication Required
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                  Enter 6-Digit Authenticator App Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="000 000"
                  className="w-full mt-2 rounded-xl border border-slate-200 py-3 text-center text-lg font-bold tracking-widest outline-none focus:border-sky-500 dark:border-slate-800 dark:bg-slate-950"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-850 dark:bg-slate-100 dark:text-slate-950"
              >
                {loggingIn ? "Verifying..." : "Verify Code & Sign In"}
              </button>
              <button
                type="button"
                onClick={() => setMfaRequired(false)}
                className="w-full text-center text-xs font-semibold text-slate-500 hover:underline mt-2"
              >
                Back to Login
              </button>
            </form>
          )}

          {/* Dev credentials tips */}
          <div className="mt-8 border-t border-slate-100 pt-4 dark:border-slate-800 text-center text-[10px] text-slate-400">
            <div>Seed Accounts (Pass: <span className="font-mono">admin123</span> / <span className="font-mono">sales123</span> etc):</div>
            <div className="mt-1 font-mono">superadmin@easypos.com | sales@easypos.com</div>
          </div>
        </div>
      </div>
    );
  }

  // --- AUTHENTICATED SCREEN (MAIN SYSTEM SHELL) ---
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 relative">
      {/* Mobile Sidebar Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-900 transition-all duration-300 md:relative md:translate-x-0 md:shadow-sm ${
          sidebarCollapsed ? "md:w-20 w-64" : "w-64"
        } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-2xl shrink-0">💻</span>
              {(!sidebarCollapsed || mobileMenuOpen) && (
                <div className="transition-opacity duration-300">
                  <h2 className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-slate-100 truncate">
                    {appName}
                  </h2>
                  <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest block truncate">
                    {user.role} CONTROL PANEL
                  </span>
                </div>
              )}
            </div>

            {/* Sidebar Collapse Toggle Button (desktop only) */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-500 shadow-sm focus:outline-none"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          </div>

          <nav className="space-y-1.5">
            {visibleNavs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as Tab);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 rounded-lg py-2 transition-all focus:outline-none ${
                    sidebarCollapsed && !mobileMenuOpen ? "justify-center px-0 w-full" : "px-3.5 w-full"
                  } ${
                    activeTab === item.id
                      ? "bg-sky-500 text-white shadow-sm shadow-sky-500/20"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-850"
                  }`}
                  title={sidebarCollapsed && !mobileMenuOpen ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {(!sidebarCollapsed || mobileMenuOpen) && (
                    <span className="text-xs font-bold">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer User info & Theme control */}
        <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          {/* Night Mode Switch */}
          {sidebarCollapsed && !mobileMenuOpen ? (
            <button
              onClick={toggleTheme}
              className="flex w-full items-center justify-center py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-850 rounded-lg focus:outline-none"
              title="Toggle Dark Mode"
            >
              {theme === "dark" ? <Moon className="h-4 w-4 text-sky-500" /> : <Sun className="h-4 w-4 text-amber-500" />}
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-4 w-4 text-sky-500" /> : <Sun className="h-4 w-4 text-amber-500" />}
                <span>Night Mode</span>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  theme === "dark" ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    theme === "dark" ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}

          <div className={`flex items-center gap-3 ${sidebarCollapsed && !mobileMenuOpen ? "justify-center" : ""}`}>
            {user.profilePhoto ? (
              <img
                src={user.profilePhoto}
                alt="Profile"
                className="h-9 w-9 shrink-0 rounded-lg object-cover shadow-inner"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white font-bold text-xs uppercase shadow-inner">
                {user.firstName[0]}
                {user.lastName[0]}
              </div>
            )}
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{user.firstName} {user.lastName}</div>
                <div className="truncate text-[9px] text-slate-400 font-mono mt-0.5">{user.email}</div>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/20 focus:outline-none ${
              sidebarCollapsed && !mobileMenuOpen ? "w-full px-0" : "w-full"
            }`}
            title={sidebarCollapsed && !mobileMenuOpen ? "Sign Out" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {(!sidebarCollapsed || mobileMenuOpen) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Toggle (Mobile) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-850 focus:outline-none"
              title="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="text-xs font-bold text-slate-400">
              System status: <span className="text-emerald-500">Live & Encrypted</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Dark mode toggler (header option) */}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 focus:outline-none"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Tab content panel */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === "DASHBOARD" && <DashboardView />}
          {activeTab === "POS" && <PosView />}
          {activeTab === "PRODUCTS" && <ProductsView />}
          {activeTab === "REPAIRS" && <RepairsView />}
          {activeTab === "CUSTOMERS" && <CustomersView />}
          {activeTab === "SUPPLIERS" && <SuppliersView />}
          {activeTab === "ACCOUNTING" && <AccountingView />}
          {activeTab === "SETTINGS" && <SettingsView />}
          {activeTab === "RESET" && <ResetView />}
        </main>

        {/* Sticky Footer */}
        <footer className="border-t border-slate-200 bg-white px-8 py-3.5 dark:border-slate-800 dark:bg-slate-900 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span className="font-medium">EasyPOS SaaS POS System v1.0</span>
          <span>
            EasyPOS&trade; by{" "}
            <a
              href="https://chestersigua.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 hover:underline font-bold"
            >
              Chester Sigua
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}
