# GoDrive — Vehicle Rental Management System

> **Advanced Database Management Systems (ADBMS) Semester Project**  
> GoDrive is a full-stack, enterprise-grade vehicle rental management platform where PostgreSQL enforces core business logic, temporal integrity, concurrency serialization, and change audit trails. The application tier uses raw, parameterized SQL queries via Express and Node.js with a modern React + Vite client.

---

## ADBMS Concepts Demonstrated      

| Advanced DBMS Concept | PostgreSQL Feature / Technique | Implementation Source Code |
|---|---|---|
| **Temporal Integrity & Range Types** | `TSTZRANGE` interval domain with half-open bounds `[start, end)` | [`db/01_schema.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/01_schema.sql#L19) |
| **Concurrency & Exclusion Constraints** | GiST Exclusion Constraint with `btree_gist` (`WITH =, WITH &&`) | [`db/01_schema.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/01_schema.sql#L19) |
| **Row-Level Pessimistic Locking** | `SELECT ... FOR UPDATE` row locks to serialize concurrent bookings | [`db/02_logic.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/02_logic.sql#L10) |
| **Stored Procedures & ACID Transactions** | PL/pgSQL atomic transaction routines (`create_booking`, `cancel_booking`) | [`db/02_logic.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/02_logic.sql#L7-L17) |
| **Change Data Capture (Audit Triggers)** | Dynamic JSONB delta capture (`OLD` vs `NEW`) with session actor tracking | [`db/02_logic.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/02_logic.sql#L4-L6) |
| **Fleet State Synchronization Triggers** | Automated asset state transitions (`available` ↔ `rented`) and odometer sync | [`db/02_logic.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/02_logic.sql#L18-L19) |
| **Materialized Views & Caching** | `MATERIALIZED VIEW` with unique index for high-speed revenue aggregation | [`db/02_logic.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/02_logic.sql#L22-L23) |
| **Window Functions & OLAP Analytics** | `RANK() OVER (PARTITION BY ...)` and `LAG() OVER (ORDER BY ...)` | [`db/03_reports.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/03_reports.sql#L3-L4) |
| **Subqueries, CTEs & Anti-Joins** | Common Table Expressions (`WITH overdue AS (...)`) and Anti-Joins (`LEFT JOIN ... WHERE NULL`) | [`db/03_reports.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/03_reports.sql#L5-L6) |
| **Advanced Indexing Strategies** | Composite B-trees, Partial Indexes (`WHERE status IN (...)`), and GiST | [`db/01_schema.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/01_schema.sql#L26) |
| **Role-Based Least Privilege Security** | DML application role (`rental_app`) and read-only analytical role (`rental_report`) | [`db/04_security.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/04_security.sql#L1-L12) |
| **Domain Checks & Extensible Types** | `CITEXT` case-insensitive email, custom `ENUM` types, and regex `CHECK`s | [`db/01_schema.sql`](file:///Users/manas/Code/Projects%20/adbms-sem5/db/01_schema.sql#L2-L12) |

---

## Database Objects

The database schema (`rental_db`) contains the following formal database objects:

| Object Category | Count | Object Names & Definitions |
|---|:---:|---|
| **Tables** | **14** | `users`, `customer_profiles`, `branches`, `vehicle_categories`, `vehicles`, `extras`, `maintenance_records`, `bookings`, `booking_extras`, `payments`, `rentals`, `damage_reports`, `reviews`, `audit_log` |
| **Views** | **2** | `v_vehicle_catalog` (catalog join with branch and category data), `v_available_vehicles` *(plus 6 reporting views in `03_reports.sql`: `v_top_customers`, `v_category_revenue`, `v_vehicle_ranks`, `v_revenue_change`, `v_never_booked`, `v_overdue_returns`)* |
| **Materialized Views** | **1** | `mv_monthly_revenue` (fast precomputed monthly net revenue and booking volume) |
| **PL/pgSQL Functions** | **3** | `create_booking()` (atomic booking creation), `cancel_booking()` (tiered refunds), `fn_available_vehicles()` (parameterized temporal availability search) *(plus trigger functions `fn_set_updated_at`, `fn_audit`, `fn_rental_status_sync`)* |
| **Triggers** | **4** | `trg_users_updated` (auto `updated_at`), `trg_bookings_audit` (audit log on bookings), `trg_vehicles_audit` (audit log on vehicles), `trg_rental_sync` (handover and return fleet synchronization) |
| **Indexes** | **7** | `idx_vehicles_branch_status` (composite), `idx_vehicles_category` (B-tree), `idx_bookings_customer` (composite DESC), `idx_bookings_live` (partial index), `idx_payments_booking` (B-tree), `idx_maintenance_vehicle` (B-tree), `idx_audit_table_record` (composite) |

---

## System Requirements

- **PostgreSQL 16+** (compatible with 16, 17, and 18) with privileges to load extensions (`btree_gist`, `citext`, `pgcrypto`).
- **Node.js 20+** and **npm**.

---

## Quickstart Setup

### 1. Database Initialization

Run the automated reset script from the project root. This drops and recreates `rental_db`, applies schema, logic, reports, security roles, seeds realistic test data, and runs the automated test suite:

```bash
cd "/Users/manas/Code/Projects /adbms-sem5/db"
bash reset.sh
psql -d rental_db -v ON_ERROR_STOP=1 -f tests.sql
```

*All 4 test transaction blocks inside `tests.sql` should pass with exit code `0`.*

### 2. Backend Server

```bash
cd "/Users/manas/Code/Projects /adbms-sem5/server"
cp .env.example .env
npm install
npm run dev
```

*Express server starts on `http://localhost:4000`.*

### 3. Frontend Client

```bash
cd "/Users/manas/Code/Projects /adbms-sem5/client"
npm install
npm run dev
```

*Vite dev server starts on `http://localhost:5173`.*

---

## Demo Accounts

All seeded demo accounts are configured with the default password: **`Password@123`**

| Role | Email | Description / Access Level |
|---|---|---|
| **Admin** | `admin@example.com` | Fleet oversight, user management, maintenance logs, and analytical reports |
| **Staff** | `staff1@example.com` | Station handover operations, rental returns, and odometer logging (Mumbai Central) |
| **Staff** | `staff2@example.com` | Station handover and return operations (Delhi Airport) |
| **Staff** | `staff3@example.com` | Station handover and return operations (Bengaluru Indiranagar) |
| **Customer** | `customer1@example.com` | Verified customer with valid driver's licence, active bookings, and review history |
| **Customers** | `customer2@example.com` to `customer20@example.com` | Extended seed customer pool across various cities |

---

## Viva Voce Demonstration Scripts

### Demo 1: Concurrency Serialization & GiST Double-Booking Defense

To demonstrate real-time database concurrency control to the examiner:

#### Step 1: Open two separate terminal windows
Open Terminal A and Terminal B, both connected to PostgreSQL:
```bash
psql -d rental_db
```

#### Step 2: Start transaction in Terminal A (acquire row lock)
```sql
-- Terminal A: Customer 1 begins booking Vehicle 1 for Dec 1 to Dec 5
BEGIN;
SELECT create_booking(
  1, 1,
  '2026-12-01 10:00:00+05:30'::timestamptz,
  '2026-12-05 10:00:00+05:30'::timestamptz,
  1, 1, 'card', ARRAY[1]::int[]
);
-- DO NOT COMMIT YET. The vehicle row lock is held by Terminal A.
```

#### Step 3: Run conflicting booking in Terminal B
```sql
-- Terminal B: Customer 2 attempts to book the SAME Vehicle 1 for overlapping dates (Dec 3 to Dec 7)
BEGIN;
SELECT create_booking(
  2, 1,
  '2026-12-03 10:00:00+05:30'::timestamptz,
  '2026-12-07 10:00:00+05:30'::timestamptz,
  1, 1, 'upi', ARRAY[]::int[]
);
-- Notice Terminal B BLOCKS immediately, waiting for Terminal A to release the lock!
```

#### Step 4: Commit in Terminal A
```sql
-- Terminal A:
COMMIT;
```

#### Step 5: Observe Terminal B immediate unblock and exception
```sql
-- Terminal B immediately unblocks and fails:
-- ERROR: Vehicle is already booked for these dates
ROLLBACK;
```

#### Step 6: Direct SQL GiST Exclusion Proof
Even if a user executes a direct `INSERT` command bypassing the stored procedure, the PostgreSQL GiST exclusion constraint blocks it:
```sql
INSERT INTO bookings(customer_id, vehicle_id, pickup_branch_id, drop_branch_id, period, daily_rate_snapshot, total_amount, status)
VALUES (2, 1, 1, 1, tstzrange('2026-12-02 10:00:00+05:30', '2026-12-04 10:00:00+05:30', '[)'), 2500, 5000, 'confirmed');

-- OUTPUT:
-- ERROR: conflicting key value violates exclusion constraint "no_double_booking"
-- DETAIL: Key (vehicle_id, period)=(1, ["2026-12-02 10:00:00+05:30","2026-12-04 10:00:00+05:30")) conflicts with existing key ...
```

---

### Demo 2: Query Optimization & EXPLAIN ANALYZE

Demonstrate the performance impact of composite indexing on customer booking history:

```sql
psql -d rental_db

-- 1. Inspect execution plan WITH composite index:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM bookings WHERE customer_id = 1 ORDER BY created_at DESC;
-- Result: Uses "Index Scan using idx_bookings_customer on bookings" with low buffer reads.

-- 2. Drop the index temporarily:
DROP INDEX idx_bookings_customer;

-- 3. Inspect execution plan WITHOUT index:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM bookings WHERE customer_id = 1 ORDER BY created_at DESC;
-- Result: Switches to a costly "Seq Scan on bookings" followed by a memory "Sort" node!

-- 4. Restore the index:
CREATE INDEX idx_bookings_customer ON bookings(customer_id, created_at DESC);
```

---

## Viva Preparation Guide

For in-depth explanations tailored for viva examiners, including:
- **Detailed 14-entity ER breakdown & cardinalities**
- **Step-by-step mathematical normalization (UNF $\rightarrow$ 1NF $\rightarrow$ 2NF $\rightarrow$ 3NF $\rightarrow$ BCNF)**
- **Justification of price snapshots (`daily_rate_snapshot`)**
- **Exclusion constraints vs. application-level validation**
- **Physical vs. contractual state (`vehicle_status` vs `booking_status`)**
- **Full viva Q&A dialogue bank**

👉 Read the complete [**ADBMS Report Notes**](file:///Users/manas/Code/Projects%20/adbms-sem5/docs/ADBMS_REPORT_NOTES.md).

---

## Project Structure

```
adbms-sem5/
├── db/
│   ├── 01_schema.sql        # Tables, constraints, types, extensions, and indexes
│   ├── 02_logic.sql         # PL/pgSQL procedures, triggers, catalog views, materialized views
│   ├── 03_reports.sql       # Analytical reporting views (Window functions, CTEs, Anti-joins)
│   ├── 04_security.sql      # Role definitions and least-privilege GRANTs/REVOKEs
│   ├── 05_seed.sql          # Realistic seed data (24 users, 30 vehicles, 48 bookings)
│   ├── reset.sh             # Automated database drop, creation, and seeding script
│   └── tests.sql            # Constraint, transaction, and security regression test suite
├── server/
│   ├── src/
│   │   ├── index.js         # Express REST API routes with parameterized SQL
│   │   ├── db.js            # PostgreSQL connection pool with actor context wrapper
│   │   └── middleware/      # Authentication, role verification, and error handling
│   ├── .env.example         # Environment template
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.jsx          # Single-page React application with 14 workflow screens
│   │   ├── main.jsx         # Vite entry point
│   │   └── index.css        # Tailwind CSS styles
│   ├── index.html
│   └── package.json
└── docs/
    ├── ADBMS_REPORT_NOTES.md # Detailed academic viva notes, ER, and normalization
    └── PLAN.md              # Original project requirements specification
```
