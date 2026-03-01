# MARI Jewellers ERP System

A comprehensive, mobile-first ERP system built specifically for jewelry retail management.

## Features

- **Inventory Management** - Track jewelry items, stones, raw materials with batch-based entry
- **Sales & POS** - Point of sale, invoicing, quotations
- **Customer Management** - CRM with loyalty programs
- **Accounting & Finance** - Complete financial management with GST compliance
- **Gold Loan Application** - Manage gold pawning and loan tracking
- **Custom Orders** - Design approvals and manufacturing tracking
- **Repairs & Exchange** - Repair jobs and old gold exchange
- **Multi-Store Support** - Hierarchical store management with role-based access

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Shadcn/ui components
- Zustand (global state)
- React Query (server state)
- React Hook Form + Zod

### Backend
- Express.js
- TypeScript
- Drizzle ORM
- PostgreSQL
- Redis
- JWT Authentication

### Infrastructure
- Turborepo (monorepo)
- Docker & Docker Compose
- MinIO (S3-compatible storage)

## Project Structure

```
mari-jewellers-erp/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Express.js backend
├── packages/
│   ├── shared/           # Shared types and constants
│   └── config/           # Shared configurations
└── scripts/              # Utility scripts
```

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker and Docker Compose

## 🚀 Quick Start

**New to the project?** Check out the [Quick Start Guide](QUICKSTART.md) for a 5-minute setup!

### Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get up and running in 5 minutes
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Complete setup and authentication guide
- **[INVENTORY_MODULE_GUIDE.md](INVENTORY_MODULE_GUIDE.md)** - Inventory management documentation
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Current project status and progress

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd mari-jewellers-erp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit [.env](.env) and update the values as needed. The defaults work for local development.

### 4. Start Docker services

Start PostgreSQL, Redis, and MinIO:

```bash
npm run docker:up
```

This will start:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **MinIO** on ports 9000 (API) and 9001 (Console)

### 5. Run database migrations

Generate and run the initial database migration:

```bash
cd apps/api
npm run db:generate
npm run db:migrate
```

### 6. Seed the database

Seed the database with initial data (roles, permissions, admin user):

```bash
npm run db:seed
```

**Important**: Note the Store ID printed in the output - you'll need it for login!

### 7. Start the development servers

In the root directory:

```bash
npm run dev
```

This will start:
- **Frontend** (Next.js) on [http://localhost:3000](http://localhost:3000)
- **Backend** (Express.js) on [http://localhost:4000](http://localhost:4000)

### 8. Login

Visit [http://localhost:3000](http://localhost:3000) and login with:
- **Email**: `admin@marijewellers.com`
- **Password**: `Admin@123`
- **Store ID**: Use the Store ID from seed output

## Available Scripts

### Root Commands

- `npm run dev` - Start all apps in development mode
- `npm run build` - Build all apps
- `npm run lint` - Lint all apps
- `npm run clean` - Clean all build artifacts
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services

### Database Commands

- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with initial data
- `npm run db:studio` - Open Drizzle Studio (database GUI)

## Development Workflow

### 1. Database Changes

When you need to modify the database schema:

1. Edit [apps/api/src/db/schema.ts](apps/api/src/db/schema.ts)
2. Generate migration: `cd apps/api && npm run db:generate`
3. Review the migration in [apps/api/src/db/migrations](apps/api/src/db/migrations)
4. Run migration: `npm run db:migrate`

### 2. Adding New Modules

Follow the modular structure in [apps/api/src/modules](apps/api/src/modules):

```
modules/
  └── module-name/
      ├── module-name.controller.ts
      ├── module-name.service.ts
      ├── module-name.routes.ts
      └── module-name.validation.ts
```

### 3. Shared Types

Add shared types and constants in [packages/shared/src](packages/shared/src):

- `types/` - TypeScript interfaces
- `constants/` - Shared constants (roles, permissions, etc.)
- `utils/` - Shared utility functions

## Architecture Highlights

### Multi-Store Hierarchy

The system supports multiple stores with parent-child relationships. Each user is assigned roles scoped to specific stores, allowing for flexible permission management across store locations.

### Role-Based Access Control (RBAC)

Pre-defined roles:
- **Super Admin** - Full system access
- **Store Manager** - Full access to assigned store
- **Salesperson** - Sales and customer operations
- **Accountant** - Financial operations
- **Cashier** - POS operations

### Batch-Based Inventory Entry

A unique card-based UI for entering inventory items in batches with real-time validation to ensure:
- Total item count matches expected count
- Total weight matches expected weight
- Prevents errors during bulk inventory entry

### Mobile-First Design

The entire UI is optimized for mobile devices with:
- Minimum 44x44px touch targets
- Responsive layouts
- Bottom sheet modals
- Progressive Web App (PWA) capabilities

## Security

- JWT-based authentication with short-lived access tokens (15 min)
- Refresh tokens stored in httpOnly cookies (7 days)
- Bcrypt password hashing (12 rounds)
- RBAC with granular permissions
- Store-level data isolation
- Audit logging for all critical operations

## API Documentation

Once the server is running, visit:
- API Base: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- Health Check: [http://localhost:4000/health](http://localhost:4000/health)

## Database Access

### PostgreSQL

```bash
# Connect via psql
docker exec -it mari-erp-postgres psql -U mari_admin -d mari_erp_dev

# Or use Drizzle Studio
npm run db:studio
```

### Redis

```bash
# Connect via redis-cli
docker exec -it mari-erp-redis redis-cli
```

### MinIO Console

Visit [http://localhost:9001](http://localhost:9001)
- Username: `mari_minio_admin`
- Password: `mari_minio_password_2025`

## Troubleshooting

### Port Already in Use

If ports are already in use, either stop the conflicting services or update the ports in [.env](.env) and [docker-compose.yml](docker-compose.yml).

### Database Connection Issues

Ensure Docker services are running:

```bash
docker ps
```

Check logs:

```bash
docker logs mari-erp-postgres
docker logs mari-erp-redis
```

### Node Module Issues

Clear and reinstall:

```bash
npm run clean
rm -rf node_modules
npm install
```

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Write tests for new features
4. Submit a pull request

## License

Proprietary - MARI Jewellers

## Support

For issues and questions, contact the development team.

---

Built with ❤️ for MARI Jewellers
