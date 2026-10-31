import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { api } from "../api";
import ConceptMap from "../components/ConceptMap";
import { TutorOrb, Typewriter } from "../components/TutorOrb";
import { Badge, Bar, ErrorBox, PageHead, Ring, Skeleton, useAsync } from "../components/ui";
import { LEVEL_COLOR, LEVEL_LABEL, OUTCOME, pageText, pct } from "../lib";
import type { MapConcept, ResultQuestion, Results } from "../types";

function QuestionRow({ q, n }: { q: ResultQuestion; n: number }) {
  const [open, setOpen] = useState(!q.correct && n === 1);
  const o = OUTCOME[q.outcome];
  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setOpen(!open)}>
        <span className="grid size-7 shrink-0 place-items-center rounded-md text-sm font-semibold" style={{ background: `${o.color}22`, color: o.color }}>{n}</span>
        <span className="flex-1 text-[15px] font-medium leading-snug">{q.stem}</span>
        <Badge color={o.color}>{o.label}</Badge>
        <ChevronDown size={16} className={`shrink-0 text-faint transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-line p-5 text-[14px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`rounded-lg border p-3 ${q.correct ? "border-good/40" : "border-bad/40"}`}>
              <div className="label-eyebrow mb-1">You chose</div>
              <div>{q.chosen_text ?? "No answer"}</div>
            </div>
            {!q.correct && (
              <div className="rounded-lg border border-good/40 p-3">
                <div className="label-eyebrow mb-1">Correct answer</div>
                <div>{q.correct_text}</div>
              </div>
            )}
          </div>
          {!q.correct && q.thinking_summary && (
            <div className="rounded-lg bg-raise p-3.5">
              <div className="label-eyebrow mb-1">What your tutor noticed</div>
              <p className="text-mute">{q.thinking_summary}</p>
              {q.misconception && <p className="mt-2 text-bad">Belief spotted: “{q.misconception}”</p>}
            </div>
          )}
          {q.reasoning && <p className="text-mute"><span className="text-faint">Your reasoning: </span>“{q.reasoning}”</p>}
          <p className="text-mute"><span className="text-faint">Why it is right: </span>{q.why_correct}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {q.revise.map((r) => <span key={r.concept} className="chip">Revise {r.concept}, NCERT {pageText(r.pages)}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const { attemptId = "" } = useParams();
  const id = Number(attemptId);
  const nav = useNavigate();
  const fromState = (useLocation().state as { results?: Results } | null)?.results;
  const res = useAsync<Results>(() => (fromState && fromState.attempt_id === id ? Promise.resolve(fromState) : api.results(id)), [id]);
  const brief = useAsync(() => api.briefing(id), [id]);
  const [sel, setSel] = useState<MapConcept | null>(null);
  const [talking, setTalking] = useState(true);

  const r = res.data;
  const byId = useMemo(() => new Map((r?.concept_map ?? []).map((c) => [c.id, c])), [r]);
  useEffect(() => { if (r && !sel && r.weak_concepts[0]) setSel(r.weak_concepts[0]); }, [r]); // eslint-disable-line

  if (res.error) return <ErrorBox message={res.error} onRetry={res.retry} />;
  if (!r) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-[480px]" /></div>;

  const frac = r.total ? r.score / r.total : 0;
  const ringColor = frac >= 0.7 ? "#3fb68b" : frac >= 0.45 ? "#d9a441" : "#e5675d";
  const counts = r.questions.reduce<Record<string, number>>((m, q) => ({ ...m, [q.outcome]: (m[q.outcome] ?? 0) + 1 }), {});
  const sMisc = sel ? r.misconceptions_found.find((m) => m.concept_id === sel.id) : undefined;

  return (
    <>
      <PageHead eyebrow="Results" title="Here is how you did"
        right={<button className="btn" onClick={() => nav("/")}>Back to topics</button>} />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="card flex items-center gap-5 p-6">
          <Ring value={frac} size={96} stroke={8} color={ringColor}>
            <div className="text-[26px] font-semibold leading-none">{r.score}<span className="text-base text-faint">/{r.total}</span></div>
          </Ring>
          <div className="flex-1 space-y-1.5">
            {Object.entries(counts).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-[13px]">
                <span className="size-2 rounded-full" style={{ background: OUTCOME[k as keyof typeof OUTCOME].color }} />
                <span className="text-mute">{OUTCOME[k as keyof typeof OUTCOME].label}</span>
                <span className="ml-auto font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card flex gap-5 p-6">
          <TutorOrb size={56} speaking={talking && !!brief.data} />
          <div className="min-w-0 flex-1">
            <div className="label-eyebrow mb-2">Your tutor says</div>
            {brief.loading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-2/3" /></div>
            ) : brief.error ? (
              <p className="text-sm text-mute">Your tutor could not prepare a summary this time, but your results are below.</p>
            ) : (
              <p className="text-[15.5px] leading-relaxed"><Typewriter text={brief.data!.spoken_text} onDone={() => setTalking(false)} /></p>
            )}
          </div>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-3">
          <div className="label-eyebrow">Your concept map</div>
          <p className="mt-1 text-sm text-mute">Each node is an idea in this topic. Red links show a weak idea sitting on top of another weak one.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <ConceptMap concepts={r.concept_map} selectedId={sel?.id ?? null} onSelect={setSel} height={500} focusTopic />
          <div className="space-y-4">
            {sel ? (
              <div className="card p-5" key={sel.id}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold leading-tight">{sel.name}</h3>
                  <Badge color={LEVEL_COLOR[sel.level]}>{LEVEL_LABEL[sel.level]}</Badge>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-mute">
                    <span>Mastery</span>
                    <span>{sel.p_before != null ? `${pct(sel.p_before)} to ` : ""}<b className="text-ink">{pct(sel.p_known)}</b></span>
                  </div>
                  <Bar value={sel.p_known ?? 0} before={sel.p_before} color={LEVEL_COLOR[sel.level]} />
                </div>
                {sel.pages.length > 0 && <div className="mt-4 text-[13px] text-mute">Revise NCERT {pageText(sel.pages)}</div>}
                {sel.root_causes.length > 0 && (
                  <div className="mt-3 rounded-lg border border-bad/30 p-3 text-[13px]">
                    <div className="mb-1 font-semibold text-bad">Start here first</div>
                    {sel.root_causes.map((c) => (
                      <button key={c} className="block text-left text-mute underline decoration-dotted hover:text-ink" onClick={() => byId.get(c) && setSel(byId.get(c)!)}>
                        {byId.get(c)?.name ?? c}
                      </button>
                    ))}
                  </div>
                )}
                {sMisc && <div className="mt-3 rounded-lg bg-raise p-3 text-[13px]"><div className="label-eyebrow mb-1">Belief spotted</div>“{sMisc.text}”</div>}
                <Link to={`/review/${r.attempt_id}`} className="btn btn-sm mt-4 w-full">Ask the tutor about this</Link>
              </div>
            ) : (
              <div className="card p-5 text-sm text-mute">Click any concept to see how you are doing on it.</div>
            )}

            {r.weak_concepts.length > 0 && (
              <div className="card p-5">
                <div className="label-eyebrow mb-3">Where to start</div>
                <ul className="space-y-1">
                  {r.weak_concepts.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      <button onClick={() => setSel(c)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition hover:bg-raise ${sel?.id === c.id ? "bg-raise" : ""}`}>
                        <span className="size-2 rounded-full bg-bad" /><span className="flex-1 font-medium">{c.name}</span><span className="text-xs text-faint">{pct(c.p_known)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <div className="label-eyebrow">Question by question</div>
          {r.questions.some((q) => !q.correct) && (
            <Link to={`/review/${r.attempt_id}`} className="btn btn-primary btn-sm">Review my mistakes with the tutor</Link>
          )}
        </div>
        <div className="space-y-2">{r.questions.map((q, k) => <QuestionRow key={q.id} q={q} n={k + 1} />)}</div>
      </section>
    </>
  );
}
