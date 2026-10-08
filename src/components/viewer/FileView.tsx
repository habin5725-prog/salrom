"use client";

import { useEffect, useState } from "react";
import { FileIcon, MusicIcon } from "@/components/icons";
import { KIND_LABEL, extensionOf, kindOfPath } from "@/lib/files";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { SHEETS_BUCKET } from "@/lib/supabase/env";

/** 서명 주소 유효 시간. 예배 동안 열어 두어도 끊기지 않을 만큼 길게 둔다. */
const LINK_SECONDS = 6 * 60 * 60;

type Links = { view: string; download: string };

/** PDF가 아닌 파일(음원, 영상, 문서 등) 보기. 음원과 영상은 바로 재생하고 그 밖의 파일은 기기 앱으로 연다. */
export function FileView({ path, title }: { path: string; title: string }) {
  const kind = kindOfPath(path);
  const fileName = `${title}.${extensionOf(path) || "bin"}`;
  const [links, setLinks] = useState<Links | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const bucket = getBrowserSupabase().storage.from(SHEETS_BUCKET);
    Promise.all([
      bucket.createSignedUrl(path, LINK_SECONDS),
      bucket.createSignedUrl(path, LINK_SECONDS, { download: fileName }),
    ]).then(([view, download]) => {
      if (cancelled) return;
      if (view.data && download.data) setLinks({ view: view.data.signedUrl, download: download.data.signedUrl });
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [path, fileName, retry]);

  return (
    <div className="card mx-auto mt-6 flex w-full max-w-lg flex-col gap-4 p-5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
          {kind === "audio" ? <MusicIcon size={28} /> : <FileIcon size={28} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1.1rem] font-bold break-keep">{title}</span>
          <span className="block text-[0.95rem] text-muted">
            {KIND_LABEL[kind].name} · {extensionOf(path).toUpperCase() || "파일"}
          </span>
        </span>
      </div>

      {failed ? (
        <>
          <p className="text-danger">파일을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.</p>
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => {
              setFailed(false);
              setRetry((n) => n + 1);
            }}
          >
            다시 시도
          </button>
        </>
      ) : !links ? (
        <p className="text-muted">파일을 준비하는 중입니다...</p>
      ) : (
        <>
          {kind === "audio" && <audio controls preload="metadata" src={links.view} className="w-full" />}
          {kind === "video" && (
            <video controls playsInline preload="metadata" src={links.view} className="w-full rounded-xl bg-black" />
          )}
          {kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={links.view} alt={title} className="w-full rounded-xl" />
          )}
          {kind === "other" && (
            <p className="text-[0.95rem] text-muted break-keep">
              이 파일은 사이트 안에서 보이지 않습니다. 아래 버튼을 누르면 휴대폰이나 컴퓨터에 있는 앱(한글, 워드 등)으로
              열립니다.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <a href={links.view} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {kind === "other" ? "파일 열기" : "새 창에서 열기"}
            </a>
            <a href={links.download} className="btn btn-secondary">
              내려받기
            </a>
          </div>
        </>
      )}
    </div>
  );
}
