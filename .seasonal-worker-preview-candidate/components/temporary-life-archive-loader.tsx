"use client";

import { LifeArchivePreview } from "@/components/life-archive-preview";
import { loadTemporaryLifeArchive } from "@/lib/life-archive-temporary";
import { useEffect, useState } from "react";

type LoadedArchive = ReturnType<typeof loadTemporaryLifeArchive>;

export function TemporaryLifeArchiveLoader({
  navigationOrigin,
  backHref,
  archiveQuery,
}: {
  navigationOrigin: "letter" | "choose";
  backHref: string;
  archiveQuery: string;
}) {
  const [archive, setArchive] = useState<LoadedArchive | undefined>(undefined);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setArchive(loadTemporaryLifeArchive());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const navigation = { navigationOrigin, backHref, archiveQuery };
  if (archive === undefined) return <LifeArchivePreview status="loading" {...navigation} />;
  if (!archive) return <LifeArchivePreview status="selection-required" {...navigation} />;
  return <LifeArchivePreview status="ready" archive={archive} storageMode="temporary" {...navigation} />;
}
