"use client";

import { Plus, ChevronDown } from "lucide-react";
import { ActionMenu } from "@/components/shared/ActionMenu";

interface AddNewSplitButtonProps {
  onNewTask: () => void;
  onNewColumn: () => void;
}

/**
 * Split button: left half opens AddCardForm in the first column; right half
 * opens an ActionMenu with 'New Task' and 'New Column' options.
 *
 * Both halves are grouped in a `<div role="group">` so assistive technologies
 * can announce the two related controls together.
 *
 * Phase 2: styled as the BMW-blue primary split button (spec §4.3).
 */
export function AddNewSplitButton({ onNewTask, onNewColumn }: AddNewSplitButtonProps) {
  return (
    <div
      role="group"
      aria-label="Add new"
      className="inline-flex h-9 items-stretch overflow-hidden rounded-[var(--radius-ctrl)]"
    >
      {/* Primary left segment */}
      <button
        type="button"
        aria-label="Add new task"
        onClick={onNewTask}
        className="flex items-center gap-1.5 bg-[var(--brand)] px-3 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[var(--brand-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2"
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        New Task
      </button>

      {/* 1px translucent divider */}
      <span aria-hidden="true" className="w-px bg-white/20" />

      {/* Chevron right segment */}
      <ActionMenu
        label="Open add new menu"
        symbolNode={<ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />}
        triggerClassName="h-9 w-8 rounded-none border-0 bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus-visible:ring-[var(--brand-light)]"
        items={[
          { id: "new-task", label: "New Task", onSelect: onNewTask },
          { id: "new-column", label: "New Column", onSelect: onNewColumn },
        ]}
      />
    </div>
  );
}
