"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function FreePolaroidNotice({ petId }: { petId: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/my/pets/${petId}/free-polaroid`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { remaining?: number } | null) => {
        if (active && typeof payload?.remaining === "number") setRemaining(payload.remaining);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [petId]);

  if (remaining === null) return null;
  if (remaining > 0) {
    return <Link href="/try" className="mt-3 block text-sm font-semibold tracking-[-0.03em] text-[#3f5c45]">우리아이 첫 폴라로이드 만들기</Link>;
  }
  return <Link href="/premium" className="mt-3 block text-sm font-semibold text-[#5a3d27]">추가 콘텐츠 만들기</Link>;
}
