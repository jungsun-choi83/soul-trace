/**
 * Temporary development storage for Life Archive photo moments.
 *
 * This module is intentionally separate from the Supabase implementation.
 * Photo blobs never enter sessionStorage/localStorage and are never uploaded.
 */
export const TEMPORARY_PHOTO_DB_NAME = "soul-trace-temporary-photo-archive";
export const TEMPORARY_PHOTO_DB_VERSION = 2;
export const MAX_PHOTOS_PER_MOMENT = 5;
export const SUPPORTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const MOMENT_STORE = "photo-moments";
const BLOB_STORE = "photo-blobs";

export type PhotoCollageLayout = "classic-centre" | "clean-grid" | "scrapbook";
export type PhotoDisplayMode = "fit" | "fill";
export type PhotoDisplaySettings = {
  mode: PhotoDisplayMode;
  positionX: number;
  positionY: number;
  zoom: number;
};

export type TemporaryPhotoMomentRecord = {
  momentId: string;
  archiveKey: string;
  caption: string;
  memoryDate: string | null;
  createdAt: string;
  photoIds: string[];
  layout: PhotoCollageLayout;
  centerPhotoId: string | null;
  photoSettings: Record<string, PhotoDisplaySettings>;
  isFavorite: boolean;
};

export type TemporaryPhotoBlobRecord = {
  photoId: string;
  momentId: string;
  name: string;
  type: string;
  blob: Blob;
};

export type TemporaryPhotoMoment = TemporaryPhotoMomentRecord & {
  photos: TemporaryPhotoBlobRecord[];
};

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was cancelled."));
  });
}

function openTemporaryPhotoDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TEMPORARY_PHOTO_DB_NAME, TEMPORARY_PHOTO_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MOMENT_STORE)) {
        const moments = database.createObjectStore(MOMENT_STORE, { keyPath: "momentId" });
        moments.createIndex("archiveKey", "archiveKey", { unique: false });
      }
      if (!database.objectStoreNames.contains(BLOB_STORE)) {
        const blobs = database.createObjectStore(BLOB_STORE, { keyPath: "photoId" });
        blobs.createIndex("momentId", "momentId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
    request.onblocked = () => reject(new Error("IndexedDB upgrade was blocked."));
  });
}

export function isSupportedPhoto(file: Pick<File, "type" | "size">): boolean {
  return file.size > 0 && SUPPORTED_PHOTO_TYPES.includes(file.type as (typeof SUPPORTED_PHOTO_TYPES)[number]);
}

export async function saveTemporaryPhotoMoment(input: {
  archiveKey: string;
  caption: string;
  memoryDate: string | null;
  files: File[];
  layout: PhotoCollageLayout;
  centerPhotoIndex: number | null;
  photoSettings: PhotoDisplaySettings[];
}): Promise<string> {
  if (!input.archiveKey || input.files.length < 1 || input.files.length > MAX_PHOTOS_PER_MOMENT) {
    throw new Error("Invalid temporary photo moment.");
  }
  if (input.files.some((file) => !isSupportedPhoto(file))) {
    throw new Error("Unsupported temporary photo.");
  }
  if (input.layout === "classic-centre" && input.files.length !== 5) {
    throw new Error("Classic Centre requires exactly five photos.");
  }
  if (input.centerPhotoIndex !== null && (input.centerPhotoIndex < 0 || input.centerPhotoIndex >= input.files.length)) {
    throw new Error("Invalid centre photo.");
  }

  const database = await openTemporaryPhotoDatabase();
  try {
    const transaction = database.transaction([MOMENT_STORE, BLOB_STORE], "readwrite");
    const momentId = crypto.randomUUID();
    const photoIds = input.files.map(() => crypto.randomUUID());
    const moment: TemporaryPhotoMomentRecord = {
      momentId,
      archiveKey: input.archiveKey,
      caption: input.caption,
      memoryDate: input.memoryDate,
      createdAt: new Date().toISOString(),
      photoIds,
      layout: input.layout,
      centerPhotoId: input.layout === "classic-centre" ? photoIds[input.centerPhotoIndex ?? 0] : null,
      photoSettings: Object.fromEntries(photoIds.map((photoId, index) => [photoId, input.photoSettings[index] ?? { mode: "fit", positionX: 50, positionY: 50, zoom: 1 }])),
      isFavorite: false,
    };
    transaction.objectStore(MOMENT_STORE).add(moment);
    input.files.forEach((file, index) => {
      transaction.objectStore(BLOB_STORE).add({
        photoId: photoIds[index],
        momentId,
        name: file.name,
        type: file.type,
        blob: file,
      } satisfies TemporaryPhotoBlobRecord);
    });
    await transactionDone(transaction);
    return momentId;
  } finally {
    database.close();
  }
}

export async function listTemporaryPhotoMoments(archiveKey: string): Promise<TemporaryPhotoMoment[]> {
  const database = await openTemporaryPhotoDatabase();
  try {
    const transaction = database.transaction([MOMENT_STORE, BLOB_STORE], "readonly");
    const moments = await requestResult(
      transaction.objectStore(MOMENT_STORE).index("archiveKey").getAll(archiveKey),
    ) as Array<Partial<TemporaryPhotoMomentRecord> & Omit<TemporaryPhotoMomentRecord, "layout" | "centerPhotoId" | "photoSettings" | "isFavorite">>;
    const blobStore = transaction.objectStore(BLOB_STORE);
    const results = await Promise.all(moments.map(async (moment) => ({
      ...moment,
      layout: moment.layout ?? "clean-grid",
      centerPhotoId: moment.centerPhotoId ?? null,
      photoSettings: moment.photoSettings ?? Object.fromEntries(moment.photoIds.map((photoId) => [photoId, { mode: "fit", positionX: 50, positionY: 50, zoom: 1 }])),
      isFavorite: moment.isFavorite ?? false,
      photos: (await Promise.all(moment.photoIds.map((id) => requestResult(blobStore.get(id)))))
        .filter((photo): photo is TemporaryPhotoBlobRecord => Boolean(photo)),
    })));
    await transactionDone(transaction);
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    database.close();
  }
}

export async function deleteTemporaryPhotoMoment(momentId: string): Promise<void> {
  const database = await openTemporaryPhotoDatabase();
  try {
    const transaction = database.transaction([MOMENT_STORE, BLOB_STORE], "readwrite");
    const blobStore = transaction.objectStore(BLOB_STORE);
    const cursorRequest = blobStore.index("momentId").openKeyCursor(momentId);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      blobStore.delete(cursor.primaryKey);
      cursor.continue();
    };
    transaction.objectStore(MOMENT_STORE).delete(momentId);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function updateTemporaryPhotoMoment(
  momentId: string,
  update: Partial<Pick<TemporaryPhotoMomentRecord, "isFavorite">>,
): Promise<void> {
  const database = await openTemporaryPhotoDatabase();
  try {
    const transaction = database.transaction(MOMENT_STORE, "readwrite");
    const store = transaction.objectStore(MOMENT_STORE);
    const record = await requestResult(store.get(momentId)) as TemporaryPhotoMomentRecord | undefined;
    if (!record) throw new Error("Temporary photo moment was not found.");
    store.put({ ...record, ...update });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function clearTemporaryPhotoMoments(): Promise<void> {
  const database = await openTemporaryPhotoDatabase();
  try {
    const transaction = database.transaction([MOMENT_STORE, BLOB_STORE], "readwrite");
    transaction.objectStore(MOMENT_STORE).clear();
    transaction.objectStore(BLOB_STORE).clear();
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
