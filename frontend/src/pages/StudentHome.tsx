import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, ErrorBox, PageHead, Ring, Skeleton, useAsync } from "../components/ui";
import { LEVEL_COLOR, LEVEL_LABEL, TOPIC_BLURB, dateShort, pct } from "../lib";
import type { Subject } from "../types";

const AGES = [
  { id: "gen_z", label: "Gen Z" },
  { id: "millennial", label: "Millennial" },
  { id: "gen_x", label: "Gen X" },
] as const;

function Personalise() {
  const { user, setUser } = useAuth();
  const [interest, setInterest] = useState(user?.interest ?? "");
  const [saved, setSaved] = useState(false);
  useEffect(() => setInterest(user?.interest ?? ""), [user?.interest]);
  if (!user) return null;

  async function save(patch: { interest?: string; age_group?: string }) {
    setUser(await api.updateMe(patch));
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="card p-5">
      <div className="text-sm font-semibold">Explain things in my world</div>
      <p className="mt-1 text-[13px] text-mute">Your tutor uses this to explain mistakes in a way that sticks.</p>
      <label className="label-eyebrow mb-1.5 mt-4 block">I enjoy</label>
      <input className="input" value={interest} placeholder="Marvel, cricket, anime, cooking"
        onChange={(e) => setInterest(e.target.value)}
        onBlur={() => interest !== user.interest && save({ interest })}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
      <label className="label-eyebrow mb-1.5 mt-4 block">Talk to me like</label>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-bg p-1">
        {AGES.map((a) => (
          <button key={a.id} onClick={() => save({ age_group: a.id })}
            className={`rounded-md py-1.5 text-[13px] font-medium transition ${user.age_group === a.id ? "bg-raise text-ink" : "text-mute hover:text-ink"}`}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="mt-2 h-4 text-xs text-good">{saved ? "Saved" : ""}</div>
    </div>
  );
}

export default function StudentHome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const subjects = useAsync(api.subjects, []);
  const progress = useAsync(api.progress, []);
  const [picked, setPicked] = useState<string>("bio10");

  const active: Subject | undefined = subjects.data?.find((s) => s.id === picked && s.available);
  const attempts = progress.data?.attempts ?? [];
  const last = attempts[attempts.length - 1];

  return (
    <>
      <PageHead eyebrow="Student" title={`Hi ${user?.name}, what shall we practise?`}
        sub="Pick a subject and topic, take a short test, and your tutor works out what to fix first." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-7">
          <section>
            <div className="label-eyebrow mb-3">Subjects</div>
            {subjects.error ? <ErrorBox message={subjects.error} onRetry={subjects.retry} /> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {subjects.loading && [0, 1].map((i) => <Skeleton key={i} className="h-[76px]" />)}
                {subjects.data?.map((s) => (
                  <button key={s.id} disabled={!s.available} onClick={() => setPicked(s.id)}
                    className={`card flex items-center gap-4 p-4 text-left ${s.available ? "card-hover" : "opacity-50"} ${picked === s.id && s.available ? "!border-accent" : ""}`}>
                    <span className="grid size-11 place-items-center rounded-lg bg-raise text-base font-semibold text-mute">{s.class}</span>
                    <span className="flex-1">
                      <span className="block font-semibold">{s.subject}</span>
                      <span className="block text-xs text-mute">Class {s.class}, NCERT Science</span>
                    </span>
                    {!s.available && <span className="text-xs text-faint">Coming soon</span>}
                  </button>
                ))}
              </div>
            )}
          </section>

          {active?.chapter && (
            <section>
              <div className="label-eyebrow mb-3">Chapter {active.chapter.number}: {active.chapter.title}</div>
              <div className="grid gap-3 md:grid-cols-2">
                {active.chapter.topics.map((t) => (
                  <div key={t.id} className="card flex flex-col gap-4 p-5">
                    <div className="flex items-start gap-4">
                      <Ring value={t.avg_mastery ?? 0} size={56} stroke={5} color={LEVEL_COLOR[t.level]}>
                        <span className="text-xs font-semibold">{pct(t.avg_mastery)}</span>
                      </Ring>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold">{t.name}</h3>
                        <p className="mt-0.5 text-[13px] leading-snug text-mute">{TOPIC_BLURB[t.id]}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs text-faint">
                        <Badge color={LEVEL_COLOR[t.level]}>{LEVEL_LABEL[t.level]}</Badge> {t.concepts} concepts
                      </span>
                      <button className="btn btn-primary btn-sm" onClick={() => nav(`/test/${t.id}`)}>
                        {t.avg_mastery == null ? "Take the test" : "Practise again"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <Personalise />

          <div className="card p-5">
            <div className="text-sm font-semibold">Revise soon</div>
            {progress.loading ? <Skeleton className="mt-4 h-24" /> : !progress.data?.revision_due.length ? (
              <p className="mt-2 text-[13px] text-mute">Nothing due yet. Take a test and your revision plan will appear here.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {progress.data.revision_due.slice(0, 5).map((r) => (
                  <li key={r.concept_id} className="flex items-center justify-between gap-3 rounded-md bg-raise px-3 py-2 text-[13px]">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="shrink-0 text-xs text-faint">{pct(r.p_known)} · {dateShort(r.due)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {last && (
            <button className="card card-hover w-full p-5 text-left" onClick={() => nav(`/results/${last.id}`)}>
              <div className="label-eyebrow">Last test</div>
              <div className="mt-2 flex items-end justify-between">
                <div className="text-3xl font-semibold">{last.score}<span className="text-lg text-faint">/{last.total}</span></div>
                <span className="text-sm text-accent">View results</span>
              </div>
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
