"use client";

import { LifeArchivePreview } from "@/components/life-archive-preview";
import { loadTemporaryLifeArchive } from "@/lib/life-archive-temporary";
import { useEffect, useState } from "react";

type LoadedArchive = ReturnType<typeof loadTemporaryLifeArchive>;

export function TemporaryLifeArchiveLoader() {
  const [archive, setArchive] = useState<LoadedArchive | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setArchive(loadTemporaryLifeArchive());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (archive === undefined) return <LifeArchivePreview status="loading" />;
  if (!archive) return <LifeArchivePreview status="selection-required" />;
  return <LifeArchivePreview status="ready" archive={archive} storageMode="temporary" />;
}
