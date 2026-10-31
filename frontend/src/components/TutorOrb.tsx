import { useEffect, useRef, useState } from "react";

/** The tutor's presence. `speaking` quickens the pulse (it will also drive voice later). */
export function TutorOrb({ size = 88, speaking = false }: { size?: number; speaking?: boolean }) {
  return (
    <div className={`orb ${speaking ? "orb-speaking" : ""}`} style={{ width: size, height: size }} aria-hidden>
      <span className="orb-ring" /><span className="orb-ring" /><span className="orb-ring" />
      <span className="orb-core" />
    </div>
  );
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Reveals text like the tutor is speaking it. */
export function Typewriter({ text, speed = 12, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [n, setN] = useState(reduced() ? text.length : 0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (reduced()) { setN(text.length); done.current?.(); return; }
    setN(0);
    const id = setInterval(() => {
      setN((k) => {
        if (k >= text.length) { clearInterval(id); done.current?.(); return k; }
        return k + 2;
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span className={n < text.length ? "caret" : ""}>{text.slice(0, n)}</span>;
}
