# MARI Jewellers ERP - Quick Start Guide

## 🚀 Get Up and Running in 5 Minutes

This guide will help you set up and run the complete ERP system including the new Inventory Management module.

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose installed
- Terminal/Command Line access

## Step-by-Step Setup

### 1. Environment Variables Setup

```bash
# Copy the example .env file
cp .env.example .env
```

The default values work perfectly for local development. No changes needed!

### 2. Install Dependencies

```bash
# Install all dependencies for the monorepo
npm install
```

This will install dependencies for:
- Root workspace
- Frontend (Next.js)
- Backend (Express.js)
- Shared packages

### 3. Start Docker Services

```bash
# Start PostgreSQL, Redis, and MinIO
npm run docker:up
```

Wait for all services to start (about 10-15 seconds).

Verify services are running:
```bash
docker ps
```

You should see:
- `mari-erp-postgres` (PostgreSQL)
- `mari-erp-redis` (Redis)
- `mari-erp-minio` (MinIO)

### 4. Generate and Run Database Migrations

```bash
# Navigate to API directory
cd apps/api

# Generate migrations from schema
npm run db:generate

# Run migrations to create tables
npm run db:migrate
```

This creates all database tables including:
- Authentication tables (users, stores, roles, permissions, etc.)
- Inventory tables (items, batches, categories, stock levels, etc.)

### 5. Seed Initial Data

```bash
# Still in apps/api directory
npm run db:seed
```

**IMPORTANT**: Take note of the Store ID printed in the output!

Example output:
```
✅ Created store: MARI Jewellers - Main Store
Store ID: 123e4567-e89b-12d3-a456-426614174000
Store Code: MAIN-001

✅ Created admin user
Email: admin@marijewellers.com
Password: Admin@123
```

### 6. Start Development Servers

```bash
# Go back to root directory
cd ../..

# Start both frontend and backend
npm run dev
```

This starts:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:4000

## 🎯 First Login

1. Open your browser and go to: http://localhost:3000
2. You'll be redirected to the login page
3. Enter credentials:
   - **Email**: `admin@marijewellers.com`
   - **Password**: `Admin@123`
   - **Store ID**: Use the Store ID from the seed output
4. Click "Sign In"
5. You'll be redirected to the Dashboard

## 📦 Test the Inventory Module

### Create Your First Batch

1. From the Dashboard, click on the **Inventory** module
2. Click **"Add Inventory Batch"** button
3. Fill in batch details:
   - **Purchase Date**: Select today's date
   - **Expected Total Items**: Enter `3`
   - **Expected Total Weight**: Enter `15.5` (grams)
   - **Notes**: Enter "Test batch - Gold jewelry"
4. Click **"Create Batch & Add Items"**

### Add Items to the Batch

You'll be redirected to the batch entry page. Now add 3 items:

**Item 1: Gold Ring**
- Name: `Gold Ring with Diamond`
- Item Type: `Finished Goods`
- Metal Type: `Gold`
- Purity: `22K`
- Gross Weight: `5.250`
- Net Weight: `4.900`
- Stone Weight: `0.350`
- Click **"Save & Add Next"**

Watch the progress bars update! You should see:
- Items: 1/3 (33%)
- Weight: 5.250g/15.500g (34%)

**Item 2: Gold Pendant**
- Name: `Gold Pendant`
- Item Type: `Finished Goods`
- Metal Type: `Gold`
- Purity: `22K`
- Gross Weight: `6.100`
- Net Weight: `5.800`
- Stone Weight: `0.300`
- Click **"Save & Add Next"**

Progress now shows:
- Items: 2/3 (67%)
- Weight: 11.350g/15.500g (73%)

**Item 3: Gold Earrings**
- Name: `Gold Earrings Pair`
- Item Type: `Finished Goods`
- Metal Type: `Gold`
- Purity: `22K`
- Gross Weight: `4.150`
- Net Weight: `3.900`
- Stone Weight: `0.250`
- Click **"Save & Add Next"**

Progress now shows:
- Items: 3/3 (100%) ✓ Items Match
- Weight: 15.500g/15.500g (100%) ✓ Weight Matches

### Complete the Batch

1. Once both counts match, the **"Complete Batch"** button turns green
2. Click **"Complete Batch"**
3. Batch status changes to "Completed"
4. All items are now in your inventory!

### View Your Inventory

1. Go back to the inventory page by clicking **"Back to Batches"**
2. Then click **"View All Inventory"**
3. You should see all 3 items with:
   - Auto-generated SKUs (e.g., `FG-123456-789`)
   - Stock level: 1 each
   - All details you entered

## 🔍 Explore Other Features

### View All Batches
- Navigate to "Inventory" → "View Batches"
- Filter by status: In Progress, Completed, Discrepancy
- See progress for any incomplete batches

### Search Inventory
- Use the search bar on the inventory page
- Search by name, SKU, or barcode
- Filter by category (once categories are added)

## 🛠️ Useful Commands

### Docker Management
```bash
npm run docker:up      # Start all Docker services
npm run docker:down    # Stop all Docker services
docker ps              # Check running containers
docker logs mari-erp-postgres  # View PostgreSQL logs
```

### Database Management
```bash
cd apps/api
npm run db:generate    # Generate new migrations
npm run db:migrate     # Run pending migrations
npm run db:seed        # Seed initial data
npm run db:studio      # Open Drizzle Studio (database GUI)
```

### Development
```bash
npm run dev            # Start all apps in dev mode
npm run build          # Build all apps
npm run lint           # Lint all code
```

## 🐛 Troubleshooting

### Docker containers won't start
```bash
# Check if ports are in use
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :9000  # MinIO

# If ports are busy, stop conflicting services or change ports in docker-compose.yml
```

### Database connection failed
```bash
# Ensure Docker is running
docker ps

# Restart containers
npm run docker:down
npm run docker:up

# Check .env file has correct DATABASE_URL
cat .env | grep DATABASE_URL
```

### Frontend can't connect to backend
```bash
# Check backend is running
curl http://localhost:4000/health

# Should return: {"status":"ok","timestamp":"..."}

# If not, check backend logs in the terminal
```

### Login fails with "Invalid credentials"
- Double-check the Store ID from seed output
- Ensure you're using: `admin@marijewellers.com` and `Admin@123`
- Check backend logs for errors

### Batch won't complete
- Ensure item count matches exactly (3/3)
- Ensure weight matches within ±0.1g tolerance
- If there's a discrepancy, you can force complete with a reason

## 📚 Next Steps

Now that your inventory system is running:

1. **Create Categories**: Use the API to create jewelry categories
   ```bash
   curl -X POST http://localhost:4000/api/v1/inventory/categories \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "Rings", "description": "All ring items"}'
   ```

2. **Add Stone Details**: When creating items, add detailed stone information

3. **Test Batch Discrepancies**: Try creating a batch where totals don't match to see the validation in action

4. **Explore the API**: Check out all endpoints in [INVENTORY_MODULE_GUIDE.md](INVENTORY_MODULE_GUIDE.md)

5. **Build Next Module**: Sales & POS, Customer Management, or any other module from the plan

## 📖 Additional Documentation

- [Main README](README.md) - Project overview and roadmap
- [Setup Guide](SETUP_GUIDE.md) - Detailed authentication and setup
- [Inventory Module Guide](INVENTORY_MODULE_GUIDE.md) - Complete inventory documentation

## 🆘 Need Help?

- Check the documentation files
- Review the implementation plan
- Check Docker logs: `docker logs mari-erp-postgres`
- Check backend logs in the terminal where `npm run dev` is running

---

**You're all set! Happy building!** 🎉
