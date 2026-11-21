/**
 * Centralised toast helpers.
 * Thin wrappers around react-hot-toast so the rest of the codebase imports
 * from one place and callers never depend directly on the library API.
 */
import toast from "react-hot-toast";

export function showSuccess(message: string): void {
  toast.success(message);
}

export function showError(message: string): void {
  toast.error(message);
}

export function showInfo(message: string): void {
  toast(message);
}
