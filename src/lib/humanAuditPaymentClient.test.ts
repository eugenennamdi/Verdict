import { describe, expect, it, vi } from "vitest";
import { base, baseSepolia } from "viem/chains";
import {
  createHumanAuditX402Signer,
  purchaseHumanAuditEntitlement,
  type HumanAuditWalletClient,
} from "./humanAuditPaymentClient";

const ADDRESS = "0x71A40000000000000000000000000000000082F1" as const;

function mockWalletClient(
  chain: typeof base | typeof baseSepolia,
  signTypedData = vi.fn().mockResolvedValue(`0x${"ab".repeat(65)}`)
): HumanAuditWalletClient {
  return {
    account: { address: ADDRESS },
    chain,
    signTypedData,
  } as unknown as HumanAuditWalletClient;
}

describe("human audit x402 wallet signer", () => {
  it("delegates x402 typed-data authorization to the connected viem WalletClient", async () => {
    const signTypedData = vi.fn().mockResolvedValue(`0x${"ab".repeat(65)}`);
    const walletClient = mockWalletClient(baseSepolia, signTypedData);
    const signer = createHumanAuditX402Signer(walletClient);

    await signer.signTypedData({
      domain: { name: "USDC" },
      types: { TransferWithAuthorization: [] },
      primaryType: "TransferWithAuthorization",
      message: { from: ADDRESS },
    });

    expect(signer.address).toBe(ADDRESS);
    expect(signTypedData).toHaveBeenCalledOnce();
    expect(signTypedData.mock.calls[0][0]).toMatchObject({
      account: { address: ADDRESS },
      primaryType: "TransferWithAuthorization",
      message: { from: ADDRESS },
    });
  });

  it("cannot create a signer without a connected account", () => {
    const walletClient = {
      account: undefined,
      chain: baseSepolia,
    } as unknown as HumanAuditWalletClient;
    expect(() => createHumanAuditX402Signer(walletClient)).toThrow(
      "connected wallet account"
    );
  });

  it("refuses the wrong network before making an entitlement request", async () => {
    const fetchImpl = vi.fn();
    await expect(
      purchaseHumanAuditEntitlement({
        walletClient: mockWalletClient(base),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toThrow("wrong payment network");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
