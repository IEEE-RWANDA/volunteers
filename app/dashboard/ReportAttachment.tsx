"use client";

import { useState } from "react";

export default function ReportAttachment({ href, label, pdf }: { href: string; label: string; pdf: boolean }) {
  const [preview, setPreview] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a className="action-link wrap-anywhere" href={href}>{label}</a>
        {pdf && (
          <button type="button" className="action-link" aria-expanded={preview} aria-label={`${preview ? "Close preview" : "Preview"} ${label}`} onClick={() => setPreview(!preview)}>
            {preview ? "Close preview" : "Preview"}
          </button>
        )}
      </div>
      {preview && <iframe className="h-80 w-full min-w-56 rounded-md border border-line" title={`PDF preview for ${label}`} src={`${href}&preview=1`} />}
    </div>
  );
}
