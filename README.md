# Dream Journal AI - Backend

Production-ready Node.js/TypeScript backend for Dream Journal AI.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **AI**: Anthropic Claude API

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Go to Settings > API to get your keys:
   - Project URL → `SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Set Up Stripe

1. Create account at [stripe.com](https://stripe.com)
2. Create a Product with a monthly recurring price ($9.99/month recommended)
3. Get your keys from Developers > API Keys:
   - Secret key → `STRIPE_SECRET_KEY`
   - Price ID → `STRIPE_PRICE_ID_MONTHLY`
4. Set up webhook (after deploying):
   - Endpoint: `https://your-api.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Signing secret → `STRIPE_WEBHOOK_SECRET`

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

ANTHROPIC_API_KEY=sk-ant-...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...

FREE_ANALYSES_PER_MONTH=3
```

### 5. Run Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3001`

## API Endpoints

### Authentication

All protected endpoints require `Authorization: Bearer <supabase_access_token>` header.

### Dreams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dreams` | List all dreams |
| GET | `/api/dreams/:id` | Get single dream |
| POST | `/api/dreams` | Create dream |
| PATCH | `/api/dreams/:id` | Update dream |
| DELETE | `/api/dreams/:id` | Delete dream |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analysis/status` | Check analysis quota |
| POST | `/api/analysis` | Analyze a dream |

### Billing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing/status` | Get subscription status |
| POST | `/api/billing/checkout` | Create checkout session |
| POST | `/api/billing/portal` | Open billing portal |
| POST | `/api/billing/webhook` | Stripe webhook (no auth) |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/me` | Get current user profile |
| DELETE | `/api/auth/me` | Delete account |

## Deployment (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repo
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Add all env variables
4. Deploy!

## Business Model

- **Free Tier**: 3 AI analyses per month
- **Pro ($9.99/month)**: Unlimited analyses

The analysis limit resets on the 1st of each month.
