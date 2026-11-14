\set ON_ERROR_STOP on
-- ============================================================
-- GoDrive rental_db test suite
-- All tests run inside transactions that ROLLBACK so seed data
-- is never modified. ON_ERROR_STOP ensures the first failure
-- aborts the script.
-- ============================================================

-- ============================================================
-- BLOCK 1: Schema constraint tests
-- ============================================================
BEGIN;
DO $$ DECLARE v BIGINT; b BIGINT; rejected BOOLEAN:=false; BEGIN
 SELECT vehicle_id INTO v FROM vehicles WHERE reg_number='CH01AB1001';

 -- 1. CHECK: negative category price
 BEGIN INSERT INTO vehicle_categories(name,base_daily_rate,seats) VALUES('Bad category',-1,4); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: category price CHECK should reject -1'; END IF;

 -- 2. UNIQUE: duplicate branch name
 rejected:=false;
 BEGIN INSERT INTO branches(name,city,address) VALUES('Chandigarh Central','X','X'); EXCEPTION WHEN unique_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: branch name UNIQUE should reject duplicate'; END IF;

 -- 3. FK: vehicle with non-existent category
 rejected:=false;
 BEGIN INSERT INTO vehicles(reg_number,category_id,branch_id,make,model,manufacture_year,fuel,transmission) VALUES('BAD-FK',99999,1,'A','B',2020,'petrol','manual'); EXCEPTION WHEN foreign_key_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: FK should reject invalid category_id'; END IF;

 -- 4. CHECK: vehicle odometer negative
 rejected:=false;
 BEGIN INSERT INTO vehicles(reg_number,category_id,branch_id,make,model,manufacture_year,fuel,transmission,odometer_km) VALUES('BAD-CHECK',1,1,'A','B',2020,'petrol','manual',-1); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: odometer CHECK should reject -1'; END IF;

 -- 5. EXCLUSION: overlapping booking for same vehicle
 rejected:=false;
 BEGIN
   INSERT INTO bookings(customer_id,vehicle_id,pickup_branch_id,drop_branch_id,period,daily_rate_snapshot,total_amount,status)
   SELECT user_id,v,1,1,tstzrange(now()+interval '14 days',now()+interval '15 days','[)'),100,100,'confirmed'
   FROM users WHERE email='customer1@example.com';
 EXCEPTION WHEN exclusion_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: exclusion constraint should block overlapping booking'; END IF;

 -- 6. Rental trigger: pickup → booking=active, vehicle=rented
 SELECT booking_id INTO b FROM bookings WHERE vehicle_id=v AND status='confirmed';
 IF b IS NULL THEN RAISE EXCEPTION 'seed booking missing for CH01AB1001'; END IF;
 INSERT INTO rentals(booking_id,handed_out_by,odometer_out) SELECT b,user_id,12000 FROM users WHERE role='staff' LIMIT 1;
 IF (SELECT status FROM bookings WHERE booking_id=b)<>'active' THEN RAISE EXCEPTION 'TEST FAILED: rental pickup should set booking=active'; END IF;
 IF (SELECT status FROM vehicles WHERE vehicle_id=v)<>'rented' THEN RAISE EXCEPTION 'TEST FAILED: rental pickup should set vehicle=rented'; END IF;

 -- 7. Rental trigger: return → booking=completed, odometer synced
 UPDATE rentals SET return_at=now()+interval '1 hour',odometer_in=12100,received_by=(SELECT user_id FROM users WHERE role='staff' ORDER BY user_id DESC LIMIT 1) WHERE booking_id=b;
 IF (SELECT status FROM bookings WHERE booking_id=b)<>'completed' THEN RAISE EXCEPTION 'TEST FAILED: rental return should set booking=completed'; END IF;
 IF (SELECT odometer_km FROM vehicles WHERE vehicle_id=v)<>12100 THEN RAISE EXCEPTION 'TEST FAILED: rental return should sync odometer'; END IF;

 -- 8. audit_log: audit row exists for booking
 IF NOT EXISTS(SELECT 1 FROM audit_log WHERE table_name='bookings' AND record_id=b) THEN RAISE EXCEPTION 'TEST FAILED: audit_log should have a row for the booking'; END IF;

 -- 9. TEST: users email UNIQUE violation (admin@example.com already exists)
 rejected:=false;
 BEGIN INSERT INTO users(full_name,email,phone,password_hash,role) VALUES('Dup Admin','admin@example.com','9900000001',crypt('x',gen_salt('bf',10)),'admin'); EXCEPTION WHEN unique_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: users email UNIQUE should reject duplicate'; END IF;

 -- 10. TEST: users phone too short CHECK (phone='123')
 rejected:=false;
 BEGIN INSERT INTO users(full_name,email,phone,password_hash,role) VALUES('Bad Phone','badphone@example.com','123',crypt('x',gen_salt('bf',10)),'customer'); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: users phone CHECK should reject too-short phone'; END IF;

 -- 11. TEST: customer_profiles licence_no UNIQUE violation
 rejected:=false;
 BEGIN
   -- Insert a new user, then try duplicate licence
   INSERT INTO users(full_name,email,phone,password_hash,role) VALUES('Lic Test','lictest@example.com','9900000002',crypt('x',gen_salt('bf',10)),'customer');
   INSERT INTO customer_profiles(user_id,licence_no,licence_expiry,date_of_birth)
     SELECT user_id,(SELECT licence_no FROM customer_profiles LIMIT 1),'2030-01-01','1995-01-01'
     FROM users WHERE email='lictest@example.com';
 EXCEPTION WHEN unique_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: licence_no UNIQUE should reject duplicate'; END IF;

 -- 12. TEST: vehicle_categories seats=0 rejected
 rejected:=false;
 BEGIN INSERT INTO vehicle_categories(name,base_daily_rate,seats) VALUES('ZeroSeats',1000,0); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: seats CHECK should reject 0'; END IF;

 -- 13. TEST: vehicle_categories seats=16 rejected
 rejected:=false;
 BEGIN INSERT INTO vehicle_categories(name,base_daily_rate,seats) VALUES('TooManySeats',1000,16); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: seats CHECK should reject 16'; END IF;

 -- 14. TEST: maintenance_records end_date < start_date rejected
 rejected:=false;
 BEGIN INSERT INTO maintenance_records(vehicle_id,description,start_date,end_date) VALUES(v,'Test maint','2024-06-10','2024-06-05'); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: maintenance end_date < start_date CHECK should reject'; END IF;

 -- 15. TEST: bookings period with lower_inf rejected (unbounded lower)
 -- The CHECK guard: NOT lower_inf(period) AND NOT upper_inf(period) AND lower(period)<upper(period)
 -- Empty tstzrange has NULL bounds so check doesn't fire; unbounded does.
 -- Also test via create_booking that p_end<=p_start raises an exception.
 rejected:=false;
 BEGIN
   -- unbounded lower → lower_inf = true → check fails
   INSERT INTO bookings(customer_id,vehicle_id,pickup_branch_id,drop_branch_id,period,daily_rate_snapshot,total_amount,status)
   SELECT user_id,v,1,1,tstzrange(NULL,now()+interval '100 days','(]'),100,100,'confirmed'
   FROM users WHERE email='customer1@example.com';
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: bookings lower_inf period CHECK should reject'; END IF;
 -- Additionally verify create_booking rejects p_end <= p_start (function-level guard)
 rejected:=false;
 BEGIN
   PERFORM create_booking((SELECT user_id FROM users WHERE email='customer1@example.com'),v,now()+interval '5 days',now()+interval '5 days',1,1,'upi','{}');
 EXCEPTION WHEN OTHERS THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: create_booking should reject p_end=p_start'; END IF;

 -- 16. TEST: bookings total_amount negative rejected
 rejected:=false;
 BEGIN
   INSERT INTO bookings(customer_id,vehicle_id,pickup_branch_id,drop_branch_id,period,daily_rate_snapshot,total_amount,status)
   SELECT user_id,v,1,1,tstzrange(now()+interval '100 days',now()+interval '101 days','[)'),100,-1,'confirmed'
   FROM users WHERE email='customer1@example.com';
 EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: bookings total_amount negative CHECK should reject'; END IF;

 -- 17. TEST: payments amount=0 rejected
 rejected:=false;
 BEGIN INSERT INTO payments(booking_id,amount,method,status) VALUES(b,0,'card','paid'); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: payments amount=0 CHECK should reject'; END IF;

 -- 18. TEST: rentals odometer_in < odometer_out rejected
 -- Need a booking + rental for a fresh vehicle; use a seeded confirmed booking
 DECLARE fresh_b BIGINT; fresh_v BIGINT;
 BEGIN
   SELECT bk.booking_id, bk.vehicle_id INTO fresh_b, fresh_v
   FROM bookings bk JOIN vehicles vv USING(vehicle_id)
   WHERE bk.status='confirmed' AND vv.status='available' LIMIT 1;
   IF fresh_b IS NOT NULL THEN
     INSERT INTO rentals(booking_id,handed_out_by,odometer_out)
       SELECT fresh_b,user_id,50000 FROM users WHERE role='staff' LIMIT 1;
     rejected:=false;
     BEGIN
       UPDATE rentals SET return_at=now()+interval '1 hour',odometer_in=1,received_by=(SELECT user_id FROM users WHERE role='staff' LIMIT 1) WHERE booking_id=fresh_b;
     EXCEPTION WHEN check_violation THEN rejected:=true; END;
     IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: rentals odometer_in < odometer_out CHECK should reject'; END IF;
   END IF;
 END;

 -- 19. TEST: reviews rating=0 rejected
 rejected:=false;
 BEGIN INSERT INTO reviews(booking_id,rating) VALUES(b,0); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: reviews rating=0 CHECK should reject'; END IF;

 -- 20. TEST: reviews rating=6 rejected
 rejected:=false;
 BEGIN INSERT INTO reviews(booking_id,rating) VALUES(b,6); EXCEPTION WHEN check_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: reviews rating=6 CHECK should reject'; END IF;

 -- 21. TEST: reviews UNIQUE per booking (second review on same booking rejected)
 rejected:=false;
 BEGIN
   INSERT INTO reviews(booking_id,rating,comment) VALUES(b,5,'Great!');
   INSERT INTO reviews(booking_id,rating,comment) VALUES(b,4,'Also great!');
 EXCEPTION WHEN unique_violation THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'TEST FAILED: reviews UNIQUE booking_id should reject second review'; END IF;

END $$;
ROLLBACK;

-- ============================================================
-- BLOCK 2: Function path tests — create_booking + cancel full refund
-- ============================================================
BEGIN;
DO $$ DECLARE cust BIGINT; veh BIGINT; br INT; booking BIGINT; refund NUMERIC; BEGIN
 SELECT user_id INTO cust FROM users WHERE email='customer3@example.com';
 SELECT vehicle_id,branch_id INTO veh,br FROM vehicles WHERE reg_number='RJ14EF3001';
 booking:=create_booking(cust,veh,now()+interval '40 days',now()+interval '42 days',br,br,'upi','{}');
 IF (SELECT status FROM bookings WHERE booking_id=booking)<>'confirmed' THEN RAISE EXCEPTION 'TEST FAILED: create_booking should set status=confirmed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payments WHERE booking_id=booking AND status='paid') THEN RAISE EXCEPTION 'TEST FAILED: create_booking should insert paid payment'; END IF;
 refund:=cancel_booking(booking,cust);
 IF refund<>(SELECT total_amount FROM bookings WHERE booking_id=booking) THEN RAISE EXCEPTION 'TEST FAILED: cancel > 24h before start should give full refund'; END IF;
END $$;
ROLLBACK;

-- ============================================================
-- BLOCK 3: cancel_booking partial refund (booking 2h from now)
-- ============================================================
BEGIN;
DO $$ DECLARE cust BIGINT; veh BIGINT; br INT; booking BIGINT; refund NUMERIC; total NUMERIC; expected NUMERIC; BEGIN
 SELECT user_id INTO cust FROM users WHERE email='customer4@example.com';
 -- Use a vehicle not currently booked. Pick any available vehicle in Chandigarh.
 SELECT v.vehicle_id,v.branch_id INTO veh,br FROM vehicles v
   WHERE v.status='available'
     AND NOT EXISTS (
       SELECT 1 FROM bookings bk
       WHERE bk.vehicle_id=v.vehicle_id
         AND bk.status IN ('pending','confirmed','active')
         AND bk.period && tstzrange(now()+interval '2 hours',now()+interval '4 hours','[)')
     )
   LIMIT 1;
 IF veh IS NULL THEN RAISE EXCEPTION 'No available vehicle found for partial refund test'; END IF;
 -- Book 2 hours from now (within 24h → partial refund)
 booking:=create_booking(cust,veh,now()+interval '2 hours',now()+interval '4 hours',br,br,'card','{}');
 SELECT total_amount INTO total FROM bookings WHERE booking_id=booking;
 expected:=ROUND(total*0.5,2);
 refund:=cancel_booking(booking,cust);
 IF refund<>expected THEN RAISE EXCEPTION 'TEST FAILED: cancel within 24h should give 50%% refund (expected %, got %)',expected,refund; END IF;
END $$;
ROLLBACK;

-- ============================================================
-- BLOCK 4: rental_app role cannot UPDATE audit_log
-- Run as a psql meta-command block that temporarily switches role.
-- Expected: permission denied → psql error captured, script continues.
-- ============================================================
-- We test this by setting the role in a transaction and expecting
-- an insufficient_privilege exception from the UPDATE.
BEGIN;
SET LOCAL ROLE rental_app;
-- This UPDATE should raise insufficient_privilege; caught by ON_ERROR_STOP=0 for this block.
-- To keep ON_ERROR_STOP=1 intact we wrap it in a savepoint.
SAVEPOINT audit_perm_test;
DO $$
BEGIN
  -- rental_app should NOT have UPDATE on audit_log
  BEGIN
    UPDATE audit_log SET action=action WHERE false;
    -- If no error: test fails
    RAISE EXCEPTION 'TEST FAILED: rental_app should not have UPDATE on audit_log';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Pass: correctly denied
    NULL;
  END;
END $$;
ROLLBACK TO SAVEPOINT audit_perm_test;
ROLLBACK;
