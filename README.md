# ReconcileX

Retailer / agent portal for bill payments, wallet top-ups, QR collection, and admin — hosted on **ServerByt** (`reconcilex.in`).

## Stack

- Next.js 16 · React 19 · TypeScript · Tailwind CSS v4
- PHP APIs under `public/api/payflow/`
- **MySQL** (preferred) for agents, wallets, ledger, deposits — JSON fallback if MySQL is not configured

## Getting started

```bash
npm install
npm run dev
```

## ServerByt production setup

1. Create a MySQL database in ServerByt control panel.
2. Copy `public/api/secrets.example.php` → `public/api/secrets.php` on the server (never commit secrets).
3. Set `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` (usually host `localhost`).
4. Set `ADMIN_PASSWORD`, payment keys, `CRON_SECRET`.
5. Deploy with `./scripts/deploy.sh` (preserves remote `data/**` and `api/secrets.php`).
6. In Admin → **Audit**, click **Import JSON → MySQL** once if you have existing JSON retailers.

### Nightly backup cron (ServerByt)

Add a daily cron that hits:

```
https://reconcilex.in/api/cron/payflow-backup.php?key=YOUR_CRON_SECRET
```

Writes gzipped snapshots to `data/backups/` (excluded from FTP deploy) and records daily settlement rows.

## App sections

- Agent: Home, Bills, Wallet, QR, Reports, Profile (PIN, Hindi/English, invite code)
- Admin: Retailers (CSV bulk), Wallets (reason + receipt ID), Transactions, Audit, Disputes, Settlements/commissions

## Roles

- `ADMIN_PASSWORD` → super (full control)
- `ADMIN_BILLING_PASSWORD` → billing (wallets, disputes, commissions)
- `ADMIN_VIEWER_PASSWORD` → viewer (read-only)
