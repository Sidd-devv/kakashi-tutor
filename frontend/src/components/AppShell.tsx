import { useId, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Sparkles } from "lucide-react";
import { useAuth } from "../auth";
import { initials } from "../lib";

export function Logo({ size = 28 }: { size?: number }) {
  const id = useId(); // unique per copy, so a hidden copy never owns the gradient
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#6366f1" /></linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13.5" fill="none" stroke={`url(#${id})`} strokeWidth="2" />
      <ellipse cx="16" cy="16" rx="8" ry="5" fill="none" stroke={`url(#${id})`} strokeWidth="2" />
      <circle cx="16" cy="16" r="2.6" fill={`url(#${id})`} />
    </svg>
  );
}

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-accent/12 text-accent" : "text-mute hover:text-ink"}`;

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return <>{children}</>;
  const teacher = user.role === "teacher";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-5">
          <button onClick={() => nav(teacher ? "/teacher" : "/")} className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">Kakashi Tutor</span>
          </button>
          <nav className="flex items-center gap-1">
            {teacher ? (
              <NavLink to="/teacher" end className={link}>Class overview</NavLink>
            ) : (
              <>
                <NavLink to="/" end className={link}>Home</NavLink>
                <NavLink to="/progress" className={link}>My progress</NavLink>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {!teacher && user.interest && (
              <span className="chip hidden sm:inline-flex"><Sparkles size={12} className="text-accent2" /> {user.interest}</span>
            )}
            <div className="relative">
              <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-xl border border-line bg-raise/70 py-1 pl-1 pr-3 hover:border-[#2b3b5f]">
                <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-xs font-bold text-[#04101c]">{initials(user.name)}</span>
                <span className="text-left leading-tight">
                  <span className="block text-[13px] font-semibold">{user.name}</span>
                  <span className="block text-[11px] capitalize text-faint">{user.role}</span>
                </span>
              </button>
              {open && (
                <div className="card absolute right-0 mt-2 w-44 p-1.5 text-sm shadow-xl" onMouseLeave={() => setOpen(false)}>
                  <button onClick={() => { logout(); nav("/login"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-mute hover:bg-raise hover:text-ink">
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
