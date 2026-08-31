# OptiRate

OptiRate is a Next.js prototype for a digital lending experience that moves a borrower from KYC and consent to lender bidding, agreement signing, and disbursement orchestration. The experience is designed to feel like a real loan journey while remaining runnable locally with mock data.

## What the app does

- Collects borrower details such as name, credit score, loan amount, and tenure.
- Verifies PAN through a Setu-backed API route.
- Guides the user through a Setu Account Aggregator consent flow.
- Runs a backend-only underwriting risk simulation that scores transaction behaviour and eligibility without exposing internal metrics in the UI.
- Runs a server-side reverse auction against three WireMock bank APIs and ranks time-limited pre-approved offers by calculated APR.
- Lets the user select a bid and proceed to a loan agreement experience.
- Records the selected marketplace application and auction outcome while the lender retains the disbursement and repayment ledger.

## Core user flow

1. Enter loan requirements and start the auction.
2. Complete PAN verification.
3. Approve bank consent and link a mock bank account.
4. Review competitive bids and choose the best one.
5. Sign the agreement and trigger the disbursement flow.

## Risk calculation model

The underwriting engine lives in [src/services/riskEngine.ts](src/services/riskEngine.ts) and is intentionally backend-only. The browser UI does not expose raw risk-engine diagnostics; those calculations are executed server-side and logged to the terminal when the mock AA consent flow is used.

The current model has exactly three underwriting layers followed by a Synthetic Risk Index (SRI):

1. Layer 1: seasoned inflow validation
   - Uses the supplied transaction history, typically 90 days from an account aggregator.
   - Determines whether a borrower has consistent, recurring income from the same counterparty source.
   - A source is seasoned when it appears in at least 3 distinct calendar months.
   - Only seasoned counterparties contribute to validated income.

2. Layer 2: drainage / cash-sweep risk
   - Measures whether a borrower’s inflow is immediately drained within 24 hours.
   - If a salary credit is followed by an outflow that consumes most of it in the same day, a rapid-drain flag is raised.
   - Each rapid drain adds a fixed, explainable SRI penalty, capped at 30 points.

3. Layer 3: net cash-flow surplus
   - Subtracts total outflows from validated inflow.
   - Computes validated income minus all outflows.
   - Separately measures uncategorized transfers and cash withdrawals as a share of validated income.
   - A deficit with leakage above 15% receives the stronger compounding penalty.

The SRI starts at zero, adds fixed penalties for triggered flags, clamps to 0-100, and maps the result to `ALLOW_AUCTION` (0-35), `REVIEW` (36-64), or `BLOCK_AUCTION` (65-100). These values are risk classifications supplied to each lender, not platform-level auction gates. Every valid application is broadcast; each mock bank applies its own appetite and affordability policy.

The engine then returns:

- `score`: the clamped SRI score
- `action`: `ALLOW_AUCTION`, `REVIEW`, or `BLOCK_AUCTION`
- `reasons`: explainable reasons for every triggered flag

The identity and financial simulations are intentionally separate. Use Setu's documented valid sandbox PAN `ABCDE1234A` for every successful identity flow (`ABCDE1234B` is Setu's invalid-PAN test case). After consent, select one of four six-month AA personas:

- Prime salaried: high bureau score and clean cashflow.
- High-score but stressed: strong bureau score sustained through friends/family borrowing and repeated 30%-of-limit petrol-pump cash-like card evergreening.
- Average salaried: medium bureau score and overextended/average cashflow.
- Stressed defaulter: low bureau score with chaotic cash sweeps, deficits, and penalties.
- New-to-credit: no bureau score with clean, seasoned salary cashflow.
- Disciplined gig worker: no bureau history, variable platform payouts, and positive savings in every month.
- Disciplined small business: no bureau history, seasonal customer/POS receipts, controlled operating costs, and monthly surplus.

Each statement contains six monthly cycles and canonical credit/debit, balance, narration, counterparty, category, timestamp, and amount fields.

## Tech stack

- Frontend: Next.js 14 + React 18
- Language: TypeScript
- Styling: Tailwind CSS
- API layer: Next.js route handlers
- Integrations: Setu sandbox-style APIs and Prisma/Postgres marketplace persistence
- Local infrastructure: Docker Compose for a Postgres development database

## Project structure

```text
src/
├── app/
│   ├── api/
│   │   ├── loan-applications/
│   │   │   └── complete/route.ts
│   │   └── loan-outcomes/[loanApplicationId]/route.ts
│   │   └── setu/
│   │       ├── consent/route.ts
│   │       └── verify-pan/route.ts
│   ├── loan-agreement/page.tsx
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── BankAgreements.tsx
│   ├── BidCard.tsx
│   ├── BidsList.tsx
│   ├── BorrowerForm.tsx
│   └── LoadingAnimation.tsx
├── hooks/
│   └── useAuctionState.ts
├── services/
│   ├── auctionService.ts
│   ├── bankAdapterService.ts
│   ├── lenderRegistry.ts
│   ├── riskEngine.ts
│   └── setuAAService.ts
├── types/
│   └── lending.ts
└── lib/
    └── aprCalculator.ts
```

## Getting started

### Prerequisites

- Node.js 18 or newer
- npm
- Docker (optional, for the local Postgres stack)

### Install dependencies

```bash
git clone https://github.com/yogeshmj94/optirate.git
cd optirate
npm install
```

### Run the app locally

```bash
npm run dev
```

Then open http://localhost:3000.

### Optional: run the local Postgres stack

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
```

This starts Postgres for the Prisma-owned marketplace schema. Copy `.env.example` to `.env` and set `DATABASE_URL` before running migration or seed commands.

## Environment variables

The app uses environment variables for real integrations:

- `MOCK_SETU=true`: enables mock Setu PAN/consent responses for local testing.
- `DATABASE_URL`: Postgres connection URL used by Prisma.
- `SETU_KYC_BASE_URL`: base URL for Setu KYC requests.
- `SETU_KYC_CLIENT_ID`: Setu client ID.
- `SETU_KYC_CLIENT_SECRET`: Setu client secret.
- `SETU_PAN_INSTANCE_ID`: Setu PAN product instance ID.
- `SETU_ESIGN_CLIENT_ID`, `SETU_ESIGN_CLIENT_SECRET`, `SETU_ESIGN_INSTANCE_ID`: Aadhaar eSign sandbox credentials.
- `SETU_ESIGN_DOCUMENT_ID`: a PDF document previously uploaded to Setu for signing.
- `SETU_ESIGN_REDIRECT_URL`: a publicly hosted return URL for Setu's signing flow.
- `SETU_AA_CLIENT_ID`: Setu Account Aggregator client ID.
- `SETU_AA_CLIENT_SECRET`: Setu Account Aggregator client secret.
- `WIREMOCK_BASE_URL`: defaults to `http://localhost:8080`.
- `BANK_RESPONSE_TIMEOUT_MS`: per-bank response deadline before deterministic fallback.

## WireMock lender auction

Start WireMock and Postgres with `docker compose up -d`. The lender stubs live under `wiremock/mappings`:

- Aster National Bank: conservative bureau-only policy; requires a 720+ score and deliberately ignores cashflow quality.
- Nova Digital Bank: progressive cashflow underwriting; clean no-history borrowers can receive offers around 16.25%.
- Summit Opportunity Bank: broader cashflow underwriting; disciplined no-history borrowers can receive a second offer around 16.75%, while riskier profiles are priced separately.
- FlowTrust Cashflow Bank: general clean-cashflow lender at about 16% for no-history profiles.
- FlexWork Bank: gig-worker specialist at about 16.5%.
- Udyam Growth Bank: disciplined small-business specialist at about 12.5%.

### Market benchmark used by the mock auction

The mock pricing is anchored to published lender pricing checked in August 2026. Fibe publishes new-to-credit availability with personal-loan rates starting at 18%; Moneyview publishes self-employed pricing from 14% and overall APRs of 17–45%; Bajaj Finance publishes 14–23% for its self-employed personal-loan product; and KreditBee publishes 12–27.5% for proprietorship borrowers. Because advertised starting rates are not guaranteed offers, OptiRate treats 18% as the demonstration benchmark for general no-history/gig profiles and 14% as the lower-bound benchmark for documented self-employed profiles.

Mock lenders target rates 1–2 percentage points below the applicable benchmark when the six-month cashflow is disciplined. The platform fee is disclosed separately at 1.5% for no-history applicants and 1% for established-credit applicants. True APR includes both lender processing fees and the platform fee.

- https://www.fibe.in/personal-loan/
- https://moneyview.in/loans/instant-personal-loan-for-self-employed
- https://www.bajajfinserv.in/personal-loan-for-self-employed
- https://www.kreditbee.in/personal-loan-for-proprietorship

`POST /api/auction` broadcasts concurrently to all six bank-specific schemas, normalizes their responses, calculates EMI/APR, adds a 15-minute offer validity window, and ranks approvals. If WireMock is unavailable, the same policies run through a deterministic local fallback so the demo remains usable.

The loan form displays AA-derived net monthly income, fixed obligations, current DTI, and an indicative projected DTI that updates with the requested amount and tenure. Each lender then applies its own DTI ceiling and may extend the offered tenure independently of the requested tenure. When an offer is completed, every approval and rejection is stored in `AuctionBid`, including the decision remark, requested/offered tenure, EMI, current/projected DTI, lender threshold, fees, and market-pricing comparison.

## Setu sandbox boundaries

PAN verification uses Setu's `POST /api/verify/pan` contract when KYC credentials are configured. Aadhaar eSign offers two explicit paths:

- Setu Hosted eSign: creates a Setu signature request, opens the hosted Aadhaar/OTP screen in a new tab, and checks Setu's signature status before completion.
- Simulated Aadhaar OTP: local demonstration fallback using OTP `123456`; it never calls Setu or UIDAI and never asks for or stores an Aadhaar number.

The single valid sandbox PAN is only the identity fixture. Credit and cashflow personas are selected independently after the simulated AA consent, so all four underwriting scenarios can reuse `ABCDE1234A` without pretending that PAN determines financial behavior. `ABCDE1234B` remains available only for testing PAN-verification failure.

If you do not provide these values, the app will still run in its built-in demo mode.

## Database & Deployment

### Running locally with Docker

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
```

Then set `DATABASE_URL` in `.env` to point to the local Postgres instance.

For local development, `DATABASE_URL` and `DIRECT_URL` can point to the same connection string:

```env
DATABASE_URL="postgresql://optirate:optirate@localhost:5432/optirate?schema=public"
DIRECT_URL="postgresql://optirate:optirate@localhost:5432/optirate?schema=public"
```

### Deploying to Vercel with Neon

This project is configured for serverless deployment on Vercel with a Neon free-tier Postgres database.

#### Step 1: Create a Neon project

1. Go to [console.neon.tech](https://console.neon.tech) and sign up (free tier available).
2. Create a new project.
3. Copy both connection strings from the Neon dashboard:
   - **Pooled connection** (with PgBouncer): use for `DATABASE_URL`
   - **Direct connection** (unpooled): use for `DIRECT_URL`

Both strings have the format:
```
postgresql://<user>:<password>@<neon-host>/<database>?sslmode=require
```

#### Step 2: Add environment variables to Vercel

1. In your Vercel project dashboard, go to **Settings → Environment Variables**.
2. Add two variables:
   - `DATABASE_URL`: paste the pooled connection string.
   - `DIRECT_URL`: paste the direct connection string.

The `postinstall` script in `package.json` automatically runs `prisma generate` on every Vercel build.

#### Step 3: Run migrations

Before (or after) your first Vercel deploy, run migrations against your Neon database:

```bash
# Locally, with DIRECT_URL configured:
npx prisma migrate deploy
```

Migrations **must** run against `DIRECT_URL` (the unpooled connection) because Neon's pooler (PgBouncer) does not support DDL statements.

To make this part of your CI/CD pipeline, add a Vercel pre-deployment build script or run it manually before deploying a new schema version.

#### Why two connection strings?

- **DATABASE_URL** (pooled via PgBouncer): Used by Prisma Client at runtime in serverless functions. Supports high concurrency and connection pooling, which is essential for Vercel's architecture where each function invocation may create a new client.
- **DIRECT_URL** (unpooled): Used **only** by Prisma for migrations (`prisma migrate deploy`). PgBouncer does not support schema DDL, so migrations must connect directly to Neon.

#### Health check endpoint

To verify that your deployed app can connect to Neon, visit:

```
https://your-vercel-domain.vercel.app/api/health
```

This endpoint runs a simple database query and returns the status. A 200 response indicates successful connectivity; 503 indicates a connection issue.

#### Neon free-tier behavior

Neon's free tier suspends compute after 15 minutes of inactivity. The next query will resume the compute and incur a brief cold-start delay (typically 1-2 seconds). This is expected behavior, not a bug. To prevent suspensions, you can keep a health check endpoint warm with a simple external scheduler (e.g., Uptime Robot on the free tier pointing to `/api/health`).

### API routes and serverless constraints

All API routes in this project are implemented as Next.js route handlers and run as Vercel serverless functions. They do not start a long-running HTTP server.

When deploying to Vercel:

- Each function invocation is independent.
- Connection pooling via Neon's PgBouncer (`DATABASE_URL`) prevents connection exhaustion under high concurrency.
- The Prisma Client singleton pattern (in [lib/prisma.ts](src/lib/prisma.ts)) ensures that each function invocation reuses the same client instance instead of creating a new one.
- Session-based authentication or ephemeral application state **must not** be stored in server memory; use the database or a session store like Redis.



- POST /api/setu/verify-pan: verifies a PAN and returns mock or live KYC data.
- POST /api/setu/consent: handles consent initiation/status/session/data actions.
- POST /api/loan-applications/complete: records the selected marketplace application and auction outcome. The lender remains the system of record for disbursement and repayment.
- GET /api/loan-outcomes/:loanApplicationId: reads the latest outcome snapshots ingested from the lender's status feed.

## Notes

- The current repository is a working prototype rather than a production-grade lender platform.
- The onboarding and auction experience is intentionally mock-friendly so it can be demonstrated without external services.
- Prisma/Postgres stores marketplace applications, bids, risk audit records, platform fee bookkeeping entries, and read-only lender outcome snapshots. It does not store a loan repayment schedule or own the lender's loan ledger.
- The risk metrics are intentionally backend-only; they are logged in the server terminal during the consent and verification flow rather than displayed to end users.
- Demo credentials and OTPs are embedded in the UI for the sandbox-style flow.

## Path forward to go live

To move this prototype into a production-grade lending flow, the next step is a phased migration:

1. Replace the mock Setu routes with real sandbox or production credentials
   - Secure all client IDs, secrets, and instance IDs in environment variables or a secret manager.
   - Add explicit consent token validation and session auditing.

2. Make the underwriting model policy-driven
   - Store layer thresholds in configuration instead of hardcoding them in the service.
   - Add admin controls for score bands and eligibility rules.

3. Move backend decisions behind a trusted orchestration service
   - Call KYC, AA, and risk evaluation from a dedicated server-side underwriting service.
   - Persist the generated `sri`, `eligibility`, and instrumented decision reasons for auditing.

4. Connect the live credit stack to a real account aggregator and lender core
   - Use Setu production or partner credentials for KYC and AA consent.
   - Connect a lender status feed to `LoanOutcomeSync`; the lender remains responsible for its loan ledger and funds flow.

5. Add production controls
   - Authentication and role-based access for staff and lenders.
   - Structured logging, trace IDs, alerting, and retry rules.
   - Security review for consent, PAN handling, and bank statement data storage.

6. Add analytics and monitoring
   - Track approval rate, review rate, automated risk decisions, and lender response latency.
   - Add dashboards that compare the mocked and live decision outcomes over time.

## Roadmap

- Add real Setu credentials and lender outcome-feed credentials for production-like testing.
- Persist auction results and borrower history.
- Improve agreement signing and audit logging.
- Add authentication and role-based lender workflows.

## License

MIT
