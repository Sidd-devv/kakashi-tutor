import { useMemo } from "react";
import type { MapConcept } from "../types";
import { LEVEL_COLOR } from "../lib";

const COL = 218, ROW = 46, PILL_W = 188, PILL_H = 34, PAD = 20;

interface Props {
  concepts: MapConcept[];
  selectedId: string | null;
  onSelect: (c: MapConcept | null) => void;
  height: number;
  focusTopic: boolean;
}

/** A clean left-to-right map: foundations on the left, what depends on them to the right. */
export default function ConceptMap2D({ concepts, selectedId, onSelect, height, focusTopic }: Props) {
  const layout = useMemo(() => {
    const byId = new Map(concepts.map((c) => [c.id, c]));
    const depth = new Map<string, number>();
    const d = (id: string): number => {
      if (depth.has(id)) return depth.get(id)!;
      depth.set(id, 0);
      const c = byId.get(id)!;
      const v = c.prerequisites.filter((p) => byId.has(p)).reduce((m, p) => Math.max(m, d(p) + 1), 0);
      depth.set(id, v);
      return v;
    };
    concepts.forEach((c) => d(c.id));
    const cols = new Map<number, MapConcept[]>();
    concepts.forEach((c) => cols.set(depth.get(c.id)!, [...(cols.get(depth.get(c.id)!) ?? []), c]));
    const pos = new Map<string, { x: number; y: number }>();
    let maxRows = 0;
    cols.forEach((list, k) => {
      list.sort((a, b) => a.section_id.localeCompare(b.section_id, undefined, { numeric: true }));
      maxRows = Math.max(maxRows, list.length);
      list.forEach((c, i) => pos.set(c.id, { x: PAD + k * COL, y: PAD + i * ROW }));
    });
    const links = concepts.flatMap((c) => c.prerequisites.filter((p) => byId.has(p)).map((p) => ({ from: byId.get(p)!, to: c })));
    return { pos, links, width: PAD * 2 + cols.size * COL - (COL - PILL_W), rows: maxRows };
  }, [concepts]);

  const svgH = Math.max(height - 8, PAD * 2 + layout.rows * ROW);

  return (
    <div className="h-full w-full overflow-auto" style={{ maxHeight: height }}>
      <svg width={layout.width} height={svgH} role="img" aria-label="Concept map">
        {layout.links.map(({ from, to }, i) => {
          const a = layout.pos.get(from.id)!, b = layout.pos.get(to.id)!;
          const x1 = a.x + PILL_W, y1 = a.y + PILL_H / 2, x2 = b.x, y2 = b.y + PILL_H / 2;
          const hot = from.level === "weak" && to.level === "weak";
          const dim = focusTopic && !(from.in_topic || to.in_topic);
          return (
            <path key={i} d={`M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`} fill="none"
              stroke={hot ? "#f87171" : "#38bdf8"} strokeOpacity={dim ? 0.12 : hot ? 0.8 : 0.4} strokeWidth={hot ? 1.8 : 1.2}
              strokeDasharray={hot ? "5 4" : undefined} />
          );
        })}
        {concepts.map((c) => {
          const p = layout.pos.get(c.id)!;
          const color = LEVEL_COLOR[c.level];
          const dim = focusTopic && !c.in_topic;
          const sel = selectedId === c.id;
          return (
            <g key={c.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: "pointer", opacity: dim ? 0.38 : 1 }}
              onClick={(e) => { e.stopPropagation(); onSelect(c); }}>
              <title>{c.name}</title>
              <rect width={PILL_W} height={PILL_H} rx={10} fill="#0c1322" stroke={sel ? "#fff" : color} strokeOpacity={sel ? 1 : 0.7}
                strokeWidth={sel ? 2 : 1.2} style={{ filter: c.level === "weak" && !dim ? `drop-shadow(0 0 6px ${color}88)` : undefined }} />
              <circle cx={14} cy={PILL_H / 2} r={5} fill={color} />
              <text x={28} y={PILL_H / 2 + 4} fontSize={12} fontWeight={600} fill="#e8eef9">
                {c.name.length > 24 ? c.name.slice(0, 23) + "…" : c.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
