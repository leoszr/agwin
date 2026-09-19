import type { QualifiedContributionId, QualifiedThemeContribution, QualifiedThemePairContribution, ThemeToken } from "./plugins/types";

export interface ThemePreference {
  themeId: QualifiedContributionId;
  auto: boolean;
}

export interface ResolveThemePreferenceOptions {
  themes: readonly QualifiedThemeContribution[];
  themePairs: readonly QualifiedThemePairContribution[];
  preference: ThemePreference;
  prefersLight: boolean;
  fallbackThemeId?: QualifiedContributionId;
}

export interface ThemePreferenceResolution {
  selectedTheme: QualifiedThemeContribution | undefined;
  activeTheme: QualifiedThemeContribution | undefined;
  selectedThemePair: QualifiedThemePairContribution | undefined;
  fallbackTheme: QualifiedThemeContribution | undefined;
}

export const CLASSIC_THEME_ID: QualifiedContributionId = "themes:classic";
export const DEFAULT_THEME_ID: QualifiedContributionId = "themes:neutral-dark";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = { themeId: DEFAULT_THEME_ID, auto: true };
export const THEME_STORAGE_KEY = "pi-web-app-theme";

export const THEME_TOKENS: ThemeToken[] = [
  "--pi-bg",
  "--pi-surface",
  "--pi-surface-hover",
  "--pi-terminal-bg",
  "--pi-terminal-text",
  "--pi-border",
  "--pi-border-muted",
  "--pi-text",
  "--pi-text-secondary",
  "--pi-text-bright",
  "--pi-muted",
  "--pi-dim",
  "--pi-accent",
  "--pi-accent-border",
  "--pi-accent-contrast",
  "--pi-selection-bg",
  "--pi-success",
  "--pi-success-border",
  "--pi-success-bg",
  "--pi-success-surface",
  "--pi-success-ring",
  "--pi-warning",
  "--pi-warning-border",
  "--pi-warning-surface",
  "--pi-danger",
  "--pi-purple",
  "--pi-purple-border",
  "--pi-purple-surface",
  "--pi-overlay",
  "--pi-shadow-soft",
  "--pi-shadow",
  "--pi-shadow-strong",
  "--pi-bg-overlay-soft",
  "--pi-bg-overlay",
  "--pi-success-bg-overlay",
  "--pi-terminal-selection",
];

const qualifiedContributionIdPattern = /^[a-z][a-z0-9.-]*:[a-z][a-z0-9.-]*$/u;

export function readStoredThemePreference(): ThemePreference | undefined {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === null ? undefined : parseThemePreference(value);
  } catch {
    return undefined;
  }
}

export function writeStoredThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Ignore storage failures; the selected theme can still apply for this tab.
  }
}

export function applyPiWebTheme(theme: QualifiedThemeContribution): void {
  const root = document.documentElement;
  root.dataset["piWebTheme"] = theme.id;
  root.style.colorScheme = theme.colorScheme;
  for (const token of THEME_TOKENS) {
    const value = theme.tokens[token];
    if (typeof value === "string" && value !== "") root.style.setProperty(token, value);
    else root.style.removeProperty(token);
  }
}

export function resolveThemePreference(options: ResolveThemePreferenceOptions): ThemePreferenceResolution {
  const fallbackTheme = findFallbackTheme(options.themes, options.fallbackThemeId ?? CLASSIC_THEME_ID);
  const selectedTheme = options.themes.find((candidate) => candidate.id === options.preference.themeId) ?? fallbackTheme;
  if (selectedTheme === undefined) {
    return { selectedTheme: undefined, activeTheme: undefined, selectedThemePair: undefined, fallbackTheme };
  }
  const selectedThemePair = findThemePairForTheme(options.themePairs, selectedTheme.id);
  if (!options.preference.auto || selectedThemePair === undefined) {
    return { selectedTheme, activeTheme: selectedTheme, selectedThemePair, fallbackTheme };
  }
  const activeThemeId = options.prefersLight ? selectedThemePair.light : selectedThemePair.dark;
  const activeTheme = options.themes.find((candidate) => candidate.id === activeThemeId) ?? selectedTheme;
  return { selectedTheme, activeTheme, selectedThemePair, fallbackTheme };
}

export function findFallbackTheme(themes: readonly QualifiedThemeContribution[], fallbackThemeId: QualifiedContributionId = CLASSIC_THEME_ID): QualifiedThemeContribution | undefined {
  return themes.find((candidate) => candidate.id === fallbackThemeId) ?? themes[0];
}

export function findThemePairForTheme(themePairs: readonly QualifiedThemePairContribution[], themeId: QualifiedContributionId): QualifiedThemePairContribution | undefined {
  return themePairs.find((pair) => pair.light === themeId || pair.dark === themeId);
}

function parseThemePreference(value: string): ThemePreference | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isThemePreference(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isThemePreference(value: unknown): value is ThemePreference {
  if (!isUnknownRecord(value)) return false;
  const themeId = value["themeId"];
  const auto = value["auto"];
  return isQualifiedContributionId(themeId) && typeof auto === "boolean";
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isQualifiedContributionId(value: unknown): value is QualifiedContributionId {
  return typeof value === "string" && qualifiedContributionIdPattern.test(value);
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{4}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/;
const RGB_COLOR_PATTERN = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const HSL_COLOR_PATTERN = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
// Bare keywords: only real CSS color keywords, never arbitrary words.
const NAMED_THEME_COLORS = new Set([
  "transparent",
  "currentcolor",
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "cyan",
  "magenta",
  "gray",
  "grey",
]);

/** Shape check for theme token values: themes carry colors, never rules or scripts. */
export function isValidThemeTokenValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return (
    HEX_COLOR_PATTERN.test(trimmed) ||
    RGB_COLOR_PATTERN.test(trimmed) ||
    HSL_COLOR_PATTERN.test(trimmed) ||
    NAMED_THEME_COLORS.has(trimmed.toLowerCase())
  );
}

/** WCAG 2.2 relative-luminance contrast ratio for two 6-digit hex colors. */
export function themeContrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(themeLuminance(foreground), themeLuminance(background));
  const darker = Math.min(themeLuminance(foreground), themeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function themeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  const [r, g, b] = [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}
