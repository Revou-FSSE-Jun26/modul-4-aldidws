"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `onTrigger` when the user presses `f` outside text fields, without
 * modifier keys and while no modal dialog is open.
 */
export function useFilterShortcut(onTrigger: () => void) {
  const callback = useRef(onTrigger);
  useEffect(() => {
    callback.current = onTrigger;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== "f") return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      event.preventDefault();
      callback.current();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
