import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { initials } from "../lib";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="none" stroke="#4c9aff" strokeWidth="2" />
      <circle cx="16" cy="16" r="4.5" fill="#4c9aff" />
    </svg>
  );
}

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-raise text-ink" : "text-mute hover:text-ink"}`;

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return <>{children}</>;
  const teacher = user.role === "teacher";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-6 px-5">
          <button onClick={() => nav(teacher ? "/teacher" : "/")} className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">Kakashi Tutor</span>
          </button>
          {!teacher && (
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={link}>Home</NavLink>
              <NavLink to="/progress" className={link}>My progress</NavLink>
            </nav>
          )}
          <div className="relative ml-auto">
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2.5 hover:bg-raise">
              <span className="grid size-8 place-items-center rounded-md bg-raise text-xs font-semibold text-mute">{initials(user.name)}</span>
              <span className="text-left leading-tight">
                <span className="block text-[13px] font-semibold">{user.name}</span>
                <span className="block text-[11px] capitalize text-faint">{user.role}</span>
              </span>
            </button>
            {open && (
              <div className="card absolute right-0 mt-2 w-40 p-1 text-sm" onMouseLeave={() => setOpen(false)}>
                <button onClick={() => { logout(); nav("/login"); }} className="w-full rounded-md px-3 py-2 text-left text-mute hover:bg-raise hover:text-ink">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
