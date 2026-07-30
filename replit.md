# Rare District

A Nigerian fashion marketplace where curated contemporary African luxury brands sell directly to discerning shoppers. Supports shoppers, vendors, and platform admins.

## Run & Operate

- `pnpm --filter @workspace/rare-district run dev` — run the frontend (port 19561, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, path `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7, Tailwind CSS v4, TanStack Query, Wouter, Framer Motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (bcryptjs), with Google OAuth scaffold
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — Drizzle schema (users, vendors, products, orders, transactions, coupons, referrals, reviews, wardrobe, admin)
- `lib/api-spec/openapi.yaml` — Single source of truth for all API contracts
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/` — Generated Zod schemas (do not edit manually)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/rare-district/src/pages/` — Frontend pages (home, shop, product, checkout, orders, vendor dashboard, admin)
- `artifacts/rare-district/src/contexts/AuthContext.tsx` — JWT auth context (localStorage token)

## Architecture decisions

- Contract-first: OpenAPI spec → codegen → typed hooks/schemas on both frontend and backend
- JWT auth via Authorization header; token stored in localStorage; `AuthContext` manages session state
- `JWT_SECRET` falls back to `"rare-district-dev-secret"` if env var not set — set it properly for production
- Prices stored as Postgres `numeric` strings, parsed to `number` in the API response layer
- Object storage uses `@google-cloud/storage` — requires GCS bucket config for image uploads

## Product

- **Shoppers**: Browse products, add to wardrobe (cart/wishlist hybrid), checkout with Paystack or Flutterwave, track orders, earn referral rewards
- **Vendors**: Apply to sell, manage products and orders via vendor dashboard, track revenue
- **Admins**: Approve/reject vendors, manage all products/orders/coupons/transactions, configure platform commission

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change before touching frontend or backend types
- `DATABASE_URL` is runtime-managed by Replit — never set it manually
- Google OAuth routes are scaffolded but require `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars to function
- Payment routes (Paystack, Flutterwave) require their respective API keys to process real transactions
- After codegen, do NOT read generated files — they are large; grep exact export names instead
