import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WalletConnect from "../WalletConnect";

// ── Mock @/lib/wallet so we never touch the real Freighter extension ──────────
jest.mock("@/lib/wallet", () => ({
  isFreighterInstalled: jest.fn(),
  connectWallet: jest.fn(),
}));

import { isFreighterInstalled, connectWallet } from "@/lib/wallet";

const mockInstalled = isFreighterInstalled as jest.MockedFunction<typeof isFreighterInstalled>;
const mockConnect   = connectWallet        as jest.MockedFunction<typeof connectWallet>;

const PUBLIC_KEY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// window.open is called when Freighter is not installed
const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Disconnected (default) state ──────────────────────────────────────────────

describe("disconnected state", () => {
  it("renders a connect button with an accessible name", () => {
    render(<WalletConnect onConnect={jest.fn()} />);

    expect(
      screen.getByRole("button", { name: /connect freighter wallet/i })
    ).toBeInTheDocument();
  });

  it("connect button is enabled before any interaction", () => {
    render(<WalletConnect onConnect={jest.fn()} />);
    expect(screen.getByRole("button", { name: /connect freighter wallet/i })).toBeEnabled();
  });
});

// ── Successful connection ─────────────────────────────────────────────────────

describe("successful connection", () => {
  beforeEach(() => {
    mockInstalled.mockResolvedValue(true);
    mockConnect.mockResolvedValue({ publicKey: PUBLIC_KEY, error: null });
  });

  it("calls onConnect with the public key returned by connectWallet", async () => {
    const onConnect = jest.fn();
    render(<WalletConnect onConnect={onConnect} />);

    await userEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() => expect(onConnect).toHaveBeenCalledWith(PUBLIC_KEY));
  });

  it("does not surface an error message on success", async () => {
    render(<WalletConnect onConnect={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() => expect(mockConnect).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("button becomes enabled again after a successful connect", async () => {
    render(<WalletConnect onConnect={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /connect freighter wallet/i })).toBeEnabled()
    );
  });
});

// ── Freighter not installed ───────────────────────────────────────────────────

describe("Freighter not installed", () => {
  beforeEach(() => {
    mockInstalled.mockResolvedValue(false);
  });

  it("opens the Freighter install page instead of crashing", async () => {
    render(<WalletConnect onConnect={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() => expect(openSpy).toHaveBeenCalledWith("https://freighter.app", "_blank"));
  });

  it("never calls connectWallet when Freighter is absent", async () => {
    render(<WalletConnect onConnect={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("surfaces the static install hint link so users know what to do", () => {
    render(<WalletConnect onConnect={jest.fn()} />);
    // The component always renders "Install Freighter →" as a fallback hint
    expect(screen.getByRole("link", { name: /install freighter/i })).toHaveAttribute(
      "href",
      "https://freighter.app"
    );
  });

  it("re-enables the connect button after the install redirect", async () => {
    render(<WalletConnect onConnect={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /connect freighter wallet/i })).toBeEnabled()
    );
  });
});

// ── User rejects the connection prompt ───────────────────────────────────────

describe("user rejection", () => {
  beforeEach(() => {
    mockInstalled.mockResolvedValue(true);
    mockConnect.mockResolvedValue({ publicKey: null, error: "Connection rejected." });
  });

  it("shows the rejection message without crashing", async () => {
    render(<WalletConnect onConnect={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() =>
      expect(screen.getByText("Connection rejected.")).toBeInTheDocument()
    );
  });

  it("does not call onConnect when the user rejects", async () => {
    const onConnect = jest.fn();
    render(<WalletConnect onConnect={onConnect} />);

    await userEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() => expect(mockConnect).toHaveBeenCalled());
    expect(onConnect).not.toHaveBeenCalled();
  });

  it("re-enables the connect button after rejection so the user can retry", async () => {
    render(<WalletConnect onConnect={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /connect freighter wallet/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /connect freighter wallet/i })).toBeEnabled()
    );
  });
});

// ── Disconnect flow (parent-driven) ──────────────────────────────────────────
//
// WalletConnect itself has no disconnect button — the parent component is
// responsible for swapping WalletConnect out once onConnect fires. The test
// below documents this contract: a second render (simulating the parent
// re-mounting WalletConnect after the user logs out) starts fresh.

describe("disconnect flow (parent re-mount)", () => {
  it("returns to the connect button when re-mounted after disconnect", () => {
    mockInstalled.mockResolvedValue(true);
    mockConnect.mockResolvedValue({ publicKey: PUBLIC_KEY, error: null });

    const { unmount } = render(<WalletConnect onConnect={jest.fn()} />);
    unmount();

    // Parent re-mounts after clearing its own connected state
    render(<WalletConnect onConnect={jest.fn()} />);

    expect(
      screen.getByRole("button", { name: /connect freighter wallet/i })
    ).toBeInTheDocument();
  });
});
