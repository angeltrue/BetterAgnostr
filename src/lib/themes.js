// Glub.chat palette ports. The core colours are lifted from glub's own
// `html[data-theme="..."]` blocks; Agnostr's surface, border and text variables
// are derived from them the same way glub derives its own surfaces.

export const GLUB_THEMES = [
  {
    id: "bitchat",
    label: "Chat",
    description: "black phosphor green, blue channels",
    bg: "#000000",
    fg: "#8fe89c",
    muted: "#7a828c",
    geo: "#5cb3ff",
    accent: "#30d158",
    danger: "#ff7b72",
  },
  {
    id: "cyberpunk-2077",
    label: "Cyberpunk 2077",
    description: "cyan readouts & hot-pink chrome",
    bg: "#000000",
    fg: "#d7d7dc",
    muted: "#7e7e88",
    geo: "#2de2e6",
    accent: "#ff2a6d",
    danger: "#ff5a5a",
  },
  {
    id: "blade-runner-blossom",
    label: "Blade Runner",
    description: "blossom pink on violet haze",
    bg: "#0a0712",
    fg: "#e4d9f2",
    muted: "#857a9e",
    geo: "#b48cff",
    accent: "#ff6ac2",
    danger: "#ff7b72",
  },
  {
    id: "ex-machina",
    label: "Ex Machina",
    description: "emergency red & amber alarm",
    bg: "#0b0507",
    fg: "#f2d9d9",
    muted: "#93706e",
    geo: "#ff8a5c",
    accent: "#ff3b30",
    danger: "#ffd60a",
  },
  {
    id: "giedi-prime",
    label: "Giedi Prime",
    description: "infrared monochrome",
    bg: "#050505",
    fg: "#ededed",
    muted: "#878787",
    geo: "#bdbdbd",
    accent: "#e6e6e6",
    danger: "#ff7b72",
  },
  {
    id: "matrix-neo",
    label: "Matrix Neo",
    description: "code-rain green on true black",
    bg: "#000000",
    fg: "#a8ffdf",
    muted: "#567b70",
    geo: "#80fffb",
    accent: "#00ffa1",
    danger: "#ff7b72",
  },
  {
    id: "star-lord",
    label: "Star-Lord",
    description: "amber-gold & engine cyan",
    bg: "#0c0806",
    fg: "#f2ddb8",
    muted: "#8e7d67",
    geo: "#ff8c42",
    accent: "#3fd8ff",
    danger: "#ff7b72",
  },
  {
    id: "time-variance-amber",
    label: "Time Variance",
    description: "mid-century CRT amber",
    bg: "#0b0906",
    fg: "#ffd98c",
    muted: "#97845f",
    geo: "#ffc861",
    accent: "#ff9e1f",
    danger: "#ff6b5e",
  },
  {
    id: "tron-legacy",
    label: "Tron Legacy",
    description: "grid ice blue & disc cyan",
    bg: "#04070c",
    fg: "#cdeeff",
    muted: "#5f7f8e",
    geo: "#5ce1ff",
    accent: "#00b8ff",
    danger: "#ff7b72",
  },
  {
    id: "lumon-light",
    label: "Lumon Light",
    description: "milky office light & teal",
    bg: "#eef0ea",
    fg: "#24424a",
    muted: "#6c8189",
    geo: "#2f7d97",
    accent: "#106a74",
    danger: "#b3362b",
    light: true,
  },
  {
    id: "her-light",
    label: "Her Light",
    description: "coral & cream",
    bg: "#f7efe6",
    fg: "#6b4a3f",
    muted: "#a2867a",
    geo: "#b04a36",
    accent: "#e0654f",
    danger: "#a63324",
    light: true,
  },
  {
    id: "iced-matcha-latte",
    label: "Iced Matcha Latte",
    description: "oat cream, iced matcha, cold green lift",
    bg: "#f1f0e7",
    fg: "#29382f",
    muted: "#778578",
    geo: "#5b8b6e",
    accent: "#4c8a5f",
    danger: "#b04a3c",
    light: true,
  },
];

export const THEME_BY_ID = new Map(GLUB_THEMES.map((t) => [t.id, t]));

export const AGNOSTR_THEME = {
  id: "agnostr",
  label: "Agnostr",
  description: "use Agnostr's own theme setting",
  css: "",
};

export const ALL_THEMES = [AGNOSTR_THEME, ...GLUB_THEMES];

export function themeById(id) {
  return THEME_BY_ID.get(id) || null;
}

// --- tiny colour helpers ----------------------------------------------------

function parseHex(hex) {
  const s = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(s)) return [0, 0, 0];
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function toHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(a, b, amount) {
  const A = parseHex(a);
  const B = parseHex(b);
  const t = Math.max(0, Math.min(1, amount));
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

function alpha(hex, a) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function shade(hex, amount) {
  return amount < 0 ? mix(hex, "#000000", -amount) : mix(hex, "#ffffff", amount);
}

export function buildThemeCss(theme) {
  if (!theme || theme.id === "agnostr") return "";
  const light = !!theme.light;
  const bg = theme.bg;
  const fg = theme.fg;
  const muted = theme.muted;
  const geo = theme.geo;
  const accent = theme.accent;
  const danger = theme.danger || (light ? "#b91c1c" : "#ef4444");
  const surface = light ? mix(bg, "#ffffff", 0.38) : mix(bg, fg, 0.045);
  const elevated = light ? mix(bg, "#ffffff", 0.68) : mix(bg, fg, 0.085);
  const subtle = light ? mix(bg, "#000000", 0.08) : mix(bg, fg, 0.13);
  const active = light ? mix(bg, "#000000", 0.13) : mix(bg, fg, 0.17);
  const input = light ? mix(bg, "#ffffff", 0.52) : mix(bg, "#000000", 0.22);
  const text2 = mix(fg, muted, 0.48);
  const accentHover = light ? shade(accent, -0.12) : shade(accent, 0.22);
  const ok = light ? "#15803d" : "#22c55e";
  const warn = light ? "#b45309" : "#f59e0b";

  const vars = {
    "--theme-meta-color": bg,
    "--bg-canvas": bg,
    "--bg-surface": surface,
    "--bg-elevated": elevated,
    "--bg-subtle": subtle,
    "--bg-hover": alpha(fg, light ? 0.06 : 0.055),
    "--bg-active": active,
    "--bg-glass": alpha(bg, 0.9),
    "--bg-overlay": light ? "rgba(20, 16, 12, .34)" : alpha(bg, 0.7),
    "--bg-input": input,
    "--border-subtle": alpha(fg, light ? 0.11 : 0.08),
    "--border-default": alpha(fg, light ? 0.2 : 0.15),
    "--border-strong": alpha(fg, light ? 0.34 : 0.28),
    "--border-accent": alpha(accent, 0.5),
    "--text-primary": fg,
    "--text-secondary": text2,
    "--text-muted": muted,
    "--text-inverse": light ? "#ffffff" : bg,
    "--accent": accent,
    "--accent-hover": accentHover,
    "--accent-soft": alpha(accent, light ? 0.11 : 0.14),
    "--accent-glow": `0 0 0 3px ${alpha(accent, 0.2)}`,
    "--accent-secondary": geo,
    "--accent-secondary-soft": alpha(geo, 0.14),
    "--status-ok": ok,
    "--status-ok-soft": alpha(ok, 0.14),
    "--status-warn": warn,
    "--status-warn-soft": alpha(warn, 0.15),
    "--status-danger": danger,
    "--status-danger-soft": alpha(danger, 0.15),
    "--dm-accent": geo,
    "--dm-soft": alpha(geo, 0.15),
    "--mesh-accent": geo,
    "--mesh-soft": alpha(geo, 0.14),
    "--handle-s": light ? "72%" : "68%",
    "--handle-l": light ? "36%" : "72%",
    "--identicon-bg-l": light ? "88%" : "16%",
    "--shadow-sm": light ? "0 1px 2px rgba(20,16,12,.08)" : "0 1px 2px rgba(0,0,0,.3)",
    "--shadow-md": light ? "0 6px 20px rgba(20,16,12,.12)" : "0 6px 20px rgba(0,0,0,.42)",
    "--shadow-lg": light ? "0 18px 48px rgba(20,16,12,.18)" : "0 18px 48px rgba(0,0,0,.6)",
    "--ambient-glow": light ? "none" : `0 0 80px ${alpha(accent, 0.08)}`,
  };

  const body = Object.entries(vars)
    .map(([k, v]) => `${k}: ${v} !important;`)
    .join("\n  ");
  return `html:root {\n  color-scheme: ${light ? "light" : "dark"} !important;\n  ${body}\n}`;
}

export function themeSwatch(theme) {
  if (!theme || theme.id === "agnostr") return ["#0b0c0f", "#171a21", "#3b82f6", "#f1f3f7"];
  return [theme.bg, theme.light ? mix(theme.bg, "#ffffff", 0.35) : mix(theme.bg, theme.fg, 0.08), theme.accent, theme.fg];
}
