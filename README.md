# Verdict

Verdict is a growth intelligence agent that turns a public startup URL into an evidence-grounded Growth Readiness assessment and prioritized action plan.

[Product](https://tryverdict.xyz) · [Documentation](https://tryverdict.xyz/docs) · [Agent API](https://tryverdict.xyz/agents) · [GitHub](https://github.com/eugenennamdi/Verdict) · [X](https://x.com/tryverdict)

## What Verdict does

Give Verdict a public startup URL. It investigates the site, admits relevant evidence, evaluates growth readiness, and returns:

- one Growth Readiness Score
- the primary growth bottleneck
- the strongest and weakest dimensions
- the highest-leverage opportunity
- prioritized recommendations
- the inspected sources supporting the report

The workflow is:

`URL → investigate → admit evidence → evaluate → Growth Readiness Score → prioritized recommendations → grounded follow-up`

Completed audits support follow-up questions grounded in the canonical report and its accepted sources. Follow-up Q&A explains the completed assessment; it does not independently re-evaluate the company or fetch new evidence.

## Growth Readiness framework

Verdict evaluates seven dimensions:

- Positioning & ICP — 20%
- Messaging & Copy — 15%
- Website & UX — 15%
- Conversion Triggers — 15%
- Trust & Social Proof — 10%
- Defensibility — 10%
- Growth Foundation — 15%

Dimension evaluations are evidence-grounded structured model assessments. The backend then applies the framework weights and deterministically aggregates the final Growth Readiness Score.

The Growth Readiness Score is the only public numeric score and ranges from 0 to 100. Individual dimension scores remain internal; customer-facing reports expose qualitative conclusions such as strongest and weakest dimensions instead.

## Human audits

- Each user receives 3 successful new audits per rolling 24-hour window.
- Failed audits do not consume free quota or a reserved paid entitlement.
- Follow-up questions on a completed audit do not consume another audit.
- After free audits are exhausted, a `$0.50` USDC payment on Base Mainnet grants one additional audit entitlement.
- Verdict does not hold wallet keys, take custody of funds, or maintain a stored balance.

## Agent API

Agents access the canonical audit endpoint:

```text
POST /api/v2/audit
```

Production requests use x402 on Base Mainnet with USDC at `$0.50` per audit.

```bash
curl -X POST https://tryverdict.xyz/api/v2/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

An unpaid request receives a standards-compliant x402 payment challenge. After the client signs the advertised requirement and retries, Verdict runs the bounded investigation and returns the public audit result as JSON.

See the [Agent API documentation](https://tryverdict.xyz/agents) for the payment flow, client integration, and response contract.

## How the investigation works

1. Normalize and validate the target URL.
2. Discover same-site candidate pages.
3. Acquire pages within bounded investigation limits.
4. Admit evidence relevant to the growth framework.
5. Evaluate the seven growth dimensions from admitted evidence.
6. Deterministically aggregate the Growth Readiness Score.
7. Persist the canonical report and source grounding.

## Local development

Install dependencies and create a local environment file:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Configure credentials only for the surfaces you run. Core integrations use these environment variable names:

- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `FIRECRAWL_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`
- `VERDICT_VISITOR_COOKIE_SECRET`

The x402 network, recipient, facilitator, and optional wallet configuration are documented in `.env.example`. Never commit credentials.

Useful project commands:

```bash
npm test
npm run build
npm run lint
```

## Tech stack

- Next.js 16, React 19, and TypeScript
- Tailwind CSS and component primitives from Base UI and Radix UI
- Supabase PostgreSQL for canonical report persistence
- Redis for quota and entitlement state
- Firecrawl-backed evidence acquisition
- Structured model orchestration across Gemini and DeepSeek
- Base, USDC, and x402 for paid access

## Documentation

The complete product, investigation, scoring, payment, security, and API documentation is available at [tryverdict.xyz/docs](https://tryverdict.xyz/docs).
