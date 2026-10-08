"use client";

import type { Annotation } from "./annotations/model";

// 개인 필기는 서버에 보내지 않고 이 기기(브라우저)에만 저장한다.
// 로그인이 없으므로 "나만 보는 필기" = "이 기기에서만 보이는 필기"이다.

const DB_NAME = "salrom";
const STORE = "personal-notes";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("sheet", "sheetKey");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

const sheetKey = (sheetId: string, version: number) => `${sheetId}:${version}`;

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export async function loadLocalNotes(sheetId: string, version: number): Promise<Annotation[]> {
  const rows = await run("readonly", (store) => store.index("sheet").getAll(sheetKey(sheetId, version)));
  return (rows as (Annotation & { sheetKey?: string })[]).map((row) => {
    const note = { ...row };
    delete note.sheetKey;
    return note as Annotation;
  });
}

export async function saveLocalNote(annotation: Annotation): Promise<void> {
  await run("readwrite", (store) =>
    store.put({ ...annotation, sheetKey: sheetKey(annotation.sheetId, annotation.sheetVersion) }),
  );
}

export async function deleteLocalNote(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}
