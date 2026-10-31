import type { Level, Outcome } from "./types";

export const LEVEL_COLOR: Record<Level, string> = {
  strong: "#34d399",
  shaky: "#fbbf24",
  weak: "#f87171",
  untested: "#64748b",
};
export const LEVEL_LABEL: Record<Level, string> = {
  strong: "Strong", shaky: "Shaky", weak: "Needs work", untested: "Not tested",
};

export const levelOf = (p: number | null | undefined): Level =>
  p == null ? "untested" : p >= 0.7 ? "strong" : p >= 0.45 ? "shaky" : "weak";

export const pct = (p: number | null | undefined) => (p == null ? "–" : `${Math.round(p * 100)}%`);

export const OUTCOME: Record<Outcome, { label: string; color: string; hint: string }> = {
  correct_confident: { label: "Correct", color: "#34d399", hint: "Right, and sure about it" },
  correct_unsure: { label: "Correct, unsure", color: "#a3e635", hint: "Right, but not confident" },
  careless_slip: { label: "Careless slip", color: "#fbbf24", hint: "Understood, picked wrong" },
  knowledge_gap: { label: "Knowledge gap", color: "#fb923c", hint: "Not yet learned" },
  misconception: { label: "Misconception", color: "#f87171", hint: "A confident wrong belief" },
};

export const STYLE_LABEL: Record<string, string> = {
  analogy: "Analogy", simple_words: "Simple words", step_by_step: "Step by step",
  story: "Story", real_life_example: "Real-life example", custom: "Your request",
};

export const TOPIC_BLURB: Record<string, string> = {
  overview: "Why living things need energy and materials",
  nutrition: "From plants making food to digestion in humans",
  respiration: "Releasing energy, and how gases are exchanged",
  transportation: "Blood, the heart, and water movement in plants",
  excretion: "How the body and plants remove wastes",
};

export const pageText = (pages: number[]) =>
  !pages.length ? "" : pages[0] === pages[pages.length - 1] ? `p. ${pages[0]}` : `pp. ${pages[0]}–${pages[pages.length - 1]}`;

export const dateShort = (iso: string) => {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
