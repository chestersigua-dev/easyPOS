export interface ThemeConfig {
  themeName: string;
  primary: string;       // e.g. "200 98% 41.2%"
  primaryHover: string;  // e.g. "200 98% 35%"
  primaryTint: string;   // e.g. "200 98% 95%"
  backgroundDark: string;// e.g. "222.2 84% 4.9%"
  cardDark: string;      // e.g. "222.2 84% 6%"
  primaryHex?: string;   // For customization color inputs
  backgroundDarkHex?: string;
  cardDarkHex?: string;
}

export const DEFAULT_THEMES: { [key: string]: ThemeConfig } = {
  ocean: {
    themeName: "Ocean Slate",
    primary: "200.5 97.9% 41.2%",
    primaryHover: "200.5 97.9% 35%",
    primaryTint: "200.5 97.9% 95%",
    backgroundDark: "222.2 84% 4.9%",
    cardDark: "222.2 84% 6%",
    primaryHex: "#0ea5e9",
    backgroundDarkHex: "#090d16",
    cardDarkHex: "#0f172a"
  },
  sunset: {
    themeName: "Sunset Amber",
    primary: "342 93% 60%",
    primaryHover: "342 93% 50%",
    primaryTint: "342 93% 95%",
    backgroundDark: "330 35% 7%",
    cardDark: "330 35% 10%",
    primaryHex: "#f43f5e",
    backgroundDarkHex: "#180b11",
    cardDarkHex: "#24111a"
  },
  forest: {
    themeName: "Forest Gold",
    primary: "158 64% 52%",
    primaryHover: "158 64% 42%",
    primaryTint: "158 64% 95%",
    backgroundDark: "160 50% 5%",
    cardDark: "160 50% 8%",
    primaryHex: "#10b981",
    backgroundDarkHex: "#05120e",
    cardDarkHex: "#0a1f18"
  },
  royal: {
    themeName: "Royal Velvet",
    primary: "262 89% 58%",
    primaryHover: "262 89% 48%",
    primaryTint: "262 89% 95%",
    backgroundDark: "260 50% 6%",
    cardDark: "260 50% 10%",
    primaryHex: "#8b5cf6",
    backgroundDarkHex: "#0f081d",
    cardDarkHex: "#190e2f"
  },
  cyber: {
    themeName: "Cyberpunk Orange",
    primary: "25 95% 53%",
    primaryHover: "25 95% 43%",
    primaryTint: "25 95% 95%",
    backgroundDark: "25 50% 4%",
    cardDark: "25 50% 7%",
    primaryHex: "#f97316",
    backgroundDarkHex: "#0d0703",
    cardDarkHex: "#1b0e06"
  },
  amethyst: {
    themeName: "Midnight Amethyst",
    primary: "270 91% 65%",
    primaryHover: "270 91% 55%",
    primaryTint: "270 91% 95%",
    backgroundDark: "270 65% 5%",
    cardDark: "270 65% 9%",
    primaryHex: "#a855f7",
    backgroundDarkHex: "#0b0314",
    cardDarkHex: "#150826"
  },
  crimson: {
    themeName: "Crimson Shadow",
    primary: "0 84% 60%",
    primaryHover: "0 84% 50%",
    primaryTint: "0 84% 95%",
    backgroundDark: "0 67% 4%",
    cardDark: "0 67% 7%",
    primaryHex: "#ef4444",
    backgroundDarkHex: "#0f0303",
    cardDarkHex: "#1e0808"
  },
  emeraldJungle: {
    themeName: "Emerald Jungle",
    primary: "158 64% 52%",
    primaryHover: "158 64% 42%",
    primaryTint: "158 64% 95%",
    backgroundDark: "160 65% 3.5%",
    cardDark: "160 65% 7%",
    primaryHex: "#34d399",
    backgroundDarkHex: "#020f0a",
    cardDarkHex: "#082116"
  },
  cyan: {
    themeName: "Electric Cyan",
    primary: "188 86% 43%",
    primaryHover: "188 86% 33%",
    primaryTint: "188 86% 95%",
    backgroundDark: "200 60% 4.5%",
    cardDark: "200 60% 8%",
    primaryHex: "#06b6d4",
    backgroundDarkHex: "#030d12",
    cardDarkHex: "#0a1b24"
  },
  lime: {
    themeName: "Volt Lime",
    primary: "84 84% 44%",
    primaryHover: "84 84% 34%",
    primaryTint: "84 84% 95%",
    backgroundDark: "84 69% 4%",
    cardDark: "84 69% 7%",
    primaryHex: "#84cc16",
    backgroundDarkHex: "#070b02",
    cardDarkHex: "#101905"
  },
  magenta: {
    themeName: "Hot Magenta",
    primary: "330 81% 60%",
    primaryHover: "330 81% 50%",
    primaryTint: "330 81% 95%",
    backgroundDark: "330 65% 4.5%",
    cardDark: "330 65% 8%",
    primaryHex: "#ec4899",
    backgroundDarkHex: "#10030a",
    cardDarkHex: "#220917"
  },
  bronze: {
    themeName: "Amber Bronze",
    primary: "38 92% 50%",
    primaryHover: "38 92% 40%",
    primaryTint: "38 92% 95%",
    backgroundDark: "35 65% 4%",
    cardDark: "35 65% 7%",
    primaryHex: "#f59e0b",
    backgroundDarkHex: "#0d0802",
    cardDarkHex: "#1c1206"
  },
  steel: {
    themeName: "Slate Steel",
    primary: "215 16% 47%",
    primaryHover: "215 16% 37%",
    primaryTint: "215 16% 95%",
    backgroundDark: "215 35% 5%",
    cardDark: "215 30% 9%",
    primaryHex: "#64748b",
    backgroundDarkHex: "#090d12",
    cardDarkHex: "#131b23"
  },
  teal: {
    themeName: "Deep Teal",
    primary: "172 66% 40%",
    primaryHover: "172 66% 30%",
    primaryTint: "172 66% 95%",
    backgroundDark: "170 70% 3%",
    cardDark: "170 70% 6.5%",
    primaryHex: "#14b8a6",
    backgroundDarkHex: "#020d0b",
    cardDarkHex: "#061d18"
  },
  solar: {
    themeName: "Solar Flare",
    primary: "45 93% 47%",
    primaryHover: "45 93% 37%",
    primaryTint: "45 93% 95%",
    backgroundDark: "45 70% 3.5%",
    cardDark: "45 70% 6.5%",
    primaryHex: "#eab308",
    backgroundDarkHex: "#0c0a02",
    cardDarkHex: "#1b1606"
  }
};

// Convert hex string to HSL string format "H S% L%"
export function hexToHslValues(hex: string): { h: number; s: number; l: number; str: string } {
  // Strip #
  let cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }
  
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return {
    h,
    s,
    l,
    str: `${h} ${s}% ${l}%`
  };
}

export function applyThemeConfig(config: ThemeConfig) {
  const root = document.documentElement;
  
  if (config.primary) {
    root.style.setProperty("--primary-override", config.primary);
  } else {
    root.style.removeProperty("--primary-override");
  }

  if (config.primaryHover) {
    root.style.setProperty("--primary-hover-override", config.primaryHover);
  } else {
    root.style.removeProperty("--primary-hover-override");
  }

  if (config.primaryTint) {
    root.style.setProperty("--primary-tint-override", config.primaryTint);
  } else {
    root.style.removeProperty("--primary-tint-override");
  }

  if (config.backgroundDark) {
    root.style.setProperty("--background-dark-override", config.backgroundDark);
  } else {
    root.style.removeProperty("--background-dark-override");
  }

  if (config.cardDark) {
    root.style.setProperty("--card-dark-override", config.cardDark);
  } else {
    root.style.removeProperty("--card-dark-override");
  }
}

export function resetThemeConfig() {
  const root = document.documentElement;
  root.style.removeProperty("--primary-override");
  root.style.removeProperty("--primary-hover-override");
  root.style.removeProperty("--primary-tint-override");
  root.style.removeProperty("--background-dark-override");
  root.style.removeProperty("--card-dark-override");
}
