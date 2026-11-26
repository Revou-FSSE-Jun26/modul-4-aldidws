import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/components/shared/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUsePathname = usePathname as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

const mockPush = jest.fn();
const mockReplace = jest.fn();

function setupRouter() {
  mockUseRouter.mockReturnValue({ push: mockPush, replace: mockReplace });
}

function setupAuth(override?: Partial<ReturnType<typeof useAuth>>) {
  mockUseAuth.mockReturnValue({
    currentUser: { id: "1", name: "Alice Smith", email: "alice@example.com", role: "member", timezone: "UTC" },
    logout: jest.fn(),
    ...override,
  });
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function clearLS() {
  localStorage.clear();
}

// ---------------------------------------------------------------------------
// D1 — Collapsible sidebar, localStorage persistence
// ---------------------------------------------------------------------------

describe("D1 — Sidebar collapse", () => {
  beforeEach(() => {
    clearLS();
    setupAuth();
    setupRouter();
    mockUsePathname.mockReturnValue("/");
  });

  it("renders expanded by default (data-collapsed=false)", () => {
    const { container } = render(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside).toHaveAttribute("data-collapsed", "false");
  });

  it("toggle button has aria-label 'Collapse sidebar' when expanded", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("clicking toggle sets data-collapsed=true and updates aria-label", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(container.querySelector("aside")).toHaveAttribute("data-collapsed", "true");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  it("persists collapsed state to localStorage", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(localStorage.getItem("sidebar-collapsed")).toBe("true");
  });

  it("reads collapsed=true from localStorage on mount", () => {
    localStorage.setItem("sidebar-collapsed", "true");
    const { container } = render(<Sidebar />);
    expect(container.querySelector("aside")).toHaveAttribute("data-collapsed", "true");
  });

  it("reads collapsed=false from localStorage on mount", () => {
    localStorage.setItem("sidebar-collapsed", "false");
    const { container } = render(<Sidebar />);
    expect(container.querySelector("aside")).toHaveAttribute("data-collapsed", "false");
  });
});

// ---------------------------------------------------------------------------
// D2 — Navigation links
// ---------------------------------------------------------------------------

describe("D2 — Nav links", () => {
  beforeEach(() => {
    clearLS();
    setupAuth();
    setupRouter();
  });

  it("active link has aria-current=page when on /my-tasks", () => {
    mockUsePathname.mockReturnValue("/my-tasks");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("active link has aria-current=page when on /", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My Tasks" })).not.toHaveAttribute("aria-current");
  });

  it("active link has aria-current=page when on /profile", () => {
    mockUsePathname.mockReturnValue("/profile");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  });

  it("Notes, Inbox, and Reports are active nav links", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Sidebar />);
    const active = ["Notes", "Inbox", "Reports"];
    for (const label of active) {
      const el = screen.getByRole("link", { name: label });
      expect(el).toHaveAttribute("href");
      expect(el).not.toHaveAttribute("aria-disabled");
    }
  });

  it("renders real links for Dashboard, My Tasks, Profile", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("href", "/my-tasks");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
  });
});

// ---------------------------------------------------------------------------
// D5 — User row
// ---------------------------------------------------------------------------

describe("D5 — User row", () => {
  beforeEach(() => {
    clearLS();
    setupRouter();
    mockUsePathname.mockReturnValue("/");
  });

  it("shows user name and email when expanded", () => {
    setupAuth();
    render(<Sidebar />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("hides email when collapsed", async () => {
    setupAuth();
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
  });

  it("user menu trigger has aria-label 'User menu for <name>'", () => {
    setupAuth();
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: "User menu for Alice Smith" })).toBeInTheDocument();
  });

  it("user menu contains Profile and Sign out items", async () => {
    setupAuth();
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: "User menu for Alice Smith" }));
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
  });

  it("Sign out calls logout()", async () => {
    const logout = jest.fn().mockResolvedValue(undefined);
    setupAuth({ logout });
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole("button", { name: "User menu for Alice Smith" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("does not render user row when currentUser is null", () => {
    mockUseAuth.mockReturnValue({ currentUser: null, logout: jest.fn() });
    render(<Sidebar />);
    expect(screen.queryByRole("button", { name: /user menu/i })).not.toBeInTheDocument();
  });
});

