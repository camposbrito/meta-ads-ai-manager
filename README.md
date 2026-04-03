# Meta Ads AI Manager

SaaS platform that analyzes Meta Ads performance and suggests optimization actions using AI-powered rules.

## Features

- **Multi-tenant Architecture**: Support for multiple organizations with strict data isolation
- **Meta Ads Integration**: Connect multiple Meta Ad accounts per organization
- **Automated Sync**: Daily synchronization of campaigns, ad sets, ads, and performance metrics
- **Optimization Engine**: Rule-based decision engine with configurable thresholds
- **Smart Suggestions**: AI-powered recommendations for:
  - Pausing underperforming ads
  - Duplicating high-performing ads
  - Increasing/decreasing budgets
- **Subscription Plans**: Free, Pro, and Agency tiers with different limits
- **Real-time Dashboard**: Performance charts, metrics, and insights
- **Team Management**: Multi-user support with role-based access control

## Tech Stack

### Backend
- Node.js + TypeScript
- Express.js
- Sequelize ORM
- MySQL 8.0
- Redis (for BullMQ queues)
- BullMQ (background jobs)
- JWT Authentication

### Frontend
- React 18 + TypeScript
- Vite
- TailwindCSS
- Recharts (data visualization)
- React Router

### Infrastructure
- Docker + Docker Compose
- Nginx (reverse proxy)

## Project Structure

```
meta-ads-ai-manager/
├── backend/
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Auth, error handling
│   │   ├── models/          # Sequelize models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── queues/          # BullMQ queues
│   │   ├── jobs/            # Scheduled jobs
│   │   └── index.ts         # Entry point
│   ├── migrations/          # Database migrations
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # React contexts
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client
│   │   ├── types/           # TypeScript types
│   │   └── App.tsx          # Main app component
│   ├── package.json
│   └── vite.config.ts
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf
├── docs/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Quick Start

### Prerequisites

- Node.js >= 20
- Docker and Docker Compose
- Git

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/camposbrito/meta-ads-ai-manager.git
cd meta-ads-ai-manager

# Copy environment file
cp .env.example .env

# Generate secure keys
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost
# Backend API: http://localhost:3000/api
# API Health: http://localhost:3000/api/health
```

### Option 2: Local Development

#### 1. Setup Database and Redis

```bash
# Using Docker for dependencies only
docker run -d --name mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=meta_ads_db \
  -e MYSQL_USER=meta_ads \
  -e MYSQL_PASSWORD=password \
  mysql:8.0

docker run -d --name redis -p 6379:6379 redis:7-alpine
```

#### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp ../.env.example .env

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

#### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp ../.env.example .env

# Start development server
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Backend server port | 3000 |
| NODE_ENV | Environment mode | development |
| DB_HOST | MySQL host | localhost |
| DB_PORT | MySQL port | 3306 |
| DB_USER | Database user | root |
| DB_PASSWORD | Database password | password |
| DB_NAME | Database name | meta_ads_db |
| REDIS_HOST | Redis host | localhost |
| REDIS_PORT | Redis port | 6379 |
| ENCRYPTION_KEY | Key for encrypting tokens | (required) |
| JWT_SECRET | JWT signing secret | (required) |
| JWT_EXPIRES_IN | Access token expiration | 7d |
| REFRESH_TOKEN_EXPIRES_IN | Refresh token expiration | 7d |
| PASSWORD_RESET_SECRET | Secret used in password reset tokens | (required) |
| PASSWORD_RESET_EXPIRES_IN | Password reset token expiration | 1h |
| SMTP_HOST | SMTP host for password reset emails | (optional) |
| SMTP_PORT | SMTP port | 587 |
| SMTP_USER | SMTP username | (optional) |
| SMTP_PASS | SMTP password | (optional) |
| SMTP_FROM | Sender email | no-reply@metaadsai.local |
| CORS_ORIGIN | Frontend URL | http://localhost:5173 |

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh-token` | Refresh access token |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |

### Ad Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ad-accounts` | List connected accounts |
| POST | `/api/ad-accounts/connect` | Connect new account |
| DELETE | `/api/ad-accounts/:id` | Disconnect account (`?delete_history=true` to remove historical data) |
| POST | `/api/ad-accounts/:id/sync` | Trigger sync |
| GET | `/api/ad-accounts/:id/sync-status` | Get sync status |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/overview` | Get overview metrics |
| GET | `/api/dashboard/performance` | Get performance chart data |
| GET | `/api/dashboard/campaigns` | List campaigns |
| GET | `/api/dashboard/top-ads` | Get top performing ads |

### Optimization

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/optimization/rules` | List optimization rules |
| POST | `/api/optimization/rules` | Create rule |
| PUT | `/api/optimization/rules/:id` | Update rule |
| DELETE | `/api/optimization/rules/:id` | Delete rule |
| PATCH | `/api/optimization/rules/:id/toggle` | Toggle rule |
| GET | `/api/optimization/suggestions` | List suggestions |
| POST | `/api/optimization/suggestions/:id/accept` | Accept suggestion |
| POST | `/api/optimization/suggestions/:id/reject` | Reject suggestion |
| POST | `/api/optimization/run` | Run optimization analysis |

### Billing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing/plans` | List available plans |
| GET | `/api/billing/subscription` | Get current subscription |
| POST | `/api/billing/upgrade` | Upgrade plan |
| POST | `/api/billing/cancel` | Cancel subscription |

## Subscription Plans

### Free
- 1 Ad Account
- 1 Daily Sync
- 2 Team Members
- Basic Optimization
- 30 Days Data Retention

### Pro ($49/month)
- 5 Ad Accounts
- 4 Daily Syncs
- 10 Team Members
- Advanced Optimization
- Auto-optimization
- 90 Days Data Retention
- Email Support

### Agency ($199/month)
- 50 Ad Accounts
- 24 Daily Syncs (hourly)
- 100 Team Members
- Full Optimization Suite
- Auto-optimization
- 365 Days Data Retention
- Priority Support

## Optimization Rules

The platform includes a rule-based optimization engine. Example rules:

### Pause Underperforming Ads
```json
{
  "name": "Pause High CPA Ads",
  "rule_type": "pause_ad",
  "conditions": [
    { "field": "cpa", "operator": "gt", "value": 50 },
    { "field": "impressions", "operator": "gte", "value": 1000 }
  ],
  "actions": [{ "type": "pause" }],
  "min_spend_threshold": 100,
  "evaluation_period_days": 7
}
```

### Duplicate Winning Ads
```json
{
  "name": "Duplicate High CTR Low CPA Ads",
  "rule_type": "duplicate_ad",
  "conditions": [
    { "field": "ctr", "operator": "gt", "value": 0.02 },
    { "field": "cpa", "operator": "lt", "value": 20 }
  ],
  "actions": [{ "type": "duplicate" }],
  "min_spend_threshold": 50,
  "evaluation_period_days": 7
}
```

### Increase Budget
```json
{
  "name": "Increase Budget for High ROAS Campaigns",
  "rule_type": "increase_budget",
  "conditions": [
    { "field": "roas", "operator": "gt", "value": 3 }
  ],
  "actions": [{ "type": "increase_budget", "params": { "percentage": 20 } }],
  "min_spend_threshold": 200,
  "evaluation_period_days": 14
}
```

## Development

### Backend Commands

```bash
cd backend

# Development
npm run dev

# Build
npm run build

# Start production
npm start

# Lint
npm run lint
npm run lint:fix

# Format
npm run format

# Database migrations
npm run migrate
npm run migrate:undo
```

### Frontend Commands

```bash
cd frontend

# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview
```

### Worker Process

The worker process handles background jobs:

```bash
cd backend
npm run worker
```

## Database Schema

### Core Entities

- **Organizations**: Multi-tenant organizations
- **Users**: User accounts with roles
- **AdAccounts**: Connected Meta Ad accounts
- **Campaigns**: Meta campaigns
- **AdSets**: Meta ad sets
- **Ads**: Meta ads
- **Insights**: Performance metrics (daily)
- **OptimizationRules**: Configurable optimization rules
- **OptimizationSuggestions**: AI-generated suggestions
- **ExecutedActions**: History of executed optimizations
- **SyncJobs**: Sync job tracking
- **RefreshTokens**: JWT refresh tokens

## Security

- JWT authentication with refresh tokens
- Encrypted storage of Meta access tokens
- Role-based access control (admin/member)
- Strict multi-tenant data isolation
- CORS protection
- Rate limiting
- Helmet.js security headers

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
