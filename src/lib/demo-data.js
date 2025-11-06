export const demoInventory = [
  {
    id: 1,
    vehicle: {
      model_year: 2025,
      chassis_model: 'Chassis Cab F-350 XL',
      chassis_class: 'Class 3',
      drivetrain: '2WD',
      engine: '6.2L V8',
    },
    body: null,
    location: 'New York, NY',
    total_price: 58990,
    lead_time_days: 14,
    featured: true,
  },
  {
    id: 2,
    vehicle: {
      model_year: 2025,
      chassis_model: 'Chassis Cab F-450 XL',
      chassis_class: 'Class 4',
      drivetrain: '4WD',
      engine: '6.7L Power Stroke Diesel',
    },
    body: { body_type: 'Dump Body', vocation: 'Construction', manufacturer: 'Rugby Manufacturing' },
    location: 'Chicago, IL',
    total_price: 83950,
    lead_time_days: 28,
  },
]

export const demoBodies = [
  {
    id: 101,
    manufacturer: 'Knapheide',
    body_name: 'Service Body KSS',
    body_type: 'Service Body',
    vocation: 'Trades',
    material: 'Steel',
    availability_status: 'In Stock',
    lead_time_days: 10,
    base_price: 12990,
  },
  {
    id: 102,
    manufacturer: 'Rugby Manufacturing',
    body_name: 'Rugby SR-4016',
    body_type: 'Dump Body',
    vocation: 'Construction',
    material: 'Steel',
    availability_status: 'Built to Order',
    lead_time_days: 35,
    base_price: 16990,
  },
]


