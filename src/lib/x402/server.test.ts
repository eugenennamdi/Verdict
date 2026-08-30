import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  createVerdictAuditPaymentConfig,
  createVerdictHumanEntitlementPaymentConfig,
  createVerdictFacilitatorClient,
  createVerdictX402ResourceServer,
  DEFAULT_VERDICT_AUDIT_PRICE,
  loadVerdictX402Config,
  VERDICT_CDP_FACILITATOR_URL,
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

function productionEnvironment(
  overrides: Record<string, string | undefined> = {}
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    VERDICT_X402_NETWORK: VERDICT_X402_NETWORKS.baseMainnet,
    VERDICT_X402_PAY_TO: PAY_TO,
    VERDICT_X402_FACILITATOR_URL: VERDICT_CDP_FACILITATOR_URL,
    CDP_API_KEY_ID: "test-key-id",
    CDP_API_KEY_SECRET: "test-key-secret",
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

  it("isolates upfront settlement to the human entitlement purchase", () => {
    const config = loadVerdictX402Config(environment());
    expect(createVerdictAuditPaymentConfig(config).accepts).toEqual([
      {
        scheme: "exact",
        network: "eip155:84532",
        price: "$0.50",
        payTo: PAY_TO,
      },
    ]);
    expect(createVerdictHumanEntitlementPaymentConfig(config)).toMatchObject({
      accepts: [
        {
          scheme: "exact",
          network: "eip155:84532",
          price: "$0.50",
          payTo: PAY_TO,
          extra: { paymentFlow: "upfront" },
        },
      ],
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

  it("requires the selected CDP facilitator for Base Mainnet", () => {
    expect(() =>
      loadVerdictX402Config(
        productionEnvironment({
          VERDICT_X402_FACILITATOR_URL:
            "https://facilitator.example.com",
        })
      )
    ).toThrow("Base Mainnet x402 configuration must use the CDP facilitator");
  });

  it("rejects the production CDP facilitator on Base Sepolia", () => {
    expect(() =>
      loadVerdictX402Config(
        environment({
          VERDICT_X402_FACILITATOR_URL: VERDICT_CDP_FACILITATOR_URL,
        })
      )
    ).toThrow("The CDP production facilitator requires Base Mainnet");
  });

  it("accepts the authenticated CDP production facilitator", () => {
    const config = loadVerdictX402Config(productionEnvironment());

    expect(config.network).toBe("eip155:8453");
    expect(config.facilitatorUrl).toBe(VERDICT_CDP_FACILITATOR_URL);
    expect(config.facilitatorAuth).toBe("cdp");
  });

  it("requires both CDP credentials without exposing their values", () => {
    const secret = "never-expose-this-cdp-secret";

    for (const [missing, expected] of [
      ["CDP_API_KEY_ID", "CDP_API_KEY_ID"],
      ["CDP_API_KEY_SECRET", "CDP_API_KEY_SECRET"],
    ] as const) {
      const env = productionEnvironment({
        CDP_API_KEY_ID: missing === "CDP_API_KEY_ID" ? undefined : "key-id",
        CDP_API_KEY_SECRET:
          missing === "CDP_API_KEY_SECRET" ? undefined : secret,
      });

      let message = "";
      try {
        loadVerdictX402Config(env);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain(expected);
      expect(message).not.toContain(secret);
    }
  });

  it("keeps the Sepolia facilitator unauthenticated", async () => {
    const createCdpFacilitatorClient = vi.fn(() => {
      throw new Error("must not be called");
    });
    const config = loadVerdictX402Config(environment());
    const facilitator = createVerdictFacilitatorClient(config, {
      env: environment(),
      createCdpFacilitatorClient,
    });

    expect(await facilitator.createAuthHeaders("supported")).toEqual({
      headers: {},
    });
    expect(createCdpFacilitatorClient).not.toHaveBeenCalled();
  });

  it("initializes Base Mainnet with the official CDP facilitator client", async () => {
    const env = productionEnvironment();
    const config = loadVerdictX402Config(env);
    const officialClient = new HTTPFacilitatorClient({
      url: VERDICT_CDP_FACILITATOR_URL,
    });
    const getSupported = vi.spyOn(officialClient, "getSupported").mockResolvedValue({
      kinds: [
        {
          x402Version: 2,
          scheme: "exact",
          network: VERDICT_X402_NETWORKS.baseMainnet,
        },
      ],
      extensions: [],
      signers: {},
    });
    const createCdpFacilitatorClient = vi.fn(() => officialClient);
    const facilitator = createVerdictFacilitatorClient(
      config,
      { env, createCdpFacilitatorClient }
    );
    const server = createVerdictX402ResourceServer(config, facilitator);

    await server.initialize();

    expect(facilitator).toBe(officialClient);
    expect(createCdpFacilitatorClient).toHaveBeenCalledOnce();
    expect(createCdpFacilitatorClient).toHaveBeenCalledWith();
    expect(getSupported).toHaveBeenCalledOnce();
    expect(server.getSupportedKind(2, config.network, "exact")).toMatchObject({
      x402Version: 2,
      scheme: "exact",
      network: config.network,
    });
  });

  it("sanitizes official CDP facilitator initialization failures", () => {
    const secret = "never-expose-this-cdp-secret";
    const env = productionEnvironment({ CDP_API_KEY_SECRET: secret });
    let message = "";
    try {
      createVerdictFacilitatorClient(loadVerdictX402Config(env), {
        env,
        createCdpFacilitatorClient: () => {
          throw new Error(`invalid credential ${secret}`);
        },
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("CDP facilitator could not initialize");
    expect(message).not.toContain(secret);
  });

  it("contains no custom CDP JWT or auth-header implementation", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/x402/server.ts"),
      "utf8"
    );

    expect(source).toContain(
      'createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402"'
    );
    expect(source).not.toContain("generateJwt");
    expect(source).not.toContain("createAuthHeaders");
    expect(source).not.toContain("authorizationHeader");
  });
});
