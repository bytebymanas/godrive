\set ON_ERROR_STOP on
-- ============================================================
-- USERS: 1 admin + 3 staff + 20 customers
-- ============================================================
INSERT INTO users(full_name,email,phone,password_hash,role) VALUES
('Manas Chhabra','admin@example.com','9876543210',crypt('Password@123',gen_salt('bf',10)),'admin'),
('Staff One','staff1@example.com','9876543211',crypt('Password@123',gen_salt('bf',10)),'staff'),
('Staff Two','staff2@example.com','9876543212',crypt('Password@123',gen_salt('bf',10)),'staff'),
('Staff Three','staff3@example.com','9876543213',crypt('Password@123',gen_salt('bf',10)),'staff'),
-- customers 1-20
('Aarav Sharma','customer1@example.com','9876543221',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Diya Singh','customer2@example.com','9876543222',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Kabir Verma','customer3@example.com','9876543223',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Ananya Gupta','customer4@example.com','9876543224',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Rohan Mehta','customer5@example.com','9876543225',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Priya Joshi','customer6@example.com','9876543226',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Arjun Nair','customer7@example.com','9876543227',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Ishaan Reddy','customer8@example.com','9876543228',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Meera Pillai','customer9@example.com','9876543229',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Vivaan Kapoor','customer10@example.com','9876543230',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Saanvi Bhat','customer11@example.com','9876543231',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Reyansh Pandey','customer12@example.com','9876543232',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Aditya Iyer','customer13@example.com','9876543233',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Kavya Rao','customer14@example.com','9876543234',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Tanvi Desai','customer15@example.com','9876543235',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Harsh Malhotra','customer16@example.com','9876543236',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Nisha Agarwal','customer17@example.com','9876543237',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Rishi Chaudhary','customer18@example.com','9876543238',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Pooja Saxena','customer19@example.com','9876543239',crypt('Password@123',gen_salt('bf',10)),'customer'),
('Nikhil Kulkarni','customer20@example.com','9876543240',crypt('Password@123',gen_salt('bf',10)),'customer');

-- Customer profiles (20 customers, licence expires 2030)
INSERT INTO customer_profiles(user_id,licence_no,licence_expiry,date_of_birth)
SELECT user_id,
       'DL-'||to_char(now(),'YYYY')||'-'||LPAD(user_id::TEXT,4,'0'),
       '2030-12-31',
       ('1990-01-01'::DATE + (user_id * 17 || ' days')::INTERVAL)::DATE
FROM users WHERE role='customer';

-- ============================================================
-- BRANCHES
-- ============================================================
INSERT INTO branches(name,city,address,phone) VALUES
('Chandigarh Central','Chandigarh','Sector 17, Chandigarh','01720000000'),
('Delhi South','Delhi','Saket, New Delhi','01120000000'),
('Jaipur Central','Jaipur','MI Road, Jaipur','01410000000');

-- ============================================================
-- VEHICLE CATEGORIES
-- ============================================================
INSERT INTO vehicle_categories(name,base_daily_rate,seats) VALUES
('Hatchback',1800,5),
('SUV',3500,7),
('Bike',900,2),
('Van',4200,9),
('Sedan',2600,5);

-- ============================================================
-- EXTRAS
-- ============================================================
INSERT INTO extras(name,price_per_day) VALUES
('Child seat',150),
('GPS',100),
('Additional driver',300),
('Roof carrier',200);

-- ============================================================
-- VEHICLES: 30 across 3 branches and 5 categories
-- Real Indian registration format: XX99 XX 9999
-- ============================================================
INSERT INTO vehicles(reg_number,category_id,branch_id,make,model,manufacture_year,fuel,transmission,odometer_km,image_url) VALUES
-- Chandigarh (branch 1) - 10 vehicles
('CH01AB1001',1,1,'Maruti','Swift',2023,'petrol','manual',12000,'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2'),
('CH01AB1002',2,1,'Hyundai','Creta',2024,'diesel','automatic',8000,'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b'),
('CH01AB1003',5,1,'Honda','City',2022,'petrol','automatic',15000,NULL),
('CH01AB1004',3,1,'Royal Enfield','Classic 350',2023,'petrol','manual',5000,NULL),
('CH01AB1005',4,1,'Force','Traveller',2022,'diesel','manual',28000,NULL),
('CH01AB1006',1,1,'Maruti','Baleno',2024,'petrol','automatic',9000,NULL),
('CH01AB1007',2,1,'Tata','Nexon',2023,'electric','automatic',6000,NULL),
('CH01AB1008',5,1,'Toyota','Innova Crysta',2021,'diesel','manual',45000,NULL),
('CH01AB1009',3,1,'Bajaj','Pulsar NS200',2022,'petrol','manual',8500,NULL),
('CH01AB1010',1,1,'Tata','Altroz',2023,'petrol','manual',11000,NULL),
-- Delhi (branch 2) - 10 vehicles
('DL01CD2001',5,2,'Honda','City',2022,'petrol','automatic',21000,NULL),
('DL01CD2002',3,2,'Royal Enfield','Classic 350',2023,'petrol','manual',5000,NULL),
('DL01CD2003',1,2,'Maruti','Swift Dzire',2024,'petrol','manual',3000,NULL),
('DL01CD2004',2,2,'Hyundai','Tucson',2023,'diesel','automatic',12000,NULL),
('DL01CD2005',4,2,'Mahindra','Bolero',2022,'diesel','manual',35000,NULL),
('DL01CD2006',5,2,'Skoda','Slavia',2023,'petrol','automatic',8000,NULL),
('DL01CD2007',2,2,'Tata','Harrier',2024,'diesel','automatic',5000,NULL),
('DL01CD2008',1,2,'Renault','Kwid',2022,'petrol','manual',19000,NULL),
('DL01CD2009',3,2,'Hero','Splendor Plus',2023,'petrol','manual',7000,NULL),
('DL01CD2010',4,2,'Tempo','Traveller 17',2021,'diesel','manual',62000,NULL),
-- Jaipur (branch 3) - 10 vehicles
('RJ14EF3001',4,3,'Force','Traveller',2022,'diesel','manual',33000,NULL),
('RJ14EF3002',2,3,'Mahindra','Scorpio N',2023,'diesel','manual',9000,NULL),
('RJ14EF3003',1,3,'Maruti','Wagon R',2023,'cng','manual',16000,NULL),
('RJ14EF3004',5,3,'Toyota','Glanza',2024,'petrol','automatic',4000,NULL),
('RJ14EF3005',3,3,'Royal Enfield','Bullet 350',2022,'petrol','manual',11000,NULL),
('RJ14EF3006',2,3,'Kia','Seltos',2023,'petrol','automatic',7000,NULL),
('RJ14EF3007',1,3,'Maruti','Celerio',2022,'cng','automatic',21000,NULL),
('RJ14EF3008',4,3,'Maruti','Eeco',2023,'cng','manual',18000,NULL),
('RJ14EF3009',5,3,'Volkswagen','Virtus',2023,'petrol','automatic',6000,NULL),
('RJ14EF3010',3,3,'TVS','Apache RTR 160',2024,'petrol','manual',3500,NULL);

-- ============================================================
-- BOOKINGS: ~50 via create_booking(), spread over next 90 days
-- ============================================================
-- Branch 1 (Chandigarh) bookings
SELECT create_booking((SELECT user_id FROM users WHERE email='customer1@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1001'),now()+interval '14 days',now()+interval '16 days',1,1,'upi',ARRAY[1]);
SELECT create_booking((SELECT user_id FROM users WHERE email='customer2@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2001'),now()+interval '20 days',now()+interval '23 days',2,2,'card','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer3@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1002'),now()+interval '5 days',now()+interval '7 days',1,1,'netbanking','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer4@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1003'),now()+interval '10 days',now()+interval '12 days',1,1,'upi',ARRAY[2]);
SELECT create_booking((SELECT user_id FROM users WHERE email='customer5@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1004'),now()+interval '3 days',now()+interval '4 days',1,1,'cash','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer6@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1005'),now()+interval '7 days',now()+interval '10 days',1,1,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer7@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1006'),now()+interval '25 days',now()+interval '27 days',1,1,'card',ARRAY[1,2]);
SELECT create_booking((SELECT user_id FROM users WHERE email='customer8@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1007'),now()+interval '30 days',now()+interval '33 days',1,1,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer9@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1008'),now()+interval '45 days',now()+interval '48 days',1,1,'netbanking','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer10@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1009'),now()+interval '50 days',now()+interval '51 days',1,1,'cash','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer11@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1010'),now()+interval '60 days',now()+interval '62 days',1,1,'upi','{}');
-- Branch 2 (Delhi) bookings
SELECT create_booking((SELECT user_id FROM users WHERE email='customer12@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2002'),now()+interval '4 days',now()+interval '5 days',2,2,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer13@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2003'),now()+interval '8 days',now()+interval '11 days',2,2,'card',ARRAY[3]);
SELECT create_booking((SELECT user_id FROM users WHERE email='customer14@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2004'),now()+interval '15 days',now()+interval '18 days',2,2,'netbanking','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer15@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2005'),now()+interval '22 days',now()+interval '25 days',2,2,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer16@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2006'),now()+interval '35 days',now()+interval '37 days',2,2,'card',ARRAY[2]);
SELECT create_booking((SELECT user_id FROM users WHERE email='customer17@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2007'),now()+interval '40 days',now()+interval '43 days',2,2,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer18@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2008'),now()+interval '55 days',now()+interval '57 days',2,2,'netbanking','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer19@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2009'),now()+interval '65 days',now()+interval '66 days',2,2,'cash','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer20@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2010'),now()+interval '70 days',now()+interval '73 days',2,2,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer1@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2004'),now()+interval '80 days',now()+interval '82 days',2,2,'card','{}');
-- Branch 3 (Jaipur) bookings
SELECT create_booking((SELECT user_id FROM users WHERE email='customer2@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3001'),now()+interval '6 days',now()+interval '9 days',3,3,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer3@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3002'),now()+interval '12 days',now()+interval '15 days',3,3,'card',ARRAY[4]);
SELECT create_booking((SELECT user_id FROM users WHERE email='customer4@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3003'),now()+interval '17 days',now()+interval '19 days',3,3,'netbanking','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer5@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3004'),now()+interval '24 days',now()+interval '26 days',3,3,'upi',ARRAY[2]);
SELECT create_booking((SELECT user_id FROM users WHERE email='customer6@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3005'),now()+interval '28 days',now()+interval '29 days',3,3,'cash','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer7@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3006'),now()+interval '32 days',now()+interval '35 days',3,3,'card','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer8@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3007'),now()+interval '38 days',now()+interval '40 days',3,3,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer9@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3008'),now()+interval '42 days',now()+interval '44 days',3,3,'netbanking','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer10@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3009'),now()+interval '52 days',now()+interval '54 days',3,3,'card',ARRAY[1,3]);
SELECT create_booking((SELECT user_id FROM users WHERE email='customer11@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3010'),now()+interval '58 days',now()+interval '59 days',3,3,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer12@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3002'),now()+interval '68 days',now()+interval '71 days',3,3,'card','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer13@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3004'),now()+interval '75 days',now()+interval '78 days',3,3,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer14@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3006'),now()+interval '82 days',now()+interval '85 days',3,3,'netbanking','{}');
-- Cross-branch drop bookings
SELECT create_booking((SELECT user_id FROM users WHERE email='customer15@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1001'),now()+interval '90 days',now()+interval '92 days',1,2,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer16@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2001'),now()+interval '85 days',now()+interval '88 days',2,3,'card','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer17@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3001'),now()+interval '76 days',now()+interval '79 days',3,1,'netbanking','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer18@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1002'),now()+interval '62 days',now()+interval '65 days',1,3,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer19@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2007'),now()+interval '48 days',now()+interval '51 days',2,1,'card','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer20@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3003'),now()+interval '31 days',now()+interval '34 days',3,2,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer1@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2003'),now()+interval '1 day',now()+interval '3 days',2,1,'cash','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer2@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1006'),now()+interval '36 days',now()+interval '39 days',1,2,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer3@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3009'),now()+interval '19 days',now()+interval '21 days',3,2,'card','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer4@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2006'),now()+interval '44 days',now()+interval '47 days',2,3,'netbanking','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer5@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1008'),now()+interval '56 days',now()+interval '59 days',1,3,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer6@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='RJ14EF3007'),now()+interval '72 days',now()+interval '74 days',3,1,'card','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer7@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='DL01CD2005'),now()+interval '88 days',now()+interval '90 days',2,3,'upi','{}');
SELECT create_booking((SELECT user_id FROM users WHERE email='customer8@example.com'),(SELECT vehicle_id FROM vehicles WHERE reg_number='CH01AB1010'),now()+interval '15 days',now()+interval '17 days',1,2,'card','{}');
