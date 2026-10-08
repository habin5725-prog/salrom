"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { notifyServiceChange, publishService, unpublishService } from "@/app/actions/push";
import { Dialog } from "@/components/Dialog";
import { ArrowDownIcon, ArrowUpIcon, BellIcon, ChevronRightIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { KeyPicker } from "@/components/KeyPicker";
import type { EditorItem, EditorService } from "@/lib/data/editor";
import { formatServiceDate } from "@/lib/dates";
import { moveItem, nextPosition } from "@/lib/setlist";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { AddSongDialog } from "./AddSongDialog";
import { SheetDialog, type SheetPatch } from "./SheetDialog";

type Toast = { text: string; error: boolean };

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ServiceEditor({
  initial,
  canDeletePublished,
}: {
  initial: EditorService;
  /** 총 관리자는 공개된 예배도 삭제할 수 있다. */
  canDeletePublished: boolean;
}) {
  const router = useRouter();
  const [service, setService] = useState(initial);
  const [items, setItems] = useState<EditorItem[]>(initial.items);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<EditorItem | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.error ? 6000 : 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isPublished = service.status === "published";

  const saved = useCallback(
    (text = "저장했습니다.") => {
      setToast({
        text: service.status === "published" ? `${text} 팀원 화면에도 바로 보입니다.` : text,
        error: false,
      });
      router.refresh();
    },
    [router, service.status],
  );

  const failed = useCallback(
    (text = "저장하지 못했습니다. 인터넷 연결을 확인해 주세요.") => {
      setToast({ text, error: true });
      router.refresh();
    },
    [router],
  );

  async function updateKey(item: EditorItem, songKey: string) {
    const previous = item.songKey;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, songKey: songKey || null } : i)));
    const { error } = await getBrowserSupabase()
      .from("service_songs")
      .update({ song_key: songKey || null })
      .eq("id", item.id);
    if (error) {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, songKey: previous } : i)));
      failed();
    } else {
      saved(`Key를 ${songKey || "미정"}(으)로 저장했습니다.`);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const previous = items;
    const next = moveItem(items, index, index + direction);
    if (next.every((item, i) => item.id === previous[i].id)) return;
    setItems(next.map((item, i) => ({ ...item, position: i + 1 })));
    const { error } = await getBrowserSupabase().rpc("reorder_service_songs", {
      p_service_id: service.id,
      p_ids: next.map((i) => i.id),
    });
    if (error) {
      setItems(previous);
      failed("순서를 바꾸지 못했습니다.");
    } else {
      saved("순서를 바꿨습니다.");
    }
  }

  async function remove(item: EditorItem) {
    if (!window.confirm(`"${item.title}"을(를) 이번 주 목록에서 뺄까요?\n악보함에서는 지워지지 않습니다.`)) return;
    const { error } = await getBrowserSupabase().from("service_songs").delete().eq("id", item.id);
    if (error) {
      failed("빼지 못했습니다.");
      return;
    }
    setItems((list) => list.filter((i) => i.id !== item.id));
    setOpenId(null);
    saved("목록에서 뺐습니다.");
  }

  async function changeSheet(item: EditorItem, patch: SheetPatch): Promise<boolean> {
    const { error } = await getBrowserSupabase()
      .from("service_songs")
      .update({ sheet_id: patch.sheetId, sheet_version: patch.sheetVersion })
      .eq("id", item.id);
    if (error) {
      failed("악보를 바꾸지 못했습니다.");
      return false;
    }
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    saved("악보를 바꿨습니다.");
    return true;
  }

  function added(item: EditorItem) {
    setItems((list) => [...list, item]);
    saved(`"${item.title}"을(를) 추가했습니다.`);
  }

  async function publish(notify: boolean) {
    setBusy(true);
    const result = await publishService(service.id, notify);
    setBusy(false);
    setPublishOpen(false);
    if (result.ok) {
      setService((s) => ({ ...s, status: "published", notifiedAt: notify ? new Date().toISOString() : s.notifiedAt }));
      setToast({ text: result.message, error: false });
      router.refresh();
    } else {
      failed(result.message);
    }
  }

  async function unpublish() {
    if (!window.confirm("공개를 취소할까요? 팀원 화면에서 이 예배가 사라집니다.")) return;
    setBusy(true);
    const result = await unpublishService(service.id);
    setBusy(false);
    if (result.ok) {
      setService((s) => ({ ...s, status: "draft" }));
      setToast({ text: result.message, error: false });
      router.refresh();
    } else {
      failed(result.message);
    }
  }

  async function sendChangeNotice(note: string) {
    setBusy(true);
    const result = await notifyServiceChange(service.id, note);
    setBusy(false);
    setNotifyOpen(false);
    if (result.ok) setService((s) => ({ ...s, notifiedAt: new Date().toISOString() }));
    setToast({ text: result.message, error: !result.ok });
  }

  async function deleteService() {
    if (!window.confirm("이 예배를 삭제할까요? 곡 목록도 함께 지워집니다(악보함은 그대로).")) return;
    const { error } = await getBrowserSupabase().from("services").delete().eq("id", service.id);
    if (error) {
      failed("삭제하지 못했습니다.");
      return;
    }
    router.replace("/edit");
    router.refresh();
  }

  async function saveInfo(date: string, title: string) {
    const { error } = await getBrowserSupabase()
      .from("services")
      .update({ service_date: date, title })
      .eq("id", service.id);
    if (error) {
      failed();
      return;
    }
    setService((s) => ({ ...s, date, title }));
    setInfoOpen(false);
    saved();
  }

  return (
    <>
      {/* 예배 정보 */}
      <section className="card mb-4 px-5 py-4">
        <div className="mb-1">
          {isPublished ? (
            <span className="badge bg-accent-soft text-accent-strong">공개됨</span>
          ) : (
            <span className="badge bg-amber-100 text-amber-800">초안 · 팀원에게 아직 안 보임</span>
          )}
        </div>
        <p className="text-[1.35rem] font-bold break-keep">{formatServiceDate(service.date, { withYear: true })}</p>
        <p className="text-muted">{service.title}</p>
        <button type="button" className="btn btn-sm btn-secondary mt-3" onClick={() => setInfoOpen(true)}>
          날짜·이름 바꾸기
        </button>
      </section>

      {/* 곡 목록 */}
      <section className="card mb-4 overflow-hidden">
        <h2 className="border-b border-line px-5 py-3 text-[1.05rem] font-bold">곡 순서 ({items.length}곡)</h2>
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted">아래 &quot;곡 추가&quot;를 눌러 첫 곡을 넣어 주세요.</p>
        ) : (
          <ol className="divide-y divide-line">
            {items.map((item, index) => {
              const open = openId === item.id;
              const hasNewer =
                item.sheetVersion !== null && (item.sheetLatestVersion ?? 0) > item.sheetVersion;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    className="flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left"
                    onClick={() => setOpenId(open ? null : item.id)}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent-strong">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.1rem] font-semibold break-keep">{item.title}</span>
                      <span className="block text-[0.95rem] text-muted">
                        {item.songKey ? `Key ${item.songKey}` : "Key 미정"} ·{" "}
                        {item.sheetId ? (hasNewer ? "새 악보 파일 있음" : "악보 있음") : "악보 없음"}
                      </span>
                    </span>
                    <span className="btn btn-sm btn-secondary shrink-0">{open ? "닫기" : "편집"}</span>
                  </button>

                  {open && (
                    <div className="flex flex-col gap-4 bg-page px-4 pt-2 pb-4">
                      <div>
                        <p className="label">Key</p>
                        <KeyPicker value={item.songKey ?? ""} onCommit={(key) => updateKey(item, key)} />
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary w-full justify-between"
                        onClick={() => setSheetItem(item)}
                      >
                        <span>
                          악보: {item.sheetId ? item.sheetName ?? "악보" : "없음"}
                          {hasNewer && <span className="ml-1 text-accent">(새 파일 있음)</span>}
                        </span>
                        <span className="flex items-center gap-1 text-accent">
                          {item.sheetId ? "바꾸기" : "올리기"}
                          <ChevronRightIcon size={20} />
                        </span>
                      </button>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUpIcon size={20} />
                          위로
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={index === items.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDownIcon size={20} />
                          아래로
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(item)}>
                          <TrashIcon size={20} />
                          빼기
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <div className="border-t border-line p-4">
          <button type="button" className="btn btn-soft w-full" onClick={() => setAddOpen(true)}>
            <PlusIcon size={22} />곡 추가
          </button>
        </div>
      </section>

      {/* 공개 */}
      <section className="card mb-4 px-5 py-5">
        {isPublished ? (
          <>
            <p className="font-semibold text-accent-strong">팀원에게 공개되어 있습니다.</p>
            <p className="mt-1 text-[0.95rem] text-muted break-keep">
              고친 내용은 바로 팀원 화면에 보입니다. Key 변경, 곡 추가와 빼기, 악보 교체처럼 중요한 수정이면 알림을 보내 주세요.
            </p>
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => setNotifyOpen(true)} disabled={busy}>
              <BellIcon size={22} />
              팀원에게 변경 알림 보내기
            </button>
            {service.notifiedAt && (
              <p className="mt-2 text-center text-[0.9rem] text-muted">마지막 알림: {formatTime(service.notifiedAt)}</p>
            )}
            <button type="button" className="btn btn-secondary btn-sm mt-4 w-full" onClick={unpublish} disabled={busy}>
              공개 취소(초안으로)
            </button>
            {canDeletePublished && (
              <button type="button" className="btn btn-danger btn-sm mt-3 w-full" onClick={deleteService}>
                이 예배 삭제(총 관리자)
              </button>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold">아직 팀원에게 보이지 않습니다.</p>
            <p className="mt-1 text-[0.95rem] text-muted break-keep">
              고친 내용은 자동으로 저장됩니다. 다 준비되면 공개를 눌러 주세요. 공개할 때 팀원에게 알림이 한 번 갑니다.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              onClick={() => setPublishOpen(true)}
              disabled={busy || items.length === 0}
            >
              이번 주 찬양 공개
            </button>
            <button type="button" className="btn btn-danger btn-sm mt-4 w-full" onClick={deleteService}>
              이 예배 삭제
            </button>
          </>
        )}
      </section>

      {/* 저장 결과 안내 */}
      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-2xl px-5 py-4 text-center font-semibold shadow-lg ${
            toast.error ? "bg-danger text-white" : "bg-ink text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      <AddSongDialog
        open={addOpen}
        serviceId={service.id}
        position={nextPosition(items)}
        onClose={() => setAddOpen(false)}
        onAdded={added}
      />
      <SheetDialog item={sheetItem} onClose={() => setSheetItem(null)} onChange={changeSheet} />
      <InfoDialog
        open={infoOpen}
        date={service.date}
        title={service.title}
        onClose={() => setInfoOpen(false)}
        onSave={saveInfo}
      />
      <PublishDialog
        open={publishOpen}
        service={service}
        items={items}
        busy={busy}
        onClose={() => setPublishOpen(false)}
        onPublish={publish}
      />
      <NotifyDialog open={notifyOpen} busy={busy} onClose={() => setNotifyOpen(false)} onSend={sendChangeNotice} />
    </>
  );
}

function InfoDialog({
  open,
  date,
  title,
  onClose,
  onSave,
}: {
  open: boolean;
  date: string;
  title: string;
  onClose: () => void;
  onSave: (date: string, title: string) => void;
}) {
  const [draftDate, setDraftDate] = useState(date);
  const [draftTitle, setDraftTitle] = useState(title);
  const [wasOpen, setWasOpen] = useState(open);
  // 열릴 때마다 현재 값으로 채운다.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraftDate(date);
      setDraftTitle(title);
    }
  }

  return (
    <Dialog open={open} title="날짜와 예배 이름" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="edit-date">
            예배 날짜
          </label>
          <input id="edit-date" type="date" className="input" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="edit-title">
            예배 이름
          </label>
          <input
            id="edit-title"
            className="input"
            value={draftTitle}
            maxLength={60}
            onChange={(e) => setDraftTitle(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={!/^\d{4}-\d{2}-\d{2}$/.test(draftDate) || !draftTitle.trim()}
          onClick={() => onSave(draftDate, draftTitle.trim())}
        >
          저장
        </button>
      </div>
    </Dialog>
  );
}

function PublishDialog({
  open,
  service,
  items,
  busy,
  onClose,
  onPublish,
}: {
  open: boolean;
  service: EditorService;
  items: EditorItem[];
  busy: boolean;
  onClose: () => void;
  onPublish: (notify: boolean) => void;
}) {
  const [notify, setNotify] = useState(true);
  const missingSheets = items.filter((i) => !i.sheetId).length;
  const missingKeys = items.filter((i) => !i.songKey).length;

  return (
    <Dialog open={open} title="공개 전 마지막 확인" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-page px-4 py-3">
          <p className="text-[1.15rem] font-bold">{formatServiceDate(service.date, { withYear: true })}</p>
          <p className="text-muted">{service.title}</p>
          <ol className="mt-2 flex flex-col gap-1">
            {items.map((item, i) => (
              <li key={item.id} className="break-keep">
                {i + 1}. {item.title}
                <span className="ml-1 font-semibold text-accent-strong">{item.songKey ? `(${item.songKey})` : ""}</span>
              </li>
            ))}
          </ol>
        </div>

        {(missingSheets > 0 || missingKeys > 0) && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900 break-keep">
            {missingSheets > 0 && `악보가 없는 곡 ${missingSheets}개. `}
            {missingKeys > 0 && `Key가 없는 곡 ${missingKeys}개. `}그래도 공개할 수 있고 나중에 채워도 됩니다.
          </p>
        )}

        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-line px-4">
          <input
            type="checkbox"
            className="h-6 w-6 accent-[var(--color-accent)]"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          <span className="font-semibold">팀원에게 알림 보내기</span>
        </label>

        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => onPublish(notify)}>
          {busy ? "공개하는 중..." : "공개"}
        </button>
      </div>
    </Dialog>
  );
}

function NotifyDialog({
  open,
  busy,
  onClose,
  onSend,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSend: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} title="변경 알림 보내기" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="notify-note">
            알림 내용 (비워 두면 기본 문구)
          </label>
          <textarea
            id="notify-note"
            className="input min-h-28 py-3"
            maxLength={100}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 2번 곡 Key가 A로 바뀌었습니다"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={busy}
          onClick={() => {
            onSend(note);
            setNote("");
          }}
        >
          <BellIcon size={22} />
          {busy ? "보내는 중..." : "알림 보내기"}
        </button>
      </div>
    </Dialog>
  );
}
