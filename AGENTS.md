# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Commit style
- Never add `Co-Authored-By` lines to commit messages.
- Never reference AI tools, models, or assistants in commit messages.

## Commands (run from `chs-app/`)

```bash
npm run dev          # Vite dev server (local, uses .env for credentials)
npm run build        # Production build → dist/
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test:e2e     # Playwright E2E against https://www.chass1s.com by default
```

## Architecture

### Source layout (`src/`)

```
chs-app.tsx          # Root component — the full app (Page 1 form → Page 2 results)
main.jsx             # React entry point, mounts chs-app.tsx
features/
  auth/              # AuthModal, AccountMenu, SettingsModal, SupportModal, FinishCreatingAccount
  billing/           # TokenPurchaseModal
  generation/        # prompts.ts — builds system/user message blocks for the AI API
  history/           # ChassisHistoryModal
  workspace/         # WorkspaceCreateModal, WorkspaceMembersModal
hooks/useResponsive.ts
i18n/translations.js # All UI strings (T object) + tier config, keyed by EN/ES/FR/PT
lib/supabase.ts      # Custom REST Supabase client (not @supabase/supabase-js)
shared/ui/           # GuestMenu, LangDropdown
types/               # Shared TypeScript types
```

### API layer (`api/` — Vercel Edge/Serverless Functions)

| File | Purpose |
|------|---------|
| `anthropic.js` | Proxies AI API calls; verifies Supabase JWT, enforces CORS, rate-limits |
| `create-purchase.js` | Initiates Stripe checkout |
| `stripe-webhook.js` | Handles Stripe events (token top-ups) |
| `validate-promo.js` | Validates promo codes |
| `healthcheck.js` | Health endpoint |
| `_ratelimit.js` | Upstash Redis rate-limit helper |
| `_newrelic.js` | New Relic observability wrapper |

### Key subsystems

**Custom Supabase client (`lib/supabase.ts`):** REST-based, not `@supabase/supabase-js`. Manages session in `localStorage`, cross-tab refresh coordination via `BroadcastChannel("chs_session")` and a lock key to prevent race conditions on single-use refresh tokens.

**AI generation flow:**
1. `chs-app.tsx` Page 1: user fills form (business description, tier, language)
2. Calls `api/anthropic.js` → AI model → ADDIS + BLIPS + KBRs
3. Optional Beyond Profit call (separate prompt function)
4. Page 2 renders results in a tabbed interface

**Tier token costs:**
| Tier | Tokens |
|------|--------|
| Compact | 3 |
| Mid-Size | 5 |
| Executive | 10 |
| Luxury | 25 |

**i18n:** All UI strings in `i18n/translations.js` as a `T` object. Languages: EN, ES, FR, PT.

**Workspace roles:** `owner` > `co-owner` > `member`.

### Database Tables

| Table | Key columns |
|-------|-------------|
| `profiles` | `email`, `token_balance` |
| `workspaces` | `name`, `created_by`, `token_balance` |
| `workspace_members` | `workspace_id`, `user_id`, `role`, `invited_by` |
| `chassis_history` | `business_name`, `business_input`, `tier`, `tokens_consumed`, `lang`, `chassis_data`, `beyond_profit_data`, `beyond_profit_selections` |

### Environment variables (`.env` / Vercel dashboard)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`, `ANTHROPIC_API_KEY`, Stripe keys, Upstash keys, New Relic keys.

### Vercel configuration (`vercel.json`)

Security headers applied globally. Function timeouts: `anthropic.js` 60s, others 5–15s.
