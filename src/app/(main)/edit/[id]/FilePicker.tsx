"use client";

import { useId } from "react";
import { checkPdf } from "@/lib/sheet-upload";

/** 큰 버튼 모양의 PDF 파일 선택 */
export function FilePicker({
  file,
  onChange,
  onError,
  disabled,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (!picked) return;
          const problem = checkPdf(picked);
          if (problem) {
            onError(problem);
            onChange(null);
            return;
          }
          onChange(picked);
        }}
      />
      <label htmlFor={id} className="btn btn-secondary w-full cursor-pointer">
        {file ? "다른 PDF 고르기" : "PDF 파일 고르기"}
      </label>
      {file && <p className="mt-2 truncate px-1 text-[0.95rem] text-accent-strong">선택한 파일: {file.name}</p>}
    </div>
  );
}
