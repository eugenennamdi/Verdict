import { DEFAULT_VERDICT_AUDIT_PRICE } from "@/lib/x402/constants";

export const AGENT_AUDIT_PATH = "/api/v2/audit";
export const AGENT_AUDIT_ORIGIN = "https://tryverdict.xyz";
export const AGENT_AUDIT_URL = `${AGENT_AUDIT_ORIGIN}${AGENT_AUDIT_PATH}`;
export const AGENT_AUDIT_PRICE = DEFAULT_VERDICT_AUDIT_PRICE;

export const AGENT_API_STATUS = {
  productionNetwork: "Base",
  testStatus: "Base Sepolia settlement verified.",
  productionStatus:
    "Designed for Base Mainnet production; mainnet payment verification is pending.",
} as const;

export const AGENT_REQUEST_EXAMPLE = `{
  "url": "https://example.com"
}`;

export const AGENT_RESPONSE_EXAMPLE = `{
  "reportId": "7c3f…91a2",
  "overallScore": 78,
  "company_name": "Example",
  "pagesInspected": 3,
  "stopReason": "sufficient",
  "evidenceCoverage": {
    "pagesAcquired": 3,
    "charsTotal": 28410
  }
}`;

export const AGENT_BUYER_EXAMPLE = `import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.EVM_PRIVATE_KEY as \`0x\${string}\`;
const signer = privateKeyToAccount(privateKey);

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const response = await fetchWithPayment("${AGENT_AUDIT_URL}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://example.com" }),
});

if (!response.ok) {
  throw new Error(\`Verdict request failed: \${response.status}\`);
}

const verdict = await response.json();
console.log(verdict);`;

export const AGENT_UNPAID_CURL_EXAMPLE = `curl -i -X POST ${AGENT_AUDIT_URL} \\
  -H 'Content-Type: application/json' \\
  -d '{"url":"https://example.com"}'`;
