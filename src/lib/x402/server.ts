import { isAddress } from "ethers";
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import {
  HTTPFacilitatorClient,
  type FacilitatorClient,
  type RouteConfig,
  x402ResourceServer,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { withX402 } from "@x402/next";
import type { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_VERDICT_AUDIT_PRICE,
  VERDICT_AUDIT_DESCRIPTION,
  VERDICT_CDP_FACILITATOR_URL,
  VERDICT_X402_NETWORKS,
  type VerdictX402Network,
} from "@/lib/x402/constants";

export {
  DEFAULT_VERDICT_AUDIT_PRICE,
  VERDICT_AUDIT_DESCRIPTION,
  VERDICT_CDP_FACILITATOR_URL,
  VERDICT_X402_NETWORKS,
} from "@/lib/x402/constants";
export type { VerdictX402Network } from "@/lib/x402/constants";

const REQUIRED_ENV = [
  "VERDICT_X402_NETWORK",
  "VERDICT_X402_PAY_TO",
  "VERDICT_X402_FACILITATOR_URL",
] as const;

const REQUIRED_CDP_ENV = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"] as const;

export type VerdictX402Config = {
  network: VerdictX402Network;
  price: string;
  payTo: `0x${string}`;
  facilitatorUrl: string;
  facilitatorAuth?: "cdp";
};

type GenerateCdpJwt = typeof generateJwt;

type VerdictFacilitatorClientOptions = {
  env?: NodeJS.ProcessEnv;
  generateJwt?: GenerateCdpJwt;
};

export class VerdictX402ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerdictX402ConfigurationError";
  }
}

function requiredValue(
  env: NodeJS.ProcessEnv,
  name: (typeof REQUIRED_ENV)[number]
): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new VerdictX402ConfigurationError(
      `Missing required x402 configuration: ${name}`
    );
  }
  return value;
}

function parseNetwork(value: string): VerdictX402Network {
  if (
    value !== VERDICT_X402_NETWORKS.baseMainnet &&
    value !== VERDICT_X402_NETWORKS.baseSepolia
  ) {
    throw new VerdictX402ConfigurationError(
      "VERDICT_X402_NETWORK must be eip155:84532 (Base Sepolia) or eip155:8453 (Base Mainnet)"
    );
  }
  return value;
}

function parsePrice(value: string): string {
  if (!/^\$(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) {
    throw new VerdictX402ConfigurationError(
      "VERDICT_X402_AUDIT_PRICE must be a positive USD amount such as $0.50"
    );
  }
  const numeric = Number(value.slice(1));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new VerdictX402ConfigurationError(
      "VERDICT_X402_AUDIT_PRICE must be greater than zero"
    );
  }
  return value;
}

function parseFacilitatorUrl(raw: string, network: VerdictX402Network): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new VerdictX402ConfigurationError(
      "VERDICT_X402_FACILITATOR_URL must be a valid URL"
    );
  }

  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new VerdictX402ConfigurationError(
      "VERDICT_X402_FACILITATOR_URL must use HTTPS (HTTP is allowed only for a local facilitator)"
    );
  }
  if (parsed.username || parsed.password) {
    throw new VerdictX402ConfigurationError(
      "VERDICT_X402_FACILITATOR_URL must not contain credentials"
    );
  }
  if (
    network === VERDICT_X402_NETWORKS.baseMainnet &&
    (parsed.hostname === "x402.org" || parsed.hostname.endsWith(".x402.org"))
  ) {
    throw new VerdictX402ConfigurationError(
      "The x402.org facilitator is testnet-only and cannot be used with Base Mainnet"
    );
  }

  return parsed.href.replace(/\/$/, "");
}

export function loadVerdictX402Config(
  env: NodeJS.ProcessEnv = process.env
): VerdictX402Config {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new VerdictX402ConfigurationError(
      `Missing required x402 configuration: ${missing.join(", ")}`
    );
  }

  const network = parseNetwork(requiredValue(env, "VERDICT_X402_NETWORK"));
  const expectedNetwork =
    env.NODE_ENV === "production"
      ? VERDICT_X402_NETWORKS.baseMainnet
      : VERDICT_X402_NETWORKS.baseSepolia;
  if (network !== expectedNetwork) {
    throw new VerdictX402ConfigurationError(
      env.NODE_ENV === "production"
        ? "Production x402 configuration must use Base Mainnet (eip155:8453)"
        : "Development/test x402 configuration must use Base Sepolia (eip155:84532)"
    );
  }
  const payTo = requiredValue(env, "VERDICT_X402_PAY_TO");
  if (!isAddress(payTo)) {
    throw new VerdictX402ConfigurationError(
      "VERDICT_X402_PAY_TO must be a valid EVM address"
    );
  }

  const facilitatorUrl = parseFacilitatorUrl(
    requiredValue(env, "VERDICT_X402_FACILITATOR_URL"),
    network
  );
  const usesCdpFacilitator = facilitatorUrl === VERDICT_CDP_FACILITATOR_URL;

  if (
    network === VERDICT_X402_NETWORKS.baseMainnet &&
    !usesCdpFacilitator
  ) {
    throw new VerdictX402ConfigurationError(
      `Base Mainnet x402 configuration must use the CDP facilitator at ${VERDICT_CDP_FACILITATOR_URL}`
    );
  }
  if (
    network === VERDICT_X402_NETWORKS.baseSepolia &&
    usesCdpFacilitator
  ) {
    throw new VerdictX402ConfigurationError(
      "The CDP production facilitator requires Base Mainnet (eip155:8453)"
    );
  }

  if (usesCdpFacilitator) {
    const missingCredentials = REQUIRED_CDP_ENV.filter(
      (name) => !env[name]?.trim()
    );
    if (missingCredentials.length > 0) {
      throw new VerdictX402ConfigurationError(
        `Missing required CDP facilitator credentials: ${missingCredentials.join(", ")}`
      );
    }
  }

  return {
    network,
    price: parsePrice(
      env.VERDICT_X402_AUDIT_PRICE?.trim() || DEFAULT_VERDICT_AUDIT_PRICE
    ),
    payTo: payTo as `0x${string}`,
    facilitatorUrl,
    ...(usesCdpFacilitator ? { facilitatorAuth: "cdp" as const } : {}),
  };
}

export function createVerdictAuditPaymentConfig(
  config: VerdictX402Config
): RouteConfig {
  return {
    accepts: [
      {
        scheme: "exact",
        network: config.network,
        price: config.price,
        payTo: config.payTo,
      },
    ],
    description: VERDICT_AUDIT_DESCRIPTION,
    mimeType: "application/json",
  };
}

function requiredCdpCredential(
  env: NodeJS.ProcessEnv,
  name: (typeof REQUIRED_CDP_ENV)[number]
): string {
  const value = env[name];
  if (!value?.trim()) {
    throw new VerdictX402ConfigurationError(
      `Missing required CDP facilitator credential: ${name}`
    );
  }
  return value;
}

export function createVerdictFacilitatorClient(
  config: VerdictX402Config,
  options: VerdictFacilitatorClientOptions = {}
): HTTPFacilitatorClient {
  if (config.facilitatorAuth !== "cdp") {
    return new HTTPFacilitatorClient({ url: config.facilitatorUrl });
  }

  const env = options.env ?? process.env;
  const apiKeyId = requiredCdpCredential(env, "CDP_API_KEY_ID");
  const apiKeySecret = requiredCdpCredential(env, "CDP_API_KEY_SECRET");
  const jwtGenerator = options.generateJwt ?? generateJwt;
  const facilitatorUrl = new URL(config.facilitatorUrl);
  const basePath = facilitatorUrl.pathname.replace(/\/$/, "");

  async function authorizationHeader(
    requestMethod: "GET" | "POST",
    operation: "supported" | "verify" | "settle"
  ): Promise<Record<string, string>> {
    try {
      const token = await jwtGenerator({
        apiKeyId,
        apiKeySecret,
        requestMethod,
        requestHost: facilitatorUrl.host,
        requestPath: `${basePath}/${operation}`,
        expiresIn: 120,
      });
      return { Authorization: `Bearer ${token}` };
    } catch {
      throw new VerdictX402ConfigurationError(
        "Failed to generate CDP facilitator authentication"
      );
    }
  }

  return new HTTPFacilitatorClient({
    url: config.facilitatorUrl,
    createAuthHeaders: async () => {
      const [supported, verify, settle] = await Promise.all([
        authorizationHeader("GET", "supported"),
        authorizationHeader("POST", "verify"),
        authorizationHeader("POST", "settle"),
      ]);
      return { supported, verify, settle };
    },
  });
}

export function createVerdictX402ResourceServer(
  config: VerdictX402Config,
  facilitator: FacilitatorClient = createVerdictFacilitatorClient(config)
): x402ResourceServer {
  return new x402ResourceServer(facilitator).register(
    config.network,
    new ExactEvmScheme()
  );
}

export function protectVerdictAuditRoute<T>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  config: VerdictX402Config,
  options: {
    facilitator?: FacilitatorClient;
    syncFacilitatorOnStart?: boolean;
  } = {}
): (request: NextRequest) => Promise<NextResponse<T>> {
  const server = createVerdictX402ResourceServer(config, options.facilitator);
  return withX402(
    handler,
    createVerdictAuditPaymentConfig(config),
    server,
    undefined,
    undefined,
    options.syncFacilitatorOnStart
  );
}
