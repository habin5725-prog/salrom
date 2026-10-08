"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { SearchIcon } from "@/components/icons";
import { KeyPicker } from "@/components/KeyPicker";
import type { EditorItem } from "@/lib/data/editor";
import { normalizeForSearch, searchSongs } from "@/lib/hangul";
import { createSong, uploadNewSheet } from "@/lib/sheet-upload";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { FilePicker } from "./FilePicker";

type SongOption = {
  id: string;
  title: string;
  sheets: { id: string; name: string; current_version: number }[];
};

type Step = "search" | "existing" | "new";

// 악보 선택: 기존 악보 ID, 새 PDF 올리기, 악보 없이
type SheetChoice = string | "upload" | "none";

export function AddSongDialog({
  open,
  serviceId,
  position,
  onClose,
  onAdded,
}: {
  open: boolean;
  serviceId: string;
  position: number;
  onClose: () => void;
  onAdded: (item: EditorItem) => void;
}) {
  const [step, setStep] = useState<Step>("search");
  const [songs, setSongs] = useState<SongOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SongOption | null>(null);
  const [sheetChoice, setSheetChoice] = useState<SheetChoice>("none");
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState("악보");
  const [newTitle, setNewTitle] = useState("");
  const [songKey, setSongKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 열 때마다 처음 단계로 돌리고 악보함 목록을 새로 읽는다.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getBrowserSupabase()
      .from("songs")
      .select("id, title, sheets(id, name, current_version)")
      .order("title")
      .then(({ data }) => {
        if (!cancelled) setSongs(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function reset() {
    setStep("search");
    setQuery("");
    setSelected(null);
    setSheetChoice("none");
    setFile(null);
    setSheetName("악보");
    setNewTitle("");
    setSongKey("");
    setError("");
    setBusy(false);
  }

  function close() {
    reset();
    onClose();
  }

  function pickSong(song: SongOption) {
    const usable = song.sheets.filter((s) => s.current_version > 0);
    setSelected(song);
    setSheetChoice(usable.length > 0 ? usable[usable.length - 1].id : "upload");
    setFile(null);
    setError("");
    setStep("existing");
  }

  function startNew() {
    setNewTitle(query.trim());
    setFile(null);
    setError("");
    setStep("new");
  }

  async function insertItem(
    songId: string,
    title: string,
    sheet: { id: string; name: string; version: number } | null,
  ) {
    const { data, error } = await getBrowserSupabase()
      .from("service_songs")
      .insert({
        service_id: serviceId,
        song_id: songId,
        sheet_id: sheet?.id ?? null,
        sheet_version: sheet?.version ?? null,
        position,
        song_key: songKey || null,
      })
      .select("id, position")
      .single();
    if (error || !data) throw new Error("이번 주 목록에 추가하지 못했습니다.");
    onAdded({
      id: data.id,
      position: data.position,
      songKey: songKey || null,
      songId,
      title,
      sheetId: sheet?.id ?? null,
      sheetVersion: sheet?.version ?? null,
      sheetName: sheet?.name ?? null,
      sheetLatestVersion: sheet?.version ?? null,
    });
  }

  async function addExisting() {
    if (!selected) return;
    if (sheetChoice === "upload" && !file) {
      setError("올릴 PDF 파일을 골라 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = getBrowserSupabase();
      let sheet: { id: string; name: string; version: number } | null = null;
      if (sheetChoice === "upload" && file) {
        const uploaded = await uploadNewSheet(supabase, selected.id, sheetName, file);
        sheet = { id: uploaded.sheetId, name: uploaded.sheetName, version: uploaded.version };
      } else if (sheetChoice !== "none") {
        const existing = selected.sheets.find((s) => s.id === sheetChoice);
        if (existing) sheet = { id: existing.id, name: existing.name, version: existing.current_version };
      }
      await insertItem(selected.id, selected.title, sheet);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "추가하지 못했습니다.");
      setBusy(false);
    }
  }

  async function addNew() {
    if (!newTitle.trim()) {
      setError("곡명을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createSong(getBrowserSupabase(), newTitle, file);
      await insertItem(
        created.songId,
        created.title,
        created.sheet ? { id: created.sheet.sheetId, name: created.sheet.sheetName, version: created.sheet.version } : null,
      );
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록하지 못했습니다.");
      setBusy(false);
    }
  }

  const results = songs ? searchSongs(songs, query) : [];
  const duplicate =
    step === "new" && songs
      ? songs.find((s) => normalizeForSearch(s.title) === normalizeForSearch(newTitle))
      : undefined;

  const title = step === "search" ? "곡 추가" : step === "existing" ? "악보와 Key 고르기" : "새 곡 등록";

  return (
    <Dialog open={open} title={title} onClose={close}>
      {step === "search" && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <SearchIcon size={22} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              className="input pl-12"
              placeholder="곡명 또는 초성으로 찾기"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="악보함에서 곡 찾기"
            />
          </div>

          <button type="button" className="btn btn-soft w-full" onClick={startNew}>
            {query.trim() ? `"${query.trim()}" 새 곡으로 등록` : "악보함에 없는 새 곡 등록"}
          </button>

          {songs === null ? (
            <p className="py-6 text-center text-muted">악보함을 불러오는 중...</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-muted">
              {songs.length === 0 ? "악보함이 비어 있습니다. 새 곡으로 등록해 주세요." : "찾는 곡이 없습니다."}
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {results.slice(0, 50).map((song) => (
                <li key={song.id}>
                  <button
                    type="button"
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-page"
                    onClick={() => pickSong(song)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.1rem] font-semibold break-keep">{song.title}</span>
                      <span className="block text-[0.9rem] text-muted">
                        {song.sheets.length > 0 ? `악보 ${song.sheets.length}개` : "악보 없음"}
                      </span>
                    </span>
                    <span className="btn btn-sm btn-secondary">고르기</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === "existing" && selected && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-page px-4 py-3">
            <span className="text-[1.15rem] font-bold break-keep">{selected.title}</span>
            <button type="button" className="btn btn-sm btn-secondary shrink-0" onClick={() => setStep("search")}>
              다른 곡
            </button>
          </div>

          <fieldset>
            <legend className="label">악보</legend>
            <div className="flex flex-col gap-2">
              {selected.sheets
                .filter((s) => s.current_version > 0)
                .map((s) => (
                  <ChoiceRow
                    key={s.id}
                    checked={sheetChoice === s.id}
                    onSelect={() => setSheetChoice(s.id)}
                    label={s.name}
                    hint={s.current_version > 1 ? `${s.current_version}번째 파일` : undefined}
                  />
                ))}
              <ChoiceRow
                checked={sheetChoice === "upload"}
                onSelect={() => setSheetChoice("upload")}
                label="새 PDF 올리기"
                hint="다른 Key 악보 등"
              />
              {sheetChoice === "upload" && (
                <div className="flex flex-col gap-3 rounded-2xl border border-line p-3">
                  <div>
                    <label className="label" htmlFor="new-sheet-name">
                      악보 이름
                    </label>
                    <input
                      id="new-sheet-name"
                      className="input"
                      value={sheetName}
                      maxLength={60}
                      onChange={(e) => setSheetName(e.target.value)}
                      placeholder="예: G키 악보"
                    />
                  </div>
                  <FilePicker file={file} onChange={setFile} onError={setError} disabled={busy} />
                </div>
              )}
              <ChoiceRow checked={sheetChoice === "none"} onSelect={() => setSheetChoice("none")} label="악보 없이 추가" />
            </div>
          </fieldset>

          <div>
            <p className="label">Key</p>
            <KeyPicker value={songKey} onCommit={setSongKey} disabled={busy} />
          </div>

          {error && <p className="text-danger">{error}</p>}
          <button type="button" className="btn btn-primary w-full" onClick={addExisting} disabled={busy}>
            {busy ? (sheetChoice === "upload" ? "악보 올리는 중..." : "추가하는 중...") : "이번 주에 추가"}
          </button>
        </div>
      )}

      {step === "new" && (
        <div className="flex flex-col gap-5">
          <div>
            <label className="label" htmlFor="new-song-title">
              곡명
            </label>
            <input
              id="new-song-title"
              className="input"
              value={newTitle}
              maxLength={100}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="예: 주님의 은혜"
            />
            {duplicate && (
              <div className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
                <p className="break-keep">악보함에 같은 이름의 곡이 있습니다.</p>
                <button type="button" className="btn btn-sm btn-secondary mt-2" onClick={() => pickSong(duplicate)}>
                  있는 곡 사용하기
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="label">악보 PDF</p>
            <FilePicker file={file} onChange={setFile} onError={setError} disabled={busy} />
            <p className="mt-2 px-1 text-[0.9rem] text-muted">악보는 나중에 올려도 됩니다.</p>
          </div>

          <div>
            <p className="label">Key</p>
            <KeyPicker value={songKey} onCommit={setSongKey} disabled={busy} />
          </div>

          {error && <p className="text-danger">{error}</p>}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setStep("search")} disabled={busy}>
              뒤로
            </button>
            <button type="button" className="btn btn-primary" onClick={addNew} disabled={busy}>
              {busy ? (file ? "악보 올리는 중..." : "등록하는 중...") : "등록하고 이번 주에 추가"}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function ChoiceRow({
  checked,
  onSelect,
  label,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-2 text-left ${
        checked ? "border-accent bg-accent-soft" : "border-line bg-surface"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-accent" : "border-faint"
        }`}
      >
        {checked && <span className="h-3 w-3 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-[0.9rem] text-muted">{hint}</span>}
      </span>
    </button>
  );
}
