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

  it("shows the email read-only and the user id, and no role", () => {
    render(<ProfilePage />);
    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("ann@example.com");
    expect(email).toHaveAttribute("readonly");
    expect(screen.queryByText("Role")).not.toBeInTheDocument();
    expect(screen.queryByText("user")).not.toBeInTheDocument();
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
    await userEvent.type(screen.getByLabelText("Name"), "x");
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

  describe("unsaved changes, reset, counter and avatar", () => {
    let addSpy: jest.SpyInstance;
    let removeSpy: jest.SpyInstance;
    const count = (spy: jest.SpyInstance) =>
      spy.mock.calls.filter((c) => c[0] === "beforeunload").length;

    beforeEach(() => {
      addSpy = jest.spyOn(window, "addEventListener");
      removeSpy = jest.spyOn(window, "removeEventListener");
    });
    afterEach(() => {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it("disables Save and Reset with an explanation when clean, enables them after a change", async () => {
      render(<ProfilePage />);
      const save = screen.getByRole("button", { name: "Save changes" });
      const reset = screen.getByRole("button", { name: "Reset" });
      expect(save).toBeDisabled();
      expect(reset).toBeDisabled();
      expect(save).toHaveAccessibleDescription("No changes to save");

      await userEvent.type(screen.getByLabelText("Name"), "x");
      expect(save).toBeEnabled();
      expect(reset).toBeEnabled();
      expect(screen.queryByText("No changes to save")).not.toBeInTheDocument();
    });

    it("treats a whitespace-only edit as clean", async () => {
      render(<ProfilePage />);
      await userEvent.type(screen.getByLabelText("Name"), "   ");
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    });

    it("reset restores saved values and the form is clean again", async () => {
      render(<ProfilePage />);
      await userEvent.type(screen.getByLabelText("Name"), " Smith");
      await userEvent.selectOptions(screen.getByLabelText("Timezone"), "Europe/Paris");
      await userEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(screen.getByLabelText("Name")).toHaveValue("Ann");
      expect(screen.getByLabelText("Timezone")).toHaveValue("UTC");
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    });

    it("clears field errors on reset", async () => {
      render(<ProfilePage />);
      const name = screen.getByLabelText("Name");
      await userEvent.click(name);
      await userEvent.paste("x".repeat(256));
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(/255/);
      await userEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(name).toHaveValue("Ann");
    });

    it("registers beforeunload only while dirty and removes it after reset", async () => {
      render(<ProfilePage />);
      expect(count(addSpy)).toBe(0);

      await userEvent.type(screen.getByLabelText("Name"), "x");
      expect(count(addSpy)).toBe(1);
      expect(count(removeSpy)).toBe(0);

      await userEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(count(removeSpy)).toBe(1);
    });

    it("removes beforeunload after a successful save and the form becomes clean", async () => {
      routeFetch(fetchMock, {
        "PATCH /api/users/me": jsonResponse(200, { data: { ...user, name: "Annie" } }),
      });
      render(<ProfilePage />);
      await userEvent.type(screen.getByLabelText("Name"), "nie");
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Profile saved successfully.")).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveValue("Annie");
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
      expect(count(addSpy)).toBe(1);
      expect(count(removeSpy)).toBe(1);
    });

    it("keeps typed values and stays dirty after a failed save", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      render(<ProfilePage />);
      await userEvent.type(screen.getByLabelText("Name"), "x");
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveValue("Annx");
      expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
      expect(count(removeSpy)).toBe(0);
    });

    it("updates the character counter, which describes the name input", async () => {
      render(<ProfilePage />);
      const name = screen.getByLabelText("Name");
      expect(name).toHaveAccessibleDescription("3 / 255");
      await userEvent.type(name, "ab");
      expect(name).toHaveAccessibleDescription("5 / 255");
    });

    it("announces remaining characters only near the limit", async () => {
      render(<ProfilePage />);
      expect(screen.queryByText(/characters remaining/)).not.toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("Name"), "x");
      expect(screen.queryByText(/characters remaining/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByLabelText("Name"));
      await userEvent.paste("y".repeat(235));
      expect(screen.getByText(/characters remaining/)).toBeInTheDocument();
    });

    it("shows a decorative initials avatar with the name and email as text", () => {
      render(<ProfilePage />);
      const avatar = screen.getByText("A");
      expect(avatar).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByText("Ann")).toBeInTheDocument();
      expect(screen.getByText("ann@example.com")).toBeInTheDocument();
    });
  });
});
