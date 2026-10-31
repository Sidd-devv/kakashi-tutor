import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Brain, Compass, ShieldAlert, Star } from "lucide-react";
import { api } from "../api";
import ConceptMap from "../components/ConceptMap";
import { ThinkingPanel } from "../components/ThinkingPanel";
import { Badge, Bar, ErrorBox, useAsync } from "../components/ui";
import { LEVEL_COLOR, LEVEL_LABEL, OUTCOME, STYLE_LABEL, dateShort, initials, pct } from "../lib";
import type { MapConcept, Outcome } from "../types";

function List({ icon: Icon, title, items, color }: { icon: typeof Star; title: string; items: string[]; color: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg/40 p-4">
      <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold"><Icon size={15} style={{ color }} />{title}</div>
      {items.length === 0 ? <p className="text-[13px] text-faint">Not enough data yet.</p> : (
        <ul className="space-y-2 text-[13.5px] leading-snug text-mute">
          {items.map((t) => <li key={t} className="flex gap-2"><span className="mt-[7px] size-1 shrink-0 rounded-full" style={{ background: color }} />{t}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function TeacherStudent() {
  const { id = "" } = useParams();
  const d = useAsync(() => api.teacherStudent(Number(id)), [id]);
  const [sel, setSel] = useState<MapConcept | null>(null);

  if (d.loading) return <div className="py-6"><ThinkingPanel title="Building this student’s thinking profile" hint="The teacher-insights agent reads their answers, confidence and reasoning." /></div>;
  if (d.error || !d.data) return <ErrorBox message={d.error ?? "Not found"} onRetry={d.retry} />;
  const { student: s, profile, calibration: cal } = d.data;
  const styles = Object.entries(d.data.style_stats).filter(([, v]) => v.shown > 0);
  const outcomes = Object.entries(cal.outcomes) as [Outcome, number][];

  return (
    <>
      <Link to="/teacher" className="mb-4 inline-flex items-center gap-1.5 text-sm text-mute hover:text-ink"><ArrowLeft size={15} /> Class overview</Link>

      <div className="mb-6 flex flex-wrap items-center gap-4 fade-up">
        <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent2 text-lg font-bold text-[#04101c]">{initials(s.name)}</span>
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{s.name}</h1>
          <p className="text-sm text-mute">Loves {s.interest || "—"} · {s.age_group.replace("_", " ")} · {d.data.attempts.length} test{d.data.attempts.length === 1 ? "" : "s"} taken</p>
        </div>
        {s.is_simulated ? <span className="chip ml-auto">Simulated sample student</span> : <Badge color="#22d3ee">Live student</Badge>}
      </div>

      <section className="card p-6 fade-up">
        <div className="mb-3 flex items-center gap-2"><Brain size={17} className="text-accent2" /><h2 className="font-semibold">How {s.name} thinks</h2></div>
        <p className="max-w-3xl text-[16px] leading-relaxed">{profile.thinking_summary}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <List icon={Star} title="Strengths" items={profile.strengths} color="#34d399" />
          <List icon={ShieldAlert} title="Watch out for" items={profile.watch_outs} color="#fbbf24" />
          <List icon={Compass} title="How to approach" items={profile.how_to_approach} color="#22d3ee" />
        </div>
        {profile.best_explanation_style && <p className="mt-4 text-xs text-faint">Explanation style that works best: <span className="text-mute">{profile.best_explanation_style}</span></p>}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="label-eyebrow mb-3">Concept map</div>
          <ConceptMap concepts={d.data.concept_map} selectedId={sel?.id ?? null} onSelect={setSel} height={430} />
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <div className="label-eyebrow mb-2">{sel ? sel.name : "Select a concept"}</div>
            {sel ? <><div className="mb-3 flex items-center gap-2"><Badge color={LEVEL_COLOR[sel.level]}>{LEVEL_LABEL[sel.level]}</Badge><span className="text-sm text-mute">{pct(sel.p_known)}</span></div><Bar value={sel.p_known ?? 0} color={LEVEL_COLOR[sel.level]} /></>
              : <p className="text-sm text-mute">Click a node to see mastery for that concept.</p>}
          </div>
          <div className="card p-5">
            <div className="label-eyebrow mb-3">Confidence vs. correctness</div>
            {cal.answers === 0 ? <p className="text-sm text-mute">No answers recorded for this student.</p> : (
              <div className="space-y-3 text-[13px]">
                <div><div className="mb-1 flex justify-between text-mute"><span>Wrong but very sure</span><b className="text-ink">{cal.wrong_but_confident}/{cal.wrong_total}</b></div><Bar value={cal.wrong_total ? cal.wrong_but_confident / cal.wrong_total : 0} color="#f87171" height={6} /></div>
                <div><div className="mb-1 flex justify-between text-mute"><span>Right but not sure</span><b className="text-ink">{cal.right_but_unsure}</b></div><Bar value={cal.answers ? cal.right_but_unsure / cal.answers : 0} color="#fbbf24" height={6} /></div>
                <div className="flex flex-wrap gap-1.5 pt-1">{outcomes.map(([k, v]) => <Badge key={k} color={OUTCOME[k].color}>{OUTCOME[k].label} · {v}</Badge>)}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="label-eyebrow mb-3">Beliefs caught</div>
          {d.data.misconceptions.length === 0 ? <p className="text-sm text-mute">None recorded.</p> : (
            <ul className="space-y-2.5 text-[13px]">{d.data.misconceptions.map((m) => <li key={m.text} className="rounded-lg border border-line p-3">“{m.text}”<div className="mt-1 text-xs text-faint">{m.concept} · {m.times}×</div></li>)}</ul>
          )}
        </div>
        <div className="card p-5">
          <div className="label-eyebrow mb-3">Explanations that worked</div>
          {styles.length === 0 ? <p className="text-sm text-mute">No feedback yet.</p> : (
            <ul className="space-y-3">{styles.map(([k, v]) => <li key={k}><div className="mb-1 flex justify-between text-[13px]"><span>{STYLE_LABEL[k] ?? k}</span><span className="text-faint">{v.helped}/{v.shown}</span></div><Bar value={v.shown ? v.helped / v.shown : 0} color="#818cf8" height={6} /></li>)}</ul>
          )}
        </div>
        <div className="card p-5">
          <div className="label-eyebrow mb-3">Tests</div>
          {d.data.attempts.length === 0 ? <p className="text-sm text-mute">No tests yet.</p> : (
            <ul className="space-y-2">{[...d.data.attempts].reverse().map((a) => <li key={a.id} className="flex items-center justify-between rounded-lg bg-raise/60 px-3 py-2.5 text-[13px]"><span className="capitalize">{a.topic_id}<span className="ml-2 text-xs text-faint">{dateShort(a.finished_at)}</span></span><b>{a.score}/{a.total}</b></li>)}</ul>
          )}
        </div>
      </section>
    </>
  );
}
