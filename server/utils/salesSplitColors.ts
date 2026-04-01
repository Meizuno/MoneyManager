export const SPLIT_COLORS = [
  "cyan",
  "violet",
  "amber",
  "emerald",
  "rose",
  "sky",
  "indigo",
  "pink",
  "orange",
  "teal",
  "purple",
  "yellow",
  "red",
  "blue",
  "green",
  "fuchsia",
  "lime",
  "cyan",
  "violet",
  "amber",
] as const;

export const nextColor = (existingCount: number) =>
  SPLIT_COLORS[existingCount % SPLIT_COLORS.length] as string;
