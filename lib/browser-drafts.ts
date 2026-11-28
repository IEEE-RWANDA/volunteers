export type BrowserDraft = { entries: [string, FormDataEntryValue][]; state: unknown; savedAt: string };

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ieee-volunteer-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Draft storage is blocked"));
  });
}
export function draftKey(email: string, form: string) {
  return JSON.stringify([email.toLowerCase(), form]);
}
export async function browserDraft(key: string, operation: "read" | "write" | "delete", value?: BrowserDraft): Promise<BrowserDraft | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("drafts", operation === "read" ? "readonly" : "readwrite");
      const store = transaction.objectStore("drafts");
      const request = operation === "read" ? store.get(key) : operation === "delete" ? store.delete(key) : store.put(value, key);
      transaction.oncomplete = () => resolve(operation === "read" ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export function restoreDraftFields(form: HTMLFormElement, entries: BrowserDraft["entries"]) {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) || !element.name || element.type === "hidden") continue;
    const values = entries.filter(([name]) => name === element.name).map(([, value]) => value);
    if (element instanceof HTMLInputElement && element.type === "file") {
      const files = new DataTransfer();
      for (const value of values) if (value instanceof File && value.size) files.items.add(value);
      element.files = files.files;
    } else if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
      element.checked = values.includes(element.value);
    } else element.value = typeof values[0] === "string" ? values[0] : "";
  }
}
