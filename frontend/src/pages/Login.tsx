import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Logo } from "../components/AppShell";
import { Spinner } from "../components/ui";

// Set only in development (frontend/.env.development), so the public build never carries a password.
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;

const DEMO = [
  { username: "riya", name: "Riya", note: "Student, loves Marvel" },
  { username: "arjun", name: "Arjun", note: "Student, loves cricket" },
  { username: "teacher", name: "Ms. Rao", note: "Teacher" },
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
    <div className="grid min-h-full lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-line p-12 lg:flex">
        <div className="flex items-center gap-2.5"><Logo size={28} /><span className="text-lg font-semibold tracking-tight">Kakashi Tutor</span></div>
        <div>
          <h1 className="max-w-md text-[40px] font-semibold leading-[1.1] tracking-tight">A tutor that learns how you think.</h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-mute">
            Take a short NCERT test, explain your reasoning, and get every mistake explained through the things you
            enjoy. Teachers see exactly where each student is stuck.
          </p>
        </div>
        <div className="text-xs text-faint">NCERT Class 10 Biology, Life Processes</div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden"><Logo /><span className="font-semibold">Kakashi Tutor</span></div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1.5 text-sm text-mute">Use your username and password.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mute" htmlFor="u">Username</label>
              <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-mute" htmlFor="p">Password</label>
              <input id="p" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>}
            <button className="btn btn-primary h-10 w-full" disabled={busy || !username || !password}>
              {busy ? <Spinner /> : "Sign in"}
            </button>
          </form>

          <div className="mt-8">
            <div className="label-eyebrow mb-2">Demo accounts</div>
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              {DEMO.map((d) => (
                <button key={d.username} disabled={busy} className="flex w-full items-center justify-between bg-panel px-4 py-3 text-left hover:bg-raise"
                  onClick={() => (DEMO_PASSWORD ? go(d.username, DEMO_PASSWORD) : setUsername(d.username))}>
                  <span className="text-sm font-semibold">{d.name}</span>
                  <span className="text-xs text-mute">{d.note}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
