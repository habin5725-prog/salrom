"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Tables } from "@/lib/database.types";
import { annotationToInsert, parseAnnotation, type Annotation } from "@/lib/annotations/model";
import { deleteLocalNote, loadLocalNotes, saveLocalNote } from "@/lib/local-notes";
import { getBrowserSupabase } from "@/lib/supabase/client";

type UndoEntry =
  | { kind: "add"; annotation: Annotation }
  | { kind: "remove"; annotation: Annotation }
  | { kind: "update"; before: Annotation; after: Annotation };

const MAX_UNDO = 50;

/**
 * 한 악보 파일(sheet + version)의 필기.
 * 개인 필기는 이 기기에만, 공용 필기는 서버에 저장한다.
 * 화면에 먼저 반영하고 바로 저장한다. 저장에 실패하면 되돌리고 onError로 알린다.
 * 리더가 고친 공용 필기는 실시간으로 받고, 앱을 다시 열 때도 한 번 새로 읽는다.
 */
export function useAnnotations(sheetId: string | null, version: number, onError: (message: string) => void) {
  const [items, setItems] = useState<Map<string, Annotation>>(() => new Map());
  const undoStack = useRef<UndoEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  const put = useCallback((annotation: Annotation) => {
    setItems((prev) => new Map(prev).set(annotation.id, annotation));
  }, []);

  const drop = useCallback((id: string) => {
    setItems((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!sheetId) return;
    const id = sheetId;
    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function load() {
      const [server, local] = await Promise.all([
        supabase.from("annotations").select("*").eq("sheet_id", id).eq("sheet_version", version),
        loadLocalNotes(id, version).catch(() => [] as Annotation[]),
      ]);
      if (cancelled) return;
      if (server.error) onErrorRef.current("공용 필기를 불러오지 못했습니다.");
      const next = new Map<string, Annotation>();
      for (const row of server.data ?? []) {
        const annotation = parseAnnotation(row);
        if (annotation) next.set(annotation.id, annotation);
      }
      for (const annotation of local) next.set(annotation.id, annotation);
      setItems(next);
    }

    load();

    const onChange = (payload: RealtimePostgresChangesPayload<Tables<"annotations">>) => {
      if (payload.eventType === "DELETE") {
        const deleted = (payload.old as Partial<Tables<"annotations">>).id;
        if (deleted) drop(deleted);
        return;
      }
      const annotation = parseAnnotation(payload.new);
      if (annotation && annotation.sheetVersion === version) put(annotation);
    };

    // 삭제 알림은 조건(filter)을 걸 수 없어 따로 받는다(삭제된 행의 ID만 온다).
    const channel = supabase
      .channel(`annotations:${id}:${version}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "annotations", filter: `sheet_id=eq.${id}` }, onChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "annotations", filter: `sheet_id=eq.${id}` }, onChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "annotations" }, onChange)
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [sheetId, version, put, drop]);

  const remember = useCallback((entry: UndoEntry) => {
    undoStack.current.push(entry);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    setCanUndo(true);
  }, []);

  // 개인 필기는 기기에, 공용 필기는 서버에 저장한다. 실패하면 true
  const persist = useCallback(async (kind: "insert" | "delete" | "update", annotation: Annotation) => {
    try {
      if (annotation.scope === "personal") {
        if (kind === "delete") await deleteLocalNote(annotation.id);
        else await saveLocalNote(annotation);
        return false;
      }
      const table = getBrowserSupabase().from("annotations");
      const { error } =
        kind === "insert"
          ? await table.insert(annotationToInsert(annotation))
          : kind === "delete"
            ? await table.delete().eq("id", annotation.id)
            : await table.update({ data: annotationToInsert(annotation).data }).eq("id", annotation.id);
      return Boolean(error);
    } catch {
      return true;
    }
  }, []);

  // 아래 세 함수는 화면 반영과 저장을 한다. track이 true면 되돌리기 목록에 남긴다.
  const insertRow = useCallback(
    async (annotation: Annotation, track: boolean) => {
      put(annotation);
      if (await persist("insert", annotation)) {
        drop(annotation.id);
        onErrorRef.current(
          annotation.scope === "personal"
            ? "이 기기에 필기를 저장하지 못했습니다."
            : "공용 필기를 저장하지 못했습니다. 인터넷 연결을 확인해 주세요.",
        );
        return false;
      }
      if (track) remember({ kind: "add", annotation });
      return true;
    },
    [put, drop, persist, remember],
  );

  const deleteRow = useCallback(
    async (annotation: Annotation, track: boolean) => {
      drop(annotation.id);
      if (await persist("delete", annotation)) {
        put(annotation);
        onErrorRef.current("필기를 지우지 못했습니다.");
        return false;
      }
      if (track) remember({ kind: "remove", annotation });
      return true;
    },
    [put, drop, persist, remember],
  );

  const updateRow = useCallback(
    async (before: Annotation, after: Annotation, track: boolean) => {
      put(after);
      if (await persist("update", after)) {
        put(before);
        onErrorRef.current("필기를 고치지 못했습니다.");
        return false;
      }
      if (track) remember({ kind: "update", before, after });
      return true;
    },
    [put, persist, remember],
  );

  const undo = useCallback(async () => {
    const entry = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (!entry) return;
    if (entry.kind === "add") await deleteRow(entry.annotation, false);
    else if (entry.kind === "remove") await insertRow(entry.annotation, false);
    else await updateRow(entry.after, entry.before, false);
  }, [deleteRow, insertRow, updateRow]);

  return {
    annotations: items,
    canUndo,
    add: (a: Annotation) => insertRow(a, true),
    remove: (a: Annotation) => deleteRow(a, true),
    update: (before: Annotation, after: Annotation) => updateRow(before, after, true),
    undo,
  };
}
