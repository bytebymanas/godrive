import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { z } from 'zod';

import { pool, withActor } from './db.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/errors.js';

const app = express();
const PgStore = connectPgSimple(session);

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use(session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86400000,
  },
}));

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ==========================================
// 1. AUTH ROUTES
// ==========================================

// GET /api/auth/me
app.get('/api/auth/me', wrap(async (req, res) => {
  if (!req.session?.user) {
    return res.json({ user: null });
  }
  const q = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.phone, u.role,
           cp.licence_no, cp.licence_expiry, cp.date_of_birth, cp.address
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.user_id
    WHERE u.user_id = $1
  `, [req.session.user.user_id]);
  if (!q.rowCount) {
    return res.json({ user: null });
  }
  res.json({ user: q.rows[0] });
}));

// PATCH /api/profile
app.patch('/api/profile', requireAuth, wrap(async (req, res) => {
  const schema = z.object({
    phone: z.string().regex(/^[0-9+ -]{10,15}$/, 'Invalid phone number format').optional(),
    address: z.string().optional(),
  });
  const parsed = schema.parse(req.body);
  await withActor(req.user.user_id, async c => {
    if (parsed.phone) {
      await c.query('UPDATE users SET phone = $1 WHERE user_id = $2', [parsed.phone, req.user.user_id]);
    }
    if (parsed.address !== undefined) {
      await c.query('UPDATE customer_profiles SET address = $1 WHERE user_id = $2', [parsed.address, req.user.user_id]);
    }
  });
  const q = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.phone, u.role,
           cp.licence_no, cp.licence_expiry, cp.date_of_birth, cp.address
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.user_id
    WHERE u.user_id = $1
  `, [req.user.user_id]);
  res.json({ user: q.rows[0] });
}));

// POST /api/auth/signup
app.post('/api/auth/signup', wrap(async (req, res) => {
  const schema = z.object({
    full_name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().regex(/^[0-9+ -]{10,15}$/, 'Invalid phone number format'),
    password: z.string().min(8).regex(/[A-Za-z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number'),
    licence_no: z.string().min(4).max(30),
    licence_expiry: z.coerce.date(),
    date_of_birth: z.coerce.date(),
    address: z.string().optional(),
  });

  const parsed = schema.parse(req.body);

  if (parsed.licence_expiry < new Date()) {
    return res.status(400).json({ error: 'Licence has expired' });
  }
  const age = (Date.now() - parsed.date_of_birth.getTime()) / 31557600000;
  if (age < 18) {
    return res.status(400).json({ error: 'You must be at least 18' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(parsed.password, 12);
    const u = await client.query(
      "INSERT INTO users(full_name, email, phone, password_hash, role) VALUES($1, $2, $3, $4, 'customer') RETURNING user_id, full_name, email, role",
      [parsed.full_name, parsed.email, parsed.phone, hash]
    );

    const newUser = u.rows[0];
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(newUser.user_id)]);

    const licenceDate = parsed.licence_expiry.toISOString().split('T')[0];
    const birthDate = parsed.date_of_birth.toISOString().split('T')[0];

    await client.query(
      'INSERT INTO customer_profiles(user_id, licence_no, licence_expiry, date_of_birth, address) VALUES($1, $2, $3, $4, $5)',
      [newUser.user_id, parsed.licence_no, licenceDate, birthDate, parsed.address || null]
    );

    await client.query('COMMIT');
    req.session.user = newUser;
    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Session save failed' });
      res.status(201).json({ user: newUser });
    });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') {
      return res.status(400).json({ error: 'This email is already registered' });
    }
    throw e;
  } finally {
    client.release();
  }
}));

// POST /api/auth/login
app.post('/api/auth/login', loginLimit, wrap(async (req, res, next) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string(),
  });
  const { email, password } = schema.parse(req.body);

  const q = await pool.query(
    'SELECT user_id, full_name, email, role, password_hash, is_active FROM users WHERE email = $1',
    [email]
  );
  const u = q.rows[0];
  if (!u || !u.is_active || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const safeUser = {
    user_id: u.user_id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
  };
  req.session.user = safeUser;
  req.session.save(err => {
    if (err) return next(err);
    res.json({ user: safeUser });
  });
}));

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ==========================================
// 2. COMMON / CATALOG ROUTES
// ==========================================

// GET /api/branches
app.get('/api/branches', wrap(async (req, res) => {
  const q = await pool.query('SELECT * FROM branches ORDER BY name');
  res.json(q.rows);
}));

// GET /api/extras
app.get('/api/extras', wrap(async (req, res) => {
  const q = await pool.query('SELECT * FROM extras ORDER BY extra_id');
  res.json(q.rows);
}));

// GET /api/vehicles
app.get('/api/vehicles', wrap(async (req, res) => {
  const { city = '%', start, end, category, type, available_only } = req.query;
  const hasDates = start && end && !isNaN(Date.parse(start)) && !isNaN(Date.parse(end));

  const params = [];
  let availabilityExpression = "CASE WHEN v.status = 'available' THEN true ELSE false END";

  if (hasDates) {
    params.push(start, end);
    availabilityExpression = `CASE
        WHEN v.status != 'available' THEN false
        WHEN EXISTS (
          SELECT 1 FROM bookings bk
          WHERE bk.vehicle_id = v.vehicle_id
            AND bk.status IN ('pending', 'confirmed', 'active')
            AND bk.period && tstzrange($1::timestamptz, $2::timestamptz, '[)')
        ) THEN false
        ELSE true
      END`;
  }

  let query = `
    SELECT
      v.vehicle_id,
      v.reg_number,
      v.make,
      v.model,
      v.fuel,
      v.transmission,
      v.image_url,
      v.status,
      v.odometer_km,
      b.branch_id,
      b.name AS branch_name,
      b.city,
      c.category_id,
      c.name AS category,
      c.seats,
      c.base_daily_rate,
      ${availabilityExpression} AS is_available
    FROM vehicles v
    JOIN vehicle_categories c USING (category_id)
    JOIN branches b USING (branch_id)
    WHERE 1=1
  `;

  if (city && city !== '%' && city.trim() !== '') {
    params.push(city);
    query += ` AND b.city ILIKE $${params.length}`;
  }

  if (category && category.trim() !== '' && category.toLowerCase() !== 'all') {
    params.push(category);
    query += ` AND c.name ILIKE $${params.length}`;
  }

  if (type === 'bike') {
    query += ` AND c.name ILIKE 'Bike'`;
  } else if (type === 'car') {
    query += ` AND c.name NOT ILIKE 'Bike'`;
  }

  if (available_only === 'true') {
    if (hasDates) {
      query += ` AND v.status = 'available' AND NOT EXISTS (
        SELECT 1 FROM bookings bk
        WHERE bk.vehicle_id = v.vehicle_id
          AND bk.status IN ('pending', 'confirmed', 'active')
          AND bk.period && tstzrange($1::timestamptz, $2::timestamptz, '[)')
      )`;
    } else {
      query += ` AND v.status = 'available'`;
    }
  }

  query += ` ORDER BY v.vehicle_id ASC`;

  const q = await pool.query(query, params);
  res.json(q.rows);
}));

// GET /api/vehicles/:id (queries vehicles table directly, so maintenance/retired vehicles are fetchable)
app.get('/api/vehicles/:id', wrap(async (req, res) => {
  const q = await pool.query(`
    SELECT
      v.*,
      c.name AS category,
      c.seats,
      c.base_daily_rate,
      b.name AS branch_name,
      b.city,
      b.address AS branch_address,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'rating', r.rating,
          'comment', r.comment,
          'created_at', r.created_at
        )), '[]'::json)
        FROM reviews r
        JOIN bookings bk USING (booking_id)
        WHERE bk.vehicle_id = v.vehicle_id
      ) AS reviews
    FROM vehicles v
    JOIN vehicle_categories c USING (category_id)
    JOIN branches b USING (branch_id)
    WHERE v.vehicle_id = $1
  `, [req.params.id]);

  if (!q.rowCount) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  res.json(q.rows[0]);
}));

// ==========================================
// 3. BOOKINGS & CUSTOMER ROUTES
// ==========================================

// POST /api/bookings
app.post('/api/bookings', requireAuth, requireRole('customer'), wrap(async (req, res) => {
  const schema = z.object({
    vehicle_id: z.coerce.number().int(),
    start: z.string().refine(s => !isNaN(Date.parse(s)), 'Invalid start date format'),
    end: z.string().refine(s => !isNaN(Date.parse(s)), 'Invalid end date format'),
    pickup_branch_id: z.coerce.number().int(),
    drop_branch_id: z.coerce.number().int(),
    method: z.enum(['card', 'upi', 'netbanking', 'cash']),
    extra_ids: z.array(z.coerce.number().int()).default([]),
  });

  const parsed = schema.parse(req.body);

  const r = await withActor(req.user.user_id, c =>
    c.query(
      'SELECT create_booking($1, $2, $3, $4, $5, $6, $7, $8) AS booking_id',
      [
        req.user.user_id,
        parsed.vehicle_id,
        parsed.start,
        parsed.end,
        parsed.pickup_branch_id,
        parsed.drop_branch_id,
        parsed.method,
        parsed.extra_ids,
      ]
    )
  );
  res.status(201).json(r.rows[0]);
}));

// GET /api/bookings/mine
app.get('/api/bookings/mine', requireAuth, requireRole('customer'), wrap(async (req, res) => {
  const q = await pool.query(`
    SELECT
      b.*,
      v.make,
      v.model,
      v.reg_number,
      v.image_url,
      pb.name AS pickup_branch,
      db.name AS drop_branch,
      COALESCE((
        SELECT SUM(dr.amount)
        FROM rentals r
        JOIN damage_reports dr USING (rental_id)
        WHERE r.booking_id = b.booking_id
      ), 0) AS total_fine,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'report_id', dr.report_id,
          'description', dr.description,
          'amount', dr.amount,
          'created_at', dr.created_at
        )), '[]'::json)
        FROM rentals r
        JOIN damage_reports dr USING (rental_id)
        WHERE r.booking_id = b.booking_id
      ) AS damage_reports
    FROM bookings b
    JOIN vehicles v USING (vehicle_id)
    JOIN branches pb ON pb.branch_id = b.pickup_branch_id
    JOIN branches db ON db.branch_id = b.drop_branch_id
    WHERE b.customer_id = $1
    ORDER BY b.created_at DESC
  `, [req.user.user_id]);

  res.json(q.rows);
}));

// GET /api/bookings/:id
app.get('/api/bookings/:id', requireAuth, wrap(async (req, res) => {
  const q = await pool.query(`
    SELECT
      b.*,
      v.make,
      v.model,
      v.reg_number,
      v.fuel,
      v.transmission,
      v.image_url,
      pb.name AS pickup_branch_name,
      pb.city AS pickup_city,
      db.name AS drop_branch_name,
      db.city AS drop_city,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'extra_id', e.extra_id,
          'name', e.name,
          'price_per_day', be.price_per_day_snapshot,
          'quantity', be.quantity
        )), '[]'::json)
        FROM booking_extras be
        JOIN extras e USING (extra_id)
        WHERE be.booking_id = b.booking_id
      ) AS extras,
      (
        SELECT json_build_object(
          'rental_id', r.rental_id,
          'pickup_at', r.pickup_at,
          'return_at', r.return_at,
          'odometer_out', r.odometer_out,
          'odometer_in', r.odometer_in,
          'total_fine', COALESCE((
            SELECT SUM(dr.amount)
            FROM damage_reports dr
            WHERE dr.rental_id = r.rental_id
          ), 0),
          'damage_reports', (
            SELECT COALESCE(json_agg(json_build_object(
              'report_id', dr.report_id,
              'description', dr.description,
              'amount', dr.amount,
              'created_at', dr.created_at
            )), '[]'::json)
            FROM damage_reports dr
            WHERE dr.rental_id = r.rental_id
          )
        )
        FROM rentals r
        WHERE r.booking_id = b.booking_id
      ) AS rental,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'payment_id', p.payment_id,
          'amount', p.amount,
          'method', p.method,
          'status', p.status,
          'transaction_ref', p.transaction_ref,
          'paid_at', p.paid_at
        )), '[]'::json)
        FROM payments p
        WHERE p.booking_id = b.booking_id
      ) AS payments
    FROM bookings b
    JOIN vehicles v USING (vehicle_id)
    JOIN branches pb ON pb.branch_id = b.pickup_branch_id
    JOIN branches db ON db.branch_id = b.drop_branch_id
    WHERE b.booking_id = $1
  `, [req.params.id]);

  if (!q.rowCount) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const booking = q.rows[0];
  // Customers can only see their own bookings; staff and admin can see all
  if (req.user.role === 'customer' && String(booking.customer_id) !== String(req.user.user_id)) {
    return res.status(403).json({ error: 'You do not have access to this resource' });
  }

  res.json(booking);
}));

// POST /api/bookings/:id/cancel
app.post('/api/bookings/:id/cancel', requireAuth, requireRole('customer'), wrap(async (req, res) => {
  const r = await withActor(req.user.user_id, c =>
    c.query('SELECT cancel_booking($1, $2) AS refund', [req.params.id, req.user.user_id])
  );
  res.json(r.rows[0]);
}));

// POST /api/bookings/:id/review
app.post('/api/bookings/:id/review', requireAuth, requireRole('customer'), wrap(async (req, res) => {
  const schema = z.object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().optional(),
  });
  const parsed = schema.parse(req.body);

  const q = await withActor(req.user.user_id, c =>
    c.query(
      "INSERT INTO reviews(booking_id, rating, comment) SELECT booking_id, $2, $3 FROM bookings WHERE booking_id = $1 AND customer_id = $4 AND status = 'completed' RETURNING *",
      [req.params.id, parsed.rating, parsed.comment || null, req.user.user_id]
    )
  );

  if (!q.rowCount) {
    return res.status(400).json({ error: 'Only your completed bookings can be reviewed' });
  }
  res.status(201).json(q.rows[0]);
}));

// ==========================================
// 4. STAFF OPERATIONS ROUTES
// ==========================================

// GET /api/staff/today (shows confirmed bookings for pickup + active rentals on the road)
app.get('/api/staff/today', requireAuth, requireRole('staff', 'admin'), wrap(async (req, res) => {
  const q = await pool.query(`
    SELECT
      r.rental_id,
      b.booking_id,
      b.customer_id,
      b.vehicle_id,
      b.period,
      b.status AS booking_status,
      v.make,
      v.model,
      v.reg_number,
      u.full_name AS customer_name,
      u.phone AS customer_phone,
      u.email AS customer_email,
      CASE WHEN r.rental_id IS NULL THEN 'pickup' ELSE 'return' END AS handover_type,
      CASE
        WHEN r.rental_id IS NOT NULL AND r.return_at IS NULL THEN 'active_rental'
        WHEN lower(b.period)::date = CURRENT_DATE THEN 'today'
        WHEN lower(b.period)::date < CURRENT_DATE THEN 'past_due'
        ELSE 'upcoming'
      END AS timeline_status,
      r.pickup_at,
      r.odometer_out,
      r.return_at,
      r.odometer_in
    FROM bookings b
    JOIN vehicles v USING (vehicle_id)
    JOIN users u ON u.user_id = b.customer_id
    LEFT JOIN rentals r USING (booking_id)
    WHERE b.status = 'confirmed'
       OR (r.rental_id IS NOT NULL AND r.return_at IS NULL)
    ORDER BY
      CASE WHEN lower(b.period)::date = CURRENT_DATE THEN 0 ELSE 1 END,
      lower(b.period) ASC
  `);
  res.json(q.rows);
}));

// GET /api/staff/overdue
app.get('/api/staff/overdue', requireAuth, requireRole('staff', 'admin'), wrap(async (req, res) => {
  const q = await pool.query('SELECT * FROM v_overdue_returns ORDER BY overdue_by DESC');
  res.json(q.rows);
}));

// POST /api/rentals (vehicle handover)
app.post('/api/rentals', requireAuth, requireRole('staff', 'admin'), wrap(async (req, res) => {
  const schema = z.object({
    booking_id: z.coerce.number().int(),
    odometer_out: z.coerce.number().int().nonnegative(),
  });
  const parsed = schema.parse(req.body);

  const q = await withActor(req.user.user_id, c =>
    c.query(
      'INSERT INTO rentals(booking_id, handed_out_by, odometer_out) VALUES($1, $2, $3) RETURNING *',
      [parsed.booking_id, req.user.user_id, parsed.odometer_out]
    )
  );
  res.status(201).json(q.rows[0]);
}));

// PATCH /api/rentals/:id/return (vehicle return & fine reconciliation)
app.patch('/api/rentals/:id/return', requireAuth, requireRole('staff', 'admin'), wrap(async (req, res) => {
  const schema = z.object({
    odometer_in: z.coerce.number().int().nonnegative(),
    damage: z.string().optional(),
    fine: z.coerce.number().nonnegative().optional(),
  });
  const parsed = schema.parse(req.body);

  const q = await withActor(req.user.user_id, async c => {
    const r = await c.query(
      'UPDATE rentals SET return_at = now(), received_by = $1, odometer_in = $2 WHERE rental_id = $3 RETURNING *',
      [req.user.user_id, parsed.odometer_in, req.params.id]
    );
    if (!r.rowCount) {
      const err = new Error('Rental not found');
      err.status = 404;
      throw err;
    }
    const rental = r.rows[0];
    const fineAmount = Number(parsed.fine) || 0;
    const damageDesc = (parsed.damage && parsed.damage.trim()) || (fineAmount > 0 ? 'Vehicle return penalty fee' : null);

    if (damageDesc || fineAmount > 0) {
      // 1. Record damage/penalty incident
      await c.query(
        'INSERT INTO damage_reports(rental_id, description, amount) VALUES($1, $2, $3)',
        [req.params.id, damageDesc || 'Vehicle return incident', fineAmount]
      );

      // 2. Reconcile fine into booking total and payment ledger
      if (fineAmount > 0) {
        await c.query(
          'UPDATE bookings SET total_amount = total_amount + $1 WHERE booking_id = $2',
          [fineAmount, rental.booking_id]
        );
        await c.query(
          'INSERT INTO payments(booking_id, amount, method, status, transaction_ref) VALUES($1, $2, $3, $4, $5)',
          [rental.booking_id, fineAmount, 'cash', 'paid', 'FINE-' + Math.random().toString(36).substring(2, 9).toUpperCase()]
        );
      }
    }
    return r;
  });
  res.json(q.rows[0]);
}));

// ==========================================
// 5. ADMIN MANAGEMENT ROUTES
// ==========================================

// GET /api/admin/users
app.get('/api/admin/users', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const q = await pool.query(`
    SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
           COUNT(DISTINCT b.booking_id) AS total_bookings,
           COALESCE(SUM(dr.amount), 0) AS total_fines
    FROM users u
    LEFT JOIN bookings b ON b.customer_id = u.user_id
    LEFT JOIN rentals r ON r.booking_id = b.booking_id
    LEFT JOIN damage_reports dr ON dr.rental_id = r.rental_id
    GROUP BY u.user_id
    ORDER BY u.user_id
  `);
  res.json(q.rows);
}));

// POST /api/admin/users (create staff / admin user)
app.post('/api/admin/users', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const schema = z.object({
    full_name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().regex(/^[0-9+ -]{10,15}$/, 'Invalid phone number format'),
    password: z.string().min(8),
    role: z.enum(['staff', 'admin', 'customer']).default('staff'),
  });
  const parsed = schema.parse(req.body);

  const hash = await bcrypt.hash(parsed.password, 12);
  const q = await withActor(req.user.user_id, c =>
    c.query(
      'INSERT INTO users(full_name, email, phone, password_hash, role) VALUES($1, $2, $3, $4, $5) RETURNING user_id, full_name, email, phone, role, is_active, created_at',
      [parsed.full_name, parsed.email, parsed.phone, hash, parsed.role]
    )
  );
  res.status(201).json({ user: q.rows[0] });
}));

// PATCH /api/admin/users/:id/status
app.patch('/api/admin/users/:id/status', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const schema = z.object({
    is_active: z.boolean(),
  });
  const { is_active } = schema.parse(req.body);

  const q = await withActor(req.user.user_id, c =>
    c.query(
      'UPDATE users SET is_active = $1 WHERE user_id = $2 RETURNING user_id, full_name, email, role, is_active',
      [is_active, req.params.id]
    )
  );
  if (!q.rowCount) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(q.rows[0]);
}));

// GET /api/admin/vehicles
app.get('/api/admin/vehicles', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const q = await pool.query(`
    SELECT
      v.*,
      c.name AS category,
      c.base_daily_rate,
      b.name AS branch_name,
      b.city
    FROM vehicles v
    JOIN vehicle_categories c USING (category_id)
    JOIN branches b USING (branch_id)
    ORDER BY v.vehicle_id
  `);
  res.json(q.rows);
}));

// GET /api/admin/vehicles/:id
app.get('/api/admin/vehicles/:id', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const q = await pool.query(`
    SELECT
      v.*,
      c.name AS category,
      c.base_daily_rate,
      b.name AS branch_name,
      b.city
    FROM vehicles v
    JOIN vehicle_categories c USING (category_id)
    JOIN branches b USING (branch_id)
    WHERE v.vehicle_id = $1
  `, [req.params.id]);

  if (!q.rowCount) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  res.json(q.rows[0]);
}));

// POST /api/admin/vehicles
app.post('/api/admin/vehicles', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const schema = z.object({
    reg_number: z.string().min(1).max(15),
    category_id: z.coerce.number().int(),
    branch_id: z.coerce.number().int(),
    make: z.string().min(1).max(40),
    model: z.string().min(1).max(40),
    manufacture_year: z.coerce.number().int().min(2000).max(2100),
    fuel: z.enum(['petrol', 'diesel', 'electric', 'hybrid', 'cng']),
    transmission: z.enum(['manual', 'automatic']),
    odometer_km: z.coerce.number().int().nonnegative().default(0),
    image_url: z.string().optional(),
  });
  const parsed = schema.parse(req.body);

  const q = await withActor(req.user.user_id, c =>
    c.query(
      `INSERT INTO vehicles(
        reg_number, category_id, branch_id, make, model, manufacture_year, fuel, transmission, odometer_km, image_url
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        parsed.reg_number,
        parsed.category_id,
        parsed.branch_id,
        parsed.make,
        parsed.model,
        parsed.manufacture_year,
        parsed.fuel,
        parsed.transmission,
        parsed.odometer_km || 0,
        parsed.image_url || null,
      ]
    )
  );
  res.status(201).json(q.rows[0]);
}));

// PATCH /api/admin/vehicles/:id (update vehicle attributes)
app.patch('/api/admin/vehicles/:id', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const schema = z.object({
    reg_number: z.string().min(1).max(15).optional(),
    category_id: z.coerce.number().int().optional(),
    branch_id: z.coerce.number().int().optional(),
    make: z.string().min(1).max(40).optional(),
    model: z.string().min(1).max(40).optional(),
    manufacture_year: z.coerce.number().int().min(2000).max(2100).optional(),
    fuel: z.enum(['petrol', 'diesel', 'electric', 'hybrid', 'cng']).optional(),
    transmission: z.enum(['manual', 'automatic']).optional(),
    odometer_km: z.coerce.number().int().nonnegative().optional(),
    status: z.enum(['available', 'maintenance', 'retired', 'rented']).optional(),
    image_url: z.string().nullable().optional(),
  });
  const parsed = schema.parse(req.body);

  const fields = Object.keys(parsed);
  if (!fields.length) {
    return res.status(400).json({ error: 'No update fields provided' });
  }

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`);
  const values = fields.map(f => parsed[f]);
  values.push(req.params.id);

  const q = await withActor(req.user.user_id, c =>
    c.query(
      `UPDATE vehicles SET ${setClauses.join(', ')} WHERE vehicle_id = $${values.length} RETURNING *`,
      values
    )
  );

  if (!q.rowCount) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  res.json(q.rows[0]);
}));

// PATCH /api/admin/vehicles/:id/status
app.patch('/api/admin/vehicles/:id/status', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const schema = z.object({
    status: z.enum(['available', 'maintenance', 'retired', 'rented']),
  });
  const { status } = schema.parse(req.body);

  const q = await withActor(req.user.user_id, c =>
    c.query('UPDATE vehicles SET status = $1 WHERE vehicle_id = $2 RETURNING *', [status, req.params.id])
  );
  if (!q.rowCount) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  res.json(q.rows[0]);
}));

// GET /api/admin/branches
app.get('/api/admin/branches', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const q = await pool.query('SELECT * FROM branches ORDER BY branch_id');
  res.json(q.rows);
}));

// POST /api/admin/branches
app.post('/api/admin/branches', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(80),
    city: z.string().min(1).max(60),
    address: z.string().min(1),
    phone: z.string().optional(),
  });
  const parsed = schema.parse(req.body);

  const q = await withActor(req.user.user_id, c =>
    c.query(
      'INSERT INTO branches(name, city, address, phone) VALUES($1, $2, $3, $4) RETURNING *',
      [parsed.name, parsed.city, parsed.address, parsed.phone || null]
    )
  );
  res.status(201).json(q.rows[0]);
}));

// GET /api/admin/categories
app.get('/api/admin/categories', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const q = await pool.query('SELECT * FROM vehicle_categories ORDER BY category_id');
  res.json(q.rows);
}));

// POST /api/admin/categories
app.post('/api/admin/categories', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(40),
    base_daily_rate: z.coerce.number().positive(),
    seats: z.coerce.number().int().min(1).max(15),
  });
  const parsed = schema.parse(req.body);

  const q = await withActor(req.user.user_id, c =>
    c.query(
      'INSERT INTO vehicle_categories(name, base_daily_rate, seats) VALUES($1, $2, $3) RETURNING *',
      [parsed.name, parsed.base_daily_rate, parsed.seats]
    )
  );
  res.status(201).json(q.rows[0]);
}));

// GET /api/admin/maintenance/:vehicleId
app.get('/api/admin/maintenance/:vehicleId', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const q = await pool.query(
    'SELECT * FROM maintenance_records WHERE vehicle_id = $1 ORDER BY start_date DESC',
    [req.params.vehicleId]
  );
  res.json(q.rows);
}));

// POST /api/admin/maintenance
app.post('/api/admin/maintenance', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const schema = z.object({
    vehicle_id: z.coerce.number().int(),
    description: z.string().min(1),
    start_date: z.string().min(1),
    end_date: z.string().nullable().optional(),
    cost: z.coerce.number().nonnegative().nullable().optional(),
  });
  const parsed = schema.parse(req.body);

  const q = await withActor(req.user.user_id, c =>
    c.query(
      'INSERT INTO maintenance_records(vehicle_id, description, start_date, end_date, cost) VALUES($1, $2, $3, $4, $5) RETURNING *',
      [parsed.vehicle_id, parsed.description, parsed.start_date, parsed.end_date || null, parsed.cost || null]
    )
  );
  res.status(201).json(q.rows[0]);
}));

// GET /api/admin/stats (live system dashboard metrics)
app.get('/api/admin/stats', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW mv_monthly_revenue');
  } catch (err) {}

  const [bookingStats, revenueStats, activeRentals, fleetStats, recentBookings, latestAudit, fineStats] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS total_bookings,
        COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_bookings,
        COUNT(*) FILTER (WHERE status = 'active') AS active_bookings,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_bookings,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_bookings
      FROM bookings
    `),
    pool.query(`
      SELECT
        COALESCE(SUM(CASE status WHEN 'paid' THEN amount WHEN 'refunded' THEN -amount ELSE 0 END), 0) AS net_revenue,
        COALESCE(SUM(CASE status WHEN 'paid' THEN amount ELSE 0 END), 0) AS gross_paid,
        COALESCE(SUM(CASE status WHEN 'refunded' THEN amount ELSE 0 END), 0) AS total_refunded
      FROM payments
    `),
    pool.query(`
      SELECT COUNT(*) AS active_count
      FROM rentals
      WHERE return_at IS NULL
    `),
    pool.query(`
      SELECT
        COUNT(*) AS total_vehicles,
        COUNT(*) FILTER (WHERE status = 'available') AS available_vehicles,
        COUNT(*) FILTER (WHERE status = 'rented') AS rented_vehicles,
        COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance_vehicles
      FROM vehicles
    `),
    pool.query(`
      SELECT b.booking_id, b.status, b.period, b.total_amount, b.created_at,
             v.reg_number, v.make, v.model,
             u.full_name AS customer_name, u.email AS customer_email,
             COALESCE((
               SELECT SUM(dr.amount)
               FROM rentals r
               JOIN damage_reports dr USING (rental_id)
               WHERE r.booking_id = b.booking_id
             ), 0) AS total_fine,
             (
               SELECT string_agg(dr.description, ', ')
               FROM rentals r
               JOIN damage_reports dr USING (rental_id)
               WHERE r.booking_id = b.booking_id
             ) AS damage_description
      FROM bookings b
      JOIN vehicles v USING (vehicle_id)
      JOIN users u ON u.user_id = b.customer_id
      ORDER BY b.created_at DESC
      LIMIT 8
    `),
    pool.query(`
      SELECT a.audit_id, a.table_name, a.record_id, a.action, a.changed_at,
             u.full_name AS actor_name, u.role AS actor_role
      FROM audit_log a
      LEFT JOIN users u ON u.user_id = a.changed_by
      ORDER BY a.audit_id DESC
      LIMIT 1
    `),
    pool.query(`
      SELECT
        COALESCE(SUM(amount), 0) AS total_fines,
        COUNT(*) FILTER (WHERE amount > 0) AS fine_count
      FROM damage_reports
    `)
  ]);

  res.json({
    system_connected: true,
    db_timestamp: new Date().toISOString(),
    bookings: bookingStats.rows[0],
    revenue: revenueStats.rows[0],
    fines: fineStats.rows[0],
    active_rentals: Number(activeRentals.rows[0]?.active_count || 0),
    fleet: fleetStats.rows[0],
    recent_bookings: recentBookings.rows,
    latest_audit: latestAudit.rows[0] || null,
  });
}));

// GET /api/admin/damage-reports
app.get('/api/admin/damage-reports', requireAuth, requireRole('admin', 'staff'), wrap(async (req, res) => {
  const q = await pool.query(`
    SELECT dr.report_id, dr.rental_id, dr.description, dr.amount, dr.created_at,
           b.booking_id, b.customer_id,
           v.reg_number, v.make, v.model,
           u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
           r.odometer_out, r.odometer_in, r.return_at
    FROM damage_reports dr
    JOIN rentals r USING (rental_id)
    JOIN bookings b USING (booking_id)
    JOIN vehicles v USING (vehicle_id)
    JOIN users u ON u.user_id = b.customer_id
    ORDER BY dr.created_at DESC
  `);
  res.json(q.rows);
}));

// GET /api/admin/reports/never-booked
app.get('/api/admin/reports/never-booked', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const q = await pool.query('SELECT * FROM v_never_booked');
  res.json(q.rows);
}));

// GET /api/admin/reports/:name
app.get('/api/admin/reports/:name', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  if (req.params.name === 'revenue') {
    try {
      await pool.query('REFRESH MATERIALIZED VIEW mv_monthly_revenue');
    } catch (err) {}
  }
  const views = {
    customers: 'v_top_customers',
    categories: 'v_category_revenue',
    vehicles: 'v_vehicle_ranks',
    revenue: 'v_revenue_change',
    overdue: 'v_overdue_returns',
    'never-booked': 'v_never_booked',
  };
  const view = views[req.params.name];
  if (!view) {
    return res.status(404).json({ error: 'Report not found' });
  }
  const q = await pool.query(`SELECT * FROM ${view}`);
  res.json(q.rows);
}));

// GET /api/admin/audit (with actor name & role joined)
app.get('/api/admin/audit', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const q = await pool.query(`
    SELECT
      a.audit_id,
      a.table_name,
      a.record_id,
      a.action,
      a.old_data,
      a.new_data,
      a.changed_by,
      a.changed_at,
      u.full_name AS actor_name,
      u.email AS actor_email,
      u.role AS actor_role
    FROM audit_log a
    LEFT JOIN users u ON u.user_id = a.changed_by
    ORDER BY a.audit_id DESC
    LIMIT 500
  `);
  res.json(q.rows);
}));

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

// Serve static frontend build
app.use(express.static(clientDist));

// SPA fallback for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
