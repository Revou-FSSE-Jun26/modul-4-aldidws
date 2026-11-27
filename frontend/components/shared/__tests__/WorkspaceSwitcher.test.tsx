import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { WorkspaceSwitcher } from "@/components/shared/WorkspaceSwitcher";
import type { WorkspaceSummary } from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/services/usersService", () => ({
  getWorkspaceSummary: jest.fn(),
}));

import { useAuth } from "@/context/AuthContext";
import { getWorkspaceSummary } from "@/lib/services/usersService";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetWorkspaceSummary = getWorkspaceSummary as jest.MockedFunction<
  typeof getWorkspaceSummary
>;

const SUMMARY: WorkspaceSummary = {
  workspace_name: "Alice's workspace",
  projects: 3,
  tasks: 12,
  members: 1,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupAuth(token: string | null = "tok") {
  mockUseAuth.mockReturnValue({
    currentUser: { id: "u-1", email: "alice@example.com", name: "Alice", role: "member", timezone: "UTC" },
    token,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateProfile: jest.fn(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe("WorkspaceSwitcher", () => {
  it("shows loading placeholder while fetching", () => {
    setupAuth();
    mockGetWorkspaceSummary.mockReturnValue(new Promise(() => {})); // never resolves
    render(<WorkspaceSwitcher />);
    expect(screen.getByLabelText("Loading workspace")).toBeInTheDocument();
  });

  it("renders workspace name and counts after successful fetch", async () => {
    setupAuth();
    mockGetWorkspaceSummary.mockResolvedValue(SUMMARY);
    render(<WorkspaceSwitcher />);

    await waitFor(() =>
      expect(screen.getByText("Alice's workspace")).toBeInTheDocument()
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders fallback name on fetch error", async () => {
    setupAuth();
    mockGetWorkspaceSummary.mockRejectedValue(new Error("Network error"));
    render(<WorkspaceSwitcher />);

    await waitFor(() =>
      expect(screen.getByText("Alice's workspace")).toBeInTheDocument()
    );
    // No counts rendered on error
    expect(screen.queryByText("Projects")).not.toBeInTheDocument();
  });

  it("does not call getWorkspaceSummary when token is null", () => {
    setupAuth(null);
    render(<WorkspaceSwitcher />);
    expect(mockGetWorkspaceSummary).not.toHaveBeenCalled();
  });
});
