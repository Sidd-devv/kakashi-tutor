import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { TraceEntry } from "../types";
import { TutorOrb } from "./TutorOrb";

const AGENT_TEXT: Record<string, string> = {
  test_builder: "Test builder: writing questions from the textbook",
  validator: "Validator: checking every question against the book",
  diagnoser: "Diagnoser: working out why an answer went wrong",
  explainer: "Explainer: writing in your style",
  fact_checker: "Fact-checker: verifying against NCERT",
  teacher_insights: "Teacher insights: reading how students think",
};

const key = (t: TraceEntry) => `${t.at}|${t.agent}|${t.seconds}|${t.chars_in}|${t.chars_out}`;

/** Shows the agents that are really working right now (from the API's call trace). */
export function ThinkingPanel({ title, hint }: { title: string; hint?: string }) {
  const [fresh, setFresh] = useState<TraceEntry[]>([]);
  const baseline = useRef<Set<string> | null>(null);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const all = await api.trace();
        if (!live) return;
        if (baseline.current === null) { baseline.current = new Set(all.map(key)); return; }
        setFresh(all.filter((t) => !baseline.current!.has(key(t))));
      } catch { /* trace is only decoration */ }
    };
    tick();
    const id = setInterval(tick, 900);
    return () => { live = false; clearInterval(id); };
  }, []);

  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center gap-5 p-8 text-center fade-up">
      <TutorOrb size={72} speaking />
      <div>
        <div className="text-[17px] font-semibold">{title}</div>
        {hint && <div className="mt-1 text-sm text-mute">{hint}</div>}
      </div>
      <ul className="w-full space-y-1.5 text-left text-sm">
        {fresh.slice(-5).map((t, i) => (
          <li key={key(t) + i} className="flex items-center gap-3 rounded-md border border-line bg-bg px-3 py-2 fade-up">
            <span className="size-1.5 rounded-full bg-good" />
            <span className="flex-1">{AGENT_TEXT[t.agent] ?? t.agent}</span>
            <span className="text-xs text-faint">{t.seconds}s</span>
          </li>
        ))}
        <li className="flex items-center gap-3 px-3 py-1 text-faint">
          <span className="size-1.5 animate-pulse rounded-full bg-accent" /> Working
        </li>
      </ul>
    </div>
  );
}
