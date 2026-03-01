# Inventory Valuation System Implementation

## Overview
This document describes the implementation of the dual-cost tracking system for the MARI Jewellers ERP. The system now tracks both the original purchase cost and the current market value of inventory items based on daily gold rates.

## Key Features Implemented

### 1. Dual Cost Tracking
- **Original Cost (`calculatedCost`)**: The cost at which the item was originally purchased/created
- **Current Market Value (`currentMarketValue`)**: The current value based on latest gold rates
- **Unrealized Gain/Loss (`unrealizedGainLoss`)**: The difference between current and original cost

### 2. Two Valuation Methods Supported

#### Method 1: Traditional Weight-Based Calculation
```
Fine Gold Weight = Net Weight × Purity Factor
Metal Cost = Fine Gold Weight × Gold Rate per Gram
Wastage Addition = Metal Cost × (Wastage % / 100)
Making Charges = Metal Cost × (Making Charge % / 100) OR Fixed Rate
Final Cost = Metal Cost + Wastage Addition + Making Charges + Stone Costs
```

#### Method 2: Rate-Based Calculation (Sovereign-Based)
```
Rate per Gram = Gold Rate per Sovereign ÷ 8
Base Metal Cost = Rate per Gram × Actual Weight
Rate Percentage = Category-specific markup (e.g., 94% for box chains, 105% for Monaco chains)
Final Cost = Base Metal Cost × (Rate Percentage ÷ 100)
```

### 3. Daily Revaluation Process
The system automatically runs a daily revaluation at 1 AM to update current market values based on the latest gold rates.

### 4. Real-time Valuation API
Provides instant access to both original and current costs when scanning items.

## API Endpoints

### Get Item Valuation Details
```
GET /api/v1/inventory/items/{itemId}/valuation
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "itemId": "uuid",
    "sku": "item-sku",
    "name": "Item Name",
    "originalCost": 45000.00,
    "currentMarketValue": 47500.00,
    "unrealizedGainLoss": 2500.00,
    "goldRateUsed": 52000.00,
    "lastValuationDate": "2024-01-15T00:00:00.000Z",
    "status": "available",
    "isHallmarked": true,
    "purity": "22K",
    "netWeight": 10.5,
    "grossWeight": 11.2
  }
}
```

## Database Schema Changes

The system uses the existing fields in the `inventory_items` table:
- `calculatedCost`: Original cost at time of creation
- `currentMarketValue`: Current market value based on latest gold rates
- `unrealizedGainLoss`: Difference between current and original cost
- `lastValuationDate`: When the current market value was last updated
- `costRatePercentage`: Rate percentage for rate-based calculation method

## Implementation Details

### 1. Cost Calculation During Item Creation
When adding items to inventory:
- If `costRatePercentage` is provided, uses rate-based method
- Otherwise, uses traditional weight-based method
- Sets both `calculatedCost` and `currentMarketValue` to the original cost initially
- Sets `unrealizedGainLoss` to 0 initially

### 2. Daily Revaluation Process
The scheduler service runs nightly at 1 AM:
- Retrieves the latest gold rates for each store
- Calculates current market value for all inventory items
- Updates `currentMarketValue`, `unrealizedGainLoss`, and `lastValuationDate`
- Handles both rate-based and traditional calculation methods

### 3. Real-time Valuation
When accessing an item's valuation:
- Calculates current market value based on latest gold rates
- Compares with original cost to determine gain/loss
- Returns both values for user visibility

## Benefits

1. **Accurate Financial Reporting**: Provides accurate inventory valuation at current market prices
2. **Profit/Loss Tracking**: Clear visibility of unrealized gains/losses
3. **Customer Transparency**: Ability to show both purchase price and current value
4. **Pricing Decisions**: Better pricing based on current market values
5. **Financial Compliance**: Accurate asset valuation for financial statements

## Usage Scenarios

### Scenario 1: Item Scanning
When a user scans an item, the system now provides:
- Original purchase cost
- Current market value based on latest gold rates
- Unrealized gain/loss amount

### Scenario 2: Financial Reporting
The system provides accurate inventory valuation for:
- Balance sheets
- Profit and loss statements
- Tax calculations
- Insurance valuations

### Scenario 3: Pricing Decisions
Staff can make informed pricing decisions based on:
- Current market value
- Original cost
- Unrealized gains/losses
- Market trends

## Configuration

The system automatically uses the gold rates stored in the `gold_rates` table. Ensure that daily gold rates are updated for accurate valuations.

## Security and Permissions

- Access to valuation details requires appropriate inventory read permissions
- Users can only access items from their assigned stores
- All valuation access is logged for audit purposes