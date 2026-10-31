import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { TutorOrb } from "../components/TutorOrb";
import { Badge, ErrorBox, PageHead, Skeleton, useAsync } from "../components/ui";
import { ThinkingPanel } from "../components/ThinkingPanel";
import { STYLE_LABEL } from "../lib";
import type { Explanation } from "../types";

function Card({ first, attemptId }: { first: Explanation; attemptId: number }) {
  const { user } = useAuth();
  const [thread, setThread] = useState<Explanation[]>([first]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [custom, setCustom] = useState("");
  const [helped, setHelped] = useState<number | null>(null);
  const cur = thread[thread.length - 1];

  async function ask(body: { request?: string; didnt_understand?: boolean }) {
    setBusy(true);
    setErr("");
    try {
      const e = await api.explain({ concept_id: first.concept_id, attempt_id: attemptId, ...body });
      setThread((t) => [...t, e]);
      setHelped(null);
      setCustom("");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function good() {
    setHelped(cur.explanation_id);
    try { await api.feedback(cur.explanation_id, true); } catch { /* feedback is best effort */ }
  }

  const likes = (user?.interest ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 2);
  const quick = [...likes.map((l) => `Explain it like ${l}`), "Explain it like a movie", "Give me an everyday example"];

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4">
        <h3 className="text-base font-semibold">{first.concept_name}</h3>
        <Badge color="#93a0b5">{STYLE_LABEL[cur.style] ?? cur.style}</Badge>
        <span className="ml-auto text-xs text-mute" title="Every explanation is checked against the NCERT text before you see it">
          {cur.fact_check?.corrected ? "Fact-checker corrected this" : "Checked against NCERT"}
        </span>
      </div>

      <div className="p-6">
        {busy ? (
          <div className="flex items-center gap-4"><TutorOrb size={40} speaking /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div></div>
        ) : (
          <div key={cur.explanation_id} className="flex gap-4 fade-up">
            <div className="hidden sm:block"><TutorOrb size={40} /></div>
            <div className="flex-1">
              <p className="whitespace-pre-line text-[15.5px] leading-[1.7]">{cur.text}</p>
              {cur.check_question && (
                <div className="mt-4 rounded-lg border border-line bg-raise p-3.5 text-[14px]">
                  <div className="label-eyebrow mb-1">Try saying it back</div>{cur.check_question}
                </div>
              )}
            </div>
          </div>
        )}
        {err && <div className="mt-3"><ErrorBox message={err} /></div>}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button className="btn btn-sm" disabled={busy} onClick={() => ask({ didnt_understand: true })}>I didn’t get that</button>
          {quick.map((q) => <button key={q} className="btn btn-sm btn-ghost" disabled={busy} onClick={() => ask({ request: q })}>{q}</button>)}
          <button className={`btn btn-sm ml-auto ${helped === cur.explanation_id ? "!border-good/50 !text-good" : ""}`} disabled={busy || helped === cur.explanation_id} onClick={good}>
            {helped === cur.explanation_id ? "Glad it helped" : "This helped"}
          </button>
        </div>

        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) ask({ request: custom.trim() }); }}>
          <input className="input !h-10 text-[14px]" value={custom} onChange={(e) => setCustom(e.target.value)} disabled={busy}
            placeholder="Or ask in your own words, e.g. “explain it like a football match”" />
          <button className="btn btn-primary btn-sm !h-10" disabled={busy || !custom.trim()}>Ask</button>
        </form>

        {thread.length > 1 && (
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer text-mute hover:text-ink">Earlier explanations ({thread.length - 1})</summary>
            <div className="mt-3 space-y-3">
              {thread.slice(0, -1).reverse().map((t) => (
                <div key={t.explanation_id} className="rounded-lg border border-line p-4">
                  <div className="mb-1.5 text-xs text-faint">{STYLE_LABEL[t.style] ?? t.style}</div>
                  <p className="leading-relaxed text-mute">{t.text}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { attemptId = "" } = useParams();
  const id = Number(attemptId);
  const rev = useAsync(() => api.review(id), [id]);

  return (
    <>
      <Link to={`/results/${id}`} className="mb-4 inline-block text-sm text-mute hover:text-ink">Back to results</Link>
      <PageHead eyebrow="Review" title="Let’s fix your mistakes together"
        sub="One explanation for each idea that tripped you up, in your style. If it doesn’t click, just say so and your tutor will try another way." />
      <div className="mx-auto max-w-[800px] space-y-5">
        {rev.loading && <ThinkingPanel title="Your tutor is preparing explanations" hint="Each one is written for you and checked against the textbook." />}
        {rev.error && <ErrorBox message={rev.error} onRetry={rev.retry} />}
        {rev.data?.length === 0 && <div className="card p-8 text-center text-mute">No mistakes to review. Nicely done.</div>}
        {rev.data?.map((e) => <Card key={e.explanation_id} first={e} attemptId={id} />)}
      </div>
    </>
  );
}
