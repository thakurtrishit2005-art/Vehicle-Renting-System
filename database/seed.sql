
-- Vehicle Rental System: demonstration vehicle inventory
-- Prices are illustrative demo rates in INR per day.

INSERT INTO vehicles
    (vehicle_code, brand, model, category, daily_rate,
     seats, engine_cc, description)
VALUES
    (
        'DEMO-CAR-001',
        'Fiat',
        '500',
        'Car',
        4000.00,
        4,
        479,
        'Compact city car with distinctive European styling'
    ),
    (
        'DEMO-CAR-002',
        'Chevrolet',
        'Camaro',
        'Car',
        15000.00,
        4,
        7011,
        'High-performance American sports coupe'
    ),
    (
        'DEMO-SUV-001',
        'Honda',
        'CR-V',
        'SUV',
        5000.00,
        5,
        2354,
        'Comfortable SUV suited to family travel'
    ),
    (
        'DEMO-SUV-002',
        'Ford',
        'Expedition',
        'SUV',
        12000.00,
        8,
        3497,
        'Full-size SUV with spacious passenger seating'
    ),
    (
        'DEMO-BIKE-001',
        'Harley-Davidson',
        'Street Bob',
        'Bike',
        5000.00,
        2,
        1923,
        'Cruiser motorcycle with classic bobber styling'
    ),
    (
        'DEMO-BIKE-002',
        'Harley-Davidson',
        'LiveWire',
        'Bike',
        7000.00,
        2,
        NULL,
        'Premium electric performance motorcycle'
    ),
    (
        'DEMO-CAR-003',
        'Lamborghini',
        'Huracan',
        'Car',
        150000.00,
        2,
        5204,
        'High-performance Italian supercar'
    ),
    (
        'DEMO-VAN-001',
        'Mahindra',
        'Furio 11',
        NULL,
        9000.00,
        3,
        3500,
        'Commercial truck for goods transportation'
    )
ON CONFLICT (vehicle_code) DO NOTHING;
