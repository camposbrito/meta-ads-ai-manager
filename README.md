# Meta Ads AI Manager

SaaS platform that analyzes Meta Ads performance and suggests optimization actions.

## Project Structure

```
meta-ads-ai-manager/
├── backend/          # Node.js + TypeScript + Express API
├── frontend/         # React + TypeScript + Vite
├── docker/           # Docker configuration files
├── docs/             # Documentation
└── docker-compose.yml
```

## Prerequisites

- Node.js >= 20
- Docker and Docker Compose (optional, for containerized development)
- MySQL 8.0+ (if running without Docker)

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Access services
# Frontend: http://localhost
# Backend: http://localhost:3000
# API Health: http://localhost:3000/health
```

### Option 2: Local Development

#### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp ../.env.example .env

# Run development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
npm run lint:fix

# Format code
npm run format
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp ../.env.example .env

# Run development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

See `.env.example` for all required environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Backend server port | 3000 |
| NODE_ENV | Environment mode | development |
| DB_HOST | MySQL host | localhost |
| DB_PORT | MySQL port | 3306 |
| DB_USER | Database user | root |
| DB_PASSWORD | Database password | password |
| DB_NAME | Database name | meta_ads_db |
| META_ADS_ACCESS_TOKEN | Meta Ads API access token | - |
| META_ADS_ACCOUNT_ID | Meta Ads account ID | - |
| JWT_SECRET | JWT signing secret | - |
| JWT_EXPIRES_IN | JWT token expiration | 7d |

## API Endpoints

- `GET /health` - Health check endpoint

## Development

### Backend Scripts

```bash
npm run dev      # Start development server with nodemon
npm run build    # Compile TypeScript
npm run start    # Start production server
npm run lint     # Run ESLint
npm run lint:fix # Fix ESLint issues
npm run format   # Format code with Prettier
```

### Frontend Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint (if configured)
```

## Database

The project uses Sequelize ORM with MySQL. Migrations and models will be added as the project evolves.

### Running Migrations

```bash
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:undo
npx sequelize-cli db:seed
```

## Docker

### Build Images

```bash
docker-compose build
```

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Access Database

```bash
docker exec -it meta_ads_mysql mysql -u root -p
```

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
