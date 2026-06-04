# optirate 🎯

**Competitive Loan Auction Platform** - Find your best loan rate in seconds, not days.

## Features

✨ **Instant Rate Discovery**
- Submit your profile once
- 12+ lenders compete automatically
- Results in 4-5 seconds

🔒 **Privacy-First Design**
- Your data is anonymized
- Lenders see only aggregated risk profile
- No credit inquiries on your credit report

⚖️ **Transparent Pricing**
- True APR calculations (base rate + processing fee)
- Accurate EMI forecasts
- Fixed platform fees (1% or ₹10k+0.5%)

🏆 **Best Market Rate Guarantee**
- Competitive bidding ensures lowest APR
- Compare all offers side-by-side
- Lock rate instantly

## Tech Stack

- **Frontend**: Next.js 14 + React 18
- **Styling**: Tailwind CSS 3
- **Language**: TypeScript
- **State**: React Hooks (useAuctionState)
- **Finance**: Custom APR & EMI calculators

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main landing page
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   ├── BorrowerForm.tsx      # Loan application form
│   ├── LoadingAnimation.tsx  # Auction loading state
│   ├── BidCard.tsx           # Individual bid display
│   ├── BidsList.tsx          # Bids grid layout
│   └── TransparencyFooter.tsx # Fee disclosure
├── hooks/
│   └── useAuctionState.ts    # Auction state machine
├── services/
│   └── auctionService.ts     # Mock lender & bid engine
├── lib/
│   └── aprCalculator.ts      # APR & EMI calculations
└── types/
    └── lending.ts            # TypeScript interfaces
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yogeshmj94/optirate.git
cd optirate

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Design

### Auction Request Flow

```typescript
Interface: BorrowerProfile
{
  fullName: string;
  creditScore: number;       // 300-900
  requiredAmount: number;    // In INR
  tenureMonths: number;      // 12-60 months
}

Response: AuctionResponse
{
  borrowerId: string;
  borrowerName: string;
  requestedAmount: number;
  tenure: number;
  bids: LoanBid[];
}
```

### Loan Bid Structure

```typescript
Interface: LoanBid
{
  id: string;
  lenderName: string;
  baseInterestRate: number;     // Base annual rate %
  processingFeePercent: number; // Fee as % of principal
  calculatedAPR: number;        // True APR (base + fee impact)
  monthlyEMI: number;           // Equated Monthly Installment
  totalPayout: number;          // Total repayment amount
  rank: number;                 // Sorting by lowest APR
}
```

## APR Calculation Logic

The platform uses accurate financial calculations:

1. **Base Rate**: Annual percentage rate from lender
2. **Processing Fee**: One-time fee as % of principal
3. **Effective Rate**: Processing fee spread across tenure
4. **True APR**: Combined effective annual percentage rate
5. **Monthly EMI**: Calculated using standard amortization formula

```
EMI = P × R × (1+R)^N / ((1+R)^N - 1)
Where:
  P = Principal
  R = Monthly interest rate
  N = Tenure in months
```

## Lender Simulation

The mock auction service includes 12 realistic lenders:

**Banks**
- HDFC Bank, ICICI Bank, Axis Bank
- Kotak Mahindra, Yes Bank, IDFC First, Federal Bank, RBL Bank

**NBFCs & Finance Companies**
- Bajaj Finance, HDFC Finance, Flex Finance

**Digital Lenders**
- Digital Credit Co.

Each lender has:
- Tier-based pricing (Excellent/Good/Fair credit)
- Processing fee range
- Competitive bidding simulation
- Realistic APR spreads

## State Machine

The auction flows through distinct states:

```
idle
  ↓
loading (with 4 step-by-step updates)
  ↓
success (show bids) or error
  ↓
reset to idle
```

## Performance Features

- ⚡ Client-side calculations (no backend latency)
- 🎨 Smooth animations and transitions
- 📱 Mobile-first responsive design
- ♿ Semantic HTML for accessibility
- 🔍 SEO-optimized metadata

## Future Enhancements

- [ ] Real FinBox API integration
- [ ] User authentication & profiles
- [ ] Loan agreement generation
- [ ] KYC/AML verification
- [ ] Disbursal tracking
- [ ] Payment portal
- [ ] Customer support chat
- [ ] Rate prediction ML model
- [ ] Dashboard for repeat borrowers
- [ ] API for partner integration

## License

MIT

## Support

For questions or issues, please open a GitHub issue or contact support@optirate.in

---

**optirate** - Smart Rate Discovery for Modern Borrowers 🚀
