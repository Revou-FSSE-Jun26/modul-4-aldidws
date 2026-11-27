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

/**
 * Show a loading/spinner toast. Returns the toast id so the caller can later
 * dismiss or update it (e.g. `toast.success(toastId, "Done")`).
 */
export function showLoading(message: string): string {
  return toast.loading(message);
}

/** Dismiss a toast created by `showLoading` (or any other id-returning call). */
export function dismissToast(id: string): void {
  toast.dismiss(id);
}

// Re-export the underlying react-hot-toast helpers so callers can use either
// the `show*` wrapper form or the native `toast.success/error/loading` form.
export const success = toast.success;
export const error = toast.error;
export const loading = toast.loading;
