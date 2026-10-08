"use client";

/** 화면 전체를 새로 불러온다(승인 여부 다시 확인 등). */
export function ReloadButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn btn-primary w-full" onClick={() => window.location.reload()}>
      {label}
    </button>
  );
}
