// Category colours. The server stores a Tailwind colour name per category
// (server/utils/salesSplitColors.ts); the client needs the actual value for
// inline styles and the chart canvas, so this is the 400-ish shade of each.
const HEX: Record<string, string> = {
  cyan: "#06b6d4", violet: "#8b5cf6", amber: "#f59e0b", emerald: "#10b981",
  rose: "#f43f5e", sky: "#0ea5e9", indigo: "#6366f1", pink: "#ec4899",
  orange: "#f97316", teal: "#14b8a6", lime: "#84cc16", red: "#ef4444",
  green: "#22c55e", blue: "#3b82f6", purple: "#a855f7", yellow: "#eab308",
  gray: "#94a3b8", slate: "#94a3b8", zinc: "#94a3b8", fuchsia: "#d946ef",
};

export const NEUTRAL_HEX = "#94a3b8";

export function categoryHex(color: string | undefined): string {
  return (color && HEX[color]) || NEUTRAL_HEX;
}
