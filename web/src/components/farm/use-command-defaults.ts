"use client";

import { useEffect, useState } from "react";
import type { PanelDraft } from "@/lib/controllers/controller-panel-draft";
import { EDIT_START_DRAFT } from "@/lib/controllers/controller-panel-map";
import { fetchCommandDefaultsBrowser } from "@/lib/data/browser/command-defaults";

export function useCommandDefaults(): PanelDraft {
  const [draft, setDraft] = useState<PanelDraft>({ ...EDIT_START_DRAFT });

  useEffect(() => {
    let cancelled = false;
    void fetchCommandDefaultsBrowser().then((next) => {
      if (!cancelled) setDraft(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return draft;
}
