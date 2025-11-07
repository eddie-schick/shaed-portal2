// Client-only demo data layer for Order Management
// Uses localStorage for persistence and JSON seeds for initial data.
import seedOrders from '@/data/orders.json'

// Generate plausible corporate fleet buyer names
export function generateFleetBuyerName(index = 0) {
  const companies = [
    'Acme Logistics',
    'Northstar Utilities',
    'Pioneer Construction',
    'Summit Energy',
    'Atlas Freight Co',
    'Riverside Municipal Services',
    'Global Services Group',
    'Vertex Communications',
    'Crescent Building Corp',
    'Evergreen Landscaping',
    'Redwood Telecom',
    'BlueSky Maintenance',
    'Titan Industrial',
    'Frontier Field Services',
    'Liberty Waste Management',
    'Keystone Infrastructure',
    'Sequoia Electric',
    'Harbor City Transit',
    'Cobalt Mining & Materials',
    'Prairie Agricultural Supply',
  ]
  const suffixes = ['LLC', 'Inc', 'Corp', 'Ltd', 'PLC']
  const base = companies[index % companies.length]
  const suffix = suffixes[index % suffixes.length]
  return `${base} ${suffix}`
}

const LS_ORDERS = 'orders'
const LS_EVENTS = 'orderEvents'
const LS_NOTES = 'orderNotes'
const LS_STOCK_SEQ = 'stockSequence'
const LS_VIN_SEQ = 'vinSequence'
const LS_SEED_VERSION = 'ordersSeedVersion'
const CURRENT_SEED_VERSION = '2025-09-25-161' // Updated: strict enforcement of Stock=Dealer, SOLD=Fleet with buyer names

// Helper to get current user (for createdBy/updatedBy)
function getCurrentUser() {
  // In a real app, this would come from auth context
  // For demo, use a random user from a pool
  const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
  const stored = localStorage.getItem('currentUser')
  if (stored) return stored
  const user = users[Math.floor(Math.random() * users.length)]
  localStorage.setItem('currentUser', user)
  return user
}

const ORDER_FLOW = [
  'CONFIG_RECEIVED',
  'OEM_ALLOCATED',
  'OEM_PRODUCTION',
  'OEM_IN_TRANSIT',
  'AT_UPFITTER',
  'UPFIT_IN_PROGRESS',
  'READY_FOR_DELIVERY',
  'DELIVERED',
]

const STATUS_LABEL = {
  CONFIG_RECEIVED: 'Order Received',
  OEM_ALLOCATED: 'OEM Allocated',
  OEM_PRODUCTION: 'OEM Production',
  OEM_IN_TRANSIT: 'OEM In Transit',
  AT_UPFITTER: 'At Upfitter',
  UPFIT_IN_PROGRESS: 'Upfit In Progress',
  READY_FOR_DELIVERY: 'Ready For Delivery',
  DELIVERED: 'Delivered',
  CANCELED: 'Canceled',
}
export function getStatusLabel(code) { return STATUS_LABEL[code] || code }

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) } catch { return fallback }
}
function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// Sequence helpers
function nextCounter(key, start = 100) {
  const current = Number(readLocal(key, start)) || start
  const next = current + 1
  writeLocal(key, next)
  return current
}

// Ensure ETAs are sequential: OEM (chassis) ≤ Upfitter ≤ Final Delivery
const DAY_MS = 86400000
function ensureSequentialEtas({ oemEta, upfitterEta, deliveryEta }, gaps = { oemToUpfit: 10, upfitToDelivery: 15 }) {
  const toDate = (v) => (v ? new Date(v) : null)
  let dOem = toDate(oemEta)
  let dUpfit = toDate(upfitterEta)
  let dDelivery = toDate(deliveryEta)
  const g1 = Number(gaps.oemToUpfit || 10) * DAY_MS
  const g2 = Number(gaps.upfitToDelivery || 15) * DAY_MS

  // Prefer anchoring on delivery if present, then upfit, then oem
  if (dDelivery) {
    if (!dUpfit) dUpfit = new Date(dDelivery.getTime() - g2)
    if (dUpfit.getTime() > dDelivery.getTime()) dUpfit = new Date(dDelivery.getTime() - g2)
    if (!dOem) dOem = new Date(dUpfit.getTime() - g1)
    if (dOem.getTime() > dUpfit.getTime()) dOem = new Date(dUpfit.getTime() - g1)
  } else if (dUpfit) {
    if (!dOem) dOem = new Date(dUpfit.getTime() - g1)
    if (!dDelivery) dDelivery = new Date(dUpfit.getTime() + g2)
    if (dOem.getTime() > dUpfit.getTime()) dOem = new Date(dUpfit.getTime() - g1)
  } else if (dOem) {
    dUpfit = new Date(dOem.getTime() + g1)
    dDelivery = new Date(dUpfit.getTime() + g2)
  }

  return {
    oemEta: dOem ? dOem.toISOString() : null,
    upfitterEta: dUpfit ? dUpfit.toISOString() : null,
    deliveryEta: dDelivery ? dDelivery.toISOString() : null,
  }
}

// Apply additional business rules on top of sequentiality
// - OEM ETA must be on/after createdAt
// - For early statuses (up to OEM_IN_TRANSIT), OEM ETA should not be in the past
function enforceEtaPolicy({ createdAt, status, oemEta, upfitterEta, deliveryEta }) {
  const seq = ensureSequentialEtas({ oemEta, upfitterEta, deliveryEta })
  let dOem = seq.oemEta ? new Date(seq.oemEta) : null
  let dUpfit = seq.upfitterEta ? new Date(seq.upfitterEta) : null
  let dDelivery = seq.deliveryEta ? new Date(seq.deliveryEta) : null
  const now = new Date()
  const created = createdAt ? new Date(createdAt) : null
  const idx = ORDER_FLOW.indexOf(status || 'CONFIG_RECEIVED')
  const earlyIdx = ORDER_FLOW.indexOf('OEM_IN_TRANSIT')

  // Rule: OEM ETA >= createdAt
  if (created && dOem && dOem < created) {
    dOem = new Date(created.getTime() + 1 * DAY_MS)
  }
  // Rule: For early statuses, OEM ETA should not be past due
  if (dOem && idx >= 0 && idx <= earlyIdx && dOem < now) {
    dOem = new Date(now.getTime() + 2 * DAY_MS)
  }
  // Re-sequence from OEM anchor
  const resequenced = ensureSequentialEtas({ oemEta: dOem?.toISOString(), upfitterEta: dUpfit?.toISOString(), deliveryEta: dDelivery?.toISOString() })
  return resequenced
}

// Generate a 9-digit stock number: [series(3)][dealer(3)][seq(3)]
function generateStockNumber(order) {
  const seriesDigits = String(order?.buildJson?.chassis?.series || '')
    .replace(/\D/g, '')
    .slice(-3)
    .padStart(3, '0')
  const dealerDigits = String(order?.dealerCode || '')
    .replace(/\D/g, '')
    .slice(-3)
    .padStart(3, '0')
  const seqDigits = String(nextCounter(LS_STOCK_SEQ, 100))
    .slice(-3)
    .padStart(3, '0')
  return `${seriesDigits}${dealerDigits}${seqDigits}`
}

// VIN helpers
function yearToVinCode(year) {
  // Simplified mapping for 2010-2035
  const map = {
    2010: 'A', 2011: 'B', 2012: 'C', 2013: 'D', 2014: 'E', 2015: 'F', 2016: 'G', 2017: 'H', 2018: 'J', 2019: 'K',
    2020: 'L', 2021: 'M', 2022: 'N', 2023: 'P', 2024: 'R', 2025: 'S', 2026: 'T', 2027: 'V', 2028: 'W', 2029: 'X',
    2030: 'Y', 2031: '1', 2032: '2', 2033: '3', 2034: '4', 2035: '5',
  }
  return map[year] || 'S'
}

// Generate a plausible 17-char Ford VIN. Not a real VIN/check digit.
function generateFordVin(order) {
  const wmi = '1FT' // Ford Truck
  const seriesDigits = String(order?.buildJson?.chassis?.series || '')
    .replace(/\D/g, '')
    .padStart(3, '0')
    .slice(-3)
  const drivetrainCode = /4x4/i.test(String(order?.buildJson?.chassis?.drivetrain || '')) ? '4' : '2'
  const cabCode = /crew/i.test(String(order?.buildJson?.chassis?.cab || '')) ? 'C' : 'R'
  const vds = (seriesDigits + drivetrainCode + cabCode).slice(0, 5).padEnd(5, 'X')
  const check = 'X' // placeholder check digit
  const year = new Date(order?.createdAt || Date.now()).getFullYear()
  const yearCode = yearToVinCode(year)
  const plant = (String(order?.dealerCode || '').replace(/[^A-Za-z]/g, '').slice(-1).toUpperCase() || 'F').slice(0, 1)
  const serial = String(nextCounter(LS_VIN_SEQ, 100000)).slice(-6).padStart(6, '0')
  return `${wmi}${vds}${check}${yearCode}${plant}${serial}`
}

// Generate varied pricing based on vehicle model and configuration
function generatePricing(order, index = 0) {
  const series = order?.buildJson?.chassis?.series || 'F-550'
  const bodyType = order?.buildJson?.bodyType || 'Service Body'
  const powertrain = order?.buildJson?.chassis?.powertrain || 'diesel-6.7L'
  const drivetrain = order?.buildJson?.chassis?.drivetrain || '4x2'
  
  // Base chassis MSRP varies by model
  const chassisBase = {
    'E-350': 45000,
    'E-450': 52000,
    'F-350': 55000,
    'F-450': 64000,
    'F-550': 68000,
    'F-600': 72000,
    'F-650': 85000,
    'F-750': 95000,
  }
  const baseChassis = chassisBase[series] || 64000
  
  // Add variation based on powertrain and drivetrain
  let chassisMsrp = baseChassis
  if (powertrain?.includes('diesel')) chassisMsrp += 8000
  if (powertrain?.includes('EV') || powertrain?.includes('ev')) chassisMsrp += 15000
  if (drivetrain?.includes('4x4')) chassisMsrp += 5000
  
  // Add some random variation (±5%)
  const variation = (index % 10) - 5 // -5 to +4
  chassisMsrp = Math.round(chassisMsrp * (1 + variation * 0.01))
  
  // Body price varies by body type and length
  const bodyBase = {
    'Service Body': 18000,
    'Flatbed': 12000,
    'Dump Body': 15000,
    'Dry Freight Body': 16000,
    'Refrigerated Body': 25000,
    'Tow & Recovery': 22000,
    'Ambulance': 35000,
    'Bucket': 28000,
    'Contractor Body': 19000,
    'Box w/ Lift Gate': 20000,
  }
  let bodyPrice = bodyBase[bodyType] || 18000
  const bodyLength = order?.buildJson?.bodySpecs?.length || order?.buildJson?.bodySpecs?.bodyLength || order?.buildJson?.bodySpecs?.bedLength || order?.buildJson?.bodySpecs?.boxLength || 12
  bodyPrice += (bodyLength - 10) * 500 // $500 per foot over 10ft
  bodyPrice = Math.round(bodyPrice * (1 + (index % 7 - 3) * 0.02)) // ±6% variation
  
  // Options price varies
  const optionsPrice = Math.round((1000 + (index % 5) * 500) * (1 + (index % 3) * 0.1))
  
  // Labor varies by upfitter and complexity
  const laborBase = 3000
  const laborVariation = (index % 8) * 200 // 0 to 1400
  const labor = laborBase + laborVariation
  
  // Freight varies by distance
  const freightBase = 1200
  const freightVariation = (index % 6) * 300 // 0 to 1500
  const freight = freightBase + freightVariation
  
  // Calculate total before taxes
  const subtotal = chassisMsrp + bodyPrice + optionsPrice + labor + freight
  
  // Taxes (varies by state/dealer, roughly 5-8%)
  const taxRate = 0.05 + (index % 4) * 0.01 // 5% to 8%
  const taxes = Math.round(subtotal * taxRate)
  
  // Total
  const total = subtotal + taxes
  
  return {
    chassisMsrp,
    bodyPrice,
    optionsPrice,
    labor,
    freight,
    incentives: [],
    taxes,
    total,
  }
}

function seedDemoOrders(targetCount = 154) {
  // Reset all relevant storage to ensure a clean reseed
  localStorage.removeItem(LS_ORDERS)
  localStorage.removeItem(LS_EVENTS)
  localStorage.removeItem(LS_NOTES)
  localStorage.removeItem(LS_STOCK_SEQ)
  localStorage.removeItem(LS_VIN_SEQ)

  const now = Date.now()
  const upfitters = [
    { id: 'knapheide-detroit', name: 'Knapheide Detroit' },
    { id: 'reading-chicago', name: 'Reading Truck Body - Chicago' },
    { id: 'jerr-dan-atlanta', name: 'Jerr-Dan Towing - Atlanta' },
    { id: 'altec-dallas', name: 'Altec Industries - Dallas' },
    { id: 'morgan-phoenix', name: 'Morgan Truck Body - Phoenix' },
    { id: 'rugby-denver', name: 'Rugby Manufacturing - Denver' },
    { id: 'supreme-seattle', name: 'Supreme Corporation - Seattle' },
    { id: 'stahl-miami', name: 'Stahl Bodies - Miami' },
    { id: 'duramag-portland', name: 'Duramag - Portland' },
    { id: 'versalift-houston', name: 'Versalift - Houston' },
    { id: 'auto-truck-boston', name: 'Auto Truck Group - Boston' },
    { id: 'miller-nashville', name: 'Miller Industries - Nashville' },
    { id: 'royal-kansas', name: 'Royal Truck Body - Kansas City' },
    { id: 'henderson-salt-lake', name: 'Henderson Products - Salt Lake City' },
    { id: 'rockport-columbus', name: 'Rockport - Columbus' },
  ]
  const dealers = Array.from({ length: 40 }, (_, i) => `CVC${String(101 + i)}`)
  // Mirror configurator body types and manufacturers
  const UPFIT_MATRIX = {
    'Service Body': {
      chassis: ['F-350', 'F-450', 'F-550'],
      manufacturers: ['Knapheide', 'Royal Truck Body', 'Duramag', 'Reading Truck']
    },
    'Flatbed': {
      chassis: ['F-350', 'F-450', 'F-550', 'F-600'],
      manufacturers: ["Rugby Manufacturing", "PJ's Truck Bodies", 'Duramag', 'SH Truck Bodies']
    },
    'Dump Body': {
      chassis: ['F-350', 'F-450', 'F-550', 'F-600'],
      manufacturers: ['Rugby Manufacturing', 'Godwin Group', 'Brandon Manufacturing', 'Downeaster']
    },
    'Dry Freight Body': {
      chassis: ['E-350', 'E-450', 'F-450', 'F-550', 'F-600', 'F-650'],
      manufacturers: ['Morgan Truck Body', 'Rockport', 'Reading Truck', 'Wabash']
    },
    'Refrigerated Body': {
      chassis: ['E-450', 'F-450', 'F-550', 'F-600', 'F-650'],
      manufacturers: ['Morgan Truck Body', 'Rockport', 'Great Dane Johnson', 'Wabash']
    },
    'Tow & Recovery': {
      chassis: ['F-450', 'F-550', 'F-600'],
      manufacturers: ['Jerr-Dan', 'Miller Industries', 'Dynamic Towing', 'Chevron']
    },
    'Ambulance': {
      chassis: ['E-450', 'F-450', 'F-550'],
      manufacturers: ['Wheeled Coach', 'Braun Industries', 'Horton Emergency Vehicles', 'AEV']
    },
    'Bucket': {
      chassis: ['F-550', 'F-600', 'F-650', 'F-750'],
      manufacturers: ['Altec', 'Versalift', 'Terex Utilities', 'Dur-A-Lift']
    },
    'Contractor Body': {
      chassis: ['F-350', 'F-450', 'F-550', 'F-600'],
      manufacturers: ['Knapheide', 'Royal Truck Body', 'Scelzi', 'Duramag']
    },
    'Box w/ Lift Gate': {
      chassis: ['F-450', 'F-550', 'F-600', 'F-650'],
      manufacturers: ['Morgan Truck Body', 'Wabash', 'Rockport', 'Complete Truck Bodies']
    }
  }
  const allBodyTypes = Object.keys(UPFIT_MATRIX)
  const chassisSeries = ['E-350', 'E-450', 'F-350', 'F-450', 'F-550', 'F-600', 'F-650', 'F-750']
  const cabs = ['Regular Cab', 'SuperCab', 'Crew Cab']
  const powertrains = ['gas-7.3L', 'diesel-6.7L']
  const gvwrBySeries = {
    'E-350': '12050',
    'E-450': '14500',
    'F-350': '14000',
    'F-450': '16500',
    'F-550': '19500',
    'F-600': '22000',
    'F-650': '26000',
    'F-750': '37000',
  }
  const wheelbasesBySeries = {
    'E-350': ['138', '158', '176'],
    'E-450': ['158', '176'],
    'F-350': ['145', '164', '176'],
    'F-450': ['164', '176', '192'],
    'F-550': ['169', '176', '192'],
    'F-600': ['169', '176', '192'],
    'F-650': ['158', '176', '190', '218'],
    'F-750': ['176', '190', '218', '254'],
  }
  const getDrivetrainForSeries = (series, idx) => {
    if (series.startsWith('E-')) return 'RWD'
    return idx % 2 === 0 ? '4x2' : '4x4'
  }
  const mkDate = (offsetDays) => new Date(now + offsetDays * 86400000).toISOString()

  const orders = []
  for (let i = 0; i < targetCount; i++) {
    const status = ORDER_FLOW[Math.min(i % ORDER_FLOW.length, ORDER_FLOW.length - 1)]
    const dealerCode = dealers[i % dealers.length]
    const up = upfitters[i % upfitters.length]
    const series = chassisSeries[i % chassisSeries.length]
    // Pick a body type compatible with this series
    const compatibleBodyTypes = allBodyTypes.filter(bt => UPFIT_MATRIX[bt].chassis.includes(series))
    const selectedBodyType = compatibleBodyTypes.length ? compatibleBodyTypes[i % compatibleBodyTypes.length] : 'Service Body'
    const manufacturers = UPFIT_MATRIX[selectedBodyType].manufacturers
    const manufacturer = manufacturers[i % manufacturers.length]
    const cab = cabs[i % cabs.length]
    const drivetrain = getDrivetrainForSeries(series, i)
    const wheelbases = wheelbasesBySeries[series] || ['169']
    const wheelbase = wheelbases[i % wheelbases.length]
    const powertrain = powertrains[i % powertrains.length]

    const createdAt = mkDate(-(14 + i))
    let oemEta = mkDate(10 + (i % 15))
    let upfitterEta = mkDate(20 + (i % 15))
    let deliveryEta = mkDate(35 + (i % 15))
    // Simulate delays, overdue, and some on-time (near-term) deliveries
    let originalDeliveryEta = null
    // Some orders have pushed delivery out (not yet delivered)
    if (i % 7 === 0) {
      originalDeliveryEta = deliveryEta
      const delayDays = 7 + (i % 21) // 7-27 days
      deliveryEta = mkDate(35 + (i % 15) + delayDays)
    }
    // Some orders are overdue (ETA in the past) but not delivered
    if (i % 11 === 0) {
      originalDeliveryEta = originalDeliveryEta || deliveryEta
      deliveryEta = mkDate(-(i % 5 + 1)) // already past due 1-5 days
    }
    // Some orders are close (3-6 days ahead) to render as ON_TIME
    if (i % 9 === 3) {
      deliveryEta = mkDate(3 + (i % 4))
    }

    // Final pass to guarantee sequentiality before building the order
    ;({ oemEta, upfitterEta, deliveryEta } = enforceEtaPolicy({ createdAt, status, oemEta, upfitterEta, deliveryEta }))

    const baseOrder = {
      id: `ORD-${(now + i).toString(36).toUpperCase()}`,
      dealerCode,
      upfitterId: up.id,
      status,
      oemEta,
      upfitterEta,
      deliveryEta,
      buildJson: {
        bodyType: selectedBodyType,
        manufacturer,
        chassis: { series, cab, drivetrain, wheelbase, gvwr: gvwrBySeries[series] || '', powertrain },
        bodySpecs: (() => {
          switch (selectedBodyType) {
            case 'Flatbed':
              return { bedLength: [8,10,12,14,16,18,20][i % 7], material: i % 2 ? 'Steel' : 'Aluminum' }
            case 'Dump Body':
              return { bedLength: [8,10,12,14,16][i % 5], sideHeight: [24,36,48,60][i % 4], hoistType: ['Scissor','Telescopic','Dual Piston'][i % 3] }
            case 'Dry Freight Body':
              return { length: [12,14,16,18,20,22,24,26][i % 8], height: [84,90,96,102][i % 4], doorType: ['Roll-up','Swing','Roll-up with Side Door'][i % 3] }
            case 'Refrigerated Body':
              return { length: [12,14,16,18,20][i % 5], height: [84,90,96][i % 3], doorType: ['Roll-up','Swing'][i % 2] }
            case 'Tow & Recovery':
              return { type: ['Rollback','Integrated Wrecker','Carrier'][i % 3], capacity: ['8T','12T','16T'][i % 3] }
            case 'Ambulance':
              return { type: ['Type I','Type II','Type III'][i % 3], moduleLength: [144,156,168][i % 3] }
            case 'Bucket':
              return { workingHeight: [42,47,55][i % 3], platform: ['Telescopic','Articulating'][i % 2] }
            case 'Contractor Body':
              return { bedLength: [8,9,11,14][i % 4], material: i % 2 ? 'Steel' : 'Aluminum' }
            case 'Service Body':
              return { bodyLength: [8,9,11,14][i % 4], material: i % 2 ? 'Steel' : 'Aluminum' }
            case 'Box w/ Lift Gate':
              return { boxLength: [12,14,16,18,20][i % 5], liftgateType: ['Tuckaway','Rail Gate','Cantilever'][i % 3] }
            default:
              return { length: 12, material: 'Steel' }
          }
        })(),
        upfitter: { id: up.id, name: up.name },
      },
      pricingJson: null, // Will be generated below
      // Make 75% of orders have buyers (not stock) - 25% stock, 75% sold
      // Shift pattern so first orders have buyers (i+1 % 4 === 0 means indices 3, 7, 11... are stock)
      inventoryStatus: ((i + 1) % 4 === 0) ? 'STOCK' : 'SOLD',
      isStock: ((i + 1) % 4 === 0),
      buyerName: '', // Will be set based on buyerSegment below
      listingStatus: null,
      dealerWebsiteStatus: (() => {
        // Ensure all dealer website statuses appear; publish only stock units
        if ((i % 12) === 0) return 'PUBLISHED'
        if ((i % 12) === 1) return 'UNPUBLISHED'
        return 'DRAFT'
      })(),
      createdAt,
      updatedAt: createdAt,
      originalDeliveryEta: originalDeliveryEta,
    }
    // Ensure all sales statuses appear by varying delivery/state
    if (orders.length % 6 === 1) {
      // Invoiced: delivered within last 7 days
      const d = new Date()
      d.setDate(d.getDate() - 3)
      baseOrder.deliveryEta = d.toISOString()
      baseOrder.status = 'DELIVERED'
      baseOrder.inventoryStatus = 'SOLD'
      const enforced = enforceEtaPolicy({ createdAt: baseOrder.createdAt, status: baseOrder.status, oemEta: baseOrder.oemEta, upfitterEta: baseOrder.upfitterEta, deliveryEta: baseOrder.deliveryEta })
      baseOrder.oemEta = enforced.oemEta
      baseOrder.upfitterEta = enforced.upfitterEta
      baseOrder.deliveryEta = enforced.deliveryEta
      // Set actual completion dates for delivered orders
      const deliveryDate = new Date(baseOrder.deliveryEta)
      baseOrder.actualDeliveryCompleted = baseOrder.deliveryEta
      // Set OEM completion date (before upfitter)
      const oemDate = new Date(deliveryDate)
      oemDate.setDate(oemDate.getDate() - 15) // OEM completed 15 days before delivery
      baseOrder.actualOemCompleted = oemDate.toISOString()
      // Set upfitter completion date (between OEM and delivery)
      const upfitterDate = new Date(deliveryDate)
      upfitterDate.setDate(upfitterDate.getDate() - 5) // Upfitter completed 5 days before delivery
      baseOrder.actualUpfitterCompleted = upfitterDate.toISOString()
    } else if (orders.length % 6 === 2) {
      // Payment received: delivered > 7 days ago
      const d = new Date()
      d.setDate(d.getDate() - 12)
      baseOrder.deliveryEta = d.toISOString()
      baseOrder.status = 'DELIVERED'
      baseOrder.inventoryStatus = 'SOLD'
      const enforced = enforceEtaPolicy({ createdAt: baseOrder.createdAt, status: baseOrder.status, oemEta: baseOrder.oemEta, upfitterEta: baseOrder.upfitterEta, deliveryEta: baseOrder.deliveryEta })
      baseOrder.oemEta = enforced.oemEta
      baseOrder.upfitterEta = enforced.upfitterEta
      baseOrder.deliveryEta = enforced.deliveryEta
      // Set actual completion dates for delivered orders
      const deliveryDate = new Date(baseOrder.deliveryEta)
      baseOrder.actualDeliveryCompleted = baseOrder.deliveryEta
      // Set OEM completion date (before upfitter)
      const oemDate = new Date(deliveryDate)
      oemDate.setDate(oemDate.getDate() - 15) // OEM completed 15 days before delivery
      baseOrder.actualOemCompleted = oemDate.toISOString()
      // Set upfitter completion date (between OEM and delivery)
      const upfitterDate = new Date(deliveryDate)
      upfitterDate.setDate(upfitterDate.getDate() - 5) // Upfitter completed 5 days before delivery
      baseOrder.actualUpfitterCompleted = upfitterDate.toISOString()
    } else if (orders.length % 6 === 0) {
      // PO received: sold but not yet delivered (future ETA)
      baseOrder.inventoryStatus = 'SOLD'
      baseOrder.status = baseOrder.status === 'DELIVERED' ? 'READY_FOR_DELIVERY' : baseOrder.status
      baseOrder.deliveryEta = mkDate(10 + (i % 10))
      const enforced = enforceEtaPolicy({ createdAt: baseOrder.createdAt, status: baseOrder.status, oemEta: baseOrder.oemEta, upfitterEta: baseOrder.upfitterEta, deliveryEta: baseOrder.deliveryEta })
      baseOrder.oemEta = enforced.oemEta
      baseOrder.upfitterEta = enforced.upfitterEta
      baseOrder.deliveryEta = enforced.deliveryEta
    }
    // For published units, ensure stock to satisfy UI rule
    if (baseOrder.dealerWebsiteStatus === 'PUBLISHED') {
      baseOrder.isStock = true
      baseOrder.inventoryStatus = 'STOCK'
    }
    
    // Final enforcement: Always ensure buyerSegment and buyerName match inventoryStatus
    // Stock = Dealer (no buyer), SOLD = Fleet (with buyer)
    baseOrder.buyerSegment = baseOrder.inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'
    baseOrder.buyerName = baseOrder.buyerSegment === 'Fleet' ? (baseOrder.buyerName || generateFleetBuyerName(i)) : ''
    
    // Set actual completion dates for any delivered orders that don't have them
    if (baseOrder.status === 'DELIVERED' && !baseOrder.actualDeliveryCompleted) {
      baseOrder.actualDeliveryCompleted = baseOrder.deliveryEta || new Date().toISOString()
      // Set OEM and upfitter dates if not already set
      if (!baseOrder.actualOemCompleted) {
        const deliveryDate = new Date(baseOrder.actualDeliveryCompleted)
        deliveryDate.setDate(deliveryDate.getDate() - 15)
        baseOrder.actualOemCompleted = deliveryDate.toISOString()
      }
      if (!baseOrder.actualUpfitterCompleted) {
        const deliveryDate = new Date(baseOrder.actualDeliveryCompleted)
        deliveryDate.setDate(deliveryDate.getDate() - 5)
        baseOrder.actualUpfitterCompleted = deliveryDate.toISOString()
      }
    }
    
    // Set actual completion dates for orders past certain stages
    const statusIdx = ORDER_FLOW.indexOf(baseOrder.status)
    if (statusIdx >= ORDER_FLOW.indexOf('OEM_IN_TRANSIT') && !baseOrder.actualOemCompleted) {
      baseOrder.actualOemCompleted = baseOrder.oemEta || new Date().toISOString()
    }
    if (statusIdx >= ORDER_FLOW.indexOf('UPFIT_IN_PROGRESS') && !baseOrder.actualUpfitterCompleted) {
      baseOrder.actualUpfitterCompleted = baseOrder.upfitterEta || new Date().toISOString()
    }
    
    // Add createdBy/updatedBy, buyerSegment, priority, tags if not present
    if (!baseOrder.createdBy) {
      const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
      baseOrder.createdBy = users[i % users.length]
    }
    if (!baseOrder.updatedBy) {
      const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
      baseOrder.updatedBy = users[(i + 1) % users.length]
    }
    // Final enforcement: Always ensure buyerSegment and buyerName match inventoryStatus
    // Stock = Dealer (no buyer), SOLD = Fleet (with buyer)
    baseOrder.buyerSegment = baseOrder.inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'
    baseOrder.buyerName = baseOrder.buyerSegment === 'Fleet' ? generateFleetBuyerName(i) : ''
    if (!baseOrder.priority) {
      const priorities = ['Low', 'Normal', 'High', 'Urgent']
      baseOrder.priority = priorities[i % priorities.length]
    }
    if (!baseOrder.tags || !Array.isArray(baseOrder.tags) || baseOrder.tags.length === 0) {
      const allTags = ['Rush', 'Custom', 'Fleet', 'Demo', 'Priority', 'Special', 'Standard', 'Warranty']
      const numTags = (i % 3) + 1
      const selected = []
      for (let j = 0; j < numTags; j++) {
        const tag = allTags[(i + j) % allTags.length]
        if (!selected.includes(tag)) selected.push(tag)
      }
      baseOrder.tags = selected
    }
    
    // Generate varied pricing based on order configuration
    baseOrder.pricingJson = generatePricing(baseOrder, i)
    
    orders.push({
      ...baseOrder,
      stockNumber: generateStockNumber(baseOrder),
      // Populate VIN for all demo rows to ensure every field is filled
      vin: generateFordVin(baseOrder),
    })
  }

  // Deduplicate IDs just in case
  const seen = new Set()
  const deduped = orders.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })
  writeLocal(LS_ORDERS, deduped)

  // Seed events corresponding to status progression
  const seededEvents = deduped.flatMap(o => {
    const idx = Math.max(0, ORDER_FLOW.indexOf(o.status))
    const created = new Date(o.createdAt).getTime()
    return ORDER_FLOW.slice(0, Math.max(idx, 1)).map((to, j) => ({
      id: `evt_${o.id}_${j}`,
      orderId: o.id,
      from: j === 0 ? '' : ORDER_FLOW[j - 1],
      to,
      at: new Date(created + j * 86400000).toISOString(),
    }))
  })
  writeLocal(LS_EVENTS, seededEvents)
  writeLocal(LS_NOTES, [])
}

function ensureSeedData() {
  const existing = readLocal(LS_ORDERS, null)
  const now = Date.now()
  let base = []
  // Always reseed when version changes or count is not exactly our target
  const version = readLocal(LS_SEED_VERSION, '')
  if (version !== CURRENT_SEED_VERSION) {
    seedDemoOrders(154)
    writeLocal(LS_SEED_VERSION, CURRENT_SEED_VERSION)
    return
  }
  // Only reseed when dataset is absent; allow counts to vary so deep-linked stub orders persist
  if (!Array.isArray(existing) || existing.length === 0) {
    seedDemoOrders(154)
    writeLocal(LS_SEED_VERSION, CURRENT_SEED_VERSION)
    return
  }
  // If we already have orders, sanitize them (remove any demo labels, fill ETAs, diversify upfitters)
  if (Array.isArray(existing) && existing.length > 0) {
    const cleaned = sanitizeExisting(existing)
    if (cleaned.length >= 20) {
      // Write back if changed and bail
      const changed = JSON.stringify(existing) !== JSON.stringify(cleaned)
      if (changed) writeLocal(LS_ORDERS, cleaned)
      return
    }
    base = cleaned
  }
  const fromSeeds = Array.isArray(seedOrders) ? seedOrders : []

  // Normalize and ensure createdAt/updatedAt
  const normalized = fromSeeds.map((o, i) => {
    const genId = () => `ORD-${(now + i).toString(36).toUpperCase()}`
    const id = (!o.id || /demo/i.test(o.id) || /^ord_/i.test(o.id)) ? genId() : o.id
    const dealerCode = (!o.dealerCode || /demo/i.test(o.dealerCode)) ? `CVC${String(101 + i)}` : o.dealerCode
    const upfitterId = o.upfitterId ?? o.buildJson?.upfitter?.id ?? (Math.random() > 0.5 ? 'metro-upfits' : 'northline-upfits')
    const status = o.status || 'CONFIG_RECEIVED'
    const buildUpfitterName = (() => {
      const name = o.buildJson?.upfitter?.name
      if (!name || /demo/i.test(name)) return upfitterId === 'metro-upfits' ? 'Metro Upfits' : upfitterId === 'northline-upfits' ? 'Northline Upfits' : 'Knapheide Detroit'
      return name
    })()
    // Make 75% of orders have buyers (not stock) - 25% stock, 75% sold
    // Shift pattern so first orders have buyers
    const inventoryStatus = ((i + 1) % 4 === 0) ? 'STOCK' : 'SOLD'
    const createdAt = o.createdAt || new Date(now - (i + 7) * 86400000).toISOString()
    // Ensure updatedAt is different from createdAt and varies based on order status
    const createdDate = new Date(createdAt)
    const daysSinceCreated = Math.floor((now - createdDate.getTime()) / 86400000)
    // updatedAt should be between 1 day and daysSinceCreated days after createdAt
    const updateOffsetDays = Math.max(1, Math.min(daysSinceCreated, (i % 5) + 1))
    const updatedAt = o.updatedAt || new Date(createdDate.getTime() + updateOffsetDays * 86400000).toISOString()
    const mkDate = (offsetDays) => new Date(now + offsetDays * 86400000).toISOString()
    // Ensure ETAs are populated
    let oemEta = o.oemEta ?? mkDate(10 + (i % 15))
    let upfitterEta = o.upfitterEta ?? mkDate(20 + (i % 15))
    let deliveryEta = o.deliveryEta ?? mkDate(35 + (i % 15))
    ;({ oemEta, upfitterEta, deliveryEta } = enforceEtaPolicy({ createdAt, status, oemEta, upfitterEta, deliveryEta }))
    
    // Enforce strict relationship: Stock = Dealer (no buyer), SOLD = Fleet (with buyer)
    // Always set buyerSegment based on inventoryStatus
    const buyerSegment = inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'
    // Always set buyerName based on buyerSegment
    const buyerName = buyerSegment === 'Fleet' ? (o.buyerName || generateFleetBuyerName(i)) : ''
    
    // Generate actual completion dates for completed stages
    const statusIdx = ORDER_FLOW.indexOf(status)
    const actualOemCompleted = (statusIdx >= ORDER_FLOW.indexOf('OEM_IN_TRANSIT')) ? (o.actualOemCompleted || mkDate(-(i % 10 + 5))) : null
    const actualUpfitterCompleted = (statusIdx >= ORDER_FLOW.indexOf('UPFIT_IN_PROGRESS')) ? (o.actualUpfitterCompleted || mkDate(-(i % 8 + 2))) : null
    const actualDeliveryCompleted = (status === 'DELIVERED') ? (o.actualDeliveryCompleted || mkDate(-(i % 7 + 1))) : null
    
    // Generate priority and tags
    const priorities = ['Low', 'Normal', 'High', 'Urgent']
    const priority = o.priority || priorities[i % priorities.length]
    const allTags = ['Rush', 'Custom', 'Fleet', 'Demo', 'Priority', 'Special', 'Standard', 'Warranty']
    const tags = o.tags || (() => {
      const numTags = (i % 3) + 1
      const selected = []
      for (let j = 0; j < numTags; j++) {
        const tag = allTags[(i + j) % allTags.length]
        if (!selected.includes(tag)) selected.push(tag)
      }
      return selected
    })()
    
    // Get user for created/updated by
    const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
    const createdBy = o.createdBy || users[i % users.length]
    const updatedBy = o.updatedBy || users[(i + 1) % users.length]
    
    const baseOrder = {
      id,
      dealerCode,
      upfitterId,
      status,
      oemEta,
      upfitterEta,
      deliveryEta,
      // Actual completion dates
      actualOemCompleted,
      actualUpfitterCompleted,
      actualDeliveryCompleted,
      // Created/Updated by
      createdBy,
      updatedBy,
      // Buyer segment
      buyerSegment,
      // Priority and tags
      priority,
      tags,
      buildJson: {
        ...(o.buildJson ?? {}),
        upfitter: { ...(o.buildJson?.upfitter ?? {}), id: upfitterId, name: buildUpfitterName },
      },
      pricingJson: o.pricingJson ?? null, // Will be generated below if null
      inventoryStatus,
      isStock: inventoryStatus === 'STOCK',
      // Buyer is only present for SOLD units; use fake fleet names
      buyerName,
      listingStatus: o.listingStatus ?? null,
      // New unified dealer website status; default: PUBLISHED if listingStatus was PUBLISHED, else DRAFT
      dealerWebsiteStatus: (o.dealerWebsiteStatus ?? (o.listingStatus === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')),
      createdAt,
      updatedAt,
    }
    const withKeys = {
      ...baseOrder,
      stockNumber: o.stockNumber || generateStockNumber(baseOrder),
      vin: (() => {
        const needVin = ORDER_FLOW.indexOf(status) >= ORDER_FLOW.indexOf('OEM_ALLOCATED')
        return needVin ? (o.vin || generateFordVin(baseOrder)) : (o.vin || '')
      })(),
    }
    // Generate pricing if missing
    if (!withKeys.pricingJson) {
      withKeys.pricingJson = generatePricing(withKeys, i)
    }
    return withKeys
  })

  let orders = [...base, ...normalized]

  // Top up to at least 15 demo orders if needed
  const placeholderDealers = ['CVC101','CVC102','CVC103','CVC104','CVC105','CVC106','CVC107','CVC108','CVC109','CVC110','CVC111','CVC112']
  const upfitters = [
    { id: 'knapheide-detroit', name: 'Knapheide Detroit' },
    { id: 'reading-chicago', name: 'Reading Truck Body - Chicago' },
    { id: 'jerr-dan-atlanta', name: 'Jerr-Dan Towing - Atlanta' },
    { id: 'altec-dallas', name: 'Altec Industries - Dallas' },
    { id: 'morgan-phoenix', name: 'Morgan Truck Body - Phoenix' },
    { id: 'rugby-denver', name: 'Rugby Manufacturing - Denver' },
    { id: 'supreme-seattle', name: 'Supreme Corporation - Seattle' },
    { id: 'stahl-miami', name: 'Stahl Bodies - Miami' },
    { id: 'duramag-portland', name: 'Duramag - Portland' },
    { id: 'versalift-houston', name: 'Versalift - Houston' },
    { id: 'auto-truck-boston', name: 'Auto Truck Group - Boston' },
    { id: 'miller-nashville', name: 'Miller Industries - Nashville' },
    { id: 'royal-kansas', name: 'Royal Truck Body - Kansas City' },
    { id: 'henderson-salt-lake', name: 'Henderson Products - Salt Lake City' },
    { id: 'rockport-columbus', name: 'Rockport - Columbus' },
  ]
  while (orders.length < 154) {
    const idx = orders.length
    const id = `ORD-${(now + idx).toString(36).toUpperCase()}`
    const statuses = ORDER_FLOW
    const status = statuses[Math.min(idx % statuses.length, statuses.length - 1)]
    const createdAt = new Date(now - (idx + 10) * 86400000).toISOString()
    const up = upfitters[idx % upfitters.length]
    // Generate ETAs for all
    const mkDate = (offsetDays) => new Date(now + offsetDays * 86400000).toISOString()
    let oemEta = mkDate(10 + (idx % 15))
    let upfitterEta = mkDate(20 + (idx % 15))
    // Sprinkle ON_TIME near-term deliveries for variety
    let deliveryEta = (idx % 8 === 2) ? mkDate(4 + (idx % 3)) : mkDate(35 + (idx % 15))
    ;({ oemEta, upfitterEta, deliveryEta } = enforceEtaPolicy({ createdAt, status, oemEta, upfitterEta, deliveryEta }))
    // Make 75% of orders have buyers (not stock) - 25% stock, 75% sold
    // Shift pattern so first orders have buyers
    const inventoryStatus = ((idx + 1) % 4 === 0) ? 'STOCK' : 'SOLD'
    // Stock orders = Dealer, Orders with buyers = Fleet
    const buyerSegment = inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'
    // Ensure buyerName matches buyerSegment: Fleet = has buyer name, Dealer = blank
    const buyerName = buyerSegment === 'Fleet' ? generateFleetBuyerName(idx) : ''
    const statusIdx = ORDER_FLOW.indexOf(status)
    const actualOemCompleted = (statusIdx >= ORDER_FLOW.indexOf('OEM_IN_TRANSIT')) ? mkDate(-(idx % 10 + 5)) : null
    const actualUpfitterCompleted = (statusIdx >= ORDER_FLOW.indexOf('UPFIT_IN_PROGRESS')) ? mkDate(-(idx % 8 + 2)) : null
    const actualDeliveryCompleted = (status === 'DELIVERED') ? mkDate(-(idx % 7 + 1)) : null
    const priorities = ['Low', 'Normal', 'High', 'Urgent']
    const priority = priorities[idx % priorities.length]
    const allTags = ['Rush', 'Custom', 'Fleet', 'Demo', 'Priority', 'Special', 'Standard', 'Warranty']
    const tags = (() => {
      const numTags = (idx % 3) + 1
      const selected = []
      for (let j = 0; j < numTags; j++) {
        const tag = allTags[(idx + j) % allTags.length]
        if (!selected.includes(tag)) selected.push(tag)
      }
      return selected
    })()
    const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
    // Ensure updatedAt is different from createdAt
    const createdDate = new Date(createdAt)
    const daysSinceCreated = Math.floor((now - createdDate.getTime()) / 86400000)
    const updateOffsetDays = Math.max(1, Math.min(daysSinceCreated, (idx % 5) + 1))
    const updatedAt = new Date(createdDate.getTime() + updateOffsetDays * 86400000).toISOString()
    const stub = {
      id,
      dealerCode: placeholderDealers[idx % placeholderDealers.length] || `CVC${String(120 + idx)}`,
      upfitterId: up.id,
      status,
      oemEta,
      upfitterEta,
      deliveryEta,
      actualOemCompleted,
      actualUpfitterCompleted,
      actualDeliveryCompleted,
      createdBy: users[idx % users.length],
      updatedBy: users[(idx + 1) % users.length],
      buyerSegment,
      priority,
      tags,
      buildJson: {
        bodyType: 'Flatbed/Stake/Platform',
        manufacturer: 'Rugby Manufacturing',
        chassis: { series: 'F-550', cab: 'Crew Cab', drivetrain: '4x4', wheelbase: '169', gvwr: '19500', powertrain: 'Gas' },
        bodySpecs: { length: 12, material: 'Steel' },
        upfitter: { id: up.id, name: up.name }
      },
      pricingJson: null, // Will be generated below
      inventoryStatus,
      isStock: inventoryStatus === 'STOCK',
      buyerName,
      listingStatus: null,
      dealerWebsiteStatus: ((idx % 10) === 0 ? 'PUBLISHED' : (idx % 10) === 1 ? 'UNPUBLISHED' : 'DRAFT'),
      createdAt,
      updatedAt,
    }
    // Generate varied pricing based on order configuration
    stub.pricingJson = generatePricing(stub, idx)
    
    orders.push({
      ...stub,
      stockNumber: generateStockNumber(stub),
      vin: generateFordVin(stub),
    })
  }

  // Deduplicate by id
  const seen = new Set()
  orders = orders.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })

  // If duplicates reduced the count, top up again until we have 154
  if (orders.length < 154) {
    const upfittersForTopup = [
      { id: 'knapheide-detroit', name: 'Knapheide Detroit' },
      { id: 'reading-chicago', name: 'Reading Truck Body - Chicago' },
      { id: 'jerr-dan-atlanta', name: 'Jerr-Dan Towing - Atlanta' },
      { id: 'altec-dallas', name: 'Altec Industries - Dallas' },
      { id: 'morgan-phoenix', name: 'Morgan Truck Body - Phoenix' },
      { id: 'rugby-denver', name: 'Rugby Manufacturing - Denver' },
      { id: 'supreme-seattle', name: 'Supreme Corporation - Seattle' },
      { id: 'stahl-miami', name: 'Stahl Bodies - Miami' },
      { id: 'duramag-portland', name: 'Duramag - Portland' },
      { id: 'versalift-houston', name: 'Versalift - Houston' },
      { id: 'auto-truck-boston', name: 'Auto Truck Group - Boston' },
      { id: 'miller-nashville', name: 'Miller Industries - Nashville' },
      { id: 'royal-kansas', name: 'Royal Truck Body - Kansas City' },
      { id: 'henderson-salt-lake', name: 'Henderson Products - Salt Lake City' },
      { id: 'rockport-columbus', name: 'Rockport - Columbus' },
    ]
    const dealersForTopup = ['CVC101','CVC102','CVC103','CVC104','CVC105','CVC106','CVC107','CVC108','CVC109','CVC110','CVC111','CVC112']
    const mkDate = (offsetDays) => new Date(now + offsetDays * 86400000).toISOString()
    let counter = 0
    while (orders.length < 154) {
      const idx = orders.length + counter
      const idCandidate = `ORD-${(Date.now() + idx).toString(36).toUpperCase()}`
      if (seen.has(idCandidate)) { counter++; continue }
      seen.add(idCandidate)
      const up = upfittersForTopup[idx % upfittersForTopup.length]
      const status = ORDER_FLOW[Math.min(idx % ORDER_FLOW.length, ORDER_FLOW.length - 1)]
      const stub = {
        id: idCandidate,
        dealerCode: dealersForTopup[idx % dealersForTopup.length],
        upfitterId: up.id,
        status,
        ...(() => {
          let oemEta = mkDate(10 + (idx % 15))
          let upfitterEta = mkDate(20 + (idx % 15))
          let deliveryEta = (idx % 7 === 3) ? mkDate(3 + (idx % 4)) : mkDate(35 + (idx % 15))
          return enforceEtaPolicy({ createdAt: mkDate(-(10 + idx)), status, oemEta, upfitterEta, deliveryEta })
        })(),
        actualOemCompleted: (() => {
          const statusIdx = ORDER_FLOW.indexOf(status)
          return (statusIdx >= ORDER_FLOW.indexOf('OEM_IN_TRANSIT')) ? mkDate(-(idx % 10 + 5)) : null
        })(),
        actualUpfitterCompleted: (() => {
          const statusIdx = ORDER_FLOW.indexOf(status)
          return (statusIdx >= ORDER_FLOW.indexOf('UPFIT_IN_PROGRESS')) ? mkDate(-(idx % 8 + 2)) : null
        })(),
        actualDeliveryCompleted: (status === 'DELIVERED') ? mkDate(-(idx % 7 + 1)) : null,
        createdBy: (() => {
          const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
          return users[idx % users.length]
        })(),
        updatedBy: (() => {
          const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
          return users[(idx + 1) % users.length]
        })(),
        buyerSegment: (() => {
          // Make 75% of orders have buyers (not stock) - 25% stock, 75% sold
          // Shift pattern so first orders have buyers
          const inventoryStatus = ((idx + 1) % 4 === 0) ? 'STOCK' : 'SOLD'
          // Stock orders = Dealer, Orders with buyers = Fleet
          return inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'
        })(),
        priority: (() => {
          const priorities = ['Low', 'Normal', 'High', 'Urgent']
          return priorities[idx % priorities.length]
        })(),
        tags: (() => {
          const allTags = ['Rush', 'Custom', 'Fleet', 'Demo', 'Priority', 'Special', 'Standard', 'Warranty']
          const numTags = (idx % 3) + 1
          const selected = []
          for (let j = 0; j < numTags; j++) {
            const tag = allTags[(idx + j) % allTags.length]
            if (!selected.includes(tag)) selected.push(tag)
          }
          return selected
        })(),
        buildJson: {
          bodyType: 'Flatbed/Stake/Platform',
          manufacturer: 'Rugby Manufacturing',
          chassis: { series: 'F-550', cab: 'Crew Cab', drivetrain: '4x4', wheelbase: '169', gvwr: '19500', powertrain: 'Gas' },
          bodySpecs: { length: 12, material: 'Steel' },
          upfitter: { id: up.id, name: up.name }
        },
        pricingJson: null, // Will be generated below
        inventoryStatus: (() => {
          // Make 75% of orders have buyers (not stock) - 25% stock, 75% sold
          // Shift pattern so first orders have buyers
          return ((idx + 1) % 4 === 0) ? 'STOCK' : 'SOLD'
        })(),
        isStock: ((idx + 1) % 4 === 0),
        buyerName: (() => {
          // Ensure buyerName matches buyerSegment: Fleet = has buyer name, Dealer = blank
          const inventoryStatus = ((idx + 1) % 4 === 0) ? 'STOCK' : 'SOLD'
          const buyerSegment = inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'
          return buyerSegment === 'Fleet' ? generateFleetBuyerName(idx + 100) : ''
        })(),
        listingStatus: null,
        dealerWebsiteStatus: ((idx % 9) === 0 ? 'PUBLISHED' : (idx % 9) === 1 ? 'UNPUBLISHED' : 'DRAFT'),
        createdAt: mkDate(-(10 + idx)),
        updatedAt: mkDate(-(10 + idx)),
      }
      // Generate varied pricing based on order configuration
      stub.pricingJson = generatePricing(stub, idx)
      
      orders.push({
        ...stub,
        stockNumber: generateStockNumber(stub),
        vin: generateFordVin(stub),
      })
      counter++
    }
  }

  writeLocal(LS_ORDERS, orders)
  const events = readLocal(LS_EVENTS, [])
  if (events.length === 0) {
    const seeded = orders.flatMap(o => {
      const idx = Math.max(0, ORDER_FLOW.indexOf(o.status))
      const created = new Date(o.createdAt).getTime()
      return ORDER_FLOW.slice(0, Math.max(idx, 1)).map((to, i) => ({
        id: `evt_${o.id}_${i}`,
        orderId: o.id,
        from: i === 0 ? '' : ORDER_FLOW[i - 1],
        to,
        at: new Date(created + i * 86400000).toISOString(),
      }))
    })
    writeLocal(LS_EVENTS, seeded)
  }
  if (!localStorage.getItem(LS_NOTES)) writeLocal(LS_NOTES, [])
}

function sanitizeExisting(rawOrders) {
  const now = Date.now()
  const upfitters = [
    { id: 'knapheide-detroit', name: 'Knapheide Detroit' },
    { id: 'reading-chicago', name: 'Reading Truck Body - Chicago' },
    { id: 'jerr-dan-atlanta', name: 'Jerr-Dan Towing - Atlanta' },
    { id: 'altec-dallas', name: 'Altec Industries - Dallas' },
    { id: 'morgan-phoenix', name: 'Morgan Truck Body - Phoenix' },
    { id: 'rugby-denver', name: 'Rugby Manufacturing - Denver' },
    { id: 'supreme-seattle', name: 'Supreme Corporation - Seattle' },
    { id: 'stahl-miami', name: 'Stahl Bodies - Miami' },
    { id: 'duramag-portland', name: 'Duramag - Portland' },
    { id: 'versalift-houston', name: 'Versalift - Houston' },
    { id: 'auto-truck-boston', name: 'Auto Truck Group - Boston' },
    { id: 'miller-nashville', name: 'Miller Industries - Nashville' },
    { id: 'royal-kansas', name: 'Royal Truck Body - Kansas City' },
    { id: 'henderson-salt-lake', name: 'Henderson Products - Salt Lake City' },
    { id: 'rockport-columbus', name: 'Rockport - Columbus' },
  ]
  const placeholderDealers = ['CVC101','CVC102','CVC103','CVC104','CVC105','CVC106','CVC107','CVC108','CVC109','CVC110','CVC111','CVC112']
  let index = 0
  const seen = new Set()
  const mkDate = (offsetDays) => new Date(now + offsetDays * 86400000).toISOString()
  let stockCount = 0
  const cleaned = rawOrders.map((o, i) => {
    // Replace any demo artifacts
    let id = o.id
    if (!id || /demo/i.test(id) || /^ord_/.test(id)) id = `ORD-${(now + i).toString(36).toUpperCase()}`
    let dealerCode = o.dealerCode
    if (!dealerCode || /demo/i.test(dealerCode)) dealerCode = placeholderDealers[i % placeholderDealers.length]
    const up = upfitters[i % upfitters.length]
    const upfitterId = o.upfitterId || up.id
    const upfitterName = (o.buildJson?.upfitter?.name && !/demo/i.test(o.buildJson.upfitter.name)) ? o.buildJson.upfitter.name : up.name
    // Force a good mix of stock/sold deterministically if not set
    // Make 75% of orders have buyers (not stock) - 25% stock, 75% sold
    // Shift pattern so first orders have buyers
    let inventoryStatus = (o.inventoryStatus ? String(o.inventoryStatus).toUpperCase() : '')
    if (inventoryStatus !== 'STOCK' && inventoryStatus !== 'SOLD') {
      inventoryStatus = ((i + 1) % 4 === 0) ? 'STOCK' : 'SOLD'
    }
    if (inventoryStatus === 'STOCK') stockCount++
    const status = o.status || 'CONFIG_RECEIVED'
    const createdAt = o.createdAt || mkDate(-(7 + i))
    // Ensure updatedAt is different from createdAt
    const createdDate = new Date(createdAt)
    const nowDate = new Date(now)
    const daysSinceCreated = Math.floor((nowDate.getTime() - createdDate.getTime()) / 86400000)
    // If updatedAt is missing or same as createdAt, set it to be 1-5 days after createdAt
    let updatedAt = o.updatedAt
    if (!updatedAt || updatedAt === createdAt) {
      const updateOffsetDays = Math.max(1, Math.min(daysSinceCreated, (i % 5) + 1))
      updatedAt = new Date(createdDate.getTime() + updateOffsetDays * 86400000).toISOString()
    }
    let oemEta = o.oemEta || mkDate(10 + (i % 15))
    let upfitterEta = o.upfitterEta || mkDate(20 + (i % 15))
    let deliveryEta = o.deliveryEta || mkDate(35 + (i % 15))
    ;({ oemEta, upfitterEta, deliveryEta } = enforceEtaPolicy({ createdAt, status, oemEta, upfitterEta, deliveryEta }))
    // Deduplicate IDs
    while (seen.has(id)) id = `ORD-${(now + (++index)).toString(36).toUpperCase()}`
    seen.add(id)
    // Backfill actual completion dates for delivered orders
    let actualOemCompleted = o.actualOemCompleted
    let actualUpfitterCompleted = o.actualUpfitterCompleted
    let actualDeliveryCompleted = o.actualDeliveryCompleted
    
    if (status === 'DELIVERED' && !actualDeliveryCompleted) {
      actualDeliveryCompleted = deliveryEta || new Date().toISOString()
      // Set OEM and upfitter dates if not already set
      if (!actualOemCompleted) {
        const deliveryDate = new Date(actualDeliveryCompleted)
        deliveryDate.setDate(deliveryDate.getDate() - 15)
        actualOemCompleted = deliveryDate.toISOString()
      }
      if (!actualUpfitterCompleted) {
        const deliveryDate = new Date(actualDeliveryCompleted)
        deliveryDate.setDate(deliveryDate.getDate() - 5)
        actualUpfitterCompleted = deliveryDate.toISOString()
      }
    }
    
    // Set actual completion dates for orders past certain stages
    const statusIdx = ORDER_FLOW.indexOf(status)
    if (statusIdx >= ORDER_FLOW.indexOf('OEM_IN_TRANSIT') && !actualOemCompleted) {
      actualOemCompleted = oemEta || new Date().toISOString()
    }
    if (statusIdx >= ORDER_FLOW.indexOf('UPFIT_IN_PROGRESS') && !actualUpfitterCompleted) {
      actualUpfitterCompleted = upfitterEta || new Date().toISOString()
    }
    
    const result = {
      ...o,
      id,
      dealerCode,
      upfitterId,
      status,
      oemEta,
      upfitterEta,
      deliveryEta,
      actualOemCompleted,
      actualUpfitterCompleted,
      actualDeliveryCompleted,
      buildJson: {
        ...(o.buildJson || {}),
        upfitter: { ...(o.buildJson?.upfitter || {}), id: upfitterId, name: upfitterName },
      },
      inventoryStatus,
      isStock: inventoryStatus === 'STOCK',
      buyerName: '', // Will be set based on buyerSegment below
      dealerWebsiteStatus: (o.dealerWebsiteStatus ?? (o.listingStatus === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')),
      createdAt,
      updatedAt,
      // Backfill new fields if not present
      createdBy: o.createdBy || (() => {
        const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
        return users[i % users.length]
      })(),
      updatedBy: o.updatedBy || (() => {
        const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
        return users[(i + 1) % users.length]
      })(),
      // Enforce strict relationship: Stock = Dealer (no buyer), SOLD = Fleet (with buyer)
      buyerSegment: inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet',
      buyerName: (() => {
        const segment = inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'
        return segment === 'Fleet' ? (o.buyerName || generateFleetBuyerName(i)) : ''
      })(),
      priority: o.priority || (() => {
        const priorities = ['Low', 'Normal', 'High', 'Urgent']
        return priorities[i % priorities.length]
      })(),
      tags: (o.tags && Array.isArray(o.tags) && o.tags.length > 0) ? o.tags : (() => {
        const allTags = ['Rush', 'Custom', 'Fleet', 'Demo', 'Priority', 'Special', 'Standard', 'Warranty']
        const numTags = (i % 3) + 1
        const selected = []
        for (let j = 0; j < numTags; j++) {
          const tag = allTags[(i + j) % allTags.length]
          if (!selected.includes(tag)) selected.push(tag)
        }
        return selected
      })(),
    }
    result.stockNumber = o.stockNumber || generateStockNumber(result)
    result.vin = (() => {
      const needVin = ORDER_FLOW.indexOf(result.status) >= ORDER_FLOW.indexOf('OEM_ALLOCATED')
      return needVin ? (o.vin || generateFordVin(result)) : (o.vin || '')
    })()
    // Generate pricing if missing or if it's the old hardcoded pricing
    if (!result.pricingJson || (result.pricingJson?.chassisMsrp === 64000 && result.pricingJson?.bodyPrice === 21000 && result.pricingJson?.total === 91800)) {
      result.pricingJson = generatePricing(result, i)
    }
    return result
  }).filter(o => !/demo/i.test(o.id) && !/demo/i.test(o.dealerCode) && !/demo/i.test(o.buildJson?.upfitter?.name || ''))
  // Ensure at least ~25% stock in the final set (75% have buyers)
  const targetStock = Math.ceil(cleaned.length * 0.25)
  if (stockCount < targetStock) {
    for (let i = 0; i < cleaned.length && stockCount < targetStock; i++) {
      if (cleaned[i].inventoryStatus === 'SOLD') {
        cleaned[i].inventoryStatus = 'STOCK'
        cleaned[i].isStock = true
        stockCount++
      }
    }
  }
  // Final enforcement: Always ensure buyerSegment and buyerName match inventoryStatus
  cleaned.forEach(o => {
    o.buyerSegment = o.inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'
    o.buyerName = o.buyerSegment === 'Fleet' ? (o.buyerName || generateFleetBuyerName(cleaned.indexOf(o))) : ''
  })
  return cleaned
}

function filterOrders(rawOrders, params = {}) {
  let orders = [...rawOrders]
  const { status, q, stock, from, to, dealerCode, upfitterId } = params
  if (status) orders = orders.filter(o => o.status === status)
  if (dealerCode) orders = orders.filter(o => o.dealerCode === dealerCode)
  if (upfitterId) {
    const target = String(upfitterId)
    orders = orders.filter(o => {
      const fromRoot = o.upfitterId != null ? String(o.upfitterId) : null
      const fromBuild = o.buildJson?.upfitter?.id != null ? String(o.buildJson.upfitter.id) : null
      return fromRoot === target || fromBuild === target
    })
  }
  if (stock != null) orders = orders.filter(o => o.isStock === Boolean(stock))
  if (from) orders = orders.filter(o => new Date(o.createdAt) >= new Date(from))
  if (to) orders = orders.filter(o => new Date(o.createdAt) <= new Date(to))
  if (q) {
    const qq = String(q).toLowerCase()
    orders = orders.filter(o => {
      const values = [
        o.id,
        o.dealerCode,
        o.buildJson?.manufacturer,
        o.buildJson?.bodyType,
        o.buildJson?.chassis?.series,
        o.buildJson?.chassis?.powertrain,
      ].filter(Boolean).map(String)
      return values.some(v => v.toLowerCase().includes(qq))
    })
  }
  return orders
}

export async function getOrders(params = {}) {
  ensureSeedData()
  let orders = readLocal(LS_ORDERS, [])
  // Safety: if for any reason the dataset is empty, force a reseed
  if (!Array.isArray(orders) || orders.length === 0) {
    try { reseedDemoData(154) } catch {}
    orders = readLocal(LS_ORDERS, [])
    // If still empty, immediately provide ephemeral fallback so UI has rows
    if (!Array.isArray(orders) || orders.length === 0) {
      const fallback = buildEphemeralOrders(48)
      // Persist fallback so detail links work
      writeOrders(fallback)
      return { orders: filterOrders(fallback, params) }
    }
  }
  let filtered = filterOrders(orders, params)
  if (!Array.isArray(filtered) || filtered.length === 0) {
    // Defensive reseed if data appears corrupted or filters eliminated everything unexpectedly
    reseedDemoData(154)
    orders = readLocal(LS_ORDERS, [])
    filtered = filterOrders(orders, params)
    // If still empty, return a small in-memory dataset so UI never blanks out
    if (!Array.isArray(filtered) || filtered.length === 0) {
      const fallback = buildEphemeralOrders(48)
      // Persist fallback so detail links work
      writeOrders(fallback)
      filtered = filterOrders(fallback, params)
    }
  }
  return { orders: filtered }
}

export async function getOrder(id) {
  ensureSeedData()
  const orders = readLocal(LS_ORDERS, [])
  let order = orders.find(o => o.id === id) || null
  // Fallbacks: try common alternates (case-insensitive, stockNumber, VIN)
  if (!order) {
    const lc = String(id || '').toLowerCase()
    order = orders.find(o => String(o.id).toLowerCase() === lc
      || String(o.stockNumber || '').toLowerCase() === lc
      || String(o.vin || '').toLowerCase() === lc) || null
  }
  // If not found, auto-create a stub so deep links always resolve in demo
  if (!order) {
    const ensured = await ensureDemoOrder(id)
    return ensured
  }
  const events = readLocal(LS_EVENTS, []).filter(e => e.orderId === order.id)
  return { order, events }
}

// Explicit helper for demo: ensure an order exists for a given id; if missing, create a stub
export async function ensureDemoOrder(id) {
  ensureSeedData()
  const orders = readLocal(LS_ORDERS, [])
  let order = orders.find(o => o.id === id) || null
  if (!order) {
    const now = new Date().toISOString()
    const stub = {
      id: String(id),
      dealerCode: 'CVC101',
      upfitterId: 'knapheide-detroit',
      status: 'OEM_ALLOCATED',
      oemEta: new Date(Date.now() + 10 * 86400000).toISOString(),
      upfitterEta: new Date(Date.now() + 20 * 86400000).toISOString(),
      deliveryEta: new Date(Date.now() + 35 * 86400000).toISOString(),
      actualOemCompleted: null,
      actualUpfitterCompleted: null,
      actualDeliveryCompleted: null,
      createdBy: getCurrentUser(),
      updatedBy: getCurrentUser(),
      buyerSegment: 'Dealer',
      priority: 'Normal',
      tags: [],
      buildJson: {
        bodyType: 'Service Body',
        manufacturer: 'Knapheide',
        chassis: { series: 'F-550', cab: 'Crew Cab', drivetrain: '4x4', wheelbase: '169', gvwr: '19500', powertrain: 'diesel-6.7L' },
        bodySpecs: { bodyLength: 11, material: 'Steel' },
        upfitter: { id: 'knapheide-detroit', name: 'Knapheide Detroit' },
      },
      pricingJson: null, // Will be generated below
      inventoryStatus: 'STOCK',
      isStock: true,
      buyerName: '',
      listingStatus: null,
      dealerWebsiteStatus: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    }
    // Generate varied pricing based on order configuration
    stub.pricingJson = generatePricing(stub, 0)
    stub.stockNumber = generateStockNumber(stub)
    stub.vin = ''
    const next = [stub, ...orders]
    writeOrders(next)
    const events = readLocal(LS_EVENTS, [])
    events.push({ id: `evt_${stub.id}`, orderId: stub.id, from: '', to: 'CONFIG_RECEIVED', at: now })
    writeLocal(LS_EVENTS, events)
    order = stub
  }
  const events = readLocal(LS_EVENTS, []).filter(e => e.orderId === order.id)
  return { order, events }
}

function canTransition(from, to) {
  if (to === 'CANCELED') return true
  if (from === 'CANCELED') return false
  const currentIndex = ORDER_FLOW.indexOf(from)
  const nextIndex = ORDER_FLOW.indexOf(to)
  return nextIndex === currentIndex + 1
}

function writeOrders(orders) { writeLocal(LS_ORDERS, orders) }

// Explicit reseed utility for UI fallbacks or debugging
export function reseedDemoData(count = 154) {
  seedDemoOrders(count)
  writeLocal(LS_SEED_VERSION, CURRENT_SEED_VERSION)
}

// Last-resort: build a small in-memory dataset without touching localStorage
function buildEphemeralOrders(count = 24) {
  const now = Date.now()
  const seriesArr = ['E-350','E-450','F-350','F-450','F-550','F-600','F-650','F-750']
  const cabs = ['Regular Cab','SuperCab','Crew Cab']
  const drivetrains = ['4x2','4x4']
  const powertrains = ['gas-7.3L','diesel-6.7L']
  const mkDate = (offset) => new Date(now + offset * DAY_MS).toISOString()
  const rows = []
  for (let i = 0; i < count; i++) {
    const series = seriesArr[i % seriesArr.length]
    const createdAt = mkDate(-(7 + i))
    let oemEta = mkDate(10 + (i % 10))
    let upfitterEta = mkDate(20 + (i % 10))
    let deliveryEta = (i % 6 === 1) ? mkDate(4 + (i % 3)) : mkDate(35 + (i % 10))
    ;({ oemEta, upfitterEta, deliveryEta } = enforceEtaPolicy({ createdAt, status: 'OEM_ALLOCATED', oemEta, upfitterEta, deliveryEta }))
    const row = {
      id: `ORD-E-${(now + i).toString(36).toUpperCase()}`,
      dealerCode: `CVC${String(101 + (i % 12))}`,
      upfitterId: 'knapheide-detroit',
      status: 'OEM_ALLOCATED',
      oemEta,
      upfitterEta,
      deliveryEta,
      buildJson: {
        bodyType: 'Service Body',
        manufacturer: 'Knapheide',
        chassis: { series, cab: cabs[i % cabs.length], drivetrain: drivetrains[i % drivetrains.length], wheelbase: '169', gvwr: '19500', powertrain: powertrains[i % powertrains.length] },
        bodySpecs: { bodyLength: [8,9,11,14][i % 4], material: i % 2 ? 'Steel' : 'Aluminum' },
        upfitter: { id: 'knapheide-detroit', name: 'Knapheide Detroit' },
      },
      pricingJson: null, // Will be generated below
      // Make 75% of orders have buyers (not stock) - 25% stock, 75% sold
      // Shift pattern so first orders have buyers
      inventoryStatus: ((i + 1) % 4 === 0) ? 'STOCK' : 'SOLD',
      isStock: ((i + 1) % 4 === 0),
      buyerName: '', // Will be set based on buyerSegment below
      listingStatus: null,
      dealerWebsiteStatus: (i % 3 === 0 ? 'PUBLISHED' : i % 3 === 1 ? 'UNPUBLISHED' : 'DRAFT'),
      createdAt,
      updatedAt: createdAt,
      stockNumber: `STUB${String(i).padStart(3,'0')}`,
      vin: '',
    }
    // Generate varied pricing based on order configuration
    row.pricingJson = generatePricing(row, i)
    // Set buyerSegment and ensure buyerName matches
    row.buyerSegment = row.inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'
    row.buyerName = row.buyerSegment === 'Fleet' ? generateFleetBuyerName(i) : ''
    rows.push(row)
  }
  return rows
}

export async function advanceOrder(id, to) {
  ensureSeedData()
  const orders = readLocal(LS_ORDERS, [])
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) throw new Error('Not found')
  const order = orders[idx]
  if (!canTransition(order.status, to)) throw new Error('Illegal transition')
  const prev = order.status
  const now = new Date().toISOString()
  const updated = { 
    ...order, 
    status: to, 
    updatedAt: now,
    updatedBy: getCurrentUser()
  }
  
  // Track actual completion dates when stages are completed
  const oemInTransitIdx = ORDER_FLOW.indexOf('OEM_IN_TRANSIT')
  const upfitInProgressIdx = ORDER_FLOW.indexOf('UPFIT_IN_PROGRESS')
  const deliveredIdx = ORDER_FLOW.indexOf('DELIVERED')
  const toIdx = ORDER_FLOW.indexOf(to)
  
  if (toIdx >= oemInTransitIdx && !updated.actualOemCompleted) {
    updated.actualOemCompleted = now
  }
  if (toIdx >= upfitInProgressIdx && !updated.actualUpfitterCompleted) {
    updated.actualUpfitterCompleted = now
  }
  if (to === 'DELIVERED' && !updated.actualDeliveryCompleted) {
    updated.actualDeliveryCompleted = now
  }
  
  // Assign VIN once we hit OEM_ALLOCATED if not already present
  const allocIndex = ORDER_FLOW.indexOf('OEM_ALLOCATED')
  if (toIdx >= allocIndex && !updated.vin) {
    updated.vin = generateFordVin(updated)
  }
  orders[idx] = updated
  writeOrders(orders)
  const events = readLocal(LS_EVENTS, [])
  events.push({ id: `evt_${id}_${Date.now()}`, orderId: id, from: prev, to, at: now })
  writeLocal(LS_EVENTS, events)
  return { ok: true, status: to }
}

export async function cancelOrder(id) {
  return advanceOrder(id, 'CANCELED')
}

export async function updateEtas(id, payload) {
  ensureSeedData()
  const orders = readLocal(LS_ORDERS, [])
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) throw new Error('Not found')
  const order = orders[idx]
  const { oemEta, upfitterEta, deliveryEta, actualOemCompleted, actualUpfitterCompleted, actualDeliveryCompleted } = payload || {}
  const enforced = enforceEtaPolicy({ createdAt: order.createdAt, status: order.status, oemEta: oemEta ?? order.oemEta, upfitterEta: upfitterEta ?? order.upfitterEta, deliveryEta: deliveryEta ?? order.deliveryEta })
  const updated = {
    ...order,
    oemEta: enforced.oemEta ?? null,
    upfitterEta: enforced.upfitterEta ?? null,
    deliveryEta: enforced.deliveryEta ?? null,
    actualOemCompleted: actualOemCompleted !== undefined ? actualOemCompleted : order.actualOemCompleted,
    actualUpfitterCompleted: actualUpfitterCompleted !== undefined ? actualUpfitterCompleted : order.actualUpfitterCompleted,
    actualDeliveryCompleted: actualDeliveryCompleted !== undefined ? actualDeliveryCompleted : order.actualDeliveryCompleted,
    updatedAt: new Date().toISOString(),
    updatedBy: getCurrentUser(),
  }
  orders[idx] = updated
  writeOrders(orders)
  return { ok: true, order: updated }
}

export async function setStock(id, isStock) {
  ensureSeedData()
  const orders = readLocal(LS_ORDERS, [])
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) throw new Error('Not found')
  orders[idx] = { 
    ...orders[idx], 
    isStock: Boolean(isStock), 
    updatedAt: new Date().toISOString(),
    updatedBy: getCurrentUser()
  }
  writeOrders(orders)
  return { ok: true }
}

// New: set Inventory/Sales status for a unit. Allowed: 'STOCK' | 'SOLD'
export async function setInventoryStatus(id, status, buyerName = '') {
  const normalized = String(status || '').toUpperCase()
  if (normalized !== 'STOCK' && normalized !== 'SOLD') throw new Error('Invalid inventory status')
  ensureSeedData()
  const orders = readLocal(LS_ORDERS, [])
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) throw new Error('Not found')
  const current = orders[idx]
  const now = new Date().toISOString()
  const isStock = normalized === 'STOCK'
  // Enforce strict relationship: Stock = Dealer (no buyer), SOLD = Fleet (with buyer)
  const buyerSegment = isStock ? 'Dealer' : 'Fleet'
  const resolvedBuyer = isStock ? '' : (buyerName || current.buyerName || generateFleetBuyerName(idx + 11))
  orders[idx] = { 
    ...current, 
    inventoryStatus: normalized, 
    isStock, 
    buyerSegment,
    buyerName: resolvedBuyer, 
    updatedAt: now 
  }
  writeOrders(orders)
  return { ok: true, inventoryStatus: normalized, isStock, buyerSegment, buyerName: resolvedBuyer }
}

export async function publishListing(id) {
  // Backward-compatible: publish action sets both old listingStatus and new dealerWebsiteStatus
  ensureSeedData()
  const orders = readLocal(LS_ORDERS, [])
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) throw new Error('Not found')
  const order = orders[idx]
  orders[idx] = { ...order, listingStatus: 'PUBLISHED', dealerWebsiteStatus: 'PUBLISHED', updatedAt: new Date().toISOString() }
  writeOrders(orders)
  return { ok: true, channel: 'DEALER_WEBSITE' }
}

// New: set Dealer Website status explicitly; allowed: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED'
export async function setDealerWebsiteStatus(id, status) {
  const allowed = new Set(['DRAFT', 'PUBLISHED', 'UNPUBLISHED'])
  if (!allowed.has(status)) throw new Error('Invalid dealer website status')
  ensureSeedData()
  const orders = readLocal(LS_ORDERS, [])
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) throw new Error('Not found')
  const order = orders[idx]
  // Maintain backward-compat with listingStatus: mirror PUBLISHED, clear when UNPUBLISHED/DRAFT
  const next = {
    ...order,
    dealerWebsiteStatus: status,
    listingStatus: status === 'PUBLISHED' ? 'PUBLISHED' : null,
    updatedAt: new Date().toISOString(),
  }
  orders[idx] = next
  writeOrders(orders)
  return { ok: true, order: next }
}

// Delete one or many orders from local storage (demo-only)
export async function deleteOrders(ids) {
  ensureSeedData()
  const toDelete = Array.isArray(ids) ? ids : [ids]
  const idSet = new Set(toDelete)
  const orders = readLocal(LS_ORDERS, [])
  const remaining = orders.filter(o => !idSet.has(o.id))
  writeOrders(remaining)
  // Cleanup events and notes for those orders
  const events = readLocal(LS_EVENTS, [])
  writeLocal(LS_EVENTS, events.filter(e => !idSet.has(e.orderId)))
  const notes = readLocal(LS_NOTES, [])
  writeLocal(LS_NOTES, notes.filter(n => !idSet.has(n.orderId)))
  return { ok: true, deleted: orders.length - remaining.length }
}

export async function intakeOrder(payload) {
  try {
    ensureSeedData()
    const orders = readLocal(LS_ORDERS, [])
    const now = new Date().toISOString()
    const id = `ord_${Math.random().toString(36).slice(2, 8)}`
    // Stock orders = Dealer, Orders with buyers = Fleet
    const buyerSegment = payload.buyerSegment || (payload.isStock ? 'Dealer' : 'Fleet')
    // Ensure buyerName matches buyerSegment: Fleet = has buyer name, Dealer = blank
    const buyerName = buyerSegment === 'Fleet' ? (payload.buyerName || generateFleetBuyerName(orders.length + 7)) : ''
    const baseOrder = {
      id,
      dealerCode: payload.dealerCode || 'DEMO',
      upfitterId: payload.upfitterId ?? payload.build?.upfitter?.id ?? null,
      status: 'CONFIG_RECEIVED',
      oemEta: null,
      upfitterEta: null,
      deliveryEta: null,
      actualOemCompleted: null,
      actualUpfitterCompleted: null,
      actualDeliveryCompleted: null,
      createdBy: getCurrentUser(),
      updatedBy: getCurrentUser(),
      buyerSegment,
      priority: payload.priority || 'Normal',
      tags: payload.tags || [],
      buildJson: payload.build ?? null,
      pricingJson: payload.pricing ?? null,
      inventoryStatus: payload.isStock ? 'STOCK' : 'SOLD',
      isStock: Boolean(payload.isStock),
      buyerName,
      listingStatus: null,
      dealerWebsiteStatus: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    }
    const withKeys = {
      ...baseOrder,
      stockNumber: generateStockNumber(baseOrder),
      vin: '',
    }
    orders.unshift(withKeys)
    writeOrders(orders)
    const events = readLocal(LS_EVENTS, [])
    events.push({ id: `evt_${id}`, orderId: id, from: '', to: 'CONFIG_RECEIVED', at: now })
    writeLocal(LS_EVENTS, events)
    return { id }
  } catch (error) {
    console.error('intakeOrder failed:', error)
    throw new Error(error?.message || 'Failed to save order. Please try again.')
  }
}

export async function addNote(orderId, text, user = 'Demo User') {
  ensureSeedData()
  const notes = readLocal(LS_NOTES, [])
  const note = { id: `note_${orderId}_${Date.now()}`, orderId, text, user, at: new Date().toISOString() }
  notes.push(note)
  writeLocal(LS_NOTES, notes)
  return { ok: true, note }
}

export async function getNotes(orderId) {
  ensureSeedData()
  const notes = readLocal(LS_NOTES, [])
  return notes.filter(n => n.orderId === orderId)
}

