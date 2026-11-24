import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfilePage from "@/app/profile/page";
import { useAuth } from "@/context/AuthContext";
import { errorResponse, jsonResponse, routeFetch } from "@/tests/fetchRoutes";

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn() };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/profile",
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const fetchMock = jest.fn();
const mockUpdateProfile = jest.fn();
const user = {
  id: "u-1",
  email: "ann@example.com",
  name: "Ann",
  role: "user",
  timezone: "UTC",
};

describe("ProfilePage", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockUpdateProfile.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    (useAuth as jest.Mock).mockReturnValue({
      token: "tok",
      currentUser: user,
      isLoading: false,
      updateProfile: mockUpdateProfile,
    });
  });

  it("shows the email read-only, the role badge and the user id", () => {
    render(<ProfilePage />);
    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("ann@example.com");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByText("user")).toBeInTheDocument();
    expect(screen.getByText("u-1")).toBeInTheDocument();
  });

  it("sends exactly {name, timezone} and never email", async () => {
    const calls = routeFetch(fetchMock, {
      "PATCH /api/users/me": jsonResponse(200, {
        data: { ...user, name: "Ann B", timezone: "Europe/Paris" },
      }),
    });
    render(<ProfilePage />);
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "  Ann B ");
    await userEvent.selectOptions(screen.getByLabelText("Timezone"), "Europe/Paris");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved successfully.");
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ name: "Ann B", timezone: "Europe/Paris" });
    expect(Object.keys(calls[0].body as object)).not.toContain("email");
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
    expect(mockUpdateProfile).toHaveBeenCalledWith({ name: "Ann B", timezone: "Europe/Paris" });
  });

  it("shows server validation errors under the field and keeps the typed values", async () => {
    routeFetch(fetchMock, {
      "PATCH /api/users/me": errorResponse(400, "VALIDATION_ERROR", "bad", {
        timezone: ["'Mars/Base' is not a valid IANA timezone."],
      }),
    });
    render(<ProfilePage />);
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Keep me");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not a valid IANA timezone/);
    expect(screen.getByLabelText("Name")).toHaveValue("Keep me");
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("shows a general error when the request fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ProfilePage />);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toHaveTextContent("");
  });

  it("rejects a name longer than 255 characters without a request", async () => {
    const calls = routeFetch(fetchMock, {});
    render(<ProfilePage />);
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.click(name);
    await userEvent.paste("x".repeat(256));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/255/);
    expect(calls).toHaveLength(0);
  });

  it("redirects to /login?next= when signed out", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      token: null,
      currentUser: null,
      isLoading: false,
      updateProfile: mockUpdateProfile,
    });
    render(<ProfilePage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fprofile"));
    expect(screen.getByLabelText("Loading profile")).toBeInTheDocument();
  });
});
