# ADBMS Report Notes — GoDrive Vehicle Rental Management System

This document provides a comprehensive technical reference for examiners and evaluators during project defense and viva voce. It details the conceptual and physical database architecture, normalization derivations, advanced PostgreSQL engine features, security models, and sample viva question-answer dialogues.

---

## 1. Entity-Relationship (ER) Model & Architecture

The GoDrive schema is composed of **14 interconnected relational entities** designed to model an enterprise-grade car rental platform with end-to-end operational workflows:

```
 users (1) <────── (0..1) customer_profiles
   │   │
   │   └─────────────────┐
   │ (1)                 │ (1)
   ▼ (N) [customer]      ▼ (N) [staff: handed_out_by, received_by]
bookings (1) ────────── rentals (1) ─── (N) damage_reports
   │    │                  │ (1)
   │    ├──── (N) payments │
   │    ├──── (0..1) reviews
   │    └──── (N) booking_extras (N) ─── (1) extras
   │ (N)
   ▼ (1)
vehicles (N) ─────────── (1) branches (pickup & drop)
   │   │
   │   └──────────────── (1) vehicle_categories
   ▼ (N)
maintenance_records

audit_log (system-wide append-only event stream via triggers)
```

### Entities, Cardinalities, and Relational Roles

1. **`users`**: Base identity entity holding core authentication credentials (email, bcrypt password hash via `pgcrypto`), contact details, account activation status, and role (`customer`, `staff`, `admin`).
2. **`customer_profiles`**: Extends `users` in a strict **1:0..1 relationship** via `user_id BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE`. It records driver qualification attributes: government driving licence number, expiry date, birth date, and residential address.  
   *Design Rationale for viva*: Keeping `customer_profiles` separate from `users` ensures that administrative and station staff accounts never carry irrelevant, null-heavy driver licensing attributes. A user row exists for all system actors, but only users with the `customer` role instantiate a corresponding profile row.
3. **`branches`**: Physical fleet depots across metropolitan areas. Participates in a **1:N relationship** with `vehicles` (home station), and two independent **1:N relationships** with `bookings` (`pickup_branch_id` and `drop_branch_id`), supporting one-way and round-trip rentals.
4. **`vehicle_categories`**: Fleet classifications (`Economy`, `Sedan`, `SUV`, `Luxury`, `Electric`) defining baseline seat capacities and base daily pricing. Participates in a **1:N relationship** with `vehicles`.
5. **`vehicles`**: The physical fleet asset. Maps **N:1** to `vehicle_categories` and **N:1** to `branches`. Tracks registration plate numbers, make, model, manufacture year, fuel type, transmission type, current odometer kilometer reading, and physical status (`available`, `rented`, `maintenance`, `retired`).
6. **`extras`**: Catalog of optional rental add-ons (GPS navigator, child safety seat, additional authorized driver, full-cover insurance).
7. **`bookings`**: The contractual rental agreement. Forms an **N:1 relationship** with `users` (as customer), **N:1** with `vehicles`, and **N:1** with `branches` (for pickup and drop). Uses PostgreSQL's native `TSTZRANGE` interval to bind the reservation window, stores a price snapshot, total financial commitment, and state (`pending`, `confirmed`, `active`, `completed`, `cancelled`).
8. **`booking_extras`**: Junction entity resolving the **M:N relationship** between `bookings` and `extras`. Uses a composite primary key `(booking_id, extra_id)` and preserves the agreed unit price snapshot (`price_per_day_snapshot`) alongside item quantity (1–5).
9. **`payments`**: Transactional ledger recording payments and refunds against a booking in a **1:N relationship** (`booking_id`). Tracks exact monetary amounts, payment methods (`card`, `upi`, `netbanking`, `cash`), status (`paid`, `refunded`, `failed`), unique gateway transaction references, and audit timestamps.
10. **`rentals`**: Physical vehicle custody agreement. Participates in a **1:0..1 relationship** with `bookings` (`booking_id UNIQUE`). Tracks vehicle checkout and checkin events, referencing staff actors in two independent **N:1 relationships** to `users` (`handed_out_by` and `received_by`), alongside departure and arrival odometer readings (`odometer_out`, `odometer_in`).
11. **`damage_reports`**: Incident tracking entity participating in a **1:N relationship** with `rentals`. Formed when vehicle check-in uncovers vehicle distress, logging repair descriptions and assessed restoration costs.
12. **`maintenance_records`**: Servicing log participating in a **1:N relationship** with `vehicles`. Captures scheduled maintenance, part replacements, servicing timeframes (`start_date`, `end_date`), and operational costs.
13. **`reviews`**: Post-rental customer feedback participating in a **1:0..1 relationship** with `bookings` (`booking_id UNIQUE`). Enforces valid rating bounds (1 to 5 stars) and optional testimonials.
14. **`audit_log`**: Enterprise security and change-data-capture entity. Populated exclusively via database triggers on `bookings` and `vehicles`, recording the entity table name, record identifier, DML action (`INSERT`, `UPDATE`, `DELETE`), full `OLD` and `NEW` JSONB snapshots, actor context (`app.current_user_id`), and high-precision timestamps.

---

## 2. Formal Normalization Derivation (UNF to BCNF)

The schema was derived systematically from an unnormalized rental manifest to achieve **Boyce-Codd Normal Form (BCNF)**, eliminating update, insertion, and deletion anomalies while preserving historical consistency.

### Step 0: Unnormalized Form (UNF)
A flat spreadsheet or single unnormalized record capturing customer reservations:
$$\text{UNF}(\underline{\text{BookingID}}, \text{CustomerName}, \text{CustomerEmail}, \text{CustomerPhone}, \text{LicenceNo}, \text{LicenceExpiry}, \text{DOB}, \text{Address}, \text{VehicleReg}, \text{Make}, \text{Model}, \text{Year}, \text{Fuel}, \text{Trans}, \text{Odometer}, \text{CategoryName}, \text{Seats}, \text{BaseRate}, \text{BranchName}, \text{BranchCity}, \text{BranchAddress}, \{\text{ExtraName}, \text{ExtraRate}, \text{ExtraQty}\}, \text{PeriodStart}, \text{PeriodEnd}, \text{TotalAmount}, \text{Status}, \{\text{PaymentRef}, \text{PayAmount}, \text{PayMethod}, \text{PayStatus}\}, \text{StaffOut}, \text{StaffIn}, \text{OdoOut}, \text{OdoIn}, \text{DamageDesc}, \text{DamageCost}, \text{Rating}, \text{Comment})$$

*Violations*: Non-atomic multi-valued attributes and repeating groups ($\{\text{Extras}\}$, $\{\text{Payments}\}$).

### Step 1: First Normal Form (1NF)
*Rule*: Eliminate repeating groups; ensure all attribute domains are atomic; designate a formal primary key.
*Transformation*:
- Repeated groups for add-on extras are extracted into a separate junction relation `booking_extras` with atomic attributes: `(booking_id, extra_id, quantity, price_per_day_snapshot)`.
- Multiple payment installments/refunds are moved into a separate relation `payments`.
- Non-atomic customer address and names are separated into atomic domain types.

### Step 2: Second Normal Form (2NF)
*Rule*: Table must be in 1NF and contain **no partial functional dependencies** (no non-prime attribute may depend on a proper subset of any candidate key).
*Analysis*:
- In the composite key relation `booking_extras(booking_id, extra_id)`:
  - $\text{extra\_id} \rightarrow \text{ExtraName}, \text{ExtraStandardPrice}$
  - The extra item name and standard catalog price depend solely on `extra_id`, not on the entire composite key `(booking_id, extra_id)`.
*Transformation*:
- Decompose into `extras(extra_id, name, price_per_day)` and `booking_extras(booking_id, extra_id, quantity, price_per_day_snapshot)`.
- All non-key attributes in `booking_extras` now depend on the full composite key `(booking_id, extra_id)`.

### Step 3: Third Normal Form (3NF)
*Rule*: Table must be in 2NF and contain **no transitive functional dependencies** ($X \rightarrow Y$ and $Y \rightarrow Z$, where $Y$ is not a superkey and $Z$ is a non-prime attribute).
*Analysis of Transitive Dependencies in the Vehicle and Booking records*:
- In `vehicles`: $\text{vehicle\_id} \rightarrow \text{category\_id} \rightarrow (\text{CategoryName}, \text{Seats}, \text{BaseDailyRate})$.  
  *Anomaly*: Updating the base daily rate of an SUV would require updating every vehicle row belonging to that category (update anomaly); if all SUVs are deleted, the category rate definition is lost (deletion anomaly).
- In `vehicles`: $\text{vehicle\_id} \rightarrow \text{branch\_id} \rightarrow (\text{BranchName}, \text{City}, \text{Address})$.  
  *Anomaly*: Moving a branch office requires updating all vehicles stationed there.
- In `bookings`: $\text{booking\_id} \rightarrow \text{customer\_id} \rightarrow (\text{FullName}, \text{Email}, \text{Phone})$.  
  *Anomaly*: Customer contact updates require scanning past bookings.
*Transformation*:
- Extract `vehicle_categories(category_id, name, base_daily_rate, seats)`.
- Extract `branches(branch_id, name, city, address, phone)`.
- Extract `users(user_id, full_name, email, phone, role, password_hash)`.
- Extract `customer_profiles(user_id, licence_no, licence_expiry, date_of_birth, address)`.

### Step 4: Boyce-Codd Normal Form (BCNF)
*Rule*: A relation is in BCNF if and only if for every functional dependency $X \rightarrow Y$, $X$ is a **superkey** (every determinant must be a candidate key).
*Verification across the schema*:
- **`vehicles` table**:
  - Functional Dependencies:
    - $\text{vehicle\_id} \rightarrow \{\text{reg\_number}, \text{category\_id}, \text{branch\_id}, \text{make}, \text{model}, \text{manufacture\_year}, \text{fuel}, \text{transmission}, \text{odometer\_km}, \text{status}\}$
    - $\text{reg\_number} \rightarrow \{\text{vehicle\_id}, \text{category\_id}, \text{branch\_id}, \text{make}, \text{model}, \text{manufacture\_year}, \text{fuel}, \text{transmission}, \text{odometer\_km}, \text{status}\}$
  - Candidate Keys: $\{\text{vehicle\_id}\}$ and $\{\text{reg\_number}\}$. Both determinants are candidate keys. Thus, `vehicles` satisfies BCNF.
- **`users` table**: Candidate keys are `user_id` and `email` (`citext UNIQUE`). Both are valid determinants; satisfies BCNF.
- **`customer_profiles` table**: Candidate keys are `user_id` and `licence_no` (`UNIQUE`). Both are valid determinants; satisfies BCNF.
- **`branches` table**: Candidate keys are `branch_id` and `name` (`UNIQUE`). Satisfies BCNF.
- **`vehicle_categories` table**: Candidate keys are `category_id` and `name` (`UNIQUE`). Satisfies BCNF.

### Justification of Rate Snapshots (`daily_rate_snapshot`)
A common viva question is whether `daily_rate_snapshot` in `bookings` and `price_per_day_snapshot` in `booking_extras` violate 3NF / normalization principles because the rate is also stored in `vehicle_categories` and `extras`.
- **Examiner Explanation**: Storing `daily_rate_snapshot` is **not a normalization violation**; it is the correct modeling of a **temporal, historical fact**.
- The `vehicle_categories.base_daily_rate` represents the *current asking price* for future reservations.
- The `bookings.daily_rate_snapshot` represents the *legally binding, immutable contract price* agreed upon when the reservation was created.
- If the business increases Sedan rates from ₹2,500/day to ₹3,200/day tomorrow, past completed or active bookings must NOT recalculate their totals. If the rate were dynamically joined from `vehicle_categories`, past accounting records would be corrupted (financial update anomaly). The snapshot attribute has a functional dependency on $(\text{booking\_id})$, not on $(\text{category\_id})$, confirming mathematical normalization compliance.

---

## 3. Database Features & Engineering Implementation

Each advanced database feature in the schema was intentionally selected to enforce operational integrity directly inside PostgreSQL:

| Database Feature | Source Code Location | Why Chosen Over Application-Level Implementation |
|---|---|---|
| **Identity Primary Keys** | `db/01_schema.sql` (Lines 12–25) | Uses SQL:2003 standard `BIGINT GENERATED ALWAYS AS IDENTITY` to prevent accidental manual key overrides, providing guaranteed gapless monotonic keys unlike legacy sequences. |
| **Case-Insensitive Text (`citext`)** | `db/01_schema.sql` (Line 3, 12) | Native `CITEXT` extension ensures user email uniqueness (`UNIQUE`) is enforced without relying on error-prone application-level `LOWER()` calls or function-based indexes. |
| **Domain Constraint Checks** | `db/01_schema.sql` (Line 12, 15, 18, 22) | Regex `CHECK(phone ~ '^[0-9+ -]{10,15}$')`, `CHECK(seats BETWEEN 1 AND 15)`, `CHECK(end_date >= start_date)`, and `CHECK(odometer_in >= odometer_out)` guarantee data sanity regardless of client interface bugs. |
| **Native Range Type (`tstzrange`)** | `db/01_schema.sql` (Line 19) | Expresses the booking window as a contiguous time range `[start, end)` with standard half-open intervals, enabling temporal overlap operators (`&&`) without messy four-way inequality checks. |
| **GiST Exclusion Constraint** | `db/01_schema.sql` (Line 19: `CONSTRAINT no_double_booking EXCLUDE USING gist(...)`) | `EXCLUDE USING gist(vehicle_id WITH =, period WITH &&) WHERE (status IN ('pending','confirmed','active'))` enforces that no vehicle is double-booked across overlapping periods mathematically inside the storage engine, completely immune to application-tier race conditions. |
| **Composite & Partial Indexes** | `db/01_schema.sql` (Line 26) | `idx_vehicles_branch_status ON vehicles(branch_id, status)` optimizes branch vehicle lookups; partial index `idx_bookings_live ON bookings(vehicle_id) WHERE status IN ('confirmed','active')` drastically reduces index footprint by ignoring completed/cancelled historical rows. |
| **Row-Level Locking (`FOR UPDATE`)** | `db/02_logic.sql` (Line 10: `SELECT ... FOR UPDATE OF v`) | Serializes competing concurrent booking requests for the same vehicle at the database transaction level before insertion, preventing race conditions before the exclusion constraint even needs to intervene. |
| **Stored Procedure Encapsulation** | `db/02_logic.sql` (Lines 7–16: `create_booking`) | Bundles eligibility checks, daily pricing calculations, booking insertion, junction extra writes, and payment ledger entries into a single atomic ACID transaction executed on the database server. |
| **Tiered Business Logic in Stored Functions** | `db/02_logic.sql` (Line 17: `cancel_booking`) | Computes refund penalties conditionally (100% refund if cancellation $> 24\text{ hours}$ before pickup; 50% refund if $< 24\text{ hours}$) and atomically records the refund ledger row inside a database lock. |
| **Audit Logging with JSONB Deltas** | `db/02_logic.sql` (Line 4: `fn_audit`) & `db/01_schema.sql` (Line 25) | AFTER INSERT/UPDATE/DELETE trigger captures full entity snapshots (`OLD` and `NEW`) as JSONB along with session variable `app.current_user_id`, creating an unforgeable compliance audit trail. |
| **Fleet State Synchronization Triggers** | `db/02_logic.sql` (Line 18–19: `trg_rental_sync`) | Synchronizes physical fleet status (`available` $\rightarrow$ `rented` on pickup; `rented` $\rightarrow$ `available` + odometer update on return) and booking lifecycle (`active`, `completed`) automatically without depending on multi-step API orchestration. |
| **Catalog View Abstraction** | `db/02_logic.sql` (Line 20: `v_vehicle_catalog`) | Pre-joins `vehicles`, `vehicle_categories`, and `branches` with `WHERE v.status = 'available'` to present a simplified, clean querying surface for web clients. |
| **Table-Valued Search Function** | `db/02_logic.sql` (Line 21: `fn_available_vehicles`) | Accepts search parameters (`city`, `start`, `end`) and returns `SETOF v_vehicle_catalog` excluding any vehicles that have overlapping active bookings via `NOT EXISTS ... &&`. |
| **Materialized Views with Explicit Refresh** | `db/02_logic.sql` (Line 22–23: `mv_monthly_revenue`) | Precomputes net monthly revenue aggregated over payment and refund ledgers with a unique index, enabling sub-millisecond management reporting without recalculating millions of rows on demand. |
| **Advanced Window Functions** | `db/03_reports.sql` (Lines 3–4: `RANK()`, `LAG()`) | Calculates vehicle popularity rankings within categories using `RANK() OVER (PARTITION BY category ORDER BY rentals DESC)` and month-over-month revenue velocity using `LAG(net_revenue) OVER (ORDER BY month)`. |
| **Common Table Expressions & Anti-Joins** | `db/03_reports.sql` (Lines 5–6: `v_never_booked`, `v_overdue_returns`) | Uses `LEFT JOIN ... WHERE b.booking_id IS NULL` for fleet utilization analysis, and `WITH overdue AS (...)` CTE to correlate overdue vehicle custody with customer phone numbers for staff intervention. |
| **Role-Based Least Privilege Security** | `db/04_security.sql` (Lines 1–12) | Creates separate database principals: `rental_app` (DML on operational tables, explicitly REVOKED from deleting/updating audit logs) and `rental_report` (strictly read-only on reporting views and materialized views). |

---

## 4. Design Decisions & Viva Talking Points

### Vehicle Status Enum: Physical Asset State vs. Contractual State
- **Key Note**: In `db/01_schema.sql`, `vehicle_status` includes `'rented'` in addition to `available`, `maintenance`, and `retired`.
- **Examiner Defense**:
  > *"vehicle_status includes 'rented' (not in the original plan's 3-value enum). This was added to track physical vehicle location accurately: a vehicle in the hands of a customer should not appear in the catalog, even if its booking is 'active'. The status returns to 'available' on the return trigger. This is a justified design deviation and a good viva talking point."*
- A vehicle's physical location is decoupled from any single booking's state. When a car is checked out, `trg_rental_sync` updates the vehicle to `rented`. When returned, the trigger updates `odometer_km` and resets status to `available`. This allows $O(1)$ catalog queries (`WHERE status = 'available'`) without costly anti-joins against active booking dates during general browsing.

---

## 5. Comprehensive Viva Voce Questions & Model Answers

### Q1: What happens if two transactions both pass the vehicle availability check simultaneously?
**Answer**:
1. In GoDrive, concurrency is guarded by a **two-layer defense**:
   - **Layer 1 (Pessimistic Row Lock in PL/pgSQL)**: Inside `create_booking()`, the query `SELECT c.base_daily_rate INTO v_rate FROM vehicles v ... WHERE v.vehicle_id = p_vehicle_id FOR UPDATE OF v` takes an exclusive row lock on the vehicle. If Transaction A and Transaction B arrive at the same time, Transaction A acquires the row lock, while Transaction B blocks and waits. Once Transaction A commits, Transaction B wakes up, re-evaluates vehicle availability, and detects the newly inserted booking or altered status, immediately aborting with an exception.
   - **Layer 2 (GiST Exclusion Constraint in Storage Engine)**: Even if someone attempts a direct SQL `INSERT INTO bookings` bypassing the stored procedure, the PostgreSQL GiST exclusion constraint (`EXCLUDE USING gist(vehicle_id WITH =, period WITH &&)`) enforces that no two rows with overlapping `tstzrange` intervals can exist for the same vehicle in active statuses. One transaction will fail at `COMMIT` time with an `exclusion_violation` (PostgreSQL error code `23P01`).

### Q2: Why use `tstzrange` instead of two separate `DATE` or `TIMESTAMP` columns?
**Answer**:
1. **Mathematical Cleanliness & Half-Open Intervals**: A standard date pair (`start_date`, `end_date`) makes edge conditions difficult (e.g. customer returning at 10:00 AM and next picking up at 10:00 AM). `tstzrange` defaults to canonical half-open intervals `[start, end)`, meaning the interval includes the start millisecond but excludes the end millisecond ($start \le t < end$). Back-to-back bookings can seamlessly end and begin at the exact same second without collision.
2. **Native Overlap Operator (`&&`)**: Instead of writing complex conditional SQL `(start_a < end_b AND end_a > start_b)`, range types use `period_a && period_b`.
3. **GiST Index Support**: PostgreSQL cannot build an exclusion constraint or 2D index on two independent timestamp columns for non-overlapping validation. `tstzrange` combined with the `btree_gist` extension allows the R-tree/GiST index to index temporal intervals along a one-dimensional timeline, enabling sub-millisecond overlap searches.

### Q3: What is BCNF and does your schema satisfy it?
**Answer**:
- **Definition**: Boyce-Codd Normal Form (BCNF) requires that for every non-trivial functional dependency $X \rightarrow Y$, the determinant $X$ must be a **superkey** of the relation.
- **Walkthrough on `vehicles` table**:
  - Determinants:
    - `vehicle_id` $\rightarrow$ all attributes (Primary Key).
    - `reg_number` $\rightarrow$ all attributes (Unique Key).
  - Since both determinants are candidate keys capable of uniquely identifying a vehicle, no non-key attribute determines any other attribute.
- **Walkthrough on `users` and `customer_profiles`**:
  - In `users`, candidate keys are `user_id` and `email`.
  - In `customer_profiles`, candidate keys are `user_id` and `licence_no`.
  - All determinants in all tables are candidate keys; therefore, the entire GoDrive schema strictly satisfies BCNF.

### Q4: Why is the materialized view refreshed manually instead of using a standard view?
**Answer**:
- `mv_monthly_revenue` aggregates large volumes of payment and refund ledger rows across months with distinct counting and conditional summation.
- A standard SQL view executes the aggregation query on every single read request, which causes heavy I/O and CPU overhead on executive dashboard loads.
- A materialized view physically persists the calculated results on disk, supporting a unique index on `month` for instant $O(1)$ lookups.
- It is refreshed explicitly via `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_revenue` because accounting and revenue reports are read-heavy and require transactional read stability across a management reporting session. In a production deployment, this refresh is invoked by a scheduled background job or nightly cron.

### Q5: Why raw SQL and PostgreSQL stored procedures instead of an ORM like Prisma or Sequelize?
**Answer**:
- The primary learning objective of an Advanced Database Management System (ADBMS) project is demonstrating direct database engine capabilities.
- ORMs abstract and hide advanced database features: ORMs cannot natively define or manage GiST exclusion constraints, range types, fine-grained `FOR UPDATE` locking semantics, trigger deltas, or database-level role security.
- Placing business logic (`create_booking`, `cancel_booking`) inside PL/pgSQL reduces network roundtrips between the Node.js server and database from 5 trips down to 1 trip, ensuring atomic transaction boundaries on the server.

### Q6: Why are most foreign key deletions restricted (`ON DELETE RESTRICT`/`NO ACTION`) rather than cascaded?
**Answer**:
- Financial and operational ledgers must maintain referential integrity and audit compliance.
- If a customer or vehicle were deleted, cascading deletions would delete historical `bookings`, `payments`, and `rentals`, destroying company revenue records and vehicle maintenance histories.
- `ON DELETE CASCADE` is strictly isolated to parent-dependent detail tables: `customer_profiles` (if a user is purged), `booking_extras` (dependent child of a booking), and `damage_reports` (dependent child of a rental).

### Q7: Why use `READ COMMITTED` isolation level instead of `SERIALIZABLE`?
**Answer**:
- PostgreSQL defaults to `READ COMMITTED`. Under high concurrency, `SERIALIZABLE` isolation incurs frequent serialization failures (`40001 serialization_failure`), requiring the application layer to implement retry loops.
- In GoDrive, the critical invariant (no overlapping bookings for the same vehicle) is already guaranteed by the combination of the `FOR UPDATE` row lock and the GiST exclusion constraint.
- Thus, the system achieves strict consistency and 100% race-condition protection without the throughput degradation and retry overhead of `SERIALIZABLE` mode.

### Q8: Why do indexes slow down write operations?
**Answer**:
- An index is an auxiliary data structure (typically a balanced B-tree or GiST R-tree) maintained on disk.
- Whenever an `INSERT`, `UPDATE`, or `DELETE` executes on the base table, PostgreSQL must also insert or update entries in every index defined on that table, incurring random I/O and potential page splits.
- For this reason, GoDrive uses targeted indexing: only 7 carefully chosen indexes exist, including partial indexes (`idx_bookings_live`) that index only active rows to keep write overhead minimal.
