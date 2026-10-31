import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ErrorBox } from "../components/ui";
import { ThinkingPanel } from "../components/ThinkingPanel";
import type { AnswerIn, Confidence, StartedAttempt } from "../types";

const CONF: { id: Confidence; label: string; hint: string }[] = [
  { id: "low", label: "Not sure", hint: "Mostly a guess" },
  { id: "medium", label: "Fairly sure", hint: "Probably right" },
  { id: "high", label: "Very sure", hint: "I know this" },
];

type Draft = { chosen: string | null; confidence: Confidence | null; reasoning: string };

export default function TestPage() {
  const { topicId = "" } = useParams();
  const nav = useNavigate();
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [error, setError] = useState("");
  const [i, setI] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  const start = useCallback(() => {
    setError("");
    api.startAttempt(topicId).then(setAttempt).catch((e) => setError(e.message));
  }, [topicId]);

  useEffect(() => {
    if (started.current) return; // React StrictMode runs effects twice in development
    started.current = true;
    start();
  }, [start]);

  const qs = attempt?.test.questions ?? [];
  const q = qs[i];
  const d: Draft = (q && drafts[q.id]) || { chosen: null, confidence: null, reasoning: "" };
  const set = (patch: Partial<Draft>) => q && setDrafts((s) => ({ ...s, [q.id]: { ...d, ...patch } }));
  const ready = d.chosen && d.confidence;
  const last = i === qs.length - 1;

  const submit = useCallback(async () => {
    if (!attempt) return;
    setSubmitting(true);
    const answers: AnswerIn[] = qs.map((x) => {
      const a = drafts[x.id];
      return { question_id: x.id, chosen_key: a?.chosen ?? null, confidence: a?.confidence ?? "medium", reasoning: a?.reasoning ?? "" };
    });
    try {
      const res = await api.submit(attempt.attempt_id, answers);
      nav(`/results/${attempt.attempt_id}`, { state: { results: res } });
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }, [attempt, qs, drafts, nav]);

  // keyboard: 1-4 / A-D choose an option, Enter moves on
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || !q || submitting) return;
      const idx = "abcd".indexOf(e.key.toLowerCase());
      const num = ["1", "2", "3", "4"].indexOf(e.key);
      const pick = idx >= 0 ? idx : num;
      if (pick >= 0 && q.options[pick]) set({ chosen: q.options[pick].key });
      if (e.key === "Enter" && ready) last ? submit() : setI((n) => n + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (error && !attempt) return <div className="mx-auto max-w-xl"><ErrorBox message={error} onRetry={start} /></div>;
  if (submitting) return <div className="py-10"><ThinkingPanel title="Your tutor is reading your answers" hint="It looks at what you chose, how sure you were, and your reasoning." /></div>;
  if (!attempt || !q) return <div className="py-10"><ThinkingPanel title="Preparing your test" hint="Questions come straight from your NCERT chapter." /></div>;

  const answered = qs.filter((x) => drafts[x.id]?.chosen && drafts[x.id]?.confidence).length;

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="label-eyebrow">Question {i + 1} of {qs.length}</span>
          <span className="text-xs text-faint">{answered} answered</span>
        </div>
        <div className="flex gap-1.5">
          {qs.map((x, k) => (
            <button key={x.id} onClick={() => setI(k)} aria-label={`Go to question ${k + 1}`} className="h-1.5 flex-1 rounded-full transition-colors"
              style={{ background: k === i ? "#4c9aff" : drafts[x.id]?.chosen && drafts[x.id]?.confidence ? "#2d5b94" : "#232c3d" }} />
          ))}
        </div>
      </div>

      <div key={q.id} className="card p-6 sm:p-8 fade-up">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {q.concepts.map((c) => <span key={c.id} className="chip">{c.name}</span>)}
        </div>
        <h2 className="text-xl font-semibold leading-snug tracking-tight">{q.stem}</h2>

        <div className="mt-6 space-y-2" role="radiogroup">
          {q.options.map((o, k) => {
            const on = d.chosen === o.key;
            return (
              <button key={o.key} role="radio" aria-checked={on} onClick={() => set({ chosen: o.key })}
                className={`flex w-full items-center gap-3.5 rounded-lg border px-4 py-3 text-left transition ${on ? "border-accent bg-accent/10" : "border-line hover:border-[#34415a] hover:bg-raise"}`}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-md text-[13px] font-semibold ${on ? "bg-accent text-[#06101f]" : "bg-raise text-mute"}`}>{o.key}</span>
                <span className="flex-1 text-[15px]">{o.text}</span>
                <span className="hidden text-[11px] text-faint sm:block">{k + 1}</span>
              </button>
            );
          })}
        </div>

        <div className={`mt-7 transition-opacity ${d.chosen ? "opacity-100" : "pointer-events-none opacity-40"}`}>
          <div className="label-eyebrow mb-2">How sure are you?</div>
          <div className="grid grid-cols-3 gap-2">
            {CONF.map((c) => (
              <button key={c.id} onClick={() => set({ confidence: c.id })}
                className={`rounded-lg border px-3 py-2.5 text-left transition ${d.confidence === c.id ? "border-accent bg-accent/10" : "border-line hover:border-[#34415a]"}`}>
                <div className="text-[13px] font-semibold">{c.label}</div>
                <div className="text-[11px] text-faint">{c.hint}</div>
              </button>
            ))}
          </div>

          <div className="label-eyebrow mb-2 mt-5">Why did you choose it? <span className="normal-case tracking-normal text-faint">(optional, but it helps your tutor a lot)</span></div>
          <textarea className="input" rows={3} value={d.reasoning} onChange={(e) => set({ reasoning: e.target.value })}
            placeholder="In your own words, how did you think about it?" />
        </div>
      </div>

      {error && <div className="mt-4"><ErrorBox message={error} /></div>}

      <div className="mt-5 flex items-center justify-between">
        <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        {last ? (
          <button className="btn btn-primary" disabled={answered < qs.length} onClick={submit} title={answered < qs.length ? "Answer every question first" : ""}>
            Submit test
          </button>
        ) : (
          <button className="btn btn-primary" disabled={!ready} onClick={() => setI(i + 1)}>Next</button>
        )}
      </div>
      {!ready && d.chosen && <p className="mt-3 text-center text-xs text-faint">Choose how sure you are to continue.</p>}
    </div>
  );
}
