"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon } from "@/components/icons";

const DEVICES = [
  { id: "phone", label: "휴대폰", width: 390, height: 844 },
  { id: "pad", label: "패드", width: 820, height: 1180 },
  { id: "laptop", label: "노트북", width: 1440, height: 900 },
] as const;

const PAGES = [
  { path: "/", label: "홈" },
  { path: "/week", label: "이번 주" },
  { path: "/library", label: "악보함" },
  { path: "/history", label: "지난 예배" },
  { path: "/settings", label: "설정" },
  { path: "/login", label: "로그인" },
] as const;

type DeviceId = (typeof DEVICES)[number]["id"] | "all";

function Frame({ device, path, maxWidth }: { device: (typeof DEVICES)[number]; path: string; maxWidth: number }) {
  const scale = Math.min(1, maxWidth / device.width);
  return (
    <figure className="flex flex-col items-center gap-2">
      <figcaption className="font-semibold text-muted">
        {device.label} ({device.width}×{device.height})
      </figcaption>
      <div
        className="overflow-hidden rounded-[1.5rem] border-[6px] border-ink bg-white shadow-xl"
        style={{ width: device.width * scale + 12, height: device.height * scale + 12 }}
      >
        <iframe
          title={`${device.label} 화면`}
          src={path}
          style={{
            width: device.width,
            height: device.height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            border: 0,
          }}
        />
      </div>
    </figure>
  );
}

export function DevicePreview() {
  const [device, setDevice] = useState<DeviceId>("phone");
  const [path, setPath] = useState<string>("/");
  const [width, setWidth] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shown = device === "all" ? DEVICES : DEVICES.filter((d) => d.id === device);
  // 모두 보기는 넓은 화면에서 나란히, 좁은 화면에서는 위아래로 놓는다.
  const sideBySide = device === "all" && width >= 1100;
  const frameWidth = sideBySide ? (width - 64) / 3 : width - 16;

  return (
    <div className="min-h-dvh bg-page">
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link href="/" className="btn btn-sm btn-secondary">
            <ChevronLeftIcon size={20} />
            사이트로
          </Link>
          <h1 className="mr-auto text-[1.15rem] font-bold">기기별 미리보기</h1>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="기기">
            {[...DEVICES.map((d) => ({ id: d.id as DeviceId, label: d.label })), { id: "all" as DeviceId, label: "모두 보기" }].map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={device === d.id}
                onClick={() => setDevice(d.id)}
                className={`btn btn-sm ${device === d.id ? "btn-primary" : "btn-secondary"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-3">
          {PAGES.map((p) => (
            <button
              key={p.path}
              type="button"
              aria-pressed={path === p.path}
              onClick={() => setPath(p.path)}
              className={`min-h-10 rounded-xl border px-3 text-[0.95rem] font-semibold ${
                path === p.path ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div ref={areaRef} className="mx-auto max-w-6xl px-4 py-6">
        {width > 0 && (
          <div className={sideBySide ? "flex items-start justify-center gap-8" : "flex flex-col items-center gap-8"}>
            {shown.map((d) => (
              <Frame key={`${d.id}-${path}`} device={d} path={path} maxWidth={frameWidth} />
            ))}
          </div>
        )}
        <p className="mt-6 text-center text-[0.9rem] text-muted break-keep">
          미리보기 안의 화면도 실제로 눌러 볼 수 있습니다. 이 화면에서 본 내용은 접속 기록에 남지 않습니다.
        </p>
      </div>
    </div>
  );
}
