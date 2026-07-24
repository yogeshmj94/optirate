# OptiRate

OptiRate is a Next.js prototype for a digital lending experience that moves a borrower from KYC and consent to lender bidding, agreement signing, and disbursement orchestration. The experience is designed to feel like a real loan journey while remaining runnable locally with mock data.

## What the app does

- Collects borrower details such as name, credit score, loan amount, and tenure.
- Verifies PAN through a Setu-backed API route.
- Guides the user through a Setu Account Aggregator consent flow.
- Runs a backend-only underwriting risk simulation that scores transaction behaviour and eligibility without exposing internal metrics in the UI.
- Simulates a reverse auction and ranks lender bids by calculated APR.
- Lets the user select a bid and proceed to a loan agreement experience.
- Sends a disbursement request to a Fineract-compatible backend endpoint.

## Core user flow

1. Enter loan requirements and start the auction.
2. Complete PAN verification.
3. Approve bank consent and link a mock bank account.
4. Review competitive bids and choose the best one.
5. Sign the agreement and trigger the disbursement flow.

## Risk calculation model

The underwriting engine lives in [src/services/riskEngine.ts](src/services/riskEngine.ts) and is intentionally backend-only. The browser UI does not expose raw risk-engine diagnostics; those calculations are executed server-side and logged to the terminal when the mock AA consent flow is used.

The current model is a layered score:

1. Layer 1: seasoned inflow validation
   - Uses the last 12 months of inflow transactions.
   - Determines whether a borrower has consistent, recurring income from the same counterparty source.
   - A source is considered seasoned when it appears across at least 3 consecutive months.
   - One-time deposits are treated as weaker evidence and do not count as stable income capacity.

2. Layer 2: drainage / cash-sweep risk
   - Measures whether a borrower’s inflow is immediately drained within 24 hours.
   - If a salary credit is followed by an outflow that consumes most of it in the same day, a rapid-drain flag is raised.
   - This increases the risk score and may move the borrower into `REVIEW` or `BLOCK_AUCTION` eligibility.

3. Layer 3: net cash-flow surplus
   - Subtracts total outflows from validated inflow.
   - Positive net cash flow improves discipline and lowers risk.
   - Negative net cash flow increases risk because the borrower is operationally burning more than they are bringing in.

4. Layer 4: thermodynamic risk module (additive)
   - Computes distribution entropy for inflow and outflow buckets using transaction-size clustering.
   - Measures `wasteHeatRatio`, which reflects the share of outflow committed to uncategorized or cash-like leakage events.
   - Computes `entropyDelta` by comparing the first and second halves of a 90-day transaction window.
   - If entropy rises sharply and waste heat is elevated, an additive penalty is applied on top of the Layer 1-3 SRI score through `calculateAdjustedSRI`.

The engine then returns:

- `sri`: the layered risk score
- `riskBand`: `LOW`, `MEDIUM`, or `HIGH`
- `eligibility`: `ALLOW_AUCTION`, `REVIEW`, or `BLOCK_AUCTION`
- terminal-only diagnostics such as source seasoning, cash-flow surplus, entropy, waste heat, and adjusted SRI

For the sandbox path, the PAN verification route maps deterministic profile data for:

- `ABCDE1234A` → disciplined first-time borrower
- `ABCDE1234B` → high-credit-score chaotic cash flow profile
- `ABCDE1234C` → low-credit-score defaulter profile

Any other PAN is rejected as invalid for the simulated environment.

## Tech stack

- Frontend: Next.js 14 + React 18
- Language: TypeScript
- Styling: Tailwind CSS
- API layer: Next.js route handlers
- Integrations: Setu sandbox-style APIs and Fineract-compatible disbursement wiring
- Local infrastructure: Docker Compose for a Fineract sample stack

## Project structure

```text
src/
├── app/
│   ├── api/
│   │   ├── fineract/
│   │   │   └── disburse/route.ts
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
- Docker (optional, for the Fineract local stack)

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

### Optional: run the local Fineract stack

```bash
docker compose up -d
```

This starts a simple MariaDB + Fineract setup that the disbursement endpoint is wired to target.

## Environment variables

The app uses environment variables for real integrations:

- `MOCK_SETU=true`: enables mock Setu PAN/consent responses for local testing.
- `SETU_KYC_BASE_URL`: base URL for Setu KYC requests.
- `SETU_KYC_CLIENT_ID`: Setu client ID.
- `SETU_KYC_CLIENT_SECRET`: Setu client secret.
- `SETU_PAN_INSTANCE_ID`: Setu PAN product instance ID.
- `SETU_AA_CLIENT_ID`: Setu Account Aggregator client ID.
- `SETU_AA_CLIENT_SECRET`: Setu Account Aggregator client secret.

If you do not provide these values, the app will still run in its built-in demo mode.

## API routes

- POST /api/setu/verify-pan: verifies a PAN and returns mock or live KYC data.
- POST /api/setu/consent: handles consent initiation/status/session/data actions.
- POST /api/fineract/disburse: sends a disbursement request to the configured core banking layer.

## Notes

- The current repository is a working prototype rather than a production-grade lender platform.
- The onboarding and auction experience is intentionally mock-friendly so it can be demonstrated without external services.
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
   - Replace the current disbursement stub with the live Fineract or core banking API contract.

5. Add production controls
   - Authentication and role-based access for staff and lenders.
   - Structured logging, trace IDs, alerting, and retry rules.
   - Security review for consent, PAN handling, and bank statement data storage.

6. Add analytics and monitoring
   - Track approval rate, review rate, automated risk decisions, and lender response latency.
   - Add dashboards that compare the mocked and live decision outcomes over time.

## Roadmap

- Add real Setu and Fineract credentials for production-like testing.
- Persist auction results and borrower history.
- Improve agreement signing and audit logging.
- Add authentication and role-based lender workflows.

## License

MIT
