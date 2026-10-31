import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "../api";
import ConceptMap from "../components/ConceptMap";
import { Badge, Bar, ErrorBox, PageHead, Skeleton, useAsync } from "../components/ui";
import { LEVEL_COLOR, LEVEL_LABEL, STYLE_LABEL, dateShort, pct } from "../lib";
import type { MapConcept } from "../types";

export default function ProgressPage() {
  const p = useAsync(api.progress, []);
  const nav = useNavigate();
  const [sel, setSel] = useState<MapConcept | null>(null);

  if (p.error) return <ErrorBox message={p.error} onRetry={p.retry} />;
  if (!p.data) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-[420px]" /></div>;
  const d = p.data;
  const tested = d.concept_map.filter((c) => c.level !== "untested");
  const weak = tested.filter((c) => c.level === "weak").sort((a, b) => (a.p_known ?? 0) - (b.p_known ?? 0));
  const strong = tested.filter((c) => c.level === "strong");
  const styles = Object.entries(d.style_stats).filter(([, v]) => v.shown > 0);

  return (
    <>
      <PageHead eyebrow="Progress" title="Your learning map" sub="Everything your tutor knows about what you understand, updated after every answer." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[["Tests taken", String(d.attempts.length)], ["Concepts strong", `${strong.length} of ${tested.length || d.concept_map.length}`], ["Need work", String(weak.length)]].map(([k, v]) => (
          <div key={k} className="card p-5 fade-up"><div className="label-eyebrow">{k}</div><div className="mt-2 text-3xl font-semibold">{v}</div></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <ConceptMap concepts={d.concept_map} selectedId={sel?.id ?? null} onSelect={setSel} height={460} />
        <div className="space-y-4">
          <div className="card p-5">
            <div className="label-eyebrow mb-2">{sel ? sel.name : "Select a concept"}</div>
            {sel ? (
              <>
                <div className="mb-3 flex items-center gap-2"><Badge color={LEVEL_COLOR[sel.level]}>{LEVEL_LABEL[sel.level]}</Badge><span className="text-sm text-mute">{pct(sel.p_known)} mastery</span></div>
                <Bar value={sel.p_known ?? 0} color={LEVEL_COLOR[sel.level]} />
              </>
            ) : <p className="text-sm text-mute">Click a node to see your mastery for that concept.</p>}
          </div>
          <div className="card p-5">
            <div className="label-eyebrow mb-3">Weakest right now</div>
            {weak.length === 0 ? <p className="text-sm text-mute">Nothing weak yet.</p> : (
              <ul className="space-y-2">{weak.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between text-[13px]"><button className="text-left font-medium hover:text-accent" onClick={() => setSel(c)}>{c.name}</button><span className="text-faint">{pct(c.p_known)}</span></li>
              ))}</ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="label-eyebrow mb-3">Test history</div>
          {d.attempts.length === 0 ? <p className="text-sm text-mute">No tests yet.</p> : (
            <ul className="space-y-2">{[...d.attempts].reverse().map((a) => (
              <li key={a.id}><button onClick={() => nav(`/results/${a.id}`)} className="flex w-full items-center justify-between rounded-lg bg-raise/60 px-3 py-2.5 text-[13px] hover:bg-raise">
                <span className="capitalize">{a.topic_id}<span className="ml-2 text-xs text-faint">{dateShort(a.finished_at)}</span></span>
                <span className="flex items-center gap-2 font-semibold">{a.score}/{a.total}<ArrowRight size={13} className="text-faint" /></span>
              </button></li>
            ))}</ul>
          )}
        </div>
        <div className="card p-5">
          <div className="label-eyebrow mb-3">Beliefs your tutor has caught</div>
          {d.misconceptions.length === 0 ? <p className="text-sm text-mute">None so far.</p> : (
            <ul className="space-y-2.5 text-[13px]">{d.misconceptions.map((m) => <li key={m.misconception_id} className="rounded-lg border border-line p-3">“{m.text}”<div className="mt-1 text-xs text-faint">seen {m.times}×</div></li>)}</ul>
          )}
        </div>
        <div className="card p-5">
          <div className="label-eyebrow mb-3">Explanations that worked for you</div>
          {styles.length === 0 ? <p className="text-sm text-mute">Review a mistake and tell your tutor what helped. It will learn your style.</p> : (
            <ul className="space-y-3">{styles.map(([k, v]) => (
              <li key={k}><div className="mb-1 flex justify-between text-[13px]"><span>{STYLE_LABEL[k] ?? k}</span><span className="text-faint">{v.helped}/{v.shown} helped</span></div><Bar value={v.shown ? v.helped / v.shown : 0} color="#818cf8" height={6} /></li>
            ))}</ul>
          )}
        </div>
      </div>
    </>
  );
}
