import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export function Ring({ value, size = 96, stroke = 8, color = "#22d3ee", children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: ReactNode;
}) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 120); return () => clearTimeout(t); }, [value]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c2740" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, v)))}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)", filter: `drop-shadow(0 0 6px ${color}88)` }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = "#22d3ee", before, height = 8 }: {
  value: number; color?: string; before?: number | null; height?: number;
}) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 100); return () => clearTimeout(t); }, [value]);
  return (
    <div className="relative w-full rounded-full bg-line/80" style={{ height }}>
      <div className="h-full rounded-full" style={{
        width: `${v * 100}%`, background: color, boxShadow: `0 0 12px ${color}66`,
        transition: "width .9s cubic-bezier(.2,.7,.2,1)",
      }} />
      {before != null && (
        <div className="absolute top-[-3px] h-[calc(100%+6px)] w-[2px] rounded bg-white/70"
          style={{ left: `${before * 100}%` }} title={`Before: ${Math.round(before * 100)}%`} />
      )}
    </div>
  );
}

export function Badge({ color, children, style }: { color: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-semibold"
      style={{ color, background: `${color}1f`, border: `1px solid ${color}44`, ...style }}>
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} />;

export const Spinner = ({ size = 18 }: { size?: number }) => <Loader2 size={size} className="spin text-accent" />;

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex items-center gap-3 border-bad/40 p-4 text-sm">
      <AlertTriangle className="text-bad" size={18} />
      <span className="flex-1 text-mute">{message}</span>
      {onRetry && <button className="btn btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function PageHead({ eyebrow, title, sub, right }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-up">
      <div>
        {eyebrow && <div className="label-eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-[15px] text-mute">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fn().then((d) => live && setData(d)).catch((e) => live && setError(e.message ?? "Something went wrong"))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, retry: () => setTick((t) => t + 1), setData };
}
