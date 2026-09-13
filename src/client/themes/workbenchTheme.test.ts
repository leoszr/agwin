// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  ISOLATED_SEMANTIC_COLORS,
  NEUTRAL_DARK,
  NEUTRAL_LIGHT,
  applyWorkbenchTheme,
  calculateContrastRatio,
  validateDeclarativeTheme,
  type DeclarativeTheme,
} from "./workbenchTheme";

describe("Workbench Themes & Accessibility (Ticket 27)", () => {
  it("strictly enforces neutral palettes for dark and light surfaces, borders, and focus rings (no blue)", () => {
    // Check dark palette neutrals:
    expect(NEUTRAL_DARK.bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(NEUTRAL_DARK.surface).toMatch(/^#[0-9a-f]{6}$/i);
    expect(NEUTRAL_DARK.border).toMatch(/^#[0-9a-f]{6}$/i);
    // Focus ring must be strictly neutral (white or grayscale, not blue)
    expect(NEUTRAL_DARK.focusRing.toLowerCase()).toBe("#ffffff");

    // Check light palette neutrals:
    expect(NEUTRAL_LIGHT.bg).toBe("#ffffff");
    expect(NEUTRAL_LIGHT.surface).toMatch(/^#[0-9a-f]{6}$/i);
    expect(NEUTRAL_LIGHT.border).toMatch(/^#[0-9a-f]{6}$/i);
    // Focus ring must be strictly neutral (black or grayscale, not blue)
    expect(NEUTRAL_LIGHT.focusRing.toLowerCase()).toBe("#000000");
  });

  it("keeps ANSI, syntax highlighting, and diff colors isolated from structural tokens", () => {
    expect(ISOLATED_SEMANTIC_COLORS.ansi["red"]).toBe("#ef4444");
    expect(ISOLATED_SEMANTIC_COLORS.ansi["green"]).toBe("#22c55e");
    expect(ISOLATED_SEMANTIC_COLORS.diff.addedText).toBe("#16a34a");
    expect(ISOLATED_SEMANTIC_COLORS.diff.removedText).toBe("#dc2626");
    expect(ISOLATED_SEMANTIC_COLORS.syntax["keyword"]).toBe("#f43f5e");
  });

  it("validates declarative theme descriptors, enforces token whitelist, and rejects unknown properties", () => {
    const validTheme: DeclarativeTheme = {
      id: "theme-custom-dark",
      name: "Custom Dark",
      version: 1,
      kind: "dark",
      tokens: {
        "--pi-bg": "#111111",
        "--pi-surface": "#222222",
        "--pi-border": "#333333",
        "--pi-text": "#eeeeee",
        "--pi-focus-ring": "#ffffff",
      },
    };

    const validResult = validateDeclarativeTheme(validTheme);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toEqual([]);

    const invalidCandidate = {
      id: "theme-bad",
      name: "Bad Theme",
      version: 1,
      kind: "dark",
      tokens: {
        "--pi-bg": "#000000",
        "--pi-surface": "#111111",
        "--pi-border": "#222222",
        "--pi-text": "#ffffff",
        "--pi-focus-ring": "#ffffff",
        "--arbitrary-evil-prop": "expression(alert(1))", // unknown token!
      },
    };

    const invalidResult = validateDeclarativeTheme(invalidCandidate);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.some((e) => e.includes("Unknown token property"))).toBe(true);
    // Fallback theme provided on rejection
    expect(invalidResult.theme).toBeDefined();
    expect(invalidResult.theme?.kind).toBe("dark");
  });

  it("rejects bare words and bad hex, accepts rgb() and durations", () => {
    const base = { id: "t", name: "T", version: 1 as const, kind: "dark" as const };
    const badWord = validateDeclarativeTheme({ ...base, tokens: { "--pi-bg": "hello", "--pi-surface": "#222222", "--pi-border": "#333333", "--pi-text": "#eeeeee", "--pi-focus-ring": "#ffffff" } });
    expect(badWord.valid).toBe(false);
    const badHex = validateDeclarativeTheme({ ...base, tokens: { "--pi-bg": "#12345", "--pi-surface": "#222222", "--pi-border": "#333333", "--pi-text": "#eeeeee", "--pi-focus-ring": "#ffffff" } });
    expect(badHex.valid).toBe(false);
    const good = validateDeclarativeTheme({
      ...base,
      tokens: {
        "--pi-bg": "rgb(1, 2, 3)",
        "--pi-surface": "#222222",
        "--pi-border": "#333333",
        "--pi-text": "#eeeeee",
        "--pi-focus-ring": "#ffffff",
        "--pi-transition-duration": "150ms",
      },
    });
    expect(good.valid).toBe(true);
  });

  it("applies theme tokens to document and sets 0s transition when prefers-reduced-motion is true", () => {
    const doc = document.implementation.createHTMLDocument("Main");
    const theme: DeclarativeTheme = {
      id: "theme-test",
      name: "Test",
      version: 1,
      kind: "dark",
      tokens: {
        "--pi-bg": "#0d0e11",
        "--pi-surface": "#16181d",
        "--pi-border": "#2b2f38",
        "--pi-text": "#e4e7eb",
        "--pi-focus-ring": "#ffffff",
      },
    };

    applyWorkbenchTheme(doc, theme, { prefersReducedMotion: true });

    expect(doc.documentElement.style.getPropertyValue("--pi-bg")).toBe("#0d0e11");
    expect(doc.documentElement.style.getPropertyValue("--pi-transition-duration")).toBe("0s");
    expect(doc.documentElement.style.getPropertyValue("--pi-animation-duration")).toBe("0s");

    // Without reduced motion
    applyWorkbenchTheme(doc, theme, { prefersReducedMotion: false });
    expect(doc.documentElement.style.getPropertyValue("--pi-transition-duration")).toBe("150ms");
  });

  it("ensures normal text and critical controls meet WCAG 2.2 AA contrast requirements (>= 4.5:1)", () => {
    const darkRatio = calculateContrastRatio(NEUTRAL_DARK.text, NEUTRAL_DARK.bg);
    expect(darkRatio).toBeGreaterThanOrEqual(4.5);

    const lightRatio = calculateContrastRatio(NEUTRAL_LIGHT.text, NEUTRAL_LIGHT.bg);
    expect(lightRatio).toBeGreaterThanOrEqual(4.5);

    const focusDarkRatio = calculateContrastRatio(NEUTRAL_DARK.focusRing, NEUTRAL_DARK.bg);
    expect(focusDarkRatio).toBeGreaterThanOrEqual(3.0);

    const focusLightRatio = calculateContrastRatio(NEUTRAL_LIGHT.focusRing, NEUTRAL_LIGHT.bg);
    expect(focusLightRatio).toBeGreaterThanOrEqual(3.0);
  });
});
