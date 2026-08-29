import { isAddress } from "ethers";
import {
  HTTPFacilitatorClient,
  type FacilitatorClient,
  type RouteConfig,
  x402ResourceServer,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { withX402 } from "@x402/next";
import type { NextRequest, NextResponse } from "next/server";

export const VERDICT_X402_NETWORKS = {
  baseMainnet: "eip155:8453",
  baseSepolia: "eip155:84532",
} as const;

export type VerdictX402Network =
  (typeof VERDICT_X402_NETWORKS)[keyof typeof VERDICT_X402_NETWORKS];

export const DEFAULT_VERDICT_AUDIT_PRICE = "$0.50";
export const VERDICT_AUDIT_DESCRIPTION =
  "Autonomous Verdict growth investigation";

const REQUIRED_ENV = [
  "VERDICT_X402_NETWORK",
  "VERDICT_X402_PAY_TO",
  "VERDICT_X402_FACILITATOR_URL",
] as const;

export type VerdictX402Config = {
  network: VerdictX402Network;
  price: string;
  payTo: `0x${string}`;
  facilitatorUrl: string;
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

  return {
    network,
    price: parsePrice(
      env.VERDICT_X402_AUDIT_PRICE?.trim() || DEFAULT_VERDICT_AUDIT_PRICE
    ),
    payTo: payTo as `0x${string}`,
    facilitatorUrl: parseFacilitatorUrl(
      requiredValue(env, "VERDICT_X402_FACILITATOR_URL"),
      network
    ),
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

export function createVerdictX402ResourceServer(
  config: VerdictX402Config,
  facilitator: FacilitatorClient = new HTTPFacilitatorClient({
    url: config.facilitatorUrl,
  })
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
