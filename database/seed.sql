
-- Synthetic demonstration vehicles

INSERT INTO vehicles
    (vehicle_code, brand, model, category, daily_rate,
     seats, engine_cc, description)
VALUES
    ('DEMO-CAR-001', 'Maruti Suzuki', 'Swift',
     'Car', 1500.00, 5, NULL,
     'Compact car for city travel'),

    ('DEMO-CAR-002', 'Hyundai', 'i20',
     'Car', 1800.00, 5, NULL,
     'Comfortable hatchback'),

    ('DEMO-SUV-001', 'Hyundai', 'Creta',
     'SUV', 3000.00, 5, NULL,
     'SUV suitable for family trips'),

    ('DEMO-SUV-002', 'Mahindra', 'Scorpio',
     'SUV', 3500.00, 7, NULL,
     'Spacious SUV for longer journeys'),

    ('DEMO-BIKE-001', 'Honda', 'Activa',
     'Bike', 500.00, 2, 110,
     'Scooter for local travel'),

    ('DEMO-BIKE-002', 'Royal Enfield', 'Classic 350',
     'Bike', 900.00, 2, 350,
     'Motorcycle for leisure rides'),

    ('DEMO-CAR-003', 'Tata', 'Nexon',
     'SUV', 2500.00, 5, NULL,
     'Compact SUV for daily and family travel'),

    ('DEMO-VAN-001', 'Force Motors', 'Traveller',
     'Van', 4500.00, 12, NULL,
     'Van for group travel')

ON CONFLICT (vehicle_code) DO NOTHING;
