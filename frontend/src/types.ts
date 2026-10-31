export type Role = "student" | "teacher";
export type Level = "strong" | "shaky" | "weak" | "untested";
export type Confidence = "low" | "medium" | "high";
export type Outcome = "correct_confident" | "correct_unsure" | "careless_slip" | "knowledge_gap" | "misconception";

export interface User {
  id: number;
  username: string;
  role: Role;
  name: string;
  interest: string;
  age_group: "gen_z" | "millennial" | "gen_x";
  is_simulated?: number;
}

export interface TopicCard {
  id: string;
  name: string;
  concepts: number;
  avg_mastery: number | null;
  level: Level;
}
export interface Subject {
  id: string;
  class: number;
  subject: string;
  available: boolean;
  chapter?: { number: number; title: string; topics: TopicCard[] };
}

export interface PublicQuestion {
  id: string;
  stem: string;
  level: string;
  concepts: { id: string; name: string }[];
  options: { key: string; text: string }[];
}
export interface StartedAttempt {
  attempt_id: number;
  test: { id: string; topic_id: string; questions: PublicQuestion[] };
}
export interface AnswerIn {
  question_id: string;
  chosen_key: string | null;
  confidence: Confidence;
  reasoning: string;
}

export interface MapConcept {
  id: string;
  name: string;
  section_id: string;
  pages: number[];
  p_known: number | null;
  level: Level;
  p_before: number | null;
  prerequisites: string[];
  root_causes: string[];
  in_topic: boolean;
}

export interface ResultQuestion {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  chosen_key: string;
  correct_key: string;
  correct: boolean;
  chosen_text: string | null;
  correct_text: string;
  confidence: Confidence;
  reasoning: string;
  outcome: Outcome;
  misconception: string | null;
  thinking_summary: string;
  why_correct: string;
  source_quote: string;
  revise: { concept: string; pages: number[] }[];
  concept_ids: string[];
}
export interface Results {
  attempt_id: number;
  topic_id: string;
  score: number;
  total: number;
  questions: ResultQuestion[];
  concept_map: MapConcept[];
  weak_concepts: MapConcept[];
  misconceptions_found: { id: string; text: string; concept_id: string }[];
  revision_due: { concept_id: string; name: string; p_known: number; due: string }[];
}

export interface Explanation {
  explanation_id: number;
  concept_id: string;
  concept_name: string;
  style: string;
  text: string;
  analogy_used: string | null;
  check_question: string;
  fact_check: { issues_found?: string[]; corrected?: boolean };
  helped?: number | null;
}

export interface Progress {
  attempts: { id: number; topic_id: string; score: number; total: number; finished_at: string }[];
  concept_map: MapConcept[];
  misconceptions: { misconception_id: string; concept_id: string; times: number; text: string }[];
  revision_due: { concept_id: string; name: string; p_known: number; due: string }[];
  style_stats: Record<string, { shown: number; helped: number }>;
}

export interface Interest { name: string; source: "chosen" | "asked"; times: number }
export interface ActivityEvent { type: "test" | "request"; at: string; student: string; text: string; concept?: string }

export interface RosterStudent extends User {
  interests: string[];
  avg_mastery: number | null;
  weak_concepts: number;
  at_risk: boolean;
  last_test: { score: number; total: number; finished_at: string; topic_id: string } | null;
}
export interface HeatCell {
  concept_id: string;
  name: string;
  avg_mastery: number;
  students: number;
  weak_students: number;
  weak_share: number;
  misconceptions: { id: string; text: string; students: number }[];
}
export interface ClassOverview {
  students: RosterStudent[];
  concept_heatmap: HeatCell[];
  top_gaps: HeatCell[];
  note: string;
}
export interface ReteachPlan {
  concept_id: string;
  misconception: string;
  explain_in_5_minutes: string;
  analogy: string;
  practice_questions: string[];
}
export interface StudentDetail {
  student: User;
  attempts: { id: number; topic_id: string; score: number; total: number; finished_at: string }[];
  concept_map: MapConcept[];
  calibration: { answers: number; wrong_but_confident: number; wrong_total: number; right_but_unsure: number; outcomes: Record<string, number> };
  misconceptions: { text: string; concept: string; times: number }[];
  interests: Interest[];
  recent_requests: { at: string; request: string; concept: string; style: string }[];
  style_stats: Record<string, { shown: number; helped: number }>;
  profile: {
    thinking_summary: string;
    strengths: string[];
    watch_outs: string[];
    how_to_approach: string[];
    best_explanation_style: string;
  };
}
export interface TraceEntry { agent: string; at: string; seconds: number; chars_in: number; chars_out: number; ok: boolean }
