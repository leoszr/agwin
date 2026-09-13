export interface NeutralPalette {
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderMuted: string;
  text: string;
  textSecondary: string;
  textBright: string;
  focusRing: string;
}

export const NEUTRAL_DARK: NeutralPalette = {
  bg: "#0d0e11",
  surface: "#16181d",
  surfaceHover: "#21242c",
  border: "#2b2f38",
  borderMuted: "#1f2229",
  text: "#e4e7eb",
  textSecondary: "#9ca3af",
  textBright: "#ffffff",
  focusRing: "#ffffff", // Strictly neutral focus ring (no blue)
};

export const NEUTRAL_LIGHT: NeutralPalette = {
  bg: "#ffffff",
  surface: "#f8f9fa",
  surfaceHover: "#f1f3f5",
  border: "#e5e7eb",
  borderMuted: "#f3f4f6",
  text: "#111827",
  textSecondary: "#4b5563",
  textBright: "#000000",
  focusRing: "#000000", // Strictly neutral focus ring (no blue)
};

export interface SemanticColors {
  ansi: Record<string, string>;
  diff: {
    addedBg: string;
    addedText: string;
    removedBg: string;
    removedText: string;
  };
  syntax: Record<string, string>;
}

export const ISOLATED_SEMANTIC_COLORS: SemanticColors = {
  ansi: {
    black: "#000000",
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#eab308",
    blue: "#3b82f6",
    magenta: "#ec4899",
    cyan: "#06b6d4",
    white: "#ffffff",
  },
  diff: {
    addedBg: "rgba(34, 197, 94, 0.15)",
    addedText: "#16a34a",
    removedBg: "rgba(239, 68, 68, 0.15)",
    removedText: "#dc2626",
  },
  syntax: {
    keyword: "#f43f5e",
    string: "#10b981",
    number: "#f59e0b",
    comment: "#6b7280",
  },
};

export interface DeclarativeTheme {
  id: string;
  name: string;
  version: 1;
  kind: "light" | "dark";
  tokens: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  theme?: DeclarativeTheme | undefined;
}

export const ALLOWED_THEME_TOKENS = new Set([
  "--pi-bg",
  "--pi-surface",
  "--pi-surface-hover",
  "--pi-border",
  "--pi-border-muted",
  "--pi-text",
  "--pi-text-secondary",
  "--pi-text-bright",
  "--pi-focus-ring",
  "--pi-transition-duration",
  "--pi-animation-duration",
]);

export const REQUIRED_THEME_TOKENS = [
  "--pi-bg",
  "--pi-surface",
  "--pi-border",
  "--pi-text",
  "--pi-focus-ring",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{4}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/;
const RGB_COLOR_PATTERN = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const HSL_COLOR_PATTERN = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const DURATION_PATTERN = /^\d+(\.\d+)?(ms|s)$/;
// Bare keywords: only real CSS color keywords + transparent/currentColor, never arbitrary words like "hello".
const NAMED_COLORS = new Set([
  "black","silver","gray","white","maroon","red","purple","fuchsia","green","lime","olive","yellow",
  "navy","blue","teal","aqua","orange","aliceblue","antiquewhite","aquamarine","azure","beige",
  "bisque","blanchedalmond","blueviolet","brown","burlywood","cadetblue","chartreuse","chocolate",
  "coral","cornflowerblue","cornsilk","crimson","cyan","darkblue","darkcyan","darkgoldenrod",
  "darkgray","darkgreen","darkgrey","darkkhaki","darkmagenta","darkolivegreen","darkorange",
  "darkorchid","darkred","darksalmon","darkseagreen","darkslateblue","darkslategray","darkslategrey",
  "darkturquoise","darkviolet","deeppink","deepskyblue","dimgray","dimgrey","dodgerblue","firebrick",
  "floralwhite","forestgreen","gainsboro","ghostwhite","gold","goldenrod","greenyellow","grey",
  "honeydew","hotpink","indianred","indigo","ivory","khaki","lavender","lavenderblush",
  "lawngreen","lemonchiffon","lightblue","lightcoral","lightcyan","lightgoldenrodyellow","lightgray",
  "lightgreen","lightgrey","lightpink","lightsalmon","lightseagreen","lightskyblue","lightslategray",
  "lightslategrey","lightsteelblue","lightyellow","limegreen","linen","magenta","mediumaquamarine",
  "mediumblue","mediumorchid","mediumpurple","mediumseagreen","mediumslateblue","mediumspringgreen",
  "mediumturquoise","mediumvioletred","midnightblue","mintcream","mistyrose","moccasin","navajowhite",
  "oldlace","olivedrab","orangered","orchid","palegoldenrod","palegreen","paleturquoise",
  "palevioletred","papayawhip","peachpuff","peru","pink","plum","powderblue","rosybrown",
  "royalblue","saddlebrown","salmon","sandybrown","seagreen","seashell","sienna","skyblue",
  "slateblue","slategray","slategrey","snow","springgreen","steelblue","tan","thistle","tomato",
  "turquoise","violet","wheat","whitesmoke","yellowgreen","transparent","currentcolor",
]);

const DURATION_TOKENS = new Set(["--pi-transition-duration", "--pi-animation-duration"]);

function isValidTokenValue(token: string, value: string): boolean {
  const v = value.trim();
  if (DURATION_TOKENS.has(token)) return DURATION_PATTERN.test(v);
  return HEX_COLOR_PATTERN.test(v) || RGB_COLOR_PATTERN.test(v) || HSL_COLOR_PATTERN.test(v) || NAMED_COLORS.has(v.toLowerCase());
}

export function validateDeclarativeTheme(candidate: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(candidate)) {
    return { valid: false, errors: ["Candidate is not an object"] };
  }

  const id = candidate["id"];
  if (typeof id !== "string" || id.trim() === "") {
    errors.push("Missing or invalid 'id'");
  }
  const name = candidate["name"];
  if (typeof name !== "string" || name.trim() === "") {
    errors.push("Missing or invalid 'name'");
  }
  if (candidate["version"] !== 1) {
    errors.push("Version must be 1");
  }
  const kind = candidate["kind"];
  if (kind !== "light" && kind !== "dark") {
    errors.push("Kind must be 'light' or 'dark'");
  }

  const tokens = candidate["tokens"];
  if (!isRecord(tokens)) {
    errors.push("Missing 'tokens' map");
  } else {
    for (const req of REQUIRED_THEME_TOKENS) {
      const val = tokens[req];
      if (typeof val !== "string" || val.trim() === "") {
        errors.push(`Missing required token: ${req}`);
      }
    }

    for (const [key, val] of Object.entries(tokens)) {
      if (!ALLOWED_THEME_TOKENS.has(key)) {
        errors.push(`Unknown token property '${key}' not allowed in declarative theme`);
      } else if (typeof val !== "string" || !isValidTokenValue(key, val)) {
        errors.push(key.startsWith("--pi-") && key.includes("duration") ? `Invalid duration value for token '${key}': ${String(val)}` : `Invalid color value for token '${key}': ${String(val)}`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, theme: resolveFallbackTheme(kind === "light" ? "light" : "dark") };
  }

  const validTokens: Record<string, string> = {};
  if (isRecord(tokens)) {
    for (const [k, v] of Object.entries(tokens)) {
      if (typeof v === "string") validTokens[k] = v;
    }
  }

  return {
    valid: true,
    errors: [],
    theme: {
      id: String(id),
      name: String(name),
      version: 1,
      kind: kind === "light" ? "light" : "dark",
      tokens: validTokens,
    },
  };
}

export function calculateContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = getLuminance(fgHex);
  const l2 = getLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function applyWorkbenchTheme(
  doc: Document,
  theme: DeclarativeTheme,
  options?: { prefersReducedMotion?: boolean },
): void {
  const root = doc.documentElement;
  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(key, value);
  }

  if (options?.prefersReducedMotion === true) {
    root.style.setProperty("--pi-transition-duration", "0s");
    root.style.setProperty("--pi-animation-duration", "0s");
  } else {
    root.style.setProperty("--pi-transition-duration", "150ms");
    root.style.setProperty("--pi-animation-duration", "200ms");
  }
}

export function resolveFallbackTheme(kind: "light" | "dark"): DeclarativeTheme {
  const palette = kind === "light" ? NEUTRAL_LIGHT : NEUTRAL_DARK;
  return {
    id: `fallback-neutral-${kind}`,
    name: `Neutral ${kind}`,
    version: 1,
    kind,
    tokens: {
      "--pi-bg": palette.bg,
      "--pi-surface": palette.surface,
      "--pi-surface-hover": palette.surfaceHover,
      "--pi-border": palette.border,
      "--pi-border-muted": palette.borderMuted,
      "--pi-text": palette.text,
      "--pi-text-secondary": palette.textSecondary,
      "--pi-text-bright": palette.textBright,
      "--pi-focus-ring": palette.focusRing,
    },
  };
}
