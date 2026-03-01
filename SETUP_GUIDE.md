# MARI Jewellers ERP - Setup Guide

## ✅ Phase 1 & 2 Complete: Foundation + Authentication

Congratulations! The foundation and authentication system for your MARI Jewellers ERP is now complete.

## What's Been Built

### 🏗️ Infrastructure
- ✅ Turborepo monorepo with workspaces
- ✅ Docker Compose (PostgreSQL, Redis, MinIO)
- ✅ Next.js 14 frontend with App Router
- ✅ Express.js backend with TypeScript
- ✅ Drizzle ORM with PostgreSQL

### 🔐 Authentication System
- ✅ JWT-based authentication (access + refresh tokens)
- ✅ Bcrypt password hashing (12 rounds)
- ✅ Role-Based Access Control (RBAC)
- ✅ Multi-store hierarchy support
- ✅ Session management with Redis
- ✅ Secure httpOnly cookie for refresh tokens

### 🗄️ Database
- ✅ Core authentication schema
  - users
  - stores
  - roles
  - permissions
  - role_permissions
  - user_roles
  - sessions
  - audit_logs

### 🎨 Frontend
- ✅ Login page with form validation
- ✅ Dashboard layout with header
- ✅ Auth store (Zustand + persistence)
- ✅ API client with auto token refresh
- ✅ Protected routes middleware
- ✅ Shadcn/ui components (Button, Input, Label)

### ⚙️ Backend
- ✅ Auth API endpoints (login, register, refresh, logout, me)
- ✅ Auth middleware (JWT verification)
- ✅ RBAC middleware (permission checking)
- ✅ Store access middleware
- ✅ Winston logger
- ✅ Error handling
- ✅ Database seed script

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

The default values work for local development. Update if needed.

### 3. Start Docker Services

```bash
npm run docker:up
```

This starts PostgreSQL, Redis, and MinIO.

### 4. Generate and Run Database Migrations

```bash
cd apps/api
npm run db:generate
npm run db:migrate
```

### 5. Seed the Database

```bash
npm run db:seed
```

**Important**: Take note of the Store ID printed in the output - you'll need it for login!

Example output:
```
✅ Created store: MARI Jewellers - Main Store
Store ID: 123e4567-e89b-12d3-a456-426614174000
Store Code: MAIN-001
```

### 6. Start Development Servers

```bash
cd ../..
npm run dev
```

This starts:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:4000](http://localhost:4000)

## 🔑 Default Credentials

**Email**: `admin@marijewellers.com`
**Password**: `Admin@123`
**Store ID**: Check the output from `npm run db:seed`

⚠️ **IMPORTANT**: Change the admin password after first login!

## 🧪 Testing the Authentication

### 1. Test Login (Frontend)

1. Open [http://localhost:3000](http://localhost:3000)
2. You should be redirected to [http://localhost:3000/login](http://localhost:3000/login)
3. Enter the credentials above
4. You'll be redirected to the dashboard

### 2. Test API Endpoints (Backend)

#### Login
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@marijewellers.com",
    "password": "Admin@123",
    "storeId": "YOUR_STORE_ID_HERE"
  }'
```

#### Get Current User (Protected Route)
```bash
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📋 Available Scripts

### Root Level

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in development mode |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |
| `npm run docker:up` | Start Docker services |
| `npm run docker:down` | Stop Docker services |

### Database (run from root or apps/api)

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate migrations from schema |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:seed` | Seed database with initial data |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |

## 📂 Project Structure

```
mari-jewellers-erp/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   └── login/  # Login page
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── dashboard/
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   └── ui/         # Shadcn/ui components
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts
│   │   │   │   └── utils.ts
│   │   │   ├── store/
│   │   │   │   └── auth-store.ts
│   │   │   └── middleware.ts   # Route protection
│   │   └── package.json
│   │
│   └── api/                    # Express.js backend
│       ├── src/
│       │   ├── config/
│       │   │   ├── database.ts
│       │   │   ├── env.ts
│       │   │   └── redis.ts
│       │   ├── db/
│       │   │   ├── schema.ts   # Database schema
│       │   │   ├── migrate.ts
│       │   │   └── seed.ts
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts
│       │   │   ├── rbac.middleware.ts
│       │   │   └── store-access.middleware.ts
│       │   ├── modules/
│       │   │   └── auth/
│       │   │       ├── auth.controller.ts
│       │   │       ├── auth.service.ts
│       │   │       ├── auth.routes.ts
│       │   │       └── auth.validation.ts
│       │   ├── utils/
│       │   │   ├── jwt.ts
│       │   │   ├── password.ts
│       │   │   └── logger.ts
│       │   ├── app.ts
│       │   └── index.ts
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared code
│       └── src/
│           ├── constants/
│           │   ├── roles.ts
│           │   └── permissions.ts
│           └── types/
│               └── entities/
│                   └── user.ts
│
└── docker-compose.yml
```

## 🔒 Security Features

1. **Password Security**
   - Bcrypt hashing with 12 salt rounds
   - Password complexity requirements (uppercase, lowercase, number, 8+ chars)

2. **Token Security**
   - Short-lived access tokens (15 minutes)
   - Refresh tokens (7 days) in httpOnly cookies
   - Automatic token refresh on expiry

3. **API Security**
   - CORS configuration
   - Helmet security headers
   - Rate limiting (ready to configure)
   - Request validation with Zod

4. **Session Management**
   - Redis session storage
   - Session invalidation on logout
   - Token hash storage (not plain tokens)

5. **Audit Trail**
   - All critical operations logged
   - User actions tracked
   - IP address and user agent recording

## 👥 Pre-configured Roles

| Role | Permissions |
|------|-------------|
| **Super Admin** | Full system access across all stores |
| **Store Manager** | Full access within assigned store (except user/system management) |
| **Salesperson** | Inventory (read), Sales, Customers, Reports (read) |
| **Accountant** | Accounting, Reports, Sales (read) |
| **Cashier** | POS operations, Payment processing |

## 🎯 API Endpoints

### Authentication

```
POST   /api/v1/auth/register    - Register new user
POST   /api/v1/auth/login       - Login
POST   /api/v1/auth/refresh     - Refresh access token
POST   /api/v1/auth/logout      - Logout
GET    /api/v1/auth/me          - Get current user (protected)
```

## 🐛 Troubleshooting

### Docker containers not starting

```bash
docker ps  # Check running containers
docker logs mari-erp-postgres
docker logs mari-erp-redis
```

### Database connection failed

1. Ensure Docker containers are running
2. Check DATABASE_URL in .env matches docker-compose.yml
3. Verify PostgreSQL is accessible on port 5432

### Frontend can't connect to API

1. Check API is running on port 4000
2. Verify NEXT_PUBLIC_API_URL in .env
3. Check CORS_ORIGIN in API .env matches frontend URL

### Refresh token not working

1. Check cookie settings in browser
2. Ensure `withCredentials: true` in axios config
3. Verify CORS credentials are enabled

## 📝 Next Steps

Now that authentication is complete, you can proceed with:

1. **Phase 3: Inventory Management** (Recommended next)
   - Batch-based inventory entry
   - Stock management
   - Categories and items

2. **Phase 4: Sales & POS**
   - Point of sale interface
   - Invoice generation
   - Payment processing

3. **Phase 5: Customer Management**
   - Customer profiles
   - Loyalty program
   - Purchase history

Continue with the implementation plan in the [README.md](README.md)!

## 🆘 Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review the [implementation plan](/Users/marijewellers/.claude/plans/expressive-stirring-muffin.md)
- Check logs: `docker logs mari-erp-postgres` or `docker logs mari-erp-api`

---

**Authentication System: ✅ Complete**
**Ready for Module Development!** 🎉
