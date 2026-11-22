"use client";

import Image from "next/image";
import { useState } from "react";

export default function VolunteerAvatar({ avatar, name, size }: { avatar?: string; name: string; size: number }) {
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2)
    .map(word => Array.from(word)[0].toUpperCase()).join("") || "V";

  return (
    <span aria-hidden="true" style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-paper-2 text-sm font-bold text-blue">
      {avatar && avatar !== failedAvatar ? (
        <Image src={avatar} alt="" unoptimized width={size} height={size} className="size-full object-cover"
          referrerPolicy="no-referrer" onError={() => setFailedAvatar(avatar)} />
      ) : initials}
    </span>
  );
}
