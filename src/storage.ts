import type { AssistantSettings, TravelDocument } from "./types";

const DB_NAME = "travel-card-studio";
const STORE = "documents";
const DOC_KEY = "current";
const SETTINGS_KEY = "travel-card-assistant";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDocument(): Promise<TravelDocument | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(DOC_KEY);
    request.onsuccess = () => resolve((request.result as TravelDocument | undefined) || null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function saveDocument(document: TravelDocument): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(document, DOC_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export function loadAssistantSettings(): AssistantSettings {
  const defaults: AssistantSettings = { baseUrl: "/api/deepseek", apiKey: "", model: "deepseek-v4-flash", musicProvider: "youtube", musicLibrary: [] };
  try {
    const saved = { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    if (/^https:\/\/api\.deepseek\.com(?:\/chat\/completions)?\/?$/i.test(saved.baseUrl)) saved.baseUrl = "/api/deepseek";
    if (saved.model === "deepseek-chat" || saved.model === "deepseek-reasoner") saved.model = "deepseek-v4-flash";
    return saved;
  } catch {
    return defaults;
  }
}

export function saveAssistantSettings(settings: AssistantSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
