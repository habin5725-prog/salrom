"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import type { EditorItem } from "@/lib/data/editor";
import { uploadNewSheet, uploadNewVersion } from "@/lib/sheet-upload";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ChoiceRow } from "./AddSongDialog";
import { FilePicker } from "./FilePicker";

type SheetOption = { id: string; name: string; current_version: number };

export type SheetPatch = Pick<EditorItem, "sheetId" | "sheetVersion" | "sheetName" | "sheetLatestVersion">;

/** 이번 주 곡의 악보 바꾸기: 다른 악보 고르기, 최신 파일로 바꾸기, 새 PDF 올리기 */
export function SheetDialog({
  item,
  onClose,
  onChange,
}: {
  item: EditorItem | null;
  onClose: () => void;
  onChange: (item: EditorItem, patch: SheetPatch) => Promise<boolean>;
}) {
  const [sheets, setSheets] = useState<SheetOption[] | null>(null);
  const [mode, setMode] = useState<"replace" | "add">("replace");
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const songId = item?.songId;
  useEffect(() => {
    if (!songId) return;
    let cancelled = false;
    getBrowserSupabase()
      .from("sheets")
      .select("id, name, current_version")
      .eq("song_id", songId)
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) setSheets((data ?? []).filter((s) => s.current_version > 0));
      });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  if (!item) return null;

  function close() {
    setSheets(null);
    setFile(null);
    setSheetName("");
    setMode("replace");
    setError("");
    setBusy(false);
    onClose();
  }

  async function choose(patch: SheetPatch) {
    if (!item) return;
    setBusy(true);
    setError("");
    const ok = await onChange(item, patch);
    if (ok) close();
    else setBusy(false);
  }

  async function upload() {
    if (!item || !file) {
      setError("올릴 PDF 파일을 골라 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = getBrowserSupabase();
      const replacing = mode === "replace" && item.sheetId;
      const uploaded = replacing
        ? await uploadNewVersion(supabase, item.songId, item.sheetId!, item.sheetName ?? "악보", file)
        : await uploadNewSheet(supabase, item.songId, sheetName || "악보", file);
      const ok = await onChange(item, {
        sheetId: uploaded.sheetId,
        sheetVersion: uploaded.version,
        sheetName: uploaded.sheetName,
        sheetLatestVersion: uploaded.version,
      });
      if (ok) close();
      else setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "올리지 못했습니다.");
      setBusy(false);
    }
  }

  const hasNewer =
    item.sheetId !== null && item.sheetVersion !== null && (item.sheetLatestVersion ?? 0) > item.sheetVersion;
  const others = (sheets ?? []).filter((s) => s.id !== item.sheetId);

  return (
    <Dialog open title={`${item.title} 악보`} onClose={close}>
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl bg-page px-4 py-3">
          <p className="text-[0.95rem] text-muted">지금 쓰는 악보</p>
          <p className="text-[1.1rem] font-semibold">
            {item.sheetId ? `${item.sheetName ?? "악보"}${item.sheetVersion && item.sheetVersion > 1 ? ` · ${item.sheetVersion}번째 파일` : ""}` : "악보 없음"}
          </p>
        </section>

        {hasNewer && (
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={() =>
              choose({
                sheetId: item.sheetId,
                sheetVersion: item.sheetLatestVersion,
                sheetName: item.sheetName,
                sheetLatestVersion: item.sheetLatestVersion,
              })
            }
          >
            최신 파일({item.sheetLatestVersion}번째)로 바꾸기
          </button>
        )}

        {others.length > 0 && (
          <section>
            <h3 className="label">다른 악보로 바꾸기</h3>
            <ul className="flex flex-col gap-2">
              {others.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-2 text-left"
                    onClick={() =>
                      choose({
                        sheetId: s.id,
                        sheetVersion: s.current_version,
                        sheetName: s.name,
                        sheetLatestVersion: s.current_version,
                      })
                    }
                  >
                    <span className="font-semibold">
                      {s.name}
                      {s.current_version > 1 && <span className="ml-1 text-[0.9rem] text-muted">{s.current_version}번째 파일</span>}
                    </span>
                    <span className="btn btn-sm btn-soft">이걸로</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="label">새 PDF 올리기</h3>
          <div className="flex flex-col gap-3">
            {item.sheetId && (
              <div role="radiogroup" className="flex flex-col gap-2">
                <ChoiceRow
                  checked={mode === "replace"}
                  onSelect={() => setMode("replace")}
                  label="지금 악보를 새 파일로 교체"
                  hint="오타 수정본 등"
                />
                <ChoiceRow
                  checked={mode === "add"}
                  onSelect={() => setMode("add")}
                  label="다른 악보로 추가"
                  hint="다른 Key, 다른 편곡 등"
                />
              </div>
            )}
            {(mode === "add" || !item.sheetId) && (
              <div>
                <label className="label" htmlFor="sheet-name">
                  악보 이름
                </label>
                <input
                  id="sheet-name"
                  className="input"
                  value={sheetName}
                  maxLength={60}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="예: G키 악보"
                />
              </div>
            )}
            <FilePicker file={file} onChange={setFile} onError={setError} disabled={busy} />
            <button type="button" className="btn btn-primary w-full" disabled={busy || !file} onClick={upload}>
              {busy ? "올리는 중..." : "올리고 바꾸기"}
            </button>
          </div>
          <p className="mt-3 px-1 text-[0.9rem] text-muted break-keep">
            새 파일로 바꿔도 이전 파일과 그 위에 적은 필기는 악보함에 그대로 남습니다.
          </p>
        </section>

        {error && <p className="text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
