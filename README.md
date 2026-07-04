# OptiRate

OptiRate is a Next.js prototype for a digital lending experience that moves a borrower from KYC and consent to lender bidding, agreement signing, and disbursement orchestration. The experience is designed to feel like a real loan journey while remaining runnable locally with mock data.

## What the app does

- Collects borrower details such as name, credit score, loan amount, and tenure.
- Verifies PAN through a Setu-backed API route.
- Guides the user through a Setu Account Aggregator consent flow.
- Simulates a reverse auction and ranks lender bids by calculated APR.
- Lets the user select a bid and proceed to a loan agreement experience.
- Sends a disbursement request to a Fineract-compatible backend endpoint.

## Core user flow

1. Enter loan requirements and start the auction.
2. Complete PAN verification.
3. Approve bank consent and link a mock bank account.
4. Review competitive bids and choose the best one.
5. Sign the agreement and trigger the disbursement flow.

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

- MOCK_SETU=true: enables mock Setu PAN/consent responses for local testing.
- SETU_KYC_BASE_URL: base URL for Setu KYC requests.
- SETU_KYC_CLIENT_ID: Setu client ID.
- SETU_KYC_CLIENT_SECRET: Setu client secret.
- SETU_PAN_INSTANCE_ID: Setu PAN product instance ID.

If you do not provide these values, the app will still run in its built-in demo mode.

## API routes

- POST /api/setu/verify-pan: verifies a PAN and returns mock or live KYC data.
- POST /api/setu/consent: handles consent initiation/status/session/data actions.
- POST /api/fineract/disburse: sends a disbursement request to the configured core banking layer.

## Notes

- The current repository is a working prototype rather than a production-grade lender platform.
- The onboarding and auction experience is intentionally mock-friendly so it can be demonstrated without external services.
- Demo credentials and OTPs are embedded in the UI for the sandbox-style flow.

## Roadmap

- Add real Setu and Fineract credentials for production-like testing.
- Persist auction results and borrower history.
- Improve agreement signing and audit logging.
- Add authentication and role-based lender workflows.

## License

MIT
