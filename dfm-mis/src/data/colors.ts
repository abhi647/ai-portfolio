// Chart and status colors resolve through overtrue/ui semantic theme variables,
// so every chart follows the active theme in light and dark mode.
export const C = {
  c1: "var(--color-chart-1)",
  c2: "var(--color-chart-2)",
  c3: "var(--color-chart-3)",
  c4: "var(--color-chart-4)",
  c5: "var(--color-chart-5)",
  teal: "var(--color-pn-teal)",
  orange: "var(--color-pn-orange)",
  cyan: "var(--color-pn-cyan)",
  pink: "var(--color-pn-pink)",
  lime: "var(--color-pn-lime)",
  muted: "color-mix(in oklab, var(--color-muted-foreground) 45%, transparent)",
  good: "var(--color-success)",
  warn: "var(--color-warning)",
  bad: "var(--color-destructive)",
};

export const PALETTE = [C.c1, C.c2, C.c3, C.c4, C.c5, C.teal, C.orange, C.cyan, C.pink, C.lime];
