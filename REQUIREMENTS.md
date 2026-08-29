## 1. Overview
Build a SaaS-style "All-in-One AI Chat" web app where authenticated users can chat with multiple LLM providers (OpenAI, Anthropic, Gemini) from one interface, with streaming responses, usage/cost tracking, rate limiting, and a credit-based billing system. Multi-tenant architecture: every user only sees their own data.

## 2. Tech Stack
- Frontend: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- Backend: Next.js API routes / Route Handlers (Node.js runtime)
- Database & Auth: Supabase (Postgres + Auth + Row Level Security)
- Caching / Rate limiting: Redis (Upstash Redis for serverless compatibility)
- Billing: Stripe (Checkout + Webhooks)
- Deployment: Vercel (app) + Supabase (DB/auth) + Upstash (Redis)

## 3. Core Features

### 3.1 Authentication
- Email/password signup and login via Supabase Auth
- Google OAuth login
- Session persistence via Supabase SSR helpers
- Protected routes: unauthenticated users redirected to /login
- On signup: auto-create a `profiles` row with default free credit balance (e.g. 100 credits)

### 3.2 Multi-Model Chat
- Chat UI with a model selector dropdown: OpenAI (gpt-4o-mini or similar), Anthropic (claude), Gemini
- Each conversation is tied to one model at a time, but user can switch models mid-conversation (new messages use newly selected model)
- Message history displayed in a scrollable thread, distinguishing user vs assistant messages
- Markdown rendering for assistant responses (code blocks, lists, etc.)
- Ability to create new conversations and switch between past conversations (sidebar list)
- Delete conversation
- Rename conversation

### 3.3 Real-Time Streaming (SSE)
- Backend route streams tokens from the selected provider's API to the frontend using Server-Sent Events (or ReadableStream)
- Frontend renders tokens incrementally as they arrive (typing effect)
- Handle stream errors gracefully (show partial message + error indicator, don't lose partial content)
- Support cancel/stop generation mid-stream (abort controller)

### 3.4 Token Counting & Cost Tracking
- Count input tokens (prompt) and output tokens (completion) per request
  - Use provider-specific tokenizers where available (e.g. tiktoken for OpenAI); reasonable approximation acceptable for others if exact tokenizer unavailable
- Store per-message token counts and computed cost (based on provider's per-1k-token pricing, configurable in a pricing config file/table)
- Deduct cost from user's credit balance after each completed response
- Usage dashboard page showing:
  - Total tokens used (input/output) over time
  - Total cost incurred
  - Breakdown by model/provider
  - Simple chart (daily/weekly usage)

### 3.5 Rate Limiting (Redis)
- Per-user rate limit on message sends, tiered by plan:
  - Free tier: e.g. 20 messages/day
  - Paid tier: higher or unlimited (configurable)
- Use Redis (Upstash) sliding window or token bucket algorithm
- Return clear error response (HTTP 429) with retry-after info when limit exceeded
- Frontend shows remaining quota / friendly rate-limit message

### 3.6 Credits & Subscription Billing (Stripe)
- Credit-based system: each message consumes credits based on tokens used
- Users can:
  - Buy one-time credit packs (Stripe Checkout, one-time payment)
  - OR subscribe to a monthly plan that grants recurring credits (Stripe Subscriptions)
- Stripe webhook endpoint to handle:
  - `checkout.session.completed` → add credits / activate subscription
  - `invoice.paid` → renew monthly credits
  - `customer.subscription.deleted` → downgrade to free tier
- Billing page: current plan, credit balance, purchase history, "Buy more credits" / "Manage subscription" (Stripe customer portal)
- Block message sending when credit balance is insufficient; show upgrade prompt

### 3.7 Multi-Tenant Database Architecture
- Postgres schema (via Supabase), core tables:
  - `profiles` (id, email, plan, credit_balance, stripe_customer_id, created_at)
  - `conversations` (id, user_id, title, model, created_at, updated_at)
  - `messages` (id, conversation_id, user_id, role, content, model, input_tokens, output_tokens, cost, created_at)
  - `usage_logs` (id, user_id, date, total_tokens, total_cost) — optional aggregation table for faster dashboard queries
  - `transactions` (id, user_id, stripe_event_id, type, amount, credits_added, created_at)
- Row Level Security (RLS) policies on every table: users can only SELECT/INSERT/UPDATE/DELETE rows where `user_id = auth.uid()`
- All API routes must verify the authenticated user server-side before querying (never trust client-supplied user_id)

### 3.8 Admin/Config (optional, nice-to-have)
- Simple config file or table for model pricing (cost per 1k input/output tokens per provider), so pricing can be updated without code changes

## 4. Non-Functional Requirements
- Type-safe throughout (no `any` unless justified)
- Error handling: all API routes return structured JSON errors with proper HTTP status codes
- Loading and empty states on all data-fetching UI
- Responsive design (usable on mobile width)
- Environment variables for all API keys/secrets (never hardcoded); provide a `.env.example`
- Basic input validation (e.g. zod) on all API route inputs
- Secrets for provider API keys stored server-side only, never exposed to client

## 5. API Routes (suggested)
- `POST /api/chat` — send message, stream response (SSE), handles token counting, credit deduction, rate limiting
- `GET /api/conversations` — list user's conversations
- `POST /api/conversations` — create conversation
- `DELETE /api/conversations/:id` — delete conversation
- `GET /api/conversations/:id/messages` — get message history
- `GET /api/usage` — usage/cost summary for dashboard
- `POST /api/stripe/checkout` — create Stripe Checkout session
- `POST /api/stripe/webhook` — handle Stripe events
- `POST /api/stripe/portal` — create Stripe customer portal session

## 6. Pages
- `/login`, `/signup` — auth
- `/chat` — main chat interface (sidebar + active conversation)
- `/dashboard` — usage & cost analytics
- `/billing` — plan, credits, purchase/upgrade
- `/settings` — profile settings, API key management (if allowing user's own keys — optional stretch goal)

## 7. Stretch Goals (only after core is working)
- Let users bring their own API keys instead of using pooled ones
- File/image upload support in chat (for models that support vision)
- Team/workspace support (multiple users sharing one tenant)
- Prompt templates / saved system prompts
- Export conversation as markdown/PDF

## 8. Deliverable Expectations
- Fully deployed, working app with a public URL
- Clean, incremental Git history (not one giant commit)
- README with setup instructions, architecture overview, and a schema diagram
- `.env.example` with all required environment variables listed
