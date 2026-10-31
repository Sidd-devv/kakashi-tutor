import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { ThinkingPanel } from "../components/ThinkingPanel";
import { Bar, ErrorBox, useAsync } from "../components/ui";
import { LEVEL_COLOR, ago, dateShort, pct } from "../lib";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="label-eyebrow mb-2">{title}</div>
      {items.length === 0 ? <p className="text-[13px] text-faint">Not enough data yet.</p> : (
        <ul className="space-y-2 text-[13.5px] leading-snug text-mute">
          {items.map((t) => <li key={t} className="flex gap-2.5"><span className="mt-[8px] size-1 shrink-0 rounded-full bg-faint" />{t}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function TeacherStudent() {
  const { id = "" } = useParams();
  const d = useAsync(() => api.teacherStudent(Number(id)), [id], 10000);

  if (d.loading && !d.data) return <div className="py-6"><ThinkingPanel title="Building this student’s thinking profile" hint="The teacher-insights agent reads their answers, confidence and reasoning." /></div>;
  if (!d.data) return <ErrorBox message={d.error ?? "Not found"} onRetry={d.retry} />;
  const { student: s, profile, calibration: cal } = d.data;
  const weak = d.data.concept_map.filter((c) => c.level === "weak").sort((a, b) => (a.p_known ?? 0) - (b.p_known ?? 0));
  const names = new Map(d.data.concept_map.map((c) => [c.id, c.name]));

  return (
    <>
      <Link to="/teacher" className="mb-4 inline-block text-sm text-mute hover:text-ink">Back to class overview</Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{s.name}</h1>
        <p className="mt-1 text-sm text-mute">
          {s.is_simulated ? "Sample student" : "Live student"}, {s.age_group.replace("_", " ")}, {d.data.attempts.length} test{d.data.attempts.length === 1 ? "" : "s"} taken
        </p>
      </div>

      <section className="card p-6">
        <div className="label-eyebrow mb-3">How {s.name} thinks</div>
        <p className="max-w-3xl text-[16px] leading-relaxed">{profile.thinking_summary}</p>
        <div className="mt-6 grid gap-6 border-t border-line pt-5 md:grid-cols-3">
          <List title="Strengths" items={profile.strengths} />
          <List title="Watch out for" items={profile.watch_outs} />
          <List title="How to approach" items={profile.how_to_approach} />
        </div>
        {cal.answers > 0 && (
          <p className="mt-5 border-t border-line pt-4 text-xs text-faint">
            {cal.wrong_total > 0 && <>Very sure but wrong on {cal.wrong_but_confident} of {cal.wrong_total} wrong answers. </>}
            {cal.right_but_unsure > 0 && <>Right but unsure on {cal.right_but_unsure}.</>}
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="label-eyebrow mb-3">Interests</div>
          {d.data.interests.length === 0 ? <p className="text-sm text-mute">No interests recorded yet.</p> : (
            <div className="flex flex-wrap gap-2">
              {d.data.interests.map((i) => (
                <span key={i.name} className="inline-flex items-baseline gap-2 rounded-md border border-line bg-raise px-3 py-1.5 text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span className="text-xs text-faint">{i.source === "chosen" ? `chosen${i.times ? `, asked ${i.times}x` : ""}` : `asked ${i.times}x`}</span>
                </span>
              ))}
            </div>
          )}
          <div className="label-eyebrow mb-2 mt-6">What they asked the tutor</div>
          {d.data.recent_requests.length === 0 ? <p className="text-sm text-mute">Nothing yet. Their requests will appear here as they use the tutor.</p> : (
            <ul className="divide-y divide-line">
              {d.data.recent_requests.map((r, i) => (
                <li key={i} className="py-2.5 text-[13.5px]">
                  <div className="flex justify-between gap-3"><span>{r.request.startsWith("(") ? "Did not understand the last explanation" : `“${r.request}”`}</span><span className="shrink-0 text-xs text-faint">{ago(r.at)}</span></div>
                  <div className="text-xs text-faint">{r.concept}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6">
          <div className="label-eyebrow mb-3">Concepts to work on</div>
          {weak.length === 0 ? <p className="text-sm text-mute">No weak concepts so far.</p> : (
            <ul className="space-y-4">
              {weak.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <div className="mb-1.5 flex justify-between text-[13.5px]"><span className="font-medium">{c.name}</span><span className="text-faint">{pct(c.p_known)}</span></div>
                  <Bar value={c.p_known ?? 0} color={LEVEL_COLOR.weak} height={5} />
                  {c.root_causes.length > 0 && <div className="mt-1 text-xs text-faint">Weak underneath: {c.root_causes.map((r) => names.get(r) ?? r).join(", ")}</div>}
                </li>
              ))}
            </ul>
          )}
          {d.data.misconceptions.length > 0 && (
            <>
              <div className="label-eyebrow mb-2 mt-6">Beliefs caught</div>
              <ul className="space-y-2 text-[13.5px]">
                {d.data.misconceptions.map((m) => <li key={m.text}>“{m.text}” <span className="text-xs text-faint">{m.concept}, {m.times}x</span></li>)}
              </ul>
            </>
          )}
        </section>
      </div>

      {d.data.attempts.length > 0 && (
        <section className="mt-6 card p-6">
          <div className="label-eyebrow mb-3">Tests</div>
          <ul className="divide-y divide-line text-[13.5px]">
            {[...d.data.attempts].reverse().map((a) => (
              <li key={a.id} className="flex justify-between py-2.5"><span className="capitalize">{a.topic_id} <span className="ml-2 text-xs text-faint">{dateShort(a.finished_at)}</span></span><b>{a.score}/{a.total}</b></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
