"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  estimateTextBox,
  hitStroke,
  hitText,
  simplifyPoints,
  toFlatPoints,
  toSvgPath,
  type Point,
} from "@/lib/annotations/geometry";
import {
  NOTE_COLORS,
  STROKE_WIDTH,
  type Annotation,
  type AnnotationScope,
  type TextData,
} from "@/lib/annotations/model";

export type Tool = "pen" | "highlighter" | "text" | "eraser";

type Props = {
  page: number;
  /** 페이지 높이 / 너비 */
  aspect: number;
  annotations: Annotation[];
  active: boolean;
  tool: Tool;
  scope: AnnotationScope;
  canEditGlobal: boolean;
  onStroke: (type: "pen" | "highlighter", points: number[]) => void;
  onErase: (annotation: Annotation) => void;
  onTextTap: (point: Point, existing: (Annotation & { type: "text" }) | null) => void;
};

const TAG_SIZE = 0.016;
const ERASER_TOLERANCE = 0.02;

function canEdit(a: Annotation, scope: AnnotationScope, canEditGlobal: boolean) {
  return a.scope === scope && (scope === "personal" || canEditGlobal);
}

/** "공용" 표시: 공용 필기를 색만이 아니라 글자로도 구분한다. */
function GlobalTag({ x, y }: { x: number; y: number }) {
  const w = TAG_SIZE * 2.6;
  const h = TAG_SIZE * 1.5;
  return (
    <g transform={`translate(${x} ${y - h})`} pointerEvents="none">
      <rect width={w} height={h} rx={h * 0.3} fill={NOTE_COLORS.global.pen} />
      <text x={w / 2} y={h * 0.74} fontSize={TAG_SIZE} fontWeight={700} fill="#fff" textAnchor="middle">
        공용
      </text>
    </g>
  );
}

function TextNote({ annotation }: { annotation: Annotation & { type: "text" } }) {
  const d: TextData = annotation.data;
  const box = estimateTextBox(d.text, d.size);
  const pad = d.size * 0.25;
  const isGlobal = annotation.scope === "global";
  return (
    <g>
      <rect
        x={d.x - pad}
        y={d.y - d.size - pad * 0.6}
        width={box.width + pad * 2}
        height={box.height + pad}
        rx={pad}
        fill={isGlobal ? "#fff1f2" : "#eff6ff"}
        fillOpacity={0.9}
        stroke={isGlobal ? NOTE_COLORS.global.text : "none"}
        strokeWidth={d.size * 0.06}
      />
      <text x={d.x} y={d.y} fontSize={d.size} fontWeight={700} fill={d.color}>
        {d.text}
      </text>
      {isGlobal && <GlobalTag x={d.x - pad} y={d.y - d.size - pad * 0.6} />}
    </g>
  );
}

function StrokeNote({ annotation }: { annotation: Annotation & { type: "pen" | "highlighter" } }) {
  const d = annotation.data;
  const highlighter = annotation.type === "highlighter";
  return (
    <g>
      <path
        d={toSvgPath(d.points)}
        fill="none"
        stroke={d.color}
        strokeWidth={d.width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={highlighter ? 0.38 : 1}
        style={highlighter ? { mixBlendMode: "multiply" } : undefined}
      />
      {annotation.scope === "global" && <GlobalTag x={d.points[0]} y={d.points[1] - d.width} />}
    </g>
  );
}

/** 악보 한 쪽 위에 겹쳐 그리는 필기 층. 원본 PDF는 건드리지 않는다. */
export function AnnotationLayer(props: Props) {
  const { aspect, annotations, active, tool, scope, canEditGlobal } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const livePoints = useRef<Point[] | null>(null);
  const pointers = useRef(new Set<number>());
  const tapStart = useRef<Point | null>(null);
  // 화면이 갱신되기 전에 같은 필기를 두 번 지우지 않도록 이번 동작에서 지운 것을 기억한다.
  const erased = useRef(new Set<string>());
  const frame = useRef(0);
  const [livePath, setLivePath] = useState<string | null>(null);

  function toPoint(e: { clientX: number; clientY: number }): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.width };
  }

  function scheduleLive() {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const pts = livePoints.current;
      setLivePath(pts && pts.length > 0 ? toSvgPath(toFlatPoints(pts)) : null);
    });
  }

  function cancelStroke() {
    livePoints.current = null;
    tapStart.current = null;
    setLivePath(null);
  }

  function eraseAt(p: Point) {
    for (const a of annotations) {
      if (erased.current.has(a.id) || !canEdit(a, scope, canEditGlobal)) continue;
      const hit =
        a.type === "text" ? hitText(a.data, p, ERASER_TOLERANCE) : hitStroke(a.data.points, a.data.width, p, ERASER_TOLERANCE);
      if (hit) {
        erased.current.add(a.id);
        props.onErase(a);
        return;
      }
    }
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (!active) return;
    pointers.current.add(e.pointerId);
    // 두 손가락이면 그리기를 멈춘다(확대와 이동은 바깥에서 처리).
    if (pointers.current.size > 1) {
      cancelStroke();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPoint(e);
    if (tool === "pen" || tool === "highlighter") {
      livePoints.current = [p];
      scheduleLive();
    } else if (tool === "eraser") {
      erased.current.clear();
      eraseAt(p);
    } else {
      tapStart.current = p;
    }
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!active || pointers.current.size !== 1 || !pointers.current.has(e.pointerId)) return;
    if (tool === "pen" || tool === "highlighter") {
      if (!livePoints.current) return;
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events) livePoints.current.push(toPoint(ev));
      scheduleLive();
    } else if (tool === "eraser") {
      eraseAt(toPoint(e));
    }
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (!active || !wasSingle) return;

    if ((tool === "pen" || tool === "highlighter") && livePoints.current) {
      const pts = simplifyPoints(livePoints.current, 0.0015);
      cancelStroke();
      props.onStroke(tool, toFlatPoints(pts));
      return;
    }

    if (tool === "text" && tapStart.current) {
      const start = tapStart.current;
      tapStart.current = null;
      const p = toPoint(e);
      if (Math.hypot(p.x - start.x, p.y - start.y) > 0.02) return;
      const existing = annotations.find(
        (a): a is Annotation & { type: "text" } =>
          a.type === "text" && canEdit(a, scope, canEditGlobal) && hitText(a.data, p, 0.005),
      );
      props.onTextTap(p, existing ?? null);
    }
  }

  function onPointerCancel(e: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    cancelStroke();
  }

  // 형광펜이 아래, 펜, 글자 순으로 그린다.
  const ordered = [...annotations].sort((a, b) => {
    const rank = (x: Annotation) => (x.type === "highlighter" ? 0 : x.type === "pen" ? 1 : 2);
    return rank(a) - rank(b) || a.updatedAt.localeCompare(b.updatedAt);
  });
  const liveColor = tool === "highlighter" ? NOTE_COLORS[scope].highlighter : NOTE_COLORS[scope].pen;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 1 ${aspect}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full select-none"
      style={{ touchAction: active ? "none" : "auto", pointerEvents: active ? "auto" : "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {ordered.map((a) =>
        a.type === "text" ? <TextNote key={a.id} annotation={a} /> : <StrokeNote key={a.id} annotation={a} />,
      )}
      {livePath && (
        <path
          d={livePath}
          fill="none"
          stroke={liveColor}
          strokeWidth={tool === "highlighter" ? STROKE_WIDTH.highlighter : STROKE_WIDTH.pen}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={tool === "highlighter" ? 0.38 : 1}
        />
      )}
    </svg>
  );
}
