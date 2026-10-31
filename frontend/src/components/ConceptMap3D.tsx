/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import type { MapConcept } from "../types";
import { LEVEL_COLOR } from "../lib";

let glow: THREE.Texture | null = null;
function glowTexture() {
  if (glow) return glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(c);
  return glow;
}

function labelSprite(text: string) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 80;
  const g = c.getContext("2d")!;
  g.font = "600 34px Inter, system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 8; g.strokeStyle = "rgba(7,11,20,0.9)";
  g.strokeText(text, 256, 40);
  g.fillStyle = "#e8eef9";
  g.fillText(text, 256, 40);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(46, 7.2, 1);
  return sp;
}

interface Props {
  concepts: MapConcept[];
  selectedId: string | null;
  onSelect: (c: MapConcept | null) => void;
  height: number;
  focusTopic: boolean;
}

export default function ConceptMap3D({ concepts, selectedId, onSelect, height, focusTopic }: Props) {
  const fg = useRef<any>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const objects = useRef<any[]>([]);
  const seen = useRef<Set<string>>(new Set()); // nodes that already played their reveal animation

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const byId = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
  const data = useMemo(() => ({
    nodes: concepts.map((c) => ({ id: c.id, c })),
    links: concepts.flatMap((c) => c.prerequisites.filter((p) => byId.has(p)).map((p) => ({ source: p, target: c.id }))),
  }), [concepts, byId]);

  const nodeObject = useCallback((n: any) => {
    const c: MapConcept = n.c;
    const dim = focusTopic && !c.in_topic;
    const color = new THREE.Color(LEVEL_COLOR[c.level]);
    const r = c.in_topic ? 4.6 : 3.4;
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(r, 24, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: dim ? 0.35 : 1 }),
    );
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color, transparent: true, opacity: dim ? 0.25 : 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.set(r * 7, r * 7, 1);
    group.add(halo, core);
    if (selectedId === c.id) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r + 2.2, r + 2.9, 48),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
      );
      group.add(ring);
    }
    // label only what matters: the selected concept and anything the student has been tested on
    if (selectedId === c.id || (c.level !== "untested" && !dim)) {
      const lab = labelSprite(c.name);
      lab.position.set(0, -(r + 7), 0);
      group.add(lab);
    }
    const first = !seen.current.has(c.id);
    seen.current.add(c.id);
    group.scale.setScalar(first ? 0.001 : 1);
    group.userData = {
      born: first ? performance.now() + objects.current.length * 45 : -1e9,
      halo, base: r * 7, weak: c.level === "weak" && !dim, i: objects.current.length,
    };
    objects.current.push(group);
    return group;
  }, [selectedId, focusTopic]);

  // reveal animation and the pulse on weak nodes
  useEffect(() => {
    let raf = 0;
    let frame = 0;
    const loop = () => {
      const now = performance.now();
      if (++frame % 120 === 0) objects.current = objects.current.filter((g) => g.parent); // drop replaced nodes
      for (const g of objects.current) {
        const u = g.userData;
        const t = Math.min(1, Math.max(0, (now - u.born) / 650));
        const e = 1 - Math.pow(1 - t, 3);
        g.scale.setScalar(Math.max(0.001, e));
        if (u.weak) {
          const s = u.base * (1 + 0.22 * Math.sin(now / 340 + u.i));
          u.halo.scale.set(s, s, 1);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => { objects.current = []; seen.current.clear(); }, [data]);

  useEffect(() => {
    const g = fg.current;
    if (!g) return;
    const controls = g.controls?.();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.7;
      controls.addEventListener("start", () => { controls.autoRotate = false; });
    }
    g.d3Force("charge")?.strength(-120);   // spread the nodes out a little
    g.d3Force("link")?.distance(46);
    g.cameraPosition({ z: 260 });
  }, []);

  const weakLink = (l: any) => {
    const s = byId.get(typeof l.source === "object" ? l.source.id : l.source);
    const t = byId.get(typeof l.target === "object" ? l.target.id : l.target);
    return !!s && !!t && s.level === "weak" && t.level === "weak";
  };

  return (
    <div ref={box} className="h-full w-full">
      <ForceGraph3D
        ref={fg}
        width={width}
        height={height}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        nodeThreeObject={nodeObject}
        nodeLabel={(n: any) => `<div style="font:600 12px Inter,sans-serif;padding:4px 8px;background:#0c1322;border:1px solid #1c2740;border-radius:6px;color:#e8eef9">${n.c.name}</div>`}
        linkColor={(l: any) => (weakLink(l) ? "rgba(248,113,113,0.7)" : "rgba(103,232,249,0.32)")}
        linkWidth={0.5}
        linkOpacity={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={(l: any) => (weakLink(l) ? "#f87171" : "#67e8f9")}
        linkDirectionalArrowLength={3.2}
        linkDirectionalArrowRelPos={0.92}
        linkDirectionalArrowColor={(l: any) => (weakLink(l) ? "#f87171" : "#38bdf8")}
        cooldownTicks={140}
        d3AlphaDecay={0.035}
        onEngineStop={() => fg.current?.zoomToFit(800, 60)}
        onNodeClick={(n: any) => {
          onSelect(n.c);
          const dist = 90;
          const k = 1 + dist / Math.hypot(n.x || 1, n.y || 1, n.z || 1);
          fg.current?.cameraPosition({ x: n.x * k, y: n.y * k, z: n.z * k }, n, 900);
        }}
        onBackgroundClick={() => onSelect(null)}
      />
    </div>
  );
}
