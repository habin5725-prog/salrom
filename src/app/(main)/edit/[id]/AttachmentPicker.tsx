"use client";

import { useEffect, useEffectEvent, useId, useState, type DragEvent } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CameraIcon,
  CloseIcon,
  FileIcon,
  ImageIcon,
  MusicIcon,
} from "@/components/icons";
import { KIND_LABEL, MAX_IMAGES, formatBytes, kindOfFile } from "@/lib/files";
import { checkFiles } from "@/lib/sheet-upload";

/**
 * 악보 파일 고르기.
 * - 사진: 찍거나 여러 장 고르면 순서대로 한 악보로 합친다. 순서를 바꾸거나 뺄 수 있다.
 * - PDF나 그 밖의 파일(음원, 문서 등): 한 개를 고른다.
 * - 컴퓨터에서는 끌어다 놓거나 복사한 그림을 붙여 넣을 수도 있다.
 */
export function AttachmentPicker({
  files,
  onChange,
  onError,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const images = files.length > 0 && kindOfFile(files[0]) === "image";

  function add(picked: File[]) {
    if (disabled || picked.length === 0) return;
    const pickedImages = picked.every((f) => kindOfFile(f) === "image");
    // 사진에 사진을 더하면 이어 붙이고, 그 밖에는 새로 고른 것으로 바꾼다.
    const next = pickedImages && images ? [...files, ...picked] : picked;
    const problem = checkFiles(next);
    if (problem) {
      onError(problem);
      return;
    }
    onError("");
    onChange(next);
  }

  // 복사한 그림이나 파일 붙여 넣기(Ctrl+V)
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData?.files ?? []);
    if (pasted.length === 0) return;
    e.preventDefault();
    add(pasted);
  });
  useEffect(() => {
    if (disabled) return;
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled]);

  function move(index: number, by: number) {
    const target = index + by;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      add(Array.from(e.dataTransfer.files));
    },
  };

  if (files.length === 0) {
    return (
      <div
        {...dropProps}
        className={`flex flex-col gap-2 rounded-2xl border-2 border-dashed p-3 ${
          dragging ? "border-accent bg-accent-soft" : "border-line"
        }`}
      >
        <div className="grid grid-cols-2 gap-2">
          <PickButton accept="image/*" capture onPick={add} disabled={disabled} icon={<CameraIcon size={22} />}>
            사진 찍기
          </PickButton>
          <PickButton accept="image/*" multiple onPick={add} disabled={disabled} icon={<ImageIcon size={22} />}>
            사진 고르기
          </PickButton>
        </div>
        <PickButton onPick={add} disabled={disabled} icon={<FileIcon size={22} />}>
          파일 고르기(PDF, 음원, 문서 등)
        </PickButton>
        <p className="px-1 text-[0.9rem] text-muted break-keep">
          사진은 여러 장을 고르면 순서대로 한 악보로 합쳐집니다. 모든 파일을 {formatBytes(50 * 1024 * 1024)}까지 올릴 수
          있습니다.
        </p>
        <p className="hidden px-1 text-[0.9rem] text-muted break-keep pointer-fine:block">
          컴퓨터에서는 파일을 이 칸에 끌어다 놓거나, 복사한 그림을 붙여 넣을 수(Ctrl+V) 있습니다.
        </p>
      </div>
    );
  }

  if (images) {
    return (
      <div {...dropProps} className={`rounded-2xl border p-3 ${dragging ? "border-accent bg-accent-soft" : "border-line"}`}>
        <p className="mb-2 px-1 font-semibold">
          사진 {files.length}장 → 악보 {files.length}쪽
        </p>
        <ol className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-xl bg-page p-2">
              <Thumb file={file} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{index + 1}쪽</span>
                <span className="block truncate text-[0.85rem] text-muted">{file.name}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <IconButton label={`${index + 1}쪽을 앞으로`} onClick={() => move(index, -1)} disabled={disabled || index === 0}>
                  <ArrowUpIcon size={20} />
                </IconButton>
                <IconButton
                  label={`${index + 1}쪽을 뒤로`}
                  onClick={() => move(index, 1)}
                  disabled={disabled || index === files.length - 1}
                >
                  <ArrowDownIcon size={20} />
                </IconButton>
                <IconButton
                  label={`${index + 1}쪽 빼기`}
                  onClick={() => onChange(files.filter((_, i) => i !== index))}
                  disabled={disabled}
                >
                  <CloseIcon size={20} />
                </IconButton>
              </span>
            </li>
          ))}
        </ol>
        {files.length < MAX_IMAGES && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PickButton accept="image/*" capture onPick={add} disabled={disabled} small icon={<CameraIcon size={20} />}>
              더 찍기
            </PickButton>
            <PickButton accept="image/*" multiple onPick={add} disabled={disabled} small icon={<ImageIcon size={20} />}>
              더 고르기
            </PickButton>
          </div>
        )}
        <button type="button" className="btn btn-sm btn-secondary mt-2 w-full" disabled={disabled} onClick={() => onChange([])}>
          다시 고르기
        </button>
      </div>
    );
  }

  const file = files[0];
  const kind = kindOfFile(file);
  return (
    <div {...dropProps} className={`rounded-2xl border p-3 ${dragging ? "border-accent bg-accent-soft" : "border-line"}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          {kind === "audio" ? <MusicIcon size={24} /> : <FileIcon size={24} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{file.name}</span>
          <span className="block text-[0.9rem] text-muted">
            {KIND_LABEL[kind].name} · {formatBytes(file.size)}
          </span>
        </span>
        <IconButton label="고른 파일 빼기" onClick={() => onChange([])} disabled={disabled}>
          <CloseIcon size={20} />
        </IconButton>
      </div>
      {kind !== "pdf" && (
        <p className="mt-2 px-1 text-[0.9rem] text-muted break-keep">
          {kind === "audio" || kind === "video"
            ? "사이트 안에서 바로 재생할 수 있습니다."
            : "사이트 안에서는 보이지 않고, 누르면 휴대폰이나 컴퓨터의 앱으로 열립니다."}
        </p>
      )}
    </div>
  );
}

function PickButton({
  accept,
  multiple,
  capture,
  onPick,
  disabled,
  small,
  icon,
  children,
}: {
  accept?: string;
  multiple?: boolean;
  capture?: boolean;
  onPick: (files: File[]) => void;
  disabled?: boolean;
  small?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <>
      <input
        id={id}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        capture={capture ? "environment" : undefined}
        disabled={disabled}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          onPick(picked);
        }}
      />
      <label
        htmlFor={id}
        className={`btn btn-secondary w-full cursor-pointer gap-2 px-2 ${small ? "btn-sm" : ""} ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        {icon}
        {children}
      </label>
    </>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** 사진 작은 미리보기. 이 기기에서 열 수 없는 사진(HEIC 등)은 그림 아이콘만 보인다. */
function Thumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // 파일에서 만든 주소는 화면이 뜬 뒤에만 만들 수 있다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <span className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-faint">
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <ImageIcon size={22} />
      )}
    </span>
  );
}
