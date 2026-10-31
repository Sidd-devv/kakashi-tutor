import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight, Lightbulb, Users } from "lucide-react";
import { api } from "../api";
import { Badge, Bar, ErrorBox, PageHead, Skeleton, useAsync } from "../components/ui";
import { ThinkingPanel } from "../components/ThinkingPanel";
import { LEVEL_COLOR, dateShort, levelOf, pct } from "../lib";
import type { ClassOverview, HeatCell, ReteachPlan } from "../types";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card p-5 fade-up">
      <div className="label-eyebrow">{label}</div>
      <div className="mt-2 text-[30px] font-semibold leading-none" style={{ color: tone }}>{value}</div>
      {sub && <div className="mt-2 truncate text-xs text-mute">{sub}</div>}
    </div>
  );
}

function Heatmap({ cells, onPick }: { cells: HeatCell[]; onPick: (c: HeatCell) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {[...cells].sort((a, b) => a.avg_mastery - b.avg_mastery).map((c) => {
        const color = LEVEL_COLOR[levelOf(c.avg_mastery)];
        return (
          <button key={c.concept_id} onClick={() => onPick(c)} title={`${c.weak_students} of ${c.students} students are weak here`}
            className="group rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
            style={{ borderColor: `${color}55`, background: `linear-gradient(160deg, ${color}26, ${color}0d)` }}>
            <div className="line-clamp-2 min-h-[34px] text-[12.5px] font-semibold leading-tight">{c.name}</div>
            <div className="mt-2 flex items-end justify-between">
              <span className="text-xl font-semibold" style={{ color }}>{pct(c.avg_mastery)}</span>
              <span className="text-[11px] text-faint">{c.weak_students}/{c.students} weak</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Plans() {
  const plans = useAsync(api.teacherPlans, []);
  const names = useAsync(api.teacherClass, []);
  const [open, setOpen] = useState<string | null>(null);
  const label = (id: string) => names.data?.concept_heatmap.find((h) => h.concept_id === id)?.name ?? id.replace(/_/g, " ");

  if (plans.loading) return <ThinkingPanel title="Writing re-teach plans for the class" hint="The teacher-insights agent turns the biggest gaps into plans you can use tomorrow." />;
  if (plans.error) return <ErrorBox message={plans.error} onRetry={plans.retry} />;
  return (
    <div className="space-y-2.5">
      {plans.data!.map((p: ReteachPlan) => {
        const on = open === p.concept_id;
        return (
          <div key={p.concept_id} className="card overflow-hidden">
            <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(on ? null : p.concept_id)}>
              <span className="grid size-8 place-items-center rounded-lg bg-accent/12 text-accent"><Lightbulb size={16} /></span>
              <span className="flex-1"><span className="block font-semibold capitalize">{label(p.concept_id)}</span>
                {p.misconception && <span className="block text-[13px] text-mute">Common belief: “{p.misconception}”</span>}</span>
              <ChevronDown size={16} className={`text-faint transition ${on ? "rotate-180" : ""}`} />
            </button>
            {on && (
              <div className="space-y-4 border-t border-line p-5 text-[14px] leading-relaxed fade-up">
                <div><div className="label-eyebrow mb-1">Say this in 5 minutes</div><p className="text-mute">{p.explain_in_5_minutes}</p></div>
                {p.analogy && <div><div className="label-eyebrow mb-1">Analogy</div><p className="text-mute">{p.analogy}</p></div>}
                <div><div className="label-eyebrow mb-1">Check it worked</div>
                  <ol className="list-decimal space-y-1 pl-5 text-mute">{p.practice_questions.map((q) => <li key={q}>{q}</li>)}</ol></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TeacherDashboard() {
  const cls = useAsync<ClassOverview>(api.teacherClass, []);
  const nav = useNavigate();
  const [focus, setFocus] = useState<HeatCell | null>(null);

  if (cls.error) return <ErrorBox message={cls.error} onRetry={cls.retry} />;
  if (!cls.data) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>;
  const d = cls.data;
  const withData = d.students.filter((s) => s.avg_mastery != null);
  const avg = withData.length ? withData.reduce((m, s) => m + (s.avg_mastery ?? 0), 0) / withData.length : null;
  const live = d.students.filter((s) => !s.is_simulated).length;
  const top = d.top_gaps[0];
  const sh = focus ?? top;

  return (
    <>
      <PageHead eyebrow="Teacher" title="Class overview"
        sub={`Biology · Life Processes · ${d.students.length} students (${live} live, ${d.students.length - live} simulated sample students).`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Students" value={String(d.students.length)} sub={`${live} live accounts`} />
        <Tile label="At risk" value={String(d.students.filter((s) => s.at_risk).length)} sub="low mastery or many weak concepts" tone="#f87171" />
        <Tile label="Class mastery" value={pct(avg)} sub="average across tested concepts" tone={LEVEL_COLOR[levelOf(avg)]} />
        <Tile label="Biggest gap" value={top ? `${Math.round(top.weak_share * 100)}%` : "–"} sub={top?.name} tone="#fbbf24" />
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="label-eyebrow mb-3">Concept heatmap · weakest first</div>
          <Heatmap cells={d.concept_heatmap} onPick={setFocus} />
        </div>
        <div className="card h-fit p-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={15} className="text-warn" /> {sh?.name ?? "Select a concept"}</div>
          {sh && (
            <>
              <div className="mt-4"><div className="mb-1.5 flex justify-between text-xs text-mute"><span>Students weak here</span><b className="text-ink">{sh.weak_students} of {sh.students}</b></div>
                <Bar value={sh.weak_share} color="#f87171" /></div>
              <div className="label-eyebrow mb-2 mt-5">What students believe</div>
              {sh.misconceptions.length ? sh.misconceptions.map((m) => (
                <div key={m.id} className="mb-2 rounded-lg border border-line bg-raise/50 p-3 text-[13px]">“{m.text}”<div className="mt-1 text-xs text-faint">{m.students} students</div></div>
              )) : <p className="text-[13px] text-mute">No specific belief recorded yet.</p>}
            </>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3"><div className="label-eyebrow">Ready-to-use re-teach plans</div>
          <p className="mt-1 text-sm text-mute">For the three biggest gaps. Written by the teacher-insights agent from the class data and the textbook facts.</p></div>
        <Plans />
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-2"><Users size={15} className="text-accent" /><div className="label-eyebrow">Students</div></div>
        <div className="card overflow-hidden">
          <table className="w-full text-left text-[13.5px]">
            <thead className="border-b border-line text-xs text-faint"><tr>
              <th className="px-4 py-3 font-medium">Student</th><th className="px-4 py-3 font-medium">Mastery</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Weak concepts</th><th className="hidden px-4 py-3 font-medium md:table-cell">Last test</th><th className="w-8" /></tr></thead>
            <tbody>
              {d.students.map((s) => (
                <tr key={s.id} onClick={() => nav(`/teacher/student/${s.id}`)} className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-raise/60">
                  <td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="font-semibold">{s.name}</span>
                    {s.is_simulated ? <span className="chip !h-5 !text-[10px]">sample</span> : <Badge color="#22d3ee">live</Badge>}
                    {s.at_risk && <Badge color="#f87171">at risk</Badge>}</div>
                    <div className="text-xs text-faint">{s.interest || "no interest set"}</div></td>
                  <td className="w-44 px-4 py-3"><div className="flex items-center gap-2.5"><div className="flex-1"><Bar value={s.avg_mastery ?? 0} color={LEVEL_COLOR[levelOf(s.avg_mastery)]} height={6} /></div><span className="w-9 text-right text-xs text-mute">{pct(s.avg_mastery)}</span></div></td>
                  <td className="hidden px-4 py-3 text-mute sm:table-cell">{s.weak_concepts}</td>
                  <td className="hidden px-4 py-3 text-mute md:table-cell">{s.last_test ? `${s.last_test.score}/${s.last_test.total} · ${dateShort(s.last_test.finished_at)}` : "–"}</td>
                  <td className="px-3 text-faint"><ChevronRight size={15} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
