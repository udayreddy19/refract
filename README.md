# PayFlow Agent

Production-style payment retailer / agent portal for bill payments, wallet, QR collection, and reports.

## Stack

- Next.js 16 · React 19 · TypeScript
- Tailwind CSS v4
- React Hook Form + Zod
- TanStack Table · Recharts · Zustand · Lucide · Sonner

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo login

Use the mock agent credentials configured in the auth service (not shown in the UI).

## App sections

- **Dashboard** — PayIn / PayOut stats, trends, recent transactions
- **Bill Payments** — category grid, fetch bill, pay, receipt
- **Wallet** — add funds, withdraw, bank accounts, history
- **QR Collection** — pending payment upload + history
- **Reports** — filtered tables + CSV export
- **Profile & Settings** — passcode change, security toggles

## Backend-ready services

Mock implementations live in `lib/services/`. Set `NEXT_PUBLIC_API_URL` in `.env` when wiring a real API. Never put secrets in client code — use `API_SECRET` server-side only.
