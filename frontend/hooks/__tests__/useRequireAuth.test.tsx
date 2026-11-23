import { render, screen } from "@testing-library/react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";

const mockReplace = jest.fn();
const mockPush = jest.fn();
// Stable object, like the real useRouter(), so effects do not re-run each render.
const mockRouter = { replace: mockReplace, push: mockPush };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

function Probe() {
  const { token, isAuthLoading } = useRequireAuth();
  return (
    <p>{isAuthLoading ? "loading" : token ? "signed in" : "signed out"}</p>
  );
}

describe("useRequireAuth", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("does not redirect while auth is loading", () => {
    mockUseAuth.mockReturnValue({ token: null, isLoading: true });
    render(<Probe />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to /login once loading ends without a token", () => {
    mockUseAuth.mockReturnValue({ token: null, isLoading: false });
    render(<Probe />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("does not redirect when a token is present", () => {
    mockUseAuth.mockReturnValue({ token: "test-token", isLoading: false });
    render(<Probe />);
    expect(screen.getByText("signed in")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
