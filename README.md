<div align="center">

```
  ______      ______        _             
 / _____|    |  ___ \      (_)            
| |  __  ___ | | _ | | __  _  _   _  ___ 
| | |_ |/ _ \| || || |/ _)| || | | |/ _ \
| |__| | |_| | || || | |  | || |_| |  __/
 \_____|\___/ |_||_||_|_|  |_| \___/ \___|
```

**Fleet management. Done right. Powered by PostgreSQL.**

<br/>

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Tunnel-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/)

</div>

---

<div align="center">

## ✦ What is GoDrive?

</div>

GoDrive is a **full-stack vehicle rental platform** — customers browse, book and pay; staff dispatch and return vehicles; admins watch the numbers move on a live dashboard. All the hard stuff — double-booking prevention, refund logic, audit trails, revenue analytics — lives inside the **database**, not scattered across your app code.

<br/>

<div align="center">

```
┌─────────────┐       REST API        ┌──────────────────┐       SQL        ┌──────────────────┐
│  React + Vite│ ─────────────────▶  │  Express / Node   │ ───────────────▶ │  PostgreSQL  16   │
│   (Browser)  │ ◀─────────────────  │    Port 4000      │ ◀─────────────── │   rental_db       │
└─────────────┘    JSON responses     └──────────────────┘   results/errors  └──────────────────┘
        ▲                                      ▲
        │              HTTPS                   │
        └──────────── Cloudflare Tunnel ───────┘
```

</div>

---

## ⚡ Feature Highlights

| | Feature | How |
|---|---|---|
| 🚫 | **Zero double-bookings** | GiST exclusion constraint on `tstzrange` — enforced at DB level, not app level |
| 🔒 | **Race-condition proof** | `SELECT ... FOR UPDATE` row locks serialize concurrent booking requests |
| 🧾 | **Full audit trail** | Trigger captures `OLD`/`NEW` as JSONB on every write across 7 tables |
| 💸 | **Smart refunds** | PL/pgSQL: 100% back if >24 hrs before pickup, 50% otherwise |
| 📊 | **Instant analytics** | Materialized view pre-computes monthly revenue — dashboard loads in ms |
| 🔄 | **Auto-status sync** | Trigger flips vehicle `available ↔ rented` and booking `confirmed → active → completed` automatically |
| 🛡️ | **Tamper-proof logs** | DB role `rental_app` has `INSERT/UPDATE/DELETE` revoked on `audit_log` |
| 🏍️ | **Cars + Bikes** | 30 vehicles across 5 categories (Hatchback, SUV, Bike, Van, Sedan) in 3 cities |

---

## 🗄️ Database at a Glance

```
rental_db
│
├── 📋 15 Tables          users · vehicles · bookings · payments · rentals
│                         damage_reports · audit_log · reviews · extras · ...
│
├── 🔢 7 ENUM Types       user_role · vehicle_status · booking_status
│                         payment_method · payment_status · fuel_type · transmission_type
│
├── 🧩 3 Extensions       btree_gist · citext · pgcrypto
│
├── ⚙️  4 Stored Funcs    create_booking() · cancel_booking()
│                         fn_audit() · fn_rental_status_sync()
│
├── 🔥 5 Triggers         trg_rental_sync · trg_*_audit (×7 tables) · trg_users_updated
│
├── 👁️  7 Views           v_vehicle_catalog · v_top_customers · v_category_revenue
│                         v_vehicle_ranks · v_revenue_change · v_never_booked · v_overdue_returns
│
├── 🗃️  1 Mat. View       mv_monthly_revenue  (with UNIQUE INDEX for CONCURRENTLY refresh)
│
└── 📇 7 Indexes          2× composite B-tree · 1× partial · 1× GiST · 3× B-tree
```

---

## 🚀 Quick Start

### 1 — Database

```bash
cd db
bash reset.sh          # drops, recreates, seeds rental_db
psql -d rental_db -f tests.sql    # run constraint regression tests
```

### 2 — Backend

```bash
cd server
cp .env.example .env
npm install
npm run dev            # → http://localhost:4000
```

### 3 — Frontend

```bash
cd client
npm install
npm run dev            # → http://localhost:5173
```

---

## 🔑 Demo Accounts

> Password for all accounts: **`Password@123`**

| Role | Email | Privileges |
|---|---|---|
| 👑 Super Admin (Owner) | `maanas@gmail.com` | Full master privileges, can manage/delete all admins, staff & customers |
| 🛡️ Admin | `admin@example.com` | Fleet oversight, reports, manage staff & customers (cannot delete admins) |
| 👷 Staff | `staff1@example.com` | Dispatch, return inspections, damage penalty entry |
| 🙋 Customer | `customer1@example.com` · `customer2@example.com` | Vehicle bookings, extras, reviews |

---

## 🏗️ Project Structure

```
adbms-sem5/
├── db/
│   ├── 01_schema.sql      ← tables, enums, exclusion constraint, indexes
│   ├── 02_logic.sql       ← stored functions, triggers, views, materialized view
│   ├── 03_reports.sql     ← window functions, CTEs, analytical views
│   ├── 04_security.sql    ← db roles, grants, revokes
│   ├── 05_seed.sql        ← 30 vehicles, 24 users, realistic bookings
│   └── reset.sh           ← one-command db rebuild
├── server/
│   └── src/index.js       ← Express REST API (1 file, ~1100 lines)
└── client/
    └── src/App.jsx         ← React SPA (role-based routing, all screens)
```

---

## 🧠 The Coolest Part — No Double Bookings, Ever

The entire booking period lives in **one column** (`tstzrange`). The database itself — not your app — rejects conflicting bookings:

```sql
CONSTRAINT no_double_booking
  EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)
  WHERE (status IN ('pending', 'confirmed', 'active'))
```

Two simultaneous requests for the same car on overlapping dates? One gets `booking_id`. The other gets:

```
ERROR: Vehicle is already booked for these dates
```

No locks in your app code. No "check then insert" race condition. Pure database integrity.

---

<div align="center">

**Built with ❤️ and way too many `EXPLAIN ANALYZE` runs.**

[![PostgreSQL](https://img.shields.io/badge/Made%20with-PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>
