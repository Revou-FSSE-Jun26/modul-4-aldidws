import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { useAuth } from "@/context/AuthContext";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
const mockUseAuth = useAuth as jest.Mock;

const fetchMock = jest.fn();

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const items = [
  {
    id: "n1",
    user_id: "u",
    title: "New comment on Fix bug",
    body: "Looks good",
    is_read: false,
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:00:00Z",
  },
  {
    id: "n2",
    user_id: "u",
    title: "Old one",
    body: "Done",
    is_read: true,
    created_at: "2026-01-01T09:00:00Z",
    updated_at: "2026-01-01T09:00:00Z",
  },
];

describe("NotificationBell", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({ token: "tok", isLoading: false });
  });

  it("shows the unread count from meta.unread_count", async () => {
    fetchMock.mockResolvedValue(
      ok({ data: items, meta: { page: 1, per_page: 20, total: 2, unread_count: 5 } }),
    );
    render(<NotificationBell />);
    expect(
      await screen.findByRole("button", { name: "Notifications — 5 unread" }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/notifications$/);
  });

  it("opens the panel, marks an unread item read with PATCH and decrements the count", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ data: items, meta: { page: 1, per_page: 20, total: 2, unread_count: 1 } }),
    );
    render(<NotificationBell />);
    const bell = await screen.findByRole("button", { name: "Notifications — 1 unread" });
    await userEvent.click(bell);
    expect(bell).toHaveAttribute("aria-expanded", "true");

    fetchMock.mockResolvedValueOnce(ok({ data: { ...items[0], is_read: true } }));
    await userEvent.click(screen.getByRole("button", { name: /New comment on Fix bug/ }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Notifications — none unread" }),
      ).toBeInTheDocument(),
    );
    const patchCall = fetchMock.mock.calls[1];
    expect(String(patchCall[0])).toMatch(/\/api\/notifications\/n1\/read$/);
    expect(patchCall[1].method).toBe("PATCH");
  });

  it("does not send a request when an already-read item is clicked", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ data: items, meta: { page: 1, per_page: 20, total: 2, unread_count: 1 } }),
    );
    render(<NotificationBell />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Notifications — 1 unread" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Old one/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows fetch errors in the panel instead of hiding them", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: "INTERNAL_ERROR", message: "Server broke" } }),
    });
    render(<NotificationBell />);
    await userEvent.click(
      await screen.findByRole("button", { name: /Notifications/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Server broke");
  });

  it("shows an empty message when there are no notifications", async () => {
    fetchMock.mockResolvedValue(
      ok({ data: [], meta: { page: 1, per_page: 20, total: 0, unread_count: 0 } }),
    );
    render(<NotificationBell />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Notifications — none unread" }),
    );
    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  });

  it("does not fetch when signed out", () => {
    mockUseAuth.mockReturnValue({ token: null, isLoading: false });
    render(<NotificationBell />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
