import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export function Ring({ value, size = 96, stroke = 8, color = "#4c9aff", children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: ReactNode;
}) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 100); return () => clearTimeout(t); }, [value]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#232c3d" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, v)))}
          style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = "#4c9aff", before, height = 6 }: {
  value: number; color?: string; before?: number | null; height?: number;
}) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 80); return () => clearTimeout(t); }, [value]);
  return (
    <div className="relative w-full rounded-full bg-line" style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: color, transition: "width .8s ease-out" }} />
      {before != null && (
        <div className="absolute top-[-3px] h-[calc(100%+6px)] w-[2px] rounded bg-white/70" style={{ left: `${before * 100}%` }}
          title={`Before: ${Math.round(before * 100)}%`} />
      )}
    </div>
  );
}

export function Badge({ color, children, style }: { color: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="inline-flex items-center rounded-md px-2 py-[2px] text-xs font-semibold"
      style={{ color, background: `${color}1c`, ...style }}>
      {children}
    </span>
  );
}

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} />;

export const Spinner = ({ size = 16 }: { size?: number }) => (
  <span className="spin inline-block rounded-full border-2 border-line border-t-accent" style={{ width: size, height: size }} />
);

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex items-center gap-3 border-bad/40 p-4 text-sm">
      <span className="flex-1 text-mute">{message}</span>
      {onRetry && <button className="btn btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function PageHead({ eyebrow, title, sub, right }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="label-eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-[14.5px] text-mute">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Loads data; `every` (ms) refreshes it in the background without flashing the loading state. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = [], every?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [updated, setUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fn().then((d) => { if (live) { setData(d); setUpdated(new Date()); } })
      .catch((e) => live && setError(e.message ?? "Something went wrong"))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    if (!every) return;
    let live = true;
    const id = setInterval(() => {
      if (document.hidden) return;
      fn().then((d) => { if (live) { setData(d); setUpdated(new Date()); setError(null); } }).catch(() => { /* keep showing the last data */ });
    }, every);
    return () => { live = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [every, ...deps]);

  return { data, error, loading, retry: () => setTick((t) => t + 1), setData, updated };
}
