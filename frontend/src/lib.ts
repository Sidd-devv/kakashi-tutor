import type { Level, Outcome } from "./types";

export const LEVEL_COLOR: Record<Level, string> = {
  strong: "#3fb68b",
  shaky: "#d9a441",
  weak: "#e5675d",
  untested: "#65748b",
};
export const LEVEL_LABEL: Record<Level, string> = {
  strong: "Strong", shaky: "Shaky", weak: "Needs work", untested: "Not tested",
};

export const levelOf = (p: number | null | undefined): Level =>
  p == null ? "untested" : p >= 0.7 ? "strong" : p >= 0.45 ? "shaky" : "weak";

export const pct = (p: number | null | undefined) => (p == null ? "–" : `${Math.round(p * 100)}%`);

export const OUTCOME: Record<Outcome, { label: string; color: string; hint: string }> = {
  correct_confident: { label: "Correct", color: "#3fb68b", hint: "Right, and sure about it" },
  correct_unsure: { label: "Correct, unsure", color: "#8cc152", hint: "Right, but not confident" },
  careless_slip: { label: "Careless slip", color: "#d9a441", hint: "Understood, picked wrong" },
  knowledge_gap: { label: "Knowledge gap", color: "#d98a41", hint: "Not yet learned" },
  misconception: { label: "Misconception", color: "#e5675d", hint: "A confident wrong belief" },
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

/** "just now", "5 min ago", "2 h ago", or a date. Server times are UTC. */
export const ago = (iso: string) => {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  const s = (Date.now() - d.getTime()) / 1000;
  if (isNaN(s)) return iso;
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const initials =(name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
