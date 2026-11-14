# Vehicle Rental Management System — Project Plan

Nov 14, 2026 · @Manas Chhabra

## 1. Overview and scope

This is a web app where customers book vehicles and staff manage the fleet, with PostgreSQL doing the real work: the database enforces the rules (no double bookings, valid prices, audit trail), and the app is a thin layer over it. That is what makes it a strong ADBMS project.

**Three user roles**

- **Customer**: signs up, browses vehicles, books, pays, cancels, sees history, leaves reviews.
- **Staff**: handles pickups and returns, records damage and fines, updates vehicle status.
- **Admin**: manages fleet, branches, pricing, staff accounts, and sees reports.

**Priorities, in order**

1. Database design and advanced PostgreSQL features (about 60% of the effort and marks)
2. Signup, login, and role-based access
3. Clean, usable UI

**Out of scope** (mention in viva as future work): real payment gateway, GPS tracking, mobile app, ML pricing.

## 2. Research: why PostgreSQL and which ADBMS concepts to show

PostgreSQL is the right choice because it has the exact features a rental system needs and an examiner wants to see: range types with exclusion constraints, strong ACID transactions, triggers, PL/pgSQL, row-level locking, and rich indexing. Plan on PostgreSQL 16 or newer (current stable also works); the plan uses nothing version-specific.

**Research findings that shape the design**

- **Double booking is the core problem.** Two customers must never hold the same vehicle for overlapping dates. PostgreSQL solves this declaratively with a `tstzrange` column plus an `EXCLUDE USING gist` constraint (needs the `btree_gist` extension). This is more robust than checking in application code, and it is the single best talking point for the viva.
- **Availability is derived, not stored.** A vehicle's status (available, rented, maintenance) is a coarse flag; real availability for a date range comes from querying bookings. Store the flag for maintenance and retirement only.
- **Price is a snapshot.** Store the daily rate on the booking at the time of booking, so later price changes never rewrite history.
- **Money uses NUMERIC(10,2), never FLOAT.**
- **Soft delete over hard delete** for users and vehicles that have history (a `is_active` flag), because foreign keys must keep resolving.
- **Audit log via trigger** gives a tamper-evident history of status and price changes without app code.

**ADBMS concept map: what to build and where it shows up**

| Concept | Where it appears in this project |
| --- | --- |
| ER modelling, normalization (3NF/BCNF) | Section 4: tables split so no repeated vehicle or customer data |
| Constraints (PK, FK, UNIQUE, CHECK, NOT NULL) | Every table in Section 5 |
| Exclusion constraint on ranges | `bookings` prevents overlapping dates per vehicle |
| Indexes (B-tree, GiST, partial, composite) | Search by city, type, date, status |
| Views and materialized views | Available vehicles, revenue summary |
| Stored functions and procedures (PL/pgSQL) | `create_booking()`, `complete_rental()`, `cancel_booking()` |
| Triggers | Audit log, auto-update vehicle status, `updated_at` |
| Transactions and isolation levels | Booking plus payment as one atomic unit |
| Concurrency and locking | `SELECT ... FOR UPDATE`, two-session demo |
| Joins, CTEs, window functions, aggregates | Admin reports in Section 7 |
| Roles and GRANT/REVOKE | Section 8: app user cannot drop tables |
| Backup and restore | `pg_dump` / `pg_restore` demo |
| Query planning | `EXPLAIN ANALYZE` before and after adding an index |

**Where to read more (verify versions against the official docs)**

- PostgreSQL official documentation: chapters on Constraints, Range Types, Indexes, PL/pgSQL, Triggers, Concurrency Control
- "The Art of PostgreSQL" by Dimitri Fontaine (book)
- Use The Index, Luke (use-the-index-luke.com) for indexing
- Typical textbook case study: car rental ER models in Elmasri and Navathe, and Silberschatz, for the normalization write-up

## 3. Requirements and business rules

Every feature below maps to at least one table or database object, so nothing is built without a data model behind it.

| Role | Functional requirements |
| --- | --- |
| Customer | Sign up, log in, edit profile and upload licence details; search vehicles by city, type, price, dates; book; pay; cancel; view booking history; rate a completed rental |
| Staff | See today's pickups and returns; mark pickup (record odometer, fuel); mark return; record damage or late fee; set vehicle to maintenance |
| Admin | CRUD on vehicles, categories, branches, pricing; manage staff and customers; view revenue, utilisation, top customers; see audit log; block a user |

**Business rules the database must enforce**

1. A vehicle cannot have two active bookings with overlapping date ranges.
2. End date must be after start date; start date cannot be in the past at booking time.
3. Customer must have a valid (non-expired) licence on file to book.
4. Total price = days × daily rate snapshot + extras, calculated by a function, not typed by the app.
5. A booking is confirmed only when its payment record exists (same transaction).
6. Cancellation more than 24 hours before start gives a full refund; later gives a partial refund (rule stored in a function so it is easy to explain).
7. A vehicle in maintenance or retired cannot be booked.
8. Odometer reading on return must be greater than or equal to the pickup reading.
9. Ratings are 1 to 5 and only allowed on a completed booking, once per booking.
10. Every status change on bookings and vehicles is written to the audit log.

## 4. Database design: entities, relationships, normalization

The schema has 14 tables, all in 3NF. Draw the ER diagram from the relationships below using the ERD tool in pgAdmin (right-click the database, then ERD Tool) or dbdiagram.io; it is a required viva exhibit, so build it once the schema in Section 5 is created.

**Entities**

| Table | Purpose | Key attributes |
| --- | --- | --- |
| users | Login identity for all roles | email (unique), password\_hash, role, is\_active |
| customer\_profiles | Customer-only details | licence\_no (unique), licence\_expiry, date\_of\_birth |
| branches | Pickup and drop locations | name, city, address |
| vehicle\_categories | Hatchback, SUV, Bike, Van and so on | name, base\_daily\_rate, seats |
| vehicles | Each physical vehicle | reg\_number (unique), status, odometer\_km, fuel |
| extras | Add-ons: child seat, GPS, driver | name, price\_per\_day |
| bookings | A reservation | period (date range), daily\_rate\_snapshot, total\_amount, status |
| booking\_extras | Extras chosen on a booking | quantity |
| payments | Money taken or refunded | amount, method, status, transaction\_ref |
| rentals | The actual handover and return | pickup\_at, return\_at, odometer\_out, odometer\_in |
| damage\_reports | Damage or fines on a rental | description, amount |
| maintenance\_records | Service history per vehicle | start\_date, end\_date, cost |
| reviews | Customer rating after a rental | rating, comment |
| audit\_log | Trigger-written change history | table\_name, action, old\_data, new\_data (JSONB) |

**Relationships (cardinality)**

| Relationship | Type | Implemented by |
| --- | --- | --- |
| users to customer\_profiles | 1 : 0..1 | customer\_profiles.user\_id is PK and FK |
| branches to vehicles | 1 : N | vehicles.branch\_id |
| vehicle\_categories to vehicles | 1 : N | vehicles.category\_id |
| users (customer) to bookings | 1 : N | bookings.customer\_id |
| vehicles to bookings | 1 : N | bookings.vehicle\_id |
| bookings to extras | M : N | booking\_extras junction table |
| bookings to payments | 1 : N | payments.booking\_id (payment, then possible refund) |
| bookings to rentals | 1 : 0..1 | rentals.booking\_id (unique) |
| rentals to damage\_reports | 1 : N | damage\_reports.rental\_id |
| vehicles to maintenance\_records | 1 : N | maintenance\_records.vehicle\_id |
| bookings to reviews | 1 : 0..1 | reviews.booking\_id (unique) |
| users (staff) to rentals | 1 : N | rentals.handed\_out\_by and received\_by |

**Normalization write-up (use this in the report)**

Start from one flat table: booking, customer name and email, licence, vehicle reg, make, model, category, category rate, branch name, branch city, extras, payment details.

1. **1NF**: remove the repeating extras column into its own rows (`booking_extras`); every cell holds one value.
2. **2NF**: attributes that depend on only part of a key move out. Vehicle make and model depend on the vehicle, not the booking, so they go to `vehicles`.
3. **3NF**: remove transitive dependencies. Category rate depends on category, not on vehicle id, so it moves to `vehicle_categories`; branch city moves to `branches`.
4. **BCNF check**: in every table the only determinants are candidate keys (email and licence\_no in users and profiles, reg\_number in vehicles).

Note for the viva: `daily_rate_snapshot` on bookings looks like duplicated data, but it records a historical fact (the rate agreed on that day), so it is a deliberate and justified design choice, not a normalization violation.

## 5. PostgreSQL schema

Run these in order in a file called `01_schema.sql`. Each table uses an identity primary key, NOT NULL wherever a value is mandatory, CHECK constraints for value rules, and foreign keys with deliberate ON DELETE behaviour. Rates live on the category, so a vehicle's price comes from its category.

**Extensions and types**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- lets GiST index plain columns (needed for the exclusion constraint)
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive email

CREATE TYPE user_role         AS ENUM ('customer', 'staff', 'admin');
CREATE TYPE vehicle_status    AS ENUM ('available', 'maintenance', 'retired');
CREATE TYPE fuel_type         AS ENUM ('petrol', 'diesel', 'electric', 'hybrid', 'cng');
CREATE TYPE transmission_type AS ENUM ('manual', 'automatic');
CREATE TYPE booking_status    AS ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled');
CREATE TYPE payment_method    AS ENUM ('card', 'upi', 'netbanking', 'cash');
CREATE TYPE payment_status    AS ENUM ('paid', 'refunded', 'failed');
```

**People and places**

```sql
CREATE TABLE users (
    user_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         CITEXT       NOT NULL UNIQUE,
    phone         VARCHAR(15)  NOT NULL CHECK (phone ~ '^[0-9+ -]{10,15}$'),
    password_hash TEXT         NOT NULL,
    role          user_role    NOT NULL DEFAULT 'customer',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE customer_profiles (
    user_id        BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    licence_no     VARCHAR(30) NOT NULL UNIQUE,
    licence_expiry DATE        NOT NULL,
    date_of_birth  DATE        NOT NULL,   -- 18+ check done in signup function (CHECK with CURRENT_DATE breaks restores)
    address        TEXT
);

CREATE TABLE branches (
    branch_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name      VARCHAR(80) NOT NULL UNIQUE,
    city      VARCHAR(60) NOT NULL,
    address   TEXT        NOT NULL,
    phone     VARCHAR(15)
);
```

**Fleet**

```sql
CREATE TABLE vehicle_categories (
    category_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(40)   NOT NULL UNIQUE,
    base_daily_rate NUMERIC(10,2) NOT NULL CHECK (base_daily_rate > 0),
    seats           SMALLINT      NOT NULL CHECK (seats BETWEEN 1 AND 15)
);

CREATE TABLE vehicles (
    vehicle_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reg_number       VARCHAR(15)       NOT NULL UNIQUE,
    category_id      INT               NOT NULL REFERENCES vehicle_categories(category_id),
    branch_id        INT               NOT NULL REFERENCES branches(branch_id),
    make             VARCHAR(40)       NOT NULL,
    model            VARCHAR(40)       NOT NULL,
    manufacture_year SMALLINT          NOT NULL CHECK (manufacture_year BETWEEN 2000 AND 2100),
    fuel             fuel_type         NOT NULL,
    transmission     transmission_type NOT NULL,
    odometer_km      INT               NOT NULL DEFAULT 0 CHECK (odometer_km >= 0),
    status           vehicle_status    NOT NULL DEFAULT 'available',
    image_url        TEXT,
    created_at       TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE TABLE extras (
    extra_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(50)  NOT NULL UNIQUE,
    price_per_day NUMERIC(8,2) NOT NULL CHECK (price_per_day >= 0)
);

CREATE TABLE maintenance_records (
    maintenance_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id     BIGINT NOT NULL REFERENCES vehicles(vehicle_id),
    description    TEXT   NOT NULL,
    start_date     DATE   NOT NULL,
    end_date       DATE,
    cost           NUMERIC(10,2) CHECK (cost >= 0),
    CHECK (end_date IS NULL OR end_date >= start_date)
);
```

**Bookings, payments, rentals**

```sql
CREATE TABLE bookings (
    booking_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id         BIGINT         NOT NULL REFERENCES users(user_id),
    vehicle_id          BIGINT         NOT NULL REFERENCES vehicles(vehicle_id),
    pickup_branch_id    INT            NOT NULL REFERENCES branches(branch_id),
    drop_branch_id      INT            NOT NULL REFERENCES branches(branch_id),
    period              TSTZRANGE      NOT NULL,
    daily_rate_snapshot NUMERIC(10,2)  NOT NULL CHECK (daily_rate_snapshot > 0),
    total_amount        NUMERIC(10,2)  NOT NULL CHECK (total_amount >= 0),
    status              booking_status NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CHECK (NOT lower_inf(period) AND NOT upper_inf(period) AND lower(period) < upper(period)),
    -- the star of the project: no two live bookings of one vehicle may overlap
    CONSTRAINT no_double_booking
        EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)
        WHERE (status IN ('pending', 'confirmed', 'active'))
);

CREATE TABLE booking_extras (
    booking_id             BIGINT   NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    extra_id               INT      NOT NULL REFERENCES extras(extra_id),
    quantity               SMALLINT NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 5),
    price_per_day_snapshot NUMERIC(8,2) NOT NULL CHECK (price_per_day_snapshot >= 0),
    PRIMARY KEY (booking_id, extra_id)
);

CREATE TABLE payments (
    payment_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id      BIGINT         NOT NULL REFERENCES bookings(booking_id),
    amount          NUMERIC(10,2)  NOT NULL CHECK (amount > 0),
    method          payment_method NOT NULL,
    status          payment_status NOT NULL,
    transaction_ref VARCHAR(60) UNIQUE,
    paid_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TABLE rentals (
    rental_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id    BIGINT      NOT NULL UNIQUE REFERENCES bookings(booking_id),
    handed_out_by BIGINT      NOT NULL REFERENCES users(user_id),
    received_by   BIGINT      REFERENCES users(user_id),
    pickup_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    return_at     TIMESTAMPTZ,
    odometer_out  INT         NOT NULL CHECK (odometer_out >= 0),
    odometer_in   INT,
    CHECK (odometer_in IS NULL OR odometer_in >= odometer_out),
    CHECK (return_at  IS NULL OR return_at  >= pickup_at)
);

CREATE TABLE damage_reports (
    report_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rental_id   BIGINT        NOT NULL REFERENCES rentals(rental_id) ON DELETE CASCADE,
    description TEXT          NOT NULL,
    amount      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
    review_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT      NOT NULL UNIQUE REFERENCES bookings(booking_id),
    rating     SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    audit_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name TEXT        NOT NULL,
    record_id  BIGINT,
    action     TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data   JSONB,
    new_data   JSONB,
    changed_by BIGINT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes** (the exclusion constraint already builds a GiST index on vehicle and period, so no extra index is needed for date overlap)

```sql
CREATE INDEX idx_vehicles_branch_status ON vehicles (branch_id, status);
CREATE INDEX idx_vehicles_category      ON vehicles (category_id);
CREATE INDEX idx_bookings_customer      ON bookings (customer_id, created_at DESC);
CREATE INDEX idx_bookings_live          ON bookings (vehicle_id) WHERE status IN ('confirmed', 'active');  -- partial index
CREATE INDEX idx_payments_booking       ON payments (booking_id);
CREATE INDEX idx_maintenance_vehicle    ON maintenance_records (vehicle_id);
CREATE INDEX idx_audit_table_record     ON audit_log (table_name, record_id);
```

**Design choices to explain in the viva**

- Foreign keys default to RESTRICT, so history cannot be orphaned; only dependent detail rows (profiles, booking extras, damage reports) cascade.
- `customer_id` must point to a user whose role is customer; enforce it in `create_booking()` (Section 6), since a plain FK cannot check a role.
- `TIMESTAMPTZ` everywhere avoids time-zone bugs; the app sets the half-open range `[start, end)` so back-to-back rentals do not clash.

## 6. Advanced database features

This section is the heart of the ADBMS marks: business logic lives in PL/pgSQL functions and triggers, so the rules hold no matter which app talks to the database. Put it all in `02_logic.sql`.

### 6.1 Triggers: updated\_at and audit trail

```sql
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- one generic audit function, reused with the primary-key column name as argument
CREATE OR REPLACE FUNCTION fn_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    rec JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN rec := to_jsonb(OLD); ELSE rec := to_jsonb(NEW); END IF;
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME,
            (rec ->> TG_ARGV[0])::BIGINT,
            TG_OP,
            CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
            CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
            NULLIF(current_setting('app.current_user_id', true), '')::BIGINT);
    RETURN NULL;
END; $$;

CREATE TRIGGER trg_bookings_audit AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION fn_audit('booking_id');
CREATE TRIGGER trg_vehicles_audit AFTER INSERT OR UPDATE OR DELETE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION fn_audit('vehicle_id');
```

The app runs `SELECT set_config('app.current_user_id', '<id>', true)` at the start of each transaction so the audit row records who made the change.

### 6.2 Booking as one atomic function

`create_booking()` validates the customer, locks the vehicle row, prices the rental from the category rate, inserts the booking, extras and payment, and either all of it succeeds or none does.

```sql
CREATE OR REPLACE FUNCTION create_booking(
    p_customer_id   BIGINT,
    p_vehicle_id    BIGINT,
    p_start         TIMESTAMPTZ,
    p_end           TIMESTAMPTZ,
    p_pickup_branch INT,
    p_drop_branch   INT,
    p_method        payment_method,
    p_extra_ids     INT[] DEFAULT '{}'
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
    v_rate       NUMERIC(10,2);
    v_extras     NUMERIC(10,2);
    v_days       INT;
    v_total      NUMERIC(10,2);
    v_booking_id BIGINT;
BEGIN
    IF p_end <= p_start THEN
        RAISE EXCEPTION 'End must be after start';
    END IF;
    IF p_start < now() - INTERVAL '5 minutes' THEN
        RAISE EXCEPTION 'Start date is in the past';
    END IF;

    -- rule 3: active customer with a licence valid until the return date
    IF NOT EXISTS (
        SELECT 1 FROM users u JOIN customer_profiles cp USING (user_id)
        WHERE u.user_id = p_customer_id AND u.role = 'customer' AND u.is_active
          AND cp.licence_expiry >= p_end::date) THEN
        RAISE EXCEPTION 'Customer not eligible: inactive account or licence expires before return';
    END IF;

    -- lock the vehicle row so concurrent bookings queue up here
    SELECT c.base_daily_rate INTO v_rate
    FROM vehicles v JOIN vehicle_categories c USING (category_id)
    WHERE v.vehicle_id = p_vehicle_id AND v.status = 'available'
    FOR UPDATE OF v;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle not available';
    END IF;

    v_days   := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (p_end - p_start)) / 86400)::INT);
    v_extras := COALESCE((SELECT SUM(price_per_day) FROM extras WHERE extra_id = ANY (p_extra_ids)), 0);
    v_total  := v_days * (v_rate + v_extras);

    INSERT INTO bookings (customer_id, vehicle_id, pickup_branch_id, drop_branch_id,
                          period, daily_rate_snapshot, total_amount, status)
    VALUES (p_customer_id, p_vehicle_id, p_pickup_branch, p_drop_branch,
            tstzrange(p_start, p_end, '[)'), v_rate, v_total, 'confirmed')
    RETURNING booking_id INTO v_booking_id;

    INSERT INTO booking_extras (booking_id, extra_id, quantity, price_per_day_snapshot)
    SELECT v_booking_id, e.extra_id, 1, e.price_per_day
    FROM extras e WHERE e.extra_id = ANY (p_extra_ids);

    INSERT INTO payments (booking_id, amount, method, status, transaction_ref)
    VALUES (v_booking_id, v_total, p_method, 'paid', 'TXN-' || gen_random_uuid());

    RETURN v_booking_id;
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION 'Vehicle is already booked for these dates';
END; $$;
```

### 6.3 Cancellation with refund rule

```sql
CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id BIGINT, p_customer_id BIGINT)
RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
    b        bookings%ROWTYPE;
    v_refund NUMERIC(10,2);
BEGIN
    SELECT * INTO b FROM bookings
    WHERE booking_id = p_booking_id AND customer_id = p_customer_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
    IF b.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Cannot cancel a booking that is %', b.status;
    END IF;

    -- rule 6: full refund if 24h or more before start, else 50%
    v_refund := CASE WHEN lower(b.period) - now() >= INTERVAL '24 hours'
                     THEN b.total_amount
                     ELSE ROUND(b.total_amount * 0.5, 2) END;

    UPDATE bookings SET status = 'cancelled' WHERE booking_id = b.booking_id;

    INSERT INTO payments (booking_id, amount, method, status, transaction_ref)
    SELECT b.booking_id, v_refund, p.method, 'refunded', 'RFD-' || gen_random_uuid()
    FROM payments p WHERE p.booking_id = b.booking_id AND p.status = 'paid'
    ORDER BY p.paid_at LIMIT 1;

    RETURN v_refund;
END; $$;
```

### 6.4 Pickup and return with a status-sync trigger

Staff insert a row into `rentals` at pickup and update it at return. A trigger moves the booking to active or completed and updates the vehicle odometer, so the app never has to remember to do it.

```sql
CREATE OR REPLACE FUNCTION fn_rental_status_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE bookings SET status = 'active' WHERE booking_id = NEW.booking_id;
    ELSIF NEW.return_at IS NOT NULL AND OLD.return_at IS NULL THEN
        UPDATE bookings SET status = 'completed' WHERE booking_id = NEW.booking_id;
        UPDATE vehicles SET odometer_km = NEW.odometer_in
        WHERE vehicle_id = (SELECT vehicle_id FROM bookings WHERE booking_id = NEW.booking_id);
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER trg_rental_sync AFTER INSERT OR UPDATE ON rentals
    FOR EACH ROW EXECUTE FUNCTION fn_rental_status_sync();
```

### 6.5 Views and a materialized view

```sql
CREATE VIEW v_vehicle_catalog AS
SELECT v.vehicle_id, v.reg_number, v.make, v.model, v.fuel, v.transmission, v.image_url,
       b.branch_id, b.city, c.name AS category, c.seats, c.base_daily_rate
FROM vehicles v
JOIN vehicle_categories c ON c.category_id = v.category_id
JOIN branches b           ON b.branch_id   = v.branch_id
WHERE v.status = 'available';

-- vehicles in a city that are free for the whole requested period
CREATE OR REPLACE FUNCTION fn_available_vehicles(p_city TEXT, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS SETOF v_vehicle_catalog LANGUAGE sql STABLE AS $$
    SELECT vc.* FROM v_vehicle_catalog vc
    WHERE vc.city ILIKE p_city
      AND NOT EXISTS (
          SELECT 1 FROM bookings bk
          WHERE bk.vehicle_id = vc.vehicle_id
            AND bk.status IN ('pending', 'confirmed', 'active')
            AND bk.period && tstzrange(p_start, p_end, '[)'));
$$;

CREATE MATERIALIZED VIEW mv_monthly_revenue AS
SELECT date_trunc('month', paid_at) AS month,
       SUM(CASE status WHEN 'paid' THEN amount WHEN 'refunded' THEN -amount ELSE 0 END) AS net_revenue,
       COUNT(DISTINCT booking_id) AS bookings
FROM payments GROUP BY 1;

CREATE UNIQUE INDEX ON mv_monthly_revenue (month);
-- refresh nightly or after reports: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_revenue;
```

### 6.6 Transactions and concurrency demo (do this live in the viva)

Open two `psql` windows and show that the database, not the app, prevents a double booking.

1. In window A: `BEGIN; SELECT create_booking(...vehicle 1, same dates...);` and do not commit.
2. In window B: run the same call. It waits, because A holds the row lock from `FOR UPDATE`.
3. In window A: `COMMIT;`. Window B now fails with "Vehicle is already booked for these dates".
4. Repeat with a plain `INSERT INTO bookings` that skips the function: the exclusion constraint still rejects it.
5. Explain the isolation level: the default READ COMMITTED is enough, because the row lock plus the exclusion constraint cover the race. Show `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` as the stricter option and when it would be needed.

## 7. Queries and reports for the admin dashboard

Each query below feeds one dashboard card and demonstrates one SQL concept, so you can say both in the viva. Save them as `03_reports.sql`.

```sql
-- 1. Top 5 customers by net spend (joins, GROUP BY, conditional aggregate)
SELECT u.full_name,
       COUNT(DISTINCT b.booking_id) AS bookings,
       SUM(CASE p.status WHEN 'paid' THEN p.amount WHEN 'refunded' THEN -p.amount ELSE 0 END) AS net_spend
FROM users u
JOIN bookings b ON b.customer_id = u.user_id
JOIN payments p ON p.booking_id  = b.booking_id
GROUP BY u.user_id, u.full_name
ORDER BY net_spend DESC
LIMIT 5;

-- 2. Revenue by vehicle category (multi-table join, HAVING)
SELECT c.name AS category, COUNT(*) AS rentals,
       SUM(b.total_amount) AS revenue, ROUND(AVG(b.total_amount), 2) AS avg_booking
FROM bookings b
JOIN vehicles v           ON v.vehicle_id  = b.vehicle_id
JOIN vehicle_categories c ON c.category_id = v.category_id
WHERE b.status = 'completed'
GROUP BY c.name
HAVING COUNT(*) >= 1
ORDER BY revenue DESC;

-- 3. Most-rented vehicles inside each category (window function RANK)
SELECT category, reg_number, rentals,
       RANK() OVER (PARTITION BY category ORDER BY rentals DESC) AS rank_in_category
FROM (
    SELECT c.name AS category, v.reg_number, COUNT(b.booking_id) AS rentals
    FROM vehicles v
    JOIN vehicle_categories c ON c.category_id = v.category_id
    LEFT JOIN bookings b ON b.vehicle_id = v.vehicle_id AND b.status = 'completed'
    GROUP BY c.name, v.reg_number
) t;

-- 4. Month-over-month revenue change (window function LAG on the materialized view)
SELECT month, net_revenue,
       net_revenue - LAG(net_revenue) OVER (ORDER BY month) AS change_vs_previous
FROM mv_monthly_revenue
ORDER BY month;

-- 5. Vehicles that have never been booked (LEFT JOIN anti-pattern)
SELECT v.reg_number, v.make, v.model
FROM vehicles v
LEFT JOIN bookings b ON b.vehicle_id = v.vehicle_id
WHERE b.booking_id IS NULL;

-- 6. Overdue returns to chase today (CTE)
WITH overdue AS (
    SELECT r.rental_id, b.vehicle_id, b.customer_id, upper(b.period) AS due_at
    FROM rentals r
    JOIN bookings b ON b.booking_id = r.booking_id
    WHERE r.return_at IS NULL AND upper(b.period) < now()
)
SELECT o.rental_id, v.reg_number, u.full_name, u.phone, now() - o.due_at AS overdue_by
FROM overdue o
JOIN vehicles v ON v.vehicle_id = o.vehicle_id
JOIN users u    ON u.user_id    = o.customer_id
ORDER BY overdue_by DESC;
```

Also prepare two more for the viva: a correlated subquery (customers whose spend is above the average) and a `GROUP BY ROLLUP (branch, category)` for subtotals per branch.

## 8. Database security, performance, backup, and seed data

### 8.1 Database roles and permissions

The web app connects as a limited role, never as the `postgres` superuser. That way a bug or SQL injection cannot drop tables, and you can demonstrate GRANT and REVOKE live.

```sql
CREATE ROLE rental_app LOGIN PASSWORD 'change_me';       -- used by the backend
CREATE ROLE rental_report LOGIN PASSWORD 'change_me_2';  -- read-only, for reports

GRANT CONNECT ON DATABASE rental_db TO rental_app, rental_report;
GRANT USAGE ON SCHEMA public TO rental_app, rental_report;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO rental_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rental_app;
REVOKE UPDATE ON audit_log FROM rental_app;   -- audit rows are append-only

GRANT SELECT ON v_vehicle_catalog, mv_monthly_revenue TO rental_report;
```

Bonus (only if time allows): row-level security so a customer can read only their own bookings, with the user id passed through `set_config('app.current_user_id', ...)` as in Section 6.1. Test it carefully, because the table owner bypasses RLS and staff need their own policy.

### 8.2 Performance demo

1. Load about 50,000 bookings with `generate_series` in the seed script.
2. Run the "customer booking history" query with `EXPLAIN (ANALYZE, BUFFERS)` and screenshot the sequential scan.
3. Add `idx_bookings_customer` and run it again; screenshot the index scan and the lower execution time.
4. Show the partial index `idx_bookings_live` being used for the availability check.
5. Write two lines in the report on why indexes slow down writes, so you can answer that question.

### 8.3 Backup and restore

```bash
pg_dump -Fc -U postgres -d rental_db -f rental_db.dump        # compressed custom-format backup
createdb -U postgres rental_db_restore
pg_restore -U postgres -d rental_db_restore rental_db.dump    # restore into a fresh database
```

Show that row counts match after restore. Mention point-in-time recovery (WAL archiving) as the production-grade approach, without implementing it.

### 8.4 Seed data and file layout

| File | Contents |
| --- | --- |
| `db/01_schema.sql` | Extensions, types, tables, indexes (Section 5) |
| `db/02_logic.sql` | Triggers, functions, views (Section 6) |
| `db/03_reports.sql` | Dashboard queries (Section 7) |
| `db/04_security.sql` | Roles and grants (Section 8.1) |
| `db/05_seed.sql` | 1 admin, 3 staff, 20 customers, 3 branches, 5 categories, 30 vehicles, 4 extras, about 50 bookings created through `create_booking()` |

Generate real bcrypt hashes for the seeded users with a small script (for example one line in Node: `bcrypt.hashSync('Password@123', 10)`), and never store plain passwords in the seed file. Use Indian-style data (cities such as Chandigarh, Delhi, Jaipur; registration numbers like `PB10AB1234`) so the demo feels real.

## 9. Signup, login, and access control

Authentication is built on the `users` table: passwords are stored only as bcrypt hashes, sessions live in PostgreSQL, and every route is guarded by role. Public signup creates customers only; staff and admin accounts are created by an admin.

**Signup flow**

1. Form fields: full name, email, phone, password, confirm password, licence number, licence expiry, date of birth.
2. Validate on the client for fast feedback and again on the server (use `zod` or `express-validator`): valid email, phone matches the DB pattern, password at least 8 characters with a letter and a digit, age 18 or more, licence not expired.
3. Hash the password with `bcrypt` (cost 10 to 12). Never log or return it.
4. In one transaction, insert into `users` and `customer_profiles`. If either fails, neither is saved.
5. A duplicate email raises PostgreSQL error code `23505` (unique violation); catch it and show "This email is already registered".
6. After success, log the user in and redirect to the vehicle search page.

**Login flow**

1. User sends email and password. The server fetches the user by email with a parameterised query, rejects inactive users, and runs `bcrypt.compare`.
2. Any failure returns the same message, "Invalid email or password", so attackers cannot tell which one was wrong.
3. On success, create a server session stored in PostgreSQL (package `connect-pg-simple`, which adds one `session` table) and send it in an `httpOnly`, `SameSite=Lax` cookie (add `Secure` in production). Sessions in the database are easy to revoke and show off the database again.
4. Logout destroys the session row.
5. Rate-limit the login route (for example 10 attempts per 15 minutes per IP with `express-rate-limit`).

**Role-based access**

| Area | Customer | Staff | Admin |
| --- | --- | --- | --- |
| Browse and book vehicles, own history | Yes | No | No |
| Today's pickups and returns, record rentals | No | Yes | Yes |
| Fleet, branch, pricing management | No | No | Yes |
| Create staff accounts, block users | No | No | Yes |
| Dashboard reports and audit log | No | Limited (fleet status) | Yes |

Implement a `requireAuth` middleware and a `requireRole('admin', 'staff')` middleware, and use them on every route. The same check hides menu items in the UI, but the server check is what actually protects the data.

**Security checklist**

- Parameterised queries only (`$1`, `$2`), never string-built SQL; this stops SQL injection.
- `helmet` for security headers, a strict CORS origin, and a CSRF token on state-changing forms.
- Secrets (database URL, session secret) in a `.env` file that is git-ignored.
- Optional extras if time allows: forgot-password with an expiring token stored in the database, and a `failed_login_attempts` column with temporary lockout.

## 10. UI plan

About 14 screens cover every feature, and each one is backed by a specific database object, so you can show the examiner where the data comes from.

| Page | Who | Main elements | Database object behind it |
| --- | --- | --- | --- |
| Home | Public | Search bar (city, pickup and drop dates), category tiles, featured vehicles | `v_vehicle_catalog` |
| Vehicle search | Public | Filters (category, fuel, transmission, price), vehicle cards with a Book button | `fn_available_vehicles()` |
| Vehicle detail | Public | Photos, specs, rate per day, reviews, availability | `vehicles`, `reviews` |
| Signup, Login | Public | Forms with inline validation errors | `users`, `customer_profiles` |
| Booking checkout | Customer | Dates, branches, extras, live price summary, payment method, Confirm | `create_booking()` |
| My bookings | Customer | List with status chips, Cancel button showing the refund amount, Rate button | `bookings`, `cancel_booking()` |
| Profile | Customer | Edit phone, address, licence details | `customer_profiles` |
| Staff board | Staff | Today's pickups and returns, overdue list | `rentals`, report query 6 |
| Pickup and return forms | Staff | Odometer, fuel, damage notes and amount | `rentals`, `damage_reports` |
| Admin dashboard | Admin | KPI cards, monthly revenue chart, top customers, category revenue | `mv_monthly_revenue`, report queries 1 to 4 |
| Fleet manager | Admin | Table with search, add and edit vehicle, set maintenance | `vehicles`, `maintenance_records` |
| Masters | Admin | Branches, categories, extras (simple CRUD) | respective tables |
| Users | Admin | List, create staff, block or unblock | `users` |
| Audit log | Admin | Filterable table with before and after JSON | `audit_log` |

**Key user journeys to polish first**

1. Visitor searches, sees available vehicles, signs up, books, sees confirmation.
2. Customer cancels a booking and sees the refund shown before confirming.
3. Staff hands over a vehicle and later records the return.
4. Admin opens the dashboard and drills into revenue.

**Design guidelines**

- **Tools**: React with Vite, Tailwind CSS, and a ready component set (shadcn/ui or daisyUI) so forms, tables, modals, and toasts look consistent without custom CSS. Use Recharts for dashboard charts and Lucide for icons.
- **Look**: one primary colour, neutral greys, large vehicle photos, generous spacing, rounded cards. Status chips: green for confirmed, blue for active, grey for completed, red for cancelled.
- **States**: every screen has loading, empty, and error states; every action shows a toast; destructive actions ask for confirmation.
- **Forms**: inline errors under fields, disabled submit while sending, and server error messages (such as "Vehicle is already booked for these dates") shown in plain words.
- **Responsive**: customer pages must work on a phone; admin pages need only be usable on a laptop.
- **Process**: sketch the 14 screens on paper or in Figma first (one hour), then build the shared layout, then the pages in the order of the journeys above.

## 11. Tech stack, architecture, and API

The browser (React) calls a small Express API, which runs plain SQL against PostgreSQL through the `pg` driver. The API stays thin on purpose: it checks the session and role, then calls the database functions from Section 6.

| Layer | Choice | Why |
| --- | --- | --- |
| Database | PostgreSQL 16 or newer, pgAdmin 4 | Required by the project; pgAdmin gives a GUI, query tool, and ERD generator |
| Backend | Node.js (current LTS) with Express | Simple, huge tutorial base, easy to explain |
| DB access | `pg` driver with raw parameterised SQL, no ORM | An ORM hides the SQL, and SQL is what an ADBMS examiner wants to see |
| Auth | `bcrypt`, `express-session`, `connect-pg-simple` | Sessions stored in PostgreSQL |
| Validation | `zod` | One schema for request checking |
| Frontend | React with Vite, Tailwind CSS, shadcn/ui, Recharts | Modern look quickly |
| Tools | Git and GitHub, Postman or Thunder Client, `.env` with dotenv | Version history and API testing |

Simpler fallback if React feels heavy: Express with EJS templates and Bootstrap. The database part of the plan does not change at all.

**Folder structure**

```text
vehicle-rental/
  db/                  01_schema.sql ... 05_seed.sql
  server/
    src/
      db.js            pg Pool (reads DATABASE_URL)
      middleware/      requireAuth.js, requireRole.js, errorHandler.js
      routes/          auth.js, vehicles.js, bookings.js, rentals.js, admin.js
      validators/      zod schemas
    .env               DATABASE_URL, SESSION_SECRET (git-ignored)
  client/
    src/
      pages/  components/  api/  hooks/
  docs/                ERD image, report, screenshots
```

**API endpoints**

| Method and path | Role | Calls |
| --- | --- | --- |
| POST `/api/auth/signup` | Public | Insert `users` and `customer_profiles` in a transaction |
| POST `/api/auth/login`, `/api/auth/logout` | Public | Verify hash, create or destroy session |
| GET `/api/auth/me` | Any | Current user and role |
| GET `/api/vehicles?city&start&end&category` | Public | `fn_available_vehicles()` |
| GET `/api/vehicles/:id` | Public | Vehicle, category, reviews |
| POST `/api/bookings` | Customer | `create_booking()` |
| GET `/api/bookings/mine` | Customer | Bookings for the session user |
| POST `/api/bookings/:id/cancel` | Customer | `cancel_booking()` |
| POST `/api/bookings/:id/review` | Customer | Insert `reviews` (completed bookings only) |
| GET `/api/staff/today` | Staff, Admin | Pickups, returns, overdue |
| POST `/api/rentals`, PATCH `/api/rentals/:id/return` | Staff, Admin | Insert and update `rentals`, trigger syncs status |
| GET, POST, PATCH `/api/admin/vehicles` | Admin | CRUD on `vehicles` |
| GET, POST, PATCH `/api/admin/users` | Admin | Create staff, block users |
| GET `/api/admin/reports/*` | Admin | Report queries from Section 7 |
| GET `/api/admin/audit` | Admin | `audit_log` with filters |

Every handler that writes data begins with `set_config('app.current_user_id', ...)` inside its transaction so the audit trigger knows who acted.

## 12. Roadmap, viva checklist, and risks

The plan is six weeks with the database finished and demonstrable before any UI work starts, because the database carries the marks. If your submission date is sooner, compress weeks 4 to 5 first and never cut weeks 2 to 3. Open question: what is your submission date, and is this a solo or group project? Tell me and I will adjust the split.

**Roadmap**

1. **Week 1, research and design.** Install PostgreSQL and pgAdmin, finalise requirements, draw the ERD, write the normalization steps. Gate: ERD and table list agreed.
2. **Week 2, database build.** Run `01_schema.sql`, write `05_seed.sql`, test every constraint with deliberately bad inserts and keep the error screenshots. Gate: all tables loaded with realistic data.
3. **Week 3, database logic.** Functions, triggers, views, roles, report queries, the two-window concurrency demo. Gate: the whole system works from `psql` alone, with no app.
4. **Week 4, backend and auth.** Express setup, signup, login, sessions, role middleware, then the booking, rental, and admin endpoints. Test each in Postman.
5. **Week 5, UI and integration.** Layout and shared components, customer journey first, then staff board, then admin dashboard. Polish states and errors.
6. **Week 6, testing, report, viva prep.** End-to-end test of the four journeys, `EXPLAIN` before and after screenshots, backup and restore demo, final report and slides.

**Viva and demo checklist**

- [ ] ERD printed, with cardinalities labelled
- [ ] Normalization steps written for one flat table up to BCNF
- [ ] Live demo: constraint rejecting bad data
- [ ] Live demo: double booking blocked with two sessions
- [ ] Live demo: trigger writing to `audit_log` and status syncing on return
- [ ] `EXPLAIN ANALYZE` screenshots before and after an index
- [ ] Backup, drop, and restore demo with matching row counts
- [ ] Role demo: `rental_app` fails on `DROP TABLE` and on updating `audit_log`
- [ ] Answers ready: why PostgreSQL, why raw SQL, why snapshot price, why RESTRICT foreign keys, what isolation level and why

**Risks and fallbacks**

| Risk | Fallback |
| --- | --- |
| Exclusion constraint errors because `btree_gist` is missing | Run `CREATE EXTENSION btree_gist;` as a superuser, which is the first line of the schema file |
| Time runs short on the UI | Use the EJS plus Bootstrap fallback and drop the admin charts; keep all database work |
| PL/pgSQL functions are hard to debug | Test each function in `psql` with `RAISE NOTICE` before wiring the API |
| Seed data looks fake | Generate bookings through `create_booking()` so every rule is exercised |
| Scope creep (coupons, GPS, online payments) | List them under future work in the report, do not build them |
