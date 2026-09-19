import { CURRENCIES } from "./currency";

export function validateShopSetup(name: string, currencyCode: string) {
  const businessName = name.trim();
  if (!businessName) throw new Error("Enter your shop name.");
  if (businessName.length > 100)
    throw new Error("Use 100 characters or fewer for the shop name.");
  if (!CURRENCIES.some((currency) => currency.code === currencyCode)) {
    throw new Error("Choose a supported currency.");
  }
  return { businessName, currencyCode };
}

export type TextSize = "small" | "medium" | "large";
export const normalizeTextSize = (value: unknown): TextSize =>
  value === "small" || value === "large" ? value : "medium";
export const textSizeScale = (value: TextSize) =>
  ({ small: 0.9, medium: 1, large: 1.12 })[value];
