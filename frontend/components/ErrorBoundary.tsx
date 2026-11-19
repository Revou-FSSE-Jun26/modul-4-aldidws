"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Props & State
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional custom fallback UI.  If omitted the default fallback is shown.
   * Receives the caught error so the caller can display contextual information.
   */
  fallback?: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Default fallback UI — rendered when no custom fallback is provided
// ---------------------------------------------------------------------------

function DefaultFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        {/* Warning icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-8 w-8 text-destructive"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>

        <h2 className="text-base font-semibold text-foreground">
          Something went wrong
        </h2>

        <p className="max-w-sm text-sm text-muted-foreground">
          An unexpected error occurred. The page could not be rendered. Please
          try refreshing or come back later.
        </p>

        {/* Never expose the raw error message to users in production.
            In development it is helpful to see it. */}
        {process.env.NODE_ENV === "development" && (
          <p className="mt-1 max-w-sm break-all font-mono text-xs text-destructive">
            {error.message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Boundary class component
//
// React error boundaries MUST be class components — there is no hook
// equivalent for componentDidCatch / getDerivedStateFromError.
// ---------------------------------------------------------------------------

/**
 * Catches unexpected render-time errors from any child component tree and
 * displays a clean fallback UI instead of a blank or broken page.
 *
 * Uses `"use client"` because error boundaries require class lifecycle methods
 * that only run in the browser.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <SomeComponent />
 * </ErrorBoundary>
 *
 * // With a custom fallback:
 * <ErrorBoundary fallback={(err) => <p>Oops: {err.message}</p>}>
 *   <SomeComponent />
 * </ErrorBoundary>
 * ```
 *
 * Note: This catches render-time errors only.  Async errors (promise
 * rejections in event handlers or useEffect) are NOT caught here — handle
 * those with try/catch at the call site and surface them via useErrorHandler.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console in development; replace with a monitoring service
    // (e.g. Sentry) in production.
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary] Uncaught render error:", error, info);
    }
  }

  handleReset(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }
      return (
        <DefaultFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}
