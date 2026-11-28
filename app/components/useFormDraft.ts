"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { browserDraft, restoreDraftFields, type BrowserDraft } from "@/lib/browser-drafts";

export default function useFormDraft(key: string, form: RefObject<HTMLFormElement | null>, capture: () => unknown, restore: (draft: BrowserDraft) => void) {
  const callbacks = useRef({ capture, restore });
  useEffect(() => { callbacks.current = { capture, restore }; });
  const [status, setStatus] = useState("Loading draft…");
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef(Promise.resolve());
  const active = useRef(false);
  useEffect(() => {
    let mounted = true;
    const element = form.current;
    active.current = false;
    browserDraft(key, "read").then(draft => {
      if (!mounted || !element) return;
      if (draft) {
        restoreDraftFields(element, draft.entries);
        callbacks.current.restore(draft);
      }
      setStatus(draft ? "Draft restored on this device." : "Drafts autosave on this device.");
    }).catch(() => { if (mounted) setStatus("Draft storage is unavailable. Keep this page open until you submit."); })
      .finally(() => { if (mounted) { active.current = true; setReady(true); } });
    return () => {
      mounted = false; active.current = false; clearTimeout(timer.current);
    };
  }, [key, form]);
  function changed() {
    const element = form.current;
    if (!active.current || !element) return;
    clearTimeout(timer.current);
    setStatus("Saving draft…");
    timer.current = setTimeout(() => {
      const draft: BrowserDraft = { entries: Array.from(new FormData(element).entries()), state: callbacks.current.capture(), savedAt: new Date().toISOString() };
      queue.current = queue.current.catch(() => {}).then(async () => {
        try { await browserDraft(key, "write", draft); setStatus("Draft saved on this device."); }
        catch { setStatus("Draft could not be saved. Keep this page open and try again."); }
      });
    }, 150);
  }
  async function clear() {
    clearTimeout(timer.current);
    await queue.current.catch(() => {});
    try {
      await browserDraft(key, "delete");
      setStatus("Draft cleared on this device.");
    } catch { setStatus("Submitted successfully, but the saved draft could not be cleared on this device."); }
  }
  return { status, ready, clear, changed };
}
