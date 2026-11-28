/**
 * Tests for the D3 Favorites and Projects sections added to Sidebar.
 *
 * We isolate the Sidebar component by mocking:
 * - next/navigation (usePathname, useRouter)
 * - @/context/AuthContext (useAuth)
 * - @/lib/services/boardsService (listBoards, setFavorite)
 * - @/components/shared/WorkspaceSwitcher (renders nothing — not under test here)
 * - @/components/shared/ActionMenu (renders nothing — not under test here)
 */
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Board } from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  usePathname: jest.fn().mockReturnValue("/"),
  useRouter: jest.fn().mockReturnValue({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/services/boardsService", () => ({
  listBoards: jest.fn(),
  setFavorite: jest.fn(),
}));

jest.mock("@/components/shared/WorkspaceSwitcher", () => ({
  WorkspaceSwitcher: () => <div data-testid="workspace-switcher" />,
}));

jest.mock("@/components/shared/ActionMenu", () => ({
  ActionMenu: () => null,
}));

import { useAuth } from "@/context/AuthContext";
import { listBoards, setFavorite } from "@/lib/services/boardsService";
import { Sidebar } from "@/components/shared/Sidebar";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockListBoards = listBoards as jest.MockedFunction<typeof listBoards>;
const mockSetFavorite = setFavorite as jest.MockedFunction<typeof setFavorite>;

const stamp = "2026-01-01T00:00:00Z";

function makeBoard(id: string, name: string, is_favorite = false): Board {
  return {
    id,
    name,
    user_id: "u-1",
    is_favorite,
    created_at: stamp,
    updated_at: stamp,
  };
}

function setupAuth() {
  mockUseAuth.mockReturnValue({
    currentUser: {
      id: "u-1",
      email: "alice@example.com",
      name: "Alice",
      role: "member",
      timezone: "UTC",
    },
    token: "tok",
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

describe("Sidebar — Favorites section (D3)", () => {
  it("shows only favorited boards in Favorites section", async () => {
    setupAuth();
    const boards = [
      makeBoard("b-1", "Alpha", true),
      makeBoard("b-2", "Beta", false),
    ];
    mockListBoards.mockResolvedValue(boards);

    render(<Sidebar collapsed={false} onToggle={jest.fn()} />);

    // Alpha appears in both Favorites and Projects; Beta only in Projects
    await waitFor(() => expect(screen.getAllByText("Alpha")).toHaveLength(2));

    const favorites = screen.getByText("Favorites").closest("section")!;
    // Only Alpha is in Favorites
    const favItems = favorites.querySelectorAll("li");
    expect(favItems).toHaveLength(1);
    // Alpha link is inside Favorites
    expect(favorites.querySelector('a[href="/boards/b-1"]')).toBeInTheDocument();
  });

  it("shows all boards in Projects section", async () => {
    setupAuth();
    const boards = [
      makeBoard("b-1", "Alpha", true),
      makeBoard("b-2", "Beta", false),
    ];
    mockListBoards.mockResolvedValue(boards);

    render(<Sidebar collapsed={false} onToggle={jest.fn()} />);

    await waitFor(() => expect(screen.getByText("Beta")).toBeInTheDocument());

    const projects = screen.getByText("Projects").closest("section")!;
    const projectItems = projects.querySelectorAll("li");
    expect(projectItems).toHaveLength(2);
  });

  it("calls setFavorite(true) when star button is clicked in Projects for a non-favorite", async () => {
    const user = userEvent.setup();
    setupAuth();
    const boards = [makeBoard("b-1", "Alpha", false)];
    mockListBoards.mockResolvedValue(boards);
    mockSetFavorite.mockResolvedValue({ ...boards[0], is_favorite: true });

    render(<Sidebar collapsed={false} onToggle={jest.fn()} />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    const addBtn = screen.getByRole("button", { name: "Add to favorites" });
    await user.click(addBtn);

    expect(mockSetFavorite).toHaveBeenCalledWith("tok", "b-1", true);
  });

  it("calls setFavorite(false) when star button is clicked for a favorite", async () => {
    const user = userEvent.setup();
    setupAuth();
    const boards = [makeBoard("b-1", "Alpha", true)];
    mockListBoards.mockResolvedValue(boards);
    mockSetFavorite.mockResolvedValue({ ...boards[0], is_favorite: false });

    render(<Sidebar collapsed={false} onToggle={jest.fn()} />);
    // Alpha appears in both Favorites and Projects
    await waitFor(() => expect(screen.getAllByText("Alpha")).toHaveLength(2));

    const removeBtn = screen.getAllByRole("button", { name: "Remove from favorites" })[0];
    await user.click(removeBtn);

    expect(mockSetFavorite).toHaveBeenCalledWith("tok", "b-1", false);
  });
});
