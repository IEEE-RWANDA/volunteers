"use client";

import VolunteerAvatar from "./VolunteerAvatar";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { signOut } from "@/app/session-actions";

export default function AccountMenu({ email, avatar, googleName }: { email: string; avatar?: string; googleName?: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const close = () => { if (detailsRef.current) detailsRef.current.open = false; };

  useEffect(() => {
    function handleOutside(event: PointerEvent) {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) close();
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  const item = "block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-navy hover:bg-paper-2";

  return (
    <details
      ref={detailsRef}
      className="dashboard-account relative"
      onKeyDown={event => {
        if (event.key === "Escape" && detailsRef.current?.open) {
          event.preventDefault();
          close();
          triggerRef.current?.focus();
        }
      }}
    >
      <summary
        ref={triggerRef}
        aria-label="Account menu"
        className="flex cursor-pointer list-none items-center gap-2 rounded-full p-1 text-navy hover:bg-paper-2 [&::-webkit-details-marker]:hidden"
      >
        <VolunteerAvatar avatar={avatar} name={googleName ?? email.split("@")[0]} size={40} />
        <span aria-hidden="true" className="me-1 text-xs">⌄</span>
      </summary>
      <div className="absolute end-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-line bg-paper p-2 shadow-lg">
        <div className="mb-1 border-b border-line px-3 py-2">
          <p className="wrap-anywhere text-sm font-semibold text-navy">{googleName ?? "Signed in as"}</p>
          <p className="mt-0.5 wrap-anywhere text-xs text-ink-soft">{email}</p>
        </div>
        <Link className={item} href="/?section=volunteers#your-profile" onClick={close}>Edit profile</Link>
        <Link className={item} href="/?section=volunteers#hours-title" onClick={close}>Volunteer hours and certificates</Link>
        <form action={signOut} className="mt-1 border-t border-line pt-1">
          <button className={`${item} cursor-pointer`} type="submit">Sign out</button>
        </form>
      </div>
    </details>
  );
}
