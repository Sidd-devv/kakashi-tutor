import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, GraduationCap, Presentation } from "lucide-react";
import { useAuth } from "../auth";
import { Logo } from "../components/AppShell";
import { TutorOrb } from "../components/TutorOrb";
import { Spinner } from "../components/ui";

// Set only in development (frontend/.env.development), so the public build never carries a password.
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;

const DEMO = [
  { username: "riya", name: "Riya", note: "Student · loves Marvel", icon: GraduationCap },
  { username: "arjun", name: "Arjun", note: "Student · loves cricket", icon: GraduationCap },
  { username: "teacher", name: "Ms. Rao", note: "Teacher dashboard", icon: Presentation },
];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to={user.role === "teacher" ? "/teacher" : "/"} replace />;

  async function go(u: string, p: string) {
    setBusy(true);
    setError("");
    try {
      const me = await login(u, p);
      nav(me.role === "teacher" ? "/teacher" : "/", { replace: true });
    } catch (e) {
      setError((e as Error).message || "Could not sign in");
      setBusy(false);
    }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); if (username && password) go(username, password); };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-12 lg:flex grid-bg">
        <div className="flex items-center gap-2.5"><Logo size={32} /><span className="text-lg font-semibold tracking-tight">Kakashi Tutor</span></div>
        <div className="relative">
          <div className="absolute -left-10 -top-24 opacity-90"><TutorOrb size={150} /></div>
          <h1 className="relative mt-28 max-w-lg text-[44px] font-semibold leading-[1.08] tracking-tight">
            A tutor that learns <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">how you think.</span>
          </h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-mute">
            Take a short NCERT test, explain your reasoning, and get every mistake explained in the things you love.
            Teachers see exactly where each student is stuck.
          </p>
        </div>
        <div className="text-xs text-faint">NCERT Class 10 Biology · Life Processes</div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px] fade-up">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden"><Logo /><span className="font-semibold">Kakashi Tutor</span></div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-1.5 text-sm text-mute">Sign in to continue your practice.</p>

          <form onSubmit={submit} className="mt-7 space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mute" htmlFor="u">Username</label>
              <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. riya" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mute" htmlFor="p">Password</label>
              <input id="p" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>}
            <button className="btn btn-primary h-11 w-full" disabled={busy || !username || !password}>
              {busy ? <Spinner /> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="my-7 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-line" />Demo accounts<span className="h-px flex-1 bg-line" /></div>
          <div className="space-y-2">
            {DEMO.map((d) => (
              <button key={d.username} disabled={busy} className="card card-hover flex w-full items-center gap-3 p-3 text-left"
                onClick={() => (DEMO_PASSWORD ? go(d.username, DEMO_PASSWORD) : setUsername(d.username))}>
                <span className="grid size-9 place-items-center rounded-lg bg-raise text-accent"><d.icon size={17} /></span>
                <span className="flex-1 leading-tight">
                  <span className="block text-sm font-semibold">{d.name}</span>
                  <span className="block text-xs text-mute">{d.note}</span>
                </span>
                <ArrowRight size={15} className="text-faint" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
