import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Bar, ErrorBox, PageHead, Skeleton, Spinner, useAsync } from "../components/ui";
import { LEVEL_COLOR, ago, dateShort, levelOf, pct } from "../lib";
import type { HeatCell, ReteachPlan } from "../types";

const clock = (d: Date | null) => (d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");

function Gaps({ gaps }: { gaps: HeatCell[] }) {
  const plans = useAsync(api.teacherPlans, []);
  const [open, setOpen] = useState<string | null>(gaps[0]?.concept_id ?? null);
  const plan = (id: string): ReteachPlan | undefined => plans.data?.find((p) => p.concept_id === id);

  return (
    <div className="card divide-y divide-line">
      {gaps.map((g) => {
        const on = open === g.concept_id;
        const p = plan(g.concept_id);
        return (
          <div key={g.concept_id}>
            <button className="flex w-full items-center gap-5 px-5 py-4 text-left hover:bg-raise/50" onClick={() => setOpen(on ? null : g.concept_id)}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{g.name}</div>
                {g.misconceptions[0] && <div className="mt-0.5 truncate text-[13px] text-mute">Students believe: “{g.misconceptions[0].text}”</div>}
              </div>
              <div className="hidden w-40 shrink-0 sm:block">
                <div className="mb-1 text-right text-xs text-mute">{g.weak_students} of {g.students} weak</div>
                <Bar value={g.weak_share} color="#e5675d" />
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-faint">{on ? "Hide plan" : "Show plan"}</span>
            </button>
            {on && (
              <div className="border-t border-line bg-bg/60 px-5 py-5 text-[14px] leading-relaxed">
                {plans.loading ? (
                  <div className="flex items-center gap-3 text-mute"><Spinner /> Writing a re-teach plan from the class data</div>
                ) : plans.error ? (
                  <ErrorBox message={plans.error} onRetry={plans.retry} />
                ) : !p ? (
                  <p className="text-mute">Plans are written for the three biggest gaps. This one is next in line.</p>
                ) : (
                  <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
                    <div className="space-y-4">
                      <div><div className="label-eyebrow mb-1">Say this in five minutes</div><p className="text-mute">{p.explain_in_5_minutes}</p></div>
                      {p.analogy && <div><div className="label-eyebrow mb-1">Analogy</div><p className="text-mute">{p.analogy}</p></div>}
                    </div>
                    <div><div className="label-eyebrow mb-1">Check it worked</div>
                      <ol className="list-decimal space-y-1.5 pl-5 text-mute">{p.practice_questions.map((q) => <li key={q}>{q}</li>)}</ol></div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TeacherDashboard() {
  const cls = useAsync(api.teacherClass, [], 8000);
  const act = useAsync(api.teacherActivity, [], 6000);
  const nav = useNavigate();

  if (cls.error && !cls.data) return <ErrorBox message={cls.error} onRetry={cls.retry} />;
  if (!cls.data) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
  const d = cls.data;
  const withData = d.students.filter((s) => s.avg_mastery != null);
  const avg = withData.length ? withData.reduce((m, s) => m + (s.avg_mastery ?? 0), 0) / withData.length : null;
  const live = d.students.filter((s) => !s.is_simulated).length;

  return (
    <>
      <PageHead eyebrow="Teacher" title="Class overview"
        sub={`Biology, Life Processes. ${d.students.length} students (${live} live, ${d.students.length - live} sample students).`}
        right={<span className="flex items-center gap-2 text-xs text-faint"><span className="size-1.5 animate-pulse rounded-full bg-good" /> Live, updated {clock(cls.updated)}</span>} />

      <div className="card mb-6 grid grid-cols-3 divide-x divide-line">
        {[["Students", String(d.students.length), undefined], ["At risk", String(d.students.filter((s) => s.at_risk).length), "#e5675d"], ["Class mastery", pct(avg), LEVEL_COLOR[levelOf(avg)]]].map(([k, v, c]) => (
          <div key={k as string} className="px-6 py-4">
            <div className="label-eyebrow">{k}</div>
            <div className="mt-1.5 text-2xl font-semibold" style={{ color: c as string | undefined }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="min-w-0">
          <div className="label-eyebrow mb-3">Where the class is stuck</div>
          <Gaps gaps={d.top_gaps.slice(0, 5)} />
        </section>

        <section className="min-w-0">
          <div className="label-eyebrow mb-3">Live activity</div>
          <div className="card divide-y divide-line">
            {act.data?.length ? act.data.slice(0, 7).map((e, i) => (
              <div key={i} className="px-4 py-3 text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{e.student}</span>
                  <span className="shrink-0 text-xs text-faint">{ago(e.at)}</span>
                </div>
                <div className="mt-0.5 text-mute">{e.type === "request" ? (e.text.startsWith("(") ? "Did not understand the last explanation" : <>Asked: “{e.text}”</>) : e.text}</div>
                {e.concept && <div className="mt-0.5 text-xs text-faint">{e.concept}</div>}
              </div>
            )) : <p className="p-4 text-[13px] text-mute">{act.loading ? "Loading" : "No activity yet. Test submissions and tutor questions from live students appear here."}</p>}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div className="label-eyebrow mb-3">Students</div>
        <div className="card overflow-hidden">
          <table className="w-full text-left text-[13.5px]">
            <thead className="border-b border-line text-xs text-faint">
              <tr>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Interests</th>
                <th className="px-4 py-3 font-medium">Mastery</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Last test</th>
              </tr>
            </thead>
            <tbody>
              {d.students.map((s) => (
                <tr key={s.id} onClick={() => nav(`/teacher/student/${s.id}`)} className="cursor-pointer border-b border-line/70 last:border-0 hover:bg-raise/50">
                  <td className="px-5 py-3">
                    <span className="font-semibold">{s.name}</span>
                    {s.at_risk && <span className="ml-2 text-xs text-bad">at risk</span>}
                    {s.is_simulated ? <span className="ml-2 text-xs text-faint">sample</span> : null}
                  </td>
                  <td className="hidden px-4 py-3 text-mute md:table-cell">{s.interests.join(", ") || "None set"}</td>
                  <td className="w-44 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1"><Bar value={s.avg_mastery ?? 0} color={LEVEL_COLOR[levelOf(s.avg_mastery)]} height={5} /></div>
                      <span className="w-9 text-right text-xs text-mute">{pct(s.avg_mastery)}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-mute sm:table-cell">{s.last_test ? `${s.last_test.score}/${s.last_test.total}, ${dateShort(s.last_test.finished_at)}` : "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
