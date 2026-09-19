import { describe, expect, it } from "vitest";
import { CLASSIC_THEME_ID, DEFAULT_THEME_PREFERENCE, findThemePairForTheme, isValidThemeTokenValue, resolveThemePreference, themeContrastRatio } from "./theme";
import type { QualifiedContributionId, QualifiedThemeContribution, QualifiedThemePairContribution, ThemeColorScheme, ThemeTokens } from "./plugins/types";

const tokens = {
  "--pi-bg": "#000000",
  "--pi-surface": "#000000",
  "--pi-surface-hover": "#000000",
  "--pi-terminal-bg": "#000000",
  "--pi-terminal-text": "#000000",
  "--pi-border": "#000000",
  "--pi-border-muted": "#000000",
  "--pi-text": "#000000",
  "--pi-text-secondary": "#000000",
  "--pi-text-bright": "#000000",
  "--pi-muted": "#000000",
  "--pi-dim": "#000000",
  "--pi-accent": "#000000",
  "--pi-accent-border": "#000000",
  "--pi-accent-contrast": "#000000",
  "--pi-selection-bg": "#000000",
  "--pi-success": "#000000",
  "--pi-success-border": "#000000",
  "--pi-success-bg": "#000000",
  "--pi-success-surface": "#000000",
  "--pi-success-ring": "#000000",
  "--pi-warning": "#000000",
  "--pi-warning-border": "#000000",
  "--pi-warning-surface": "#000000",
  "--pi-danger": "#000000",
  "--pi-purple": "#000000",
  "--pi-purple-border": "#000000",
  "--pi-purple-surface": "#000000",
  "--pi-overlay": "#000000",
  "--pi-shadow-soft": "#000000",
  "--pi-shadow": "#000000",
  "--pi-shadow-strong": "#000000",
  "--pi-bg-overlay-soft": "#000000",
  "--pi-bg-overlay": "#000000",
  "--pi-success-bg-overlay": "#000000",
  "--pi-terminal-selection": "#000000",
} satisfies ThemeTokens;

const themes = [
  theme("neutral-dark", "Neutral Dark", "dark"),
  theme("neutral-light", "Neutral Light", "light"),
  theme("pi-web-dark", "PI WEB Dark", "dark"),
  theme("pi-web-light", "PI WEB Light", "light"),
  theme("classic", "PI WEB Classic", "dark"),
];

const themePairs: QualifiedThemePairContribution[] = [
  {
    id: "themes:neutral",
    pluginId: "themes",
    localId: "neutral",
    name: "Neutral",
    light: "themes:neutral-light",
    dark: "themes:neutral-dark",
  },
  {
    id: "themes:pi-web",
    pluginId: "themes",
    localId: "pi-web",
    name: "PI WEB",
    light: "themes:pi-web-light",
    dark: "themes:pi-web-dark",
  },
];

describe("resolveThemePreference", () => {
  it("resolves the default auto preference to the neutral dark member when the system is dark", () => {
    expect(resolveThemePreference({ themes, themePairs, preference: DEFAULT_THEME_PREFERENCE, prefersLight: false }).activeTheme?.id)
      .toBe("themes:neutral-dark");
  });

  it("resolves the default auto preference to the neutral light member when the system is light", () => {
    expect(resolveThemePreference({ themes, themePairs, preference: DEFAULT_THEME_PREFERENCE, prefersLight: true }).activeTheme?.id)
      .toBe("themes:neutral-light");
  });

  it("keeps an unpaired theme selected when auto is enabled", () => {
    const resolution = resolveThemePreference({
      themes,
      themePairs,
      preference: { themeId: CLASSIC_THEME_ID, auto: true },
      prefersLight: true,
    });

    expect(resolution.selectedTheme?.id).toBe("themes:classic");
    expect(resolution.activeTheme?.id).toBe("themes:classic");
    expect(resolution.selectedThemePair).toBeUndefined();
  });

  it("falls back to Classic when the selected theme does not exist", () => {
    const resolution = resolveThemePreference({
      themes,
      themePairs,
      preference: { themeId: "plugin:missing", auto: false },
      prefersLight: true,
    });

    expect(resolution.selectedTheme?.id).toBe("themes:classic");
    expect(resolution.activeTheme?.id).toBe("themes:classic");
  });

  it("falls back to Classic without mutating a missing selected theme preference", () => {
    const preference = {
      themeId: "plugin:missing",
      auto: true,
    } satisfies { themeId: QualifiedContributionId; auto: boolean };
    const resolution = resolveThemePreference({
      themes,
      themePairs,
      preference,
      prefersLight: false,
    });

    expect(resolution.selectedTheme?.id).toBe("themes:classic");
    expect(resolution.activeTheme?.id).toBe("themes:classic");
    expect(preference).toEqual({ themeId: "plugin:missing", auto: true });
  });

  it("can look up a pair from either member theme", () => {
    expect(findThemePairForTheme(themePairs, "themes:pi-web-light")?.id).toBe("themes:pi-web");
    expect(findThemePairForTheme(themePairs, "themes:pi-web-dark")?.id).toBe("themes:pi-web");
  });
});

function theme(localId: string, name: string, colorScheme: ThemeColorScheme): QualifiedThemeContribution {
  return {
    id: `themes:${localId}`,
    pluginId: "themes",
    localId,
    name,
    colorScheme,
    tokens,
  };
}

describe("isValidThemeTokenValue", () => {
  it("accepts hex, rgb, hsl, and named colors but rejects rules, scripts, and bare words", () => {
    expect(isValidThemeTokenValue("#fff")).toBe(true);
    expect(isValidThemeTokenValue("#0d0e11")).toBe(true);
    expect(isValidThemeTokenValue("#0008")).toBe(true);
    expect(isValidThemeTokenValue("rgb(1, 2, 3)")).toBe(true);
    expect(isValidThemeTokenValue("hsla(0, 0%, 100%, 0.5)")).toBe(true);
    expect(isValidThemeTokenValue("transparent")).toBe(true);
    expect(isValidThemeTokenValue("hello")).toBe(false);
    expect(isValidThemeTokenValue("")).toBe(false);
    expect(isValidThemeTokenValue("150ms")).toBe(false);
    expect(isValidThemeTokenValue("#12345")).toBe(false);
    expect(isValidThemeTokenValue("expression(alert(1))")).toBe(false);
  });
});

describe("themeContrastRatio", () => {
  it("computes WCAG relative-luminance ratios with black on white at 21:1", () => {
    expect(themeContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(themeContrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 3);
  });
});
