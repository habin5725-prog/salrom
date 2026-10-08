"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EraserIcon,
  HighlighterIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  TextIcon,
  UndoIcon,
} from "@/components/icons";
import type { Point } from "@/lib/annotations/geometry";
import {
  MAX_TEXT_LENGTH,
  NOTE_COLORS,
  STROKE_WIDTH,
  TEXT_SIZE,
  type Annotation,
  type AnnotationScope,
} from "@/lib/annotations/model";
import type { ViewerData } from "@/lib/data/viewer";
import { openPdf, type PdfPage } from "@/lib/pdf";
import { loadSheetPdf, prefetchSheetPdf } from "@/lib/sheet-cache";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { AnnotationLayer, type Tool } from "./AnnotationLayer";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { useAnnotations } from "./useAnnotations";
import { usePinchZoom } from "./usePinchZoom";
import { useWakeLock } from "./useWakeLock";

type Props = ViewerData & { userId: string; canWriteGlobal: boolean };

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; pages: { page: PdfPage; aspect: number }[] };

const PAGE_GAP = 12;
const SIDE_PADDING = 8;

/** 악보 화면. 평소에는 악보만 크게 보이고, 화면을 누르면 위아래 버튼이 나타난다. */
export function SheetViewer(props: Props) {
  const { title, subtitle, songKey, sheet, back, prev, next, prefetchPaths } = props;
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [annotating, setAnnotating] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [scope, setScope] = useState<AnnotationScope>("personal");
  const [toast, setToast] = useState("");
  const [textEdit, setTextEdit] = useState<{
    page: number;
    point: Point;
    existing: (Annotation & { type: "text" }) | null;
  } | null>(null);
  const { zoom, zoomBy, canZoomIn, canZoomOut } = usePinchZoom(containerRef, contentRef);
  useWakeLock();

  // 악보 파일 불러오기(기기에 저장해 둔 것이 있으면 그것을 쓴다)
  const filePath = sheet?.filePath ?? null;
  // 서버에서 화면을 새로 받아도 같은 목록이면 다시 불러오지 않도록 문자열로 비교한다.
  const prefetchKey = prefetchPaths.join("\n");
  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;
    const supabase = getBrowserSupabase();
    (async () => {
      try {
        const data = await loadSheetPdf(supabase, filePath);
        const opened = await openPdf(data);
        destroy = opened.destroy;
        const doc = opened.doc;
        const pages: { page: PdfPage; aspect: number }[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          pages.push({ page, aspect: viewport.height / viewport.width });
        }
        if (cancelled) return;
        setLoad({ status: "ready", pages });
        // 다음 곡 악보를 미리 받아 둔다.
        prefetchKey
          .split("\n")
          .filter(Boolean)
          .forEach((path) => prefetchSheetPdf(supabase, path));
      } catch {
        if (!cancelled) setLoad({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [filePath, reloadKey, prefetchKey]);

  // 화면 너비에 맞춰 악보 너비를 정한다(화면 회전 포함).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 블루투스 페달이나 키보드의 좌우 화살표로 이전 곡, 다음 곡
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (annotating || textEdit) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft" && prev) router.push(prev.href);
      if (e.key === "ArrowRight" && next) router.push(next.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotating, textEdit, prev, next, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notes = useAnnotations(sheet?.sheetId ?? null, sheet?.version ?? 0, setToast);

  const pageWidth = Math.max(0, (containerWidth - SIDE_PADDING * 2) * zoom);

  function startAnnotating() {
    setAnnotating(true);
    setChrome(true);
  }

  function newAnnotationBase(page: number) {
    return {
      id: crypto.randomUUID(),
      sheetId: sheet!.sheetId,
      sheetVersion: sheet!.version,
      userId: props.userId,
      page,
      scope,
      updatedAt: new Date().toISOString(),
    };
  }

  function saveText(text: string) {
    if (!textEdit) return;
    const clean = text.trim().slice(0, MAX_TEXT_LENGTH);
    const { existing, page, point } = textEdit;
    setTextEdit(null);
    if (existing) {
      if (!clean) notes.remove(existing);
      else if (clean !== existing.data.text) notes.update(existing, { ...existing, data: { ...existing.data, text: clean } });
      return;
    }
    if (!clean) return;
    notes.add({
      ...newAnnotationBase(page),
      type: "text",
      data: { x: point.x, y: point.y + TEXT_SIZE * 0.35, text: clean, size: TEXT_SIZE, color: NOTE_COLORS[scope].text },
    });
  }

  const byPage = new Map<number, Annotation[]>();
  notes.annotations.forEach((a) => {
    const list = byPage.get(a.page) ?? [];
    list.push(a);
    byPage.set(a.page, list);
  });

  const showChrome = chrome || annotating;

  return (
    <div className="fixed inset-0 flex flex-col bg-stone-200">
      {/* 위: 돌아가기, 곡 정보, 크기 */}
      <header
        className={`safe-top absolute inset-x-0 top-0 z-20 bg-surface/95 shadow-sm backdrop-blur transition-transform duration-200 ${
          showChrome ? "" : "pointer-events-none -translate-y-full"
        }`}
      >
        <div className="flex items-center gap-2 px-2 py-2">
          <Link href={back.href} className="btn btn-sm btn-secondary shrink-0 px-2">
            <ChevronLeftIcon size={22} />
            {back.label}
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[1.1rem] font-bold">{title}</p>
            <p className="truncate text-[0.9rem] text-muted">
              {songKey && <strong className="text-accent-strong">Key {songKey} · </strong>}
              {subtitle}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="flex min-h-12 w-12 flex-col items-center justify-center rounded-xl border border-line bg-surface text-[0.75rem] font-semibold disabled:opacity-40"
              onClick={() => zoomBy(1 / 1.25)}
              disabled={!canZoomOut}
            >
              <MinusIcon size={20} />
              작게
            </button>
            <button
              type="button"
              className="flex min-h-12 w-12 flex-col items-center justify-center rounded-xl border border-line bg-surface text-[0.75rem] font-semibold disabled:opacity-40"
              onClick={() => zoomBy(1.25)}
              disabled={!canZoomIn}
            >
              <PlusIcon size={20} />
              크게
            </button>
          </div>
        </div>
        {props.olderVersion && (
          <p className="bg-amber-100 px-4 py-1.5 text-center text-[0.9rem] text-amber-900">이전 파일을 보고 있습니다</p>
        )}
      </header>

      {/* 악보 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto overscroll-contain"
        style={{ touchAction: "pan-x pan-y" }}
        onClick={() => {
          if (!annotating) setChrome((v) => !v);
        }}
      >
        <div
          ref={contentRef}
          className="flex flex-col items-center"
          style={{
            minWidth: "100%",
            width: pageWidth + SIDE_PADDING * 2,
            padding: `5.5rem ${SIDE_PADDING}px 9rem`,
            gap: PAGE_GAP,
          }}
        >
          {!sheet ? (
            <Message text="이 곡은 아직 악보가 없습니다." />
          ) : load.status === "loading" ? (
            <Message text="악보를 불러오는 중입니다" spinner />
          ) : load.status === "error" ? (
            <div className="flex flex-col items-center gap-4 pt-10">
              <Message text="악보를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요." />
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setLoad({ status: "loading" });
                  setReloadKey((k) => k + 1);
                }}
              >
                다시 시도
              </button>
            </div>
          ) : (
            pageWidth > 0 &&
            load.pages.map(({ page, aspect }, index) => (
              <div
                key={index}
                className="relative shrink-0 bg-white shadow-md"
                style={{ width: pageWidth, height: pageWidth * aspect }}
              >
                <PdfPageCanvas page={page} cssWidth={pageWidth} />
                <AnnotationLayer
                  page={index + 1}
                  aspect={aspect}
                  annotations={byPage.get(index + 1) ?? []}
                  active={annotating}
                  tool={tool}
                  scope={scope}
                  canEditGlobal={props.canWriteGlobal}
                  onStroke={(type, points) =>
                    notes.add({
                      ...newAnnotationBase(index + 1),
                      type,
                      data: { points, color: NOTE_COLORS[scope][type], width: STROKE_WIDTH[type] },
                    })
                  }
                  onErase={(a) => notes.remove(a)}
                  onTextTap={(point, existing) => setTextEdit({ page: index + 1, point, existing })}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {toast && (
        <p role="status" className="absolute inset-x-4 bottom-36 z-30 mx-auto max-w-md rounded-2xl bg-danger px-4 py-3 text-center font-semibold text-white shadow-lg">
          {toast}
        </p>
      )}

      {/* 아래: 이전 곡, 필기, 다음 곡 / 필기 도구 */}
      <footer
        className={`safe-bottom absolute inset-x-0 bottom-0 z-20 bg-surface/95 shadow-[0_-1px_4px_rgba(0,0,0,0.08)] backdrop-blur transition-transform duration-200 ${
          showChrome ? "" : "pointer-events-none translate-y-full"
        }`}
      >
        {annotating ? (
          <Toolbar
            tool={tool}
            onTool={setTool}
            scope={scope}
            onScope={setScope}
            canWriteGlobal={props.canWriteGlobal}
            canUndo={notes.canUndo}
            onUndo={notes.undo}
            onDone={() => setAnnotating(false)}
          />
        ) : (
          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2 px-3 py-2">
            {prev ? (
              <Link href={prev.href} className="btn btn-secondary px-2">
                <ChevronLeftIcon size={22} />
                이전 곡
              </Link>
            ) : (
              <span />
            )}
            <button type="button" className="btn btn-primary px-2" onClick={startAnnotating} disabled={!sheet || load.status !== "ready"}>
              <PencilIcon size={22} />
              필기
            </button>
            {next ? (
              <Link href={next.href} className="btn btn-secondary px-2">
                다음 곡
                <ChevronRightIcon size={22} />
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </footer>

      <TextDialog
        key={textEdit ? `${textEdit.page}-${textEdit.point.x}-${textEdit.point.y}` : "closed"}
        open={textEdit !== null}
        initial={textEdit?.existing?.data.text ?? ""}
        isEdit={Boolean(textEdit?.existing)}
        scope={textEdit?.existing?.scope ?? scope}
        onClose={() => setTextEdit(null)}
        onSave={saveText}
      />
    </div>
  );
}

function Message({ text, spinner }: { text: string; spinner?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 pt-16 text-center text-[1.05rem] text-muted">
      {spinner && <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent" />}
      {text}
    </div>
  );
}

const TOOLS: { id: Tool; label: string; icon: typeof PencilIcon }[] = [
  { id: "pen", label: "펜", icon: PencilIcon },
  { id: "highlighter", label: "형광펜", icon: HighlighterIcon },
  { id: "text", label: "글자", icon: TextIcon },
  { id: "eraser", label: "지우개", icon: EraserIcon },
];

function Toolbar({
  tool,
  onTool,
  scope,
  onScope,
  canWriteGlobal,
  canUndo,
  onUndo,
  onDone,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  scope: AnnotationScope;
  onScope: (scope: AnnotationScope) => void;
  canWriteGlobal: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onDone: () => void;
}) {
  const color = scope === "global" ? "text-global" : "text-personal";
  return (
    <div className="mx-auto max-w-2xl px-2 pt-2 pb-2">
      {canWriteGlobal ? (
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-2xl bg-page p-1" role="radiogroup" aria-label="필기 종류">
          <button
            type="button"
            role="radio"
            aria-checked={scope === "personal"}
            onClick={() => onScope("personal")}
            className={`min-h-11 rounded-xl font-semibold ${scope === "personal" ? "bg-surface text-personal shadow-sm" : "text-muted"}`}
          >
            내 필기(나만 보기)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scope === "global"}
            onClick={() => onScope("global")}
            className={`min-h-11 rounded-xl font-semibold ${scope === "global" ? "bg-surface text-global shadow-sm" : "text-muted"}`}
          >
            공용 필기(모두 보기)
          </button>
        </div>
      ) : (
        <p className="mb-1 text-center text-[0.9rem] text-muted">
          <span className="font-semibold text-personal">파란색</span> 나만 보기 ·{" "}
          <span className="font-semibold text-global">빨간색 공용</span> 리더 필기
        </p>
      )}
      <div className="grid grid-cols-6 gap-1">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tool === id}
            onClick={() => onTool(id)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.85rem] font-semibold ${
              tool === id ? `bg-accent-soft ${color}` : "text-muted"
            }`}
          >
            <Icon size={24} />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.85rem] font-semibold text-muted disabled:opacity-40"
        >
          <UndoIcon size={24} />
          되돌리기
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-accent text-[0.95rem] font-bold text-white"
        >
          완료
        </button>
      </div>
    </div>
  );
}

function TextDialog({
  open,
  initial,
  isEdit,
  scope,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  isEdit: boolean;
  scope: AnnotationScope;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <Dialog open={open} title={isEdit ? "글자 고치기" : scope === "global" ? "공용 글자 쓰기" : "글자 쓰기"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text);
        }}
      >
        <input
          className="input"
          value={text}
          maxLength={MAX_TEXT_LENGTH}
          onChange={(e) => setText(e.target.value)}
          placeholder={scope === "global" ? "예: 후렴 2번, Bridge 바로" : "예: 카포 2, 여기서 쉬기"}
          autoFocus
        />
        <div className={`grid gap-2 ${isEdit ? "grid-cols-2" : "grid-cols-1"}`}>
          {isEdit && (
            <button type="button" className="btn btn-danger" onClick={() => onSave("")}>
              지우기
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            저장
          </button>
        </div>
      </form>
    </Dialog>
  );
}
