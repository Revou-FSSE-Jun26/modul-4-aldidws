import fs from "fs";
import path from "path";
import { LABEL_COLORS, LABEL_COLOR_KEYS } from "@/lib/labelColors";

const css = fs.readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf-8");

function hexOf(variable: string): string {
  const match = css.match(new RegExp(`--${variable}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`--${variable} not found in globals.css`);
  return match[1];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("label colours", () => {
  it("defines exactly the 8 colours of the backend", () => {
    expect([...LABEL_COLOR_KEYS].sort()).toEqual(
      ["blue", "graphite", "green", "orange", "purple", "red", "silver", "sky"],
    );
  });

  it.each(LABEL_COLOR_KEYS)("%s has text contrast of at least 4.5 (WCAG AA)", (key) => {
    const ratio = contrast(hexOf(`label-${key}-bg`), hexOf(`label-${key}-fg`));
    // Visible with `npx jest labelColors --verbose`; recorded in the task findings.
    console.info(`label contrast ${key}: ${ratio.toFixed(2)}`);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("class names reference the matching CSS variables", () => {
    for (const key of LABEL_COLOR_KEYS) {
      expect(LABEL_COLORS[key].className).toContain(`--label-${key}-bg`);
      expect(LABEL_COLORS[key].className).toContain(`--label-${key}-fg`);
    }
  });
});
