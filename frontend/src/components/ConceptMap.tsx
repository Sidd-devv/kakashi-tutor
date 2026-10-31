import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { Box, ListTree } from "lucide-react";
import type { MapConcept } from "../types";
import { LEVEL_COLOR, LEVEL_LABEL } from "../lib";
import ConceptMap2D from "./ConceptMap2D";
import { Skeleton } from "./ui";

const Map3D = lazy(() => import("./ConceptMap3D"));

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

interface Props {
  concepts: MapConcept[];
  selectedId: string | null;
  onSelect: (c: MapConcept | null) => void;
  height?: number;
  /** dim concepts outside the current topic */
  focusTopic?: boolean;
}

/** The concept map: a glowing 3D view with a clean 2D fallback (also used if WebGL is unavailable). */
export default function ConceptMap({ concepts, selectedId, onSelect, height = 480, focusTopic = false }: Props) {
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const view = { concepts, selectedId, onSelect, height, focusTopic };
  return (
    <div className="card relative overflow-hidden grid-bg" style={{ height }}>
      <div className="absolute left-3 top-3 z-10 flex rounded-lg border border-line bg-panel/90 p-0.5 text-xs font-semibold">
        {([["3d", Box, "3D"], ["2d", ListTree, "Layers"]] as const).map(([m, Icon, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${mode === m ? "bg-accent/15 text-accent" : "text-mute hover:text-ink"}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-panel/80 px-3 py-1.5 text-[11px] text-mute backdrop-blur">
        {(["strong", "shaky", "weak", "untested"] as const).map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: LEVEL_COLOR[l], boxShadow: `0 0 8px ${LEVEL_COLOR[l]}` }} />
            {LEVEL_LABEL[l]}
          </span>
        ))}
      </div>
      <div className="absolute bottom-3 right-3 z-10 hidden rounded-lg bg-panel/80 px-3 py-1.5 text-[11px] text-faint backdrop-blur sm:block">
        {mode === "3d" ? "Drag to rotate · scroll to zoom · click a concept" : "Foundations on the left · click a concept"}
      </div>
      {mode === "3d" ? (
        <Boundary fallback={<ConceptMap2D {...view} />}>
          <Suspense fallback={<div className="p-6"><Skeleton className="h-full min-h-[300px] w-full" /></div>}>
            <Map3D {...view} />
          </Suspense>
        </Boundary>
      ) : (
        <ConceptMap2D {...view} />
      )}
    </div>
  );
}
