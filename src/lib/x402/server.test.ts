import { describe, expect, it } from "vitest";
import {
  createVerdictAuditPaymentConfig,
  DEFAULT_VERDICT_AUDIT_PRICE,
  loadVerdictX402Config,
  VERDICT_X402_NETWORKS,
  VerdictX402ConfigurationError,
} from "@/lib/x402/server";

const PAY_TO = "0x1111111111111111111111111111111111111111";

function environment(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    VERDICT_X402_NETWORK: VERDICT_X402_NETWORKS.baseSepolia,
    VERDICT_X402_PAY_TO: PAY_TO,
    VERDICT_X402_FACILITATOR_URL: "https://x402.org/facilitator",
    ...overrides,
  };
}

describe("Verdict x402 server configuration", () => {
  it("loads the Base Sepolia defaults from the environment", () => {
    const config = loadVerdictX402Config(
      environment({ SELLER_PRIVATE_KEY: "never-return-this-private-key" })
    );

    expect(config).toEqual({
      network: "eip155:84532",
      price: DEFAULT_VERDICT_AUDIT_PRICE,
      payTo: PAY_TO,
      facilitatorUrl: "https://x402.org/facilitator",
    });
    expect(JSON.stringify(config)).not.toContain("never-return-this-private-key");
  });

  it("creates exactly one Base exact-payment option", () => {
    const config = loadVerdictX402Config(
      environment({ VERDICT_X402_AUDIT_PRICE: "$0.75" })
    );

    expect(createVerdictAuditPaymentConfig(config)).toMatchObject({
      accepts: [
        {
          scheme: "exact",
          network: "eip155:84532",
          price: "$0.75",
          payTo: PAY_TO,
        },
      ],
      description: "Autonomous Verdict growth investigation",
      mimeType: "application/json",
    });
  });

  it("fails clearly when required configuration is missing", () => {
    expect(() =>
      loadVerdictX402Config({ NODE_ENV: "test" })
    ).toThrowError(
      new VerdictX402ConfigurationError(
        "Missing required x402 configuration: VERDICT_X402_NETWORK, VERDICT_X402_PAY_TO, VERDICT_X402_FACILITATOR_URL"
      )
    );
  });

  it("rejects invalid receiving addresses and prices", () => {
    expect(() =>
      loadVerdictX402Config(
        environment({ VERDICT_X402_PAY_TO: "not-an-address" })
      )
    ).toThrow("VERDICT_X402_PAY_TO must be a valid EVM address");

    expect(() =>
      loadVerdictX402Config(
        environment({ VERDICT_X402_AUDIT_PRICE: "0.50" })
      )
    ).toThrow("VERDICT_X402_AUDIT_PRICE must be a positive USD amount");
  });

  it("rejects the test-only facilitator for Base Mainnet", () => {
    expect(() =>
      loadVerdictX402Config(
        environment({
          NODE_ENV: "production",
          VERDICT_X402_NETWORK: VERDICT_X402_NETWORKS.baseMainnet,
        })
      )
    ).toThrow("The x402.org facilitator is testnet-only");
  });

  it("rejects a testnet network in production", () => {
    expect(() =>
      loadVerdictX402Config(
        environment({
          NODE_ENV: "production",
          VERDICT_X402_FACILITATOR_URL:
            "https://facilitator.payai.network",
        })
      )
    ).toThrow(
      "Production x402 configuration must use Base Mainnet (eip155:8453)"
    );
  });

  it("accepts an environment-configured production facilitator", () => {
    const config = loadVerdictX402Config(
      environment({
        NODE_ENV: "production",
        VERDICT_X402_NETWORK: VERDICT_X402_NETWORKS.baseMainnet,
        VERDICT_X402_FACILITATOR_URL:
          "https://facilitator.payai.network",
      })
    );

    expect(config.network).toBe("eip155:8453");
    expect(config.facilitatorUrl).toBe(
      "https://facilitator.payai.network"
    );
  });
});
