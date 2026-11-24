import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";
import { useAuth } from "@/context/AuthContext";

const mockPush = jest.fn();
let mockSearch = "";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

async function submit() {
  await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
  await userEvent.type(screen.getByLabelText("Password"), "secret-pw");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage return path", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearch = "";
    mockUseAuth.mockReturnValue({ login: jest.fn().mockResolvedValue(undefined) });
  });

  it("goes to / when there is no next param", async () => {
    render(<LoginPage />);
    await submit();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  it("returns to the requested same-origin path", async () => {
    mockSearch = "next=%2Fboards%2Fx";
    render(<LoginPage />);
    await submit();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/boards/x"));
  });

  it.each(["//evil.com", "https://evil.com", "%2F%2Fevil.com", "javascript:alert(1)"])(
    "rejects an unsafe next value %s",
    async (value) => {
      mockSearch = `next=${value}`;
      render(<LoginPage />);
      await submit();
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    },
  );

  it("stays on the page and shows an alert when login fails", async () => {
    mockSearch = "next=%2Fboards%2Fx";
    mockUseAuth.mockReturnValue({ login: jest.fn().mockRejectedValue(new Error("no")) });
    render(<LoginPage />);
    await submit();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
