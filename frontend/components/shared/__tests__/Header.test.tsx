import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "@/components/shared/Header";
import { useAuth } from "@/context/AuthContext";

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn() };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/my-tasks",
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/shared/NotificationBell", () => ({
  NotificationBell: () => <button aria-label="Notifications bell stub" />,
}));

const mockUseAuth = useAuth as jest.Mock;

describe("Header", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("renders nothing when signed out", () => {
    mockUseAuth.mockReturnValue({ token: null, currentUser: null, logout: jest.fn() });
    const { container } = render(<Header />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows navigation links, user name and bell when signed in", () => {
    mockUseAuth.mockReturnValue({
      token: "t",
      currentUser: { id: "u", email: "a@b.co", name: "Ann", role: "member", timezone: "UTC" },
      logout: jest.fn(),
    });
    render(<Header />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("href", "/my-tasks");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications bell stub" })).toBeInTheDocument();
  });

  it("falls back to the email when the user has no name", () => {
    mockUseAuth.mockReturnValue({
      token: "t",
      currentUser: { id: "u", email: "a@b.co", name: null, role: "member", timezone: "UTC" },
      logout: jest.fn(),
    });
    render(<Header />);
    expect(screen.getByText("a@b.co")).toBeInTheDocument();
  });

  it("logs out and navigates to /login", async () => {
    const logout = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      token: "t",
      currentUser: { id: "u", email: "a@b.co", name: "Ann", role: "member", timezone: "UTC" },
      logout,
    });
    render(<Header />);
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("toggles the mobile menu with aria-expanded", async () => {
    mockUseAuth.mockReturnValue({
      token: "t",
      currentUser: { id: "u", email: "a@b.co", name: "Ann", role: "member", timezone: "UTC" },
      logout: jest.fn(),
    });
    render(<Header />);
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("navigation", { name: "Main" })).toHaveClass("hidden");
    await userEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Main" })).toHaveClass("flex");
    expect(screen.getByRole("navigation", { name: "Main" })).not.toHaveClass("hidden");
    await userEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });
});
