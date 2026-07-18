import React, { useState, useEffect } from "react";
import { Palette, Save, RotateCcw, Paintbrush, Sliders, CheckCircle, Plus, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { useAuthStore } from "../store/auth";
import { useToastStore } from "../store/toast";
import { DEFAULT_THEMES, ThemeConfig, applyThemeConfig, resetThemeConfig, hexToHslValues } from "../utils/theme";

export function ThemeView() {
  const { user } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  // States
  const [selectedThemeKey, setSelectedThemeKey] = useState<string>("ocean");
  const [customPrimary, setCustomPrimary] = useState<string>("#0ea5e9");
  const [customBg, setCustomBg] = useState<string>("#090d16");
  const [customCard, setCustomCard] = useState<string>("#0f172a");

  // Custom theme naming
  const [newThemeName, setNewThemeName] = useState<string>("");
  const [customThemes, setCustomThemes] = useState<ThemeConfig[]>([]);

  const [saving, setSaving] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  // Load active theme and list of custom saved themes
  const loadThemeSettings = async () => {
    try {
      const res = await api.get("/system/settings");
      
      // Load custom themes array
      let loadedCustoms: ThemeConfig[] = [];
      if (res.data?.CUSTOM_THEMES) {
        try {
          loadedCustoms = JSON.parse(res.data.CUSTOM_THEMES);
          setCustomThemes(loadedCustoms);
        } catch (err) {
          console.error("Failed to parse custom themes list:", err);
        }
      }

      // Load active theme config
      if (res.data?.THEME_CONFIG) {
        const config = JSON.parse(res.data.THEME_CONFIG) as ThemeConfig;
        
        // Find if it matches a default theme
        const defaultKey = Object.keys(DEFAULT_THEMES).find(
          (k) => DEFAULT_THEMES[k].themeName === config.themeName
        );

        if (defaultKey) {
          setSelectedThemeKey(defaultKey);
        } else {
          // Check if it matches a saved custom theme
          const customIndex = loadedCustoms.findIndex(
            (t) => t.themeName === config.themeName
          );
          if (customIndex !== -1) {
            setSelectedThemeKey(`custom_${customIndex}`);
            setCustomPrimary(config.primaryHex || "#0ea5e9");
            setCustomBg(config.backgroundDarkHex || "#090d16");
            setCustomCard(config.cardDarkHex || "#0f172a");
          } else {
            // Unsaved custom colors
            setSelectedThemeKey("custom");
            setCustomPrimary(config.primaryHex || "#0ea5e9");
            setCustomBg(config.backgroundDarkHex || "#090d16");
            setCustomCard(config.cardDarkHex || "#0f172a");
          }
        }
        applyThemeConfig(config);
      }
    } catch (err) {
      console.error("Failed to load theme settings from server:", err);
    }
  };

  useEffect(() => {
    loadThemeSettings();
  }, []);

  // Handle standard presets selection
  const handleSelectStandardTheme = (key: string) => {
    setSelectedThemeKey(key);
    const theme = DEFAULT_THEMES[key];
    applyThemeConfig(theme);
    addToast(`Previewing ${theme.themeName} theme`, "info");
  };

  // Handle custom saved themes selection
  const handleSelectCustomSavedTheme = (index: number) => {
    const key = `custom_${index}`;
    setSelectedThemeKey(key);
    const theme = customThemes[index];
    setCustomPrimary(theme.primaryHex || "#0ea5e9");
    setCustomBg(theme.backgroundDarkHex || "#090d16");
    setCustomCard(theme.cardDarkHex || "#0f172a");
    applyThemeConfig(theme);
    addToast(`Previewing custom saved theme: ${theme.themeName}`, "info");
  };

  // Live preview custom overrides
  const handlePreviewCustomColors = () => {
    const priHsl = hexToHslValues(customPrimary);
    const bgHsl = hexToHslValues(customBg);
    const cardHsl = hexToHslValues(customCard);

    const hoverL = Math.max(10, priHsl.l - 10);
    const priHover = `${priHsl.h} ${priHsl.s}% ${hoverL}%`;
    const priTint = `${priHsl.h} ${priHsl.s}% 12%`;

    const config: ThemeConfig = {
      themeName: "Unsaved Custom",
      primary: priHsl.str,
      primaryHover: priHover,
      primaryTint: priTint,
      backgroundDark: bgHsl.str,
      cardDark: cardHsl.str,
      primaryHex: customPrimary,
      backgroundDarkHex: customBg,
      cardDarkHex: customCard
    };

    applyThemeConfig(config);
  };

  // Live preview whenever custom hexes are touched in Customizer mode
  useEffect(() => {
    if (selectedThemeKey === "custom") {
      handlePreviewCustomColors();
    }
  }, [customPrimary, customBg, customCard]);

  // Save active selection as the default business theme
  const handleSaveDefaultTheme = async () => {
    setSaving(true);
    try {
      let finalConfig: ThemeConfig;

      if (selectedThemeKey === "custom") {
        const priHsl = hexToHslValues(customPrimary);
        const bgHsl = hexToHslValues(customBg);
        const cardHsl = hexToHslValues(customCard);
        const hoverL = Math.max(10, priHsl.l - 10);
        const priHover = `${priHsl.h} ${priHsl.s}% ${hoverL}%`;
        const priTint = `${priHsl.h} ${priHsl.s}% 12%`;

        finalConfig = {
          themeName: "Custom Theme Override",
          primary: priHsl.str,
          primaryHover: priHover,
          primaryTint: priTint,
          backgroundDark: bgHsl.str,
          cardDark: cardHsl.str,
          primaryHex: customPrimary,
          backgroundDarkHex: customBg,
          cardDarkHex: customCard
        };
      } else if (selectedThemeKey.startsWith("custom_")) {
        const index = parseInt(selectedThemeKey.split("_")[1]);
        finalConfig = customThemes[index];
      } else {
        finalConfig = DEFAULT_THEMES[selectedThemeKey];
      }

      await api.post("/system/settings", {
        THEME_CONFIG: JSON.stringify(finalConfig)
      });

      applyThemeConfig(finalConfig);
      addToast(`Default theme successfully saved for business!`, "success");
    } catch (err: any) {
      addToast(err.response?.data?.error || "Failed to save theme setting", "error");
    } finally {
      setSaving(false);
    }
  };

  // Create and save custom theme to business database array
  const handleSaveAsNewTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeName || !newThemeName.trim()) {
      return addToast("Please specify a name for your custom theme", "info");
    }

    setSavingNew(true);
    try {
      const priHsl = hexToHslValues(customPrimary);
      const bgHsl = hexToHslValues(customBg);
      const cardHsl = hexToHslValues(customCard);
      const hoverL = Math.max(10, priHsl.l - 10);
      const priHover = `${priHsl.h} ${priHsl.s}% ${hoverL}%`;
      const priTint = `${priHsl.h} ${priHsl.s}% 12%`;

      const newTheme: ThemeConfig = {
        themeName: newThemeName.trim(),
        primary: priHsl.str,
        primaryHover: priHover,
        primaryTint: priTint,
        backgroundDark: bgHsl.str,
        cardDark: cardHsl.str,
        primaryHex: customPrimary,
        backgroundDarkHex: customBg,
        cardDarkHex: customCard
      };

      const updatedList = [...customThemes, newTheme];

      // Save custom themes list AND set it as active default theme config
      await api.post("/system/settings", {
        CUSTOM_THEMES: JSON.stringify(updatedList),
        THEME_CONFIG: JSON.stringify(newTheme)
      });

      setCustomThemes(updatedList);
      setSelectedThemeKey(`custom_${updatedList.length - 1}`);
      setNewThemeName("");
      applyThemeConfig(newTheme);
      addToast(`Custom theme "${newTheme.themeName}" created and saved!`, "success");
    } catch (err: any) {
      addToast("Failed to save new theme", "error");
    } finally {
      setSavingNew(false);
    }
  };

  // Delete custom saved theme
  const handleDeleteCustomTheme = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting it
    if (!confirm(`Are you sure you want to delete this custom theme?`)) return;

    try {
      const updatedList = customThemes.filter((_, i) => i !== index);
      
      const payload: any = {
        CUSTOM_THEMES: JSON.stringify(updatedList)
      };

      // If we are deleting the active selected theme, reset active to default Ocean Slate
      if (selectedThemeKey === `custom_${index}`) {
        setSelectedThemeKey("ocean");
        payload.THEME_CONFIG = JSON.stringify(DEFAULT_THEMES.ocean);
        applyThemeConfig(DEFAULT_THEMES.ocean);
      }

      await api.post("/system/settings", payload);
      setCustomThemes(updatedList);
      addToast("Custom theme deleted successfully", "success");
      
      // Reload setting configuration mapping
      loadThemeSettings();
    } catch (err) {
      addToast("Failed to delete custom theme", "error");
    }
  };

  const handleReset = () => {
    resetThemeConfig();
    setSelectedThemeKey("ocean");
    applyThemeConfig(DEFAULT_THEMES.ocean);
    addToast("Theme reset to default Ocean Slate", "info");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Palette className="h-6 w-6 text-sky-500" />
          <span>Business Appearance & Theme Settings</span>
        </h1>
        <p className="text-xs text-slate-500">
          Configure a custom complimentary color palette for this business. This theme will automatically apply to all store operators upon login.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Preset & Customizer */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Preset Color Themes */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <Paintbrush className="h-4.5 w-4.5 text-sky-500" />
              <span>Complimentary Preset Themes ({15 + customThemes.length} Available)</span>
            </h2>

            {/* Standard Presets Grid */}
            <div className="mb-6">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">System Presets</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.keys(DEFAULT_THEMES).map((key) => {
                  const theme = DEFAULT_THEMES[key];
                  const isSelected = selectedThemeKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectStandardTheme(key)}
                      className={`flex flex-col text-left rounded-xl p-3 border transition-all focus:outline-none ${
                        isSelected
                          ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/20"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{theme.themeName}</span>
                        {isSelected && <CheckCircle className="h-3.5 w-3.5 text-sky-500" />}
                      </div>

                      <div className="flex items-center gap-1.5 w-full">
                        <span className="h-3.5 w-7 rounded shadow-sm" style={{ backgroundColor: theme.primaryHex }} />
                        <span className="h-3.5 w-3.5 rounded shadow-sm border border-slate-700/20 dark:border-slate-300/20" style={{ backgroundColor: theme.cardDarkHex }} />
                        <span className="h-3.5 w-3.5 rounded shadow-sm border border-slate-700/20 dark:border-slate-300/20" style={{ backgroundColor: theme.backgroundDarkHex }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Saved Themes Section */}
            {customThemes.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Custom Saved Themes</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {customThemes.map((theme, index) => {
                    const isSelected = selectedThemeKey === `custom_${index}`;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectCustomSavedTheme(index)}
                        className={`flex flex-col text-left rounded-xl p-3 border transition-all focus:outline-none relative group ${
                          isSelected
                            ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/20"
                            : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2 pr-6">
                          <span className="text-xs font-bold text-slate-850 dark:text-slate-150 truncate">{theme.themeName}</span>
                          {isSelected && <CheckCircle className="h-3.5 w-3.5 text-sky-500" />}
                        </div>

                        <div className="flex items-center gap-1.5 w-full">
                          <span className="h-3.5 w-7 rounded shadow-sm" style={{ backgroundColor: theme.primaryHex }} />
                          <span className="h-3.5 w-3.5 rounded shadow-sm border border-slate-700/20 dark:border-slate-300/20" style={{ backgroundColor: theme.cardDarkHex }} />
                          <span className="h-3.5 w-3.5 rounded shadow-sm border border-slate-700/20 dark:border-slate-300/20" style={{ backgroundColor: theme.backgroundDarkHex }} />
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomTheme(index, e)}
                          className="absolute right-2.5 bottom-2.5 p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete Custom Theme"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Theme Creator / Customizer */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <Sliders className="h-4.5 w-4.5 text-sky-500" />
              <span>Theme Color Customizer</span>
            </h2>

            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  id="enableCustom"
                  checked={selectedThemeKey === "custom"}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedThemeKey("custom");
                      handlePreviewCustomColors();
                    } else {
                      setSelectedThemeKey("ocean");
                      applyThemeConfig(DEFAULT_THEMES.ocean);
                    }
                  }}
                  className="rounded border-slate-200 text-sky-500 h-4 w-4 focus:ring-sky-500/20 cursor-pointer"
                />
                <label htmlFor="enableCustom" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Activate Color Pickers (Create custom colors)
                </label>
              </div>

              {/* Color Pickers Row */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Custom Primary */}
                <div className={`p-4 rounded-xl border ${selectedThemeKey === "custom" ? "border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/25" : "border-slate-100 dark:border-slate-900 bg-slate-100/30 dark:bg-slate-900/30 opacity-50 pointer-events-none"}`}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customPrimary}
                      onChange={(e) => setCustomPrimary(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={customPrimary}
                      onChange={(e) => setCustomPrimary(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-1 text-center font-mono text-xs dark:border-slate-800 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>

                {/* Dark Background */}
                <div className={`p-4 rounded-xl border ${selectedThemeKey === "custom" ? "border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/25" : "border-slate-100 dark:border-slate-900 bg-slate-100/30 dark:bg-slate-900/30 opacity-50 pointer-events-none"}`}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Night Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customBg}
                      onChange={(e) => setCustomBg(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={customBg}
                      onChange={(e) => setCustomBg(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-1 text-center font-mono text-xs dark:border-slate-800 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>

                {/* Dark Card */}
                <div className={`p-4 rounded-xl border ${selectedThemeKey === "custom" ? "border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/25" : "border-slate-100 dark:border-slate-900 bg-slate-100/30 dark:bg-slate-900/30 opacity-50 pointer-events-none"}`}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Night Card/Panel</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customCard}
                      onChange={(e) => setCustomCard(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={customCard}
                      onChange={(e) => setCustomCard(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-1 text-center font-mono text-xs dark:border-slate-800 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Save As New Theme Form */}
              {selectedThemeKey === "custom" && (
                <form onSubmit={handleSaveAsNewTheme} className="border-t border-slate-100 pt-4 dark:border-slate-800/80 mt-4 flex flex-col sm:flex-row gap-3 items-end">
                  <div className="w-full">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name your theme</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. My Premium Turquoise Theme"
                      value={newThemeName}
                      onChange={(e) => setNewThemeName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-950 outline-none font-semibold focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingNew}
                    className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{savingNew ? "Saving..." : "Save as New Theme"}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions */}
        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight mb-2 text-slate-850 dark:text-slate-150">Publish Active Selection</h2>
              <p className="text-[11px] text-slate-400">
                Set the active theme as the default for this business. This theme will load instantly for all operators inside the store.
              </p>
            </div>

            <div className="space-y-2 mt-2">
              <button
                type="button"
                onClick={handleSaveDefaultTheme}
                disabled={saving}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2.5 text-xs font-bold text-white hover:bg-sky-600 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? "Publishing..." : "Publish Default Theme"}</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-850 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset to System Default</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
