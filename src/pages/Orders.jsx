import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { createPortal } from 'react-dom'
import { getOrders, getStatusLabel, publishListing, deleteOrders, setDealerWebsiteStatus, reseedDemoData, generateFleetBuyerName } from '@/lib/orderApi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OrderDashboards } from './OrderDashboards'
import { toast } from 'sonner'

export function OrdersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [stockOnly, setStockOnly] = useState(false)
  const [dealer, setDealer] = useState('')
  const [upfitter, setUpfitter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [needsAttention, setNeedsAttention] = useState(false)

  // Get active tab from URL parameter, default to 'dashboards'
  const searchParams = new URLSearchParams(location.search)
  const tabParam = searchParams.get('tab')
  const activeTab = (tabParam === 'orders' || tabParam === 'dashboards') ? tabParam : 'dashboards'
  
  // Handle tab change - update URL without navigation
  const handleTabChange = (value) => {
    const params = new URLSearchParams(location.search)
    params.set('tab', value)
    navigate(`${location.pathname}?${params.toString()}`, { replace: true })
  }

  // Local last-resort fallback dataset so the UI always has rows
  const buildLocalFallback = () => {
    const now = Date.now()
    const DAY = 86400000
    const mkDate = (d) => new Date(now + d * DAY).toISOString()
    const seriesArr = ['E-350','E-450','Transit','E-Transit','F-350','F-450','F-550','F-600','F-650','F-750']
    const orderFlow = ['CONFIG_RECEIVED','OEM_ALLOCATED','OEM_PRODUCTION','OEM_IN_TRANSIT','AT_UPFITTER','UPFIT_IN_PROGRESS','READY_FOR_DELIVERY','DELIVERED']
    const bodyMatrix = {
      'Service Body': ['Knapheide','Royal Truck Body','Duramag','Reading Truck'],
      'Flatbed': ["Rugby Manufacturing","PJ's Truck Bodies",'Duramag','SH Truck Bodies'],
      'Dump Body': ['Rugby Manufacturing','Godwin Group','Brandon Manufacturing','Downeaster'],
      'Dry Freight Body': ['Morgan Truck Body','Rockport','Reading Truck','Wabash'],
      'Refrigerated Body': ['Morgan Truck Body','Rockport','Great Dane Johnson','Wabash'],
      'Tow & Recovery': ['Jerr-Dan','Miller Industries','Dynamic Towing','Chevron'],
      'Ambulance': ['Wheeled Coach','Braun Industries','Horton Emergency Vehicles','AEV'],
      'Bucket': ['Altec','Versalift','Terex Utilities','Dur-A-Lift'],
      'Contractor Body': ['Knapheide','Royal Truck Body','Scelzi','Duramag'],
      'Box w/ Lift Gate': ['Morgan Truck Body','Wabash','Rockport','Complete Truck Bodies']
    }
    const bodyTypes = Object.keys(bodyMatrix)
    const upfitters = [
      { id: 'knapheide-detroit', name: 'Knapheide Detroit' },
      { id: 'reading-chicago', name: 'Reading Truck Body - Chicago' },
      { id: 'jerr-dan-atlanta', name: 'Jerr-Dan Towing - Atlanta' },
      { id: 'altec-dallas', name: 'Altec Industries - Dallas' },
      { id: 'morgan-phoenix', name: 'Morgan Truck Body - Phoenix' },
      { id: 'rugby-denver', name: 'Rugby Manufacturing - Denver' },
      { id: 'rockport-columbus', name: 'Rockport - Columbus' }
    ]
    const wheelbaseBySeries = {
      'E-350': ['138','158','176'],
      'E-450': ['158','176'],
      'Transit': ['148'],
      'E-Transit': ['148'],
      'F-350': ['145','164','176'],
      'F-450': ['164','176','192'],
      'F-550': ['169','176','192'],
      'F-600': ['169','176','192'],
      'F-650': ['158','176','190','218'],
      'F-750': ['176','190','218','254']
    }
    const gvwrBySeries = { 'E-350':'12050','E-450':'14500','Transit':'10360','E-Transit':'10360','F-350':'14000','F-450':'16500','F-550':'19500','F-600':'22000','F-650':'26000','F-750':'37000' }

    const rows = []
    for (let i = 0; i < 48; i++) {
      const status = orderFlow[i % orderFlow.length]
      const dealerCode = `CVC${String(101 + (i % 20))}`
      const series = seriesArr[i % seriesArr.length]
      const wbList = wheelbaseBySeries[series] || ['169']
      const wheelbase = wbList[i % wbList.length]
      const drivetrain = series.startsWith('E') || series.includes('Transit') ? 'RWD' : (i % 2 ? '4x2' : '4x4')
      const powertrain = series.includes('Transit') || series === 'E-Transit' ? (series === 'E-Transit' ? 'ev-68kwh' : 'gas-3.5L') : (i % 2 ? 'gas-7.3L' : 'diesel-6.7L')
      const bodyType = bodyTypes[i % bodyTypes.length]
      const manufacturer = bodyMatrix[bodyType][i % bodyMatrix[bodyType].length]
      const up = upfitters[i % upfitters.length]

      const createdAt = mkDate(-(10 + i))
      // Base ETAs
      let oemEta = mkDate(10 + (i % 12))
      let upfitterEta = mkDate(20 + (i % 12))
      let deliveryEta = mkDate(35 + (i % 12))
      // Variety for delivery status
      if (i % 9 === 2) deliveryEta = mkDate(3 + (i % 3)) // near term -> ON_TIME
      if (i % 11 === 0 && status !== 'DELIVERED') deliveryEta = mkDate(-(i % 5 + 1)) // overdue
      if (status === 'DELIVERED') deliveryEta = mkDate(-(7 + (i % 10)))

      const inventoryStatus = (i % 2 === 0 ? 'STOCK' : 'SOLD')
      const buyerName = inventoryStatus === 'SOLD' ? generateFleetBuyerName(i) : ''
      const dealerWebsiteStatus = ((i % 10) === 0 ? 'PUBLISHED' : (i % 10) === 1 ? 'UNPUBLISHED' : 'DRAFT')

      rows.push({
        id: `ORD-LF-${(now + i).toString(36).toUpperCase()}`,
        dealerCode,
        upfitterId: up.id,
        status,
        oemEta,
        upfitterEta,
        deliveryEta,
        buildJson: {
          bodyType,
          manufacturer,
          chassis: { series, cab: (i % 3 === 0 ? 'Regular Cab' : i % 3 === 1 ? 'SuperCab' : 'Crew Cab'), drivetrain, wheelbase, gvwr: gvwrBySeries[series] || '', powertrain },
          bodySpecs: { length: [10,12,14,16,18,20][i % 6], material: i % 2 ? 'Steel' : 'Aluminum' },
          upfitter: { id: up.id, name: up.name },
        },
        pricingJson: { chassisMsrp: 60000 + (i % 6) * 1500, bodyPrice: 18000 + (i % 5) * 1200, optionsPrice: (i % 4) * 750, labor: 3000 + (i % 3) * 400, freight: 1500, incentives: [], taxes: 0, total: 90000 + (i % 20) * 500 },
        inventoryStatus,
        isStock: inventoryStatus === 'STOCK',
        buyerName,
        listingStatus: null,
        dealerWebsiteStatus,
        createdAt,
        updatedAt: createdAt,
        stockNumber: `STUB${String(i).padStart(3,'0')}`,
        vin: status === 'CONFIG_RECEIVED' ? '' : `VIN${String(100000 + i)}`,
      })
    }
    return rows
  }

  // Immediately show a small in-memory dataset so the table is never empty while real data loads
  useEffect(() => {
    setOrders(curr => (Array.isArray(curr) && curr.length > 0) ? curr : buildLocalFallback())
  }, [])

  // Column filter state
  const [openFilter, setOpenFilter] = useState('')
  const initialColumnFilters = {
    id: new Set(),
    stockNumber: new Set(),
    status: new Set(),
    vin: new Set(),
    buyer: new Set(),
    upfitter: new Set(),
    oemEta: { from: '', to: '' },
    upfitterEta: { from: '', to: '' },
    deliveryEta: { from: '', to: '' },
    createdAt: { from: '', to: '' },
    inventoryStatus: new Set(),
    deliveryStatus: new Set(),
    listingStatus: new Set(),
    bodyType: new Set(),
    manufacturer: new Set(),
    series: new Set(),
    cab: new Set(),
    drivetrain: new Set(),
    wheelbase: new Set(),
    gvwr: new Set(),
    powertrain: new Set(),
    bodyLength: new Set(),
    bodyMaterial: new Set(),
    chassisMsrp: { min: '', max: '' },
    bodyPrice: { min: '', max: '' },
    optionsPrice: { min: '', max: '' },
    labor: { min: '', max: '' },
    freight: { min: '', max: '' },
    total: { min: '', max: '' },
  }
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters)
  const hasAnyFilters = useMemo(() => {
    const f = columnFilters
    const hasSet = (s) => s && s.size > 0
    const hasRange = (r) => Boolean(r && (r.from || r.to))
    const hasNumRange = (r) => Boolean(r && (r.min !== '' || r.max !== ''))
    return (
      hasSet(f.id) || hasSet(f.stockNumber) || hasSet(f.status) || hasSet(f.vin) || hasSet(f.buyer) || hasSet(f.upfitter) ||
      hasRange(f.oemEta) || hasRange(f.upfitterEta) || hasRange(f.deliveryEta) || hasRange(f.createdAt) ||
      hasSet(f.inventoryStatus) || hasSet(f.deliveryStatus) || hasSet(f.listingStatus) || hasSet(f.bodyType) || hasSet(f.manufacturer) ||
      hasSet(f.series) || hasSet(f.cab) || hasSet(f.drivetrain) || hasSet(f.wheelbase) || hasSet(f.gvwr) ||
      hasSet(f.powertrain) || hasSet(f.bodyLength) || hasSet(f.bodyMaterial) ||
      hasNumRange(f.chassisMsrp) || hasNumRange(f.bodyPrice) || hasNumRange(f.optionsPrice) ||
      hasNumRange(f.labor) || hasNumRange(f.freight) || hasNumRange(f.total)
    )
  }, [columnFilters])
  const clearAllColumnFilters = () => {
    setColumnFilters(initialColumnFilters)
    setOpenFilter('')
  }

  // Global search over all displayed columns
  const [globalQ, setGlobalQ] = useState('')
  const [debouncedGlobalQ, setDebouncedGlobalQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobalQ(globalQ), 250)
    return () => clearTimeout(t)
  }, [globalQ])

  // Helper: determine if an order is overdue based on the nearest available ETA
  const isOverdue = (o) => {
    const eta = o.deliveryEta || o.upfitterEta || o.oemEta
    return eta && new Date(eta) < new Date() && o.status !== 'DELIVERED' && o.status !== 'CANCELED'
  }

  // Load options baseline once for dropdowns; if empty, proactively reseed
  useEffect(() => {
    const init = async () => {
      let data = await getOrders({})
      let base = Array.isArray(data?.orders) ? data.orders : []
      if (base.length === 0) {
        try { reseedDemoData(154) } catch {}
        data = await getOrders({})
        base = Array.isArray(data?.orders) ? data.orders : []
        if (base.length === 0) base = buildLocalFallback()
      }
      setAllOrders(base)
      if (!orders?.length) setOrders(base)
    }
    init()
  }, [])

  // Debounce search text for better UX
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 250)
    return () => clearTimeout(handle)
  }, [q])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = { status, q: debouncedQ, dealerCode: dealer, upfitterId: upfitter, from, to }
        if (stockOnly) params.stock = true
        let data = await getOrders(params)
        let list = data?.orders || []
        // If nothing came back, force a reseed once and retry
        if (!Array.isArray(list) || list.length === 0) {
          try { reseedDemoData(154) } catch {}
          data = await getOrders(params)
          list = data?.orders || []
          if (!Array.isArray(list) || list.length === 0) {
            list = buildLocalFallback()
          }
        }
        if (needsAttention) list = list.filter(isOverdue)
        setOrders(list)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [status, debouncedQ, stockOnly, dealer, upfitter, from, to, needsAttention])

  // Options for per-column filters
  const idOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.id))).sort().map(v => ({ value: v, label: String(v) }))
  }, [orders, allOrders])
  const stockNumberOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.stockNumber).filter(Boolean))).sort().map(v => ({ value: v, label: String(v) }))
  }, [orders, allOrders])
  const vinOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.vin).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])
  const statusOptions = useMemo(() => {
    const orderFlow = [
      'CONFIG_RECEIVED',
      'OEM_ALLOCATED',
      'OEM_PRODUCTION',
      'OEM_IN_TRANSIT',
      'AT_UPFITTER',
      'UPFIT_IN_PROGRESS',
      'READY_FOR_DELIVERY',
      'DELIVERED',
      'CANCELED',
    ]
    const base = orders.length ? orders : allOrders
    const present = new Set((base || []).map(o => o.status).filter(Boolean))
    const inOrder = orderFlow.filter(s => present.has(s))
    const others = Array.from(present).filter(s => !orderFlow.includes(s)).sort()
    return [...inOrder, ...others].map(code => ({ value: code, label: getStatusLabel(code) }))
  }, [orders, allOrders])
  const buyerOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => (o.inventoryStatus === 'SOLD' ? (o.buyerName || '') : '')).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])
  const upfitterOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.upfitter?.name).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])
  // Computed Sales Status options (derived per-order from delivery dates vs today)
  const salesStatusOptions = useMemo(() => ([
    { value: 'STOCK', label: 'Stock' },
    { value: 'PO_RECEIVED', label: 'PO Received' },
    { value: 'INVOICED', label: 'Invoiced' },
    { value: 'PAYMENT_RECEIVED', label: 'Payment Received' },
  ]), [])
  const dealerWebsiteOptions = useMemo(() => ([
    { value: 'PUBLISHED', label: 'Published' },
    { value: 'UNPUBLISHED', label: 'Unpublished' },
    { value: 'DRAFT', label: 'Draft' },
  ]), [])

  // Delivery Status filter options
  const deliveryStatusOptions = useMemo(() => ([
    { value: 'AHEAD', label: 'Ahead of Schedule' },
    { value: 'ON_TIME', label: 'On Time' },
    { value: 'DELAYED', label: 'Delayed' },
    { value: 'DELIVERED', label: 'Delivered' },
  ]), [])

  // Extra column options
  const bodyTypeOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.bodyType).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])
  const manufacturerOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.manufacturer).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])
  const seriesOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.chassis?.series).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])
  const cabOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.chassis?.cab).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])
  const drivetrainOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.chassis?.drivetrain).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])
  const wheelbaseOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.chassis?.wheelbase).filter(Boolean))).sort().map(v => ({ value: v, label: String(v) }))
  }, [orders, allOrders])
  const gvwrOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.chassis?.gvwr).filter(Boolean))).sort().map(v => ({ value: v, label: String(v) }))
  }, [orders, allOrders])
  const powertrainOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.chassis?.powertrain).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])
  const bodyLengthOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.bodySpecs?.length).filter(v => v != null))).sort((a,b)=>Number(a)-Number(b)).map(v => ({ value: String(v), label: String(v) }))
  }, [orders, allOrders])
  const bodyMaterialOptions = useMemo(() => {
    const base = orders.length ? orders : allOrders
    return Array.from(new Set((base || []).map(o => o.buildJson?.bodySpecs?.material).filter(Boolean))).sort().map(v => ({ value: v, label: v }))
  }, [orders, allOrders])

  // Filtering helpers
  const isInDateRange = (dateStr, range) => {
    if (!range?.from && !range?.to) return true
    if (!dateStr) return false
    const d = new Date(dateStr)
    if (range.from && d < new Date(range.from)) return false
    if (range.to && d > new Date(`${range.to}T23:59:59`)) return false
    return true
  }
  const isInNumberRange = (num, range) => {
    const n = Number(num)
    const hasMin = range?.min !== '' && range?.min != null
    const hasMax = range?.max !== '' && range?.max != null
    if (!hasMin && !hasMax) return true
    if (Number.isNaN(n)) return false
    if (hasMin && n < Number(range.min)) return false
    if (hasMax && n > Number(range.max)) return false
    return true
  }

  // Compute Sales Status from inventory state and delivery dates relative to today
  const getSalesStatus = (o) => {
    const now = new Date()
    const delivery = o?.deliveryEta ? new Date(o.deliveryEta) : null
    // If not sold, it's still stock
    if (o?.inventoryStatus !== 'SOLD') return 'STOCK'
    // Sold but not yet delivered
    if (!delivery || now < delivery) return 'PO_RECEIVED'
    // Delivered: within 7 days = invoiced, after that = payment received
    const daysSince = Math.floor((now - delivery) / 86400000)
    if (daysSince < 7) return 'INVOICED'
    return 'PAYMENT_RECEIVED'
  }

  const salesStatusLabel = {
    STOCK: 'Stock',
    PO_RECEIVED: 'PO Received',
    INVOICED: 'Invoiced',
    PAYMENT_RECEIVED: 'Payment Received',
  }

  // Compute Delivery Status from the nearest ETA vs today
  const getDeliveryStatus = (o) => {
    if (o?.status === 'DELIVERED') return 'DELIVERED'
    const etaStr = o?.deliveryEta || o?.upfitterEta || o?.oemEta
    if (!etaStr) return 'ON_TIME'
    const now = new Date()
    const eta = new Date(etaStr)
    if (now > eta) return 'DELAYED'
    const daysUntil = Math.ceil((eta - now) / 86400000)
    if (daysUntil > 7) return 'AHEAD'
    return 'ON_TIME'
  }
  const getDeliveryStatusLabel = (o) => {
    const code = getDeliveryStatus(o)
    if (code === 'DELAYED') {
      const etaStr = o?.deliveryEta || o?.upfitterEta || o?.oemEta
      const now = new Date()
      const eta = etaStr ? new Date(etaStr) : now
      const daysLate = Math.max(1, Math.ceil((now - eta) / 86400000))
      return `Delayed (${daysLate} days)`
    }
    const map = { AHEAD: 'Ahead of Schedule', ON_TIME: 'On Time', DELIVERED: 'Delivered' }
    return map[code] || code
  }

  const filteredOrders = useMemo(() => {
    let list = orders
    const f = columnFilters
    if (f.id?.size) list = list.filter(o => f.id.has(o.id))
    if (f.stockNumber?.size) list = list.filter(o => f.stockNumber.has(o.stockNumber))
    if (f.status?.size) list = list.filter(o => f.status.has(o.status))
    if (f.vin?.size) list = list.filter(o => f.vin.has(o.vin))
    if (f.buyer?.size) list = list.filter(o => f.buyer.has(o.inventoryStatus === 'SOLD' ? (o.buyerName || '') : ''))
    if (f.upfitter?.size) list = list.filter(o => f.upfitter.has(o.buildJson?.upfitter?.name))
    list = list.filter(o => isInDateRange(o.oemEta, f.oemEta))
    list = list.filter(o => isInDateRange(o.upfitterEta, f.upfitterEta))
    list = list.filter(o => isInDateRange(o.deliveryEta, f.deliveryEta))
    list = list.filter(o => isInDateRange(o.createdAt, f.createdAt))
    if (f.inventoryStatus?.size) list = list.filter(o => f.inventoryStatus.has(getSalesStatus(o)))
    if (f.deliveryStatus?.size) list = list.filter(o => f.deliveryStatus.has(getDeliveryStatus(o)))
    if (f.listingStatus?.size) {
      list = list.filter(o => {
        const s = o.dealerWebsiteStatus ?? (o.listingStatus === 'PUBLISHED' ? 'PUBLISHED' : 'UNPUBLISHED')
        return f.listingStatus.has(s)
      })
    }
    if (f.bodyType?.size) list = list.filter(o => f.bodyType.has(o.buildJson?.bodyType))
    if (f.manufacturer?.size) list = list.filter(o => f.manufacturer.has(o.buildJson?.manufacturer))
    if (f.series?.size) list = list.filter(o => f.series.has(o.buildJson?.chassis?.series))
    if (f.cab?.size) list = list.filter(o => f.cab.has(o.buildJson?.chassis?.cab))
    if (f.drivetrain?.size) list = list.filter(o => f.drivetrain.has(o.buildJson?.chassis?.drivetrain))
    if (f.wheelbase?.size) list = list.filter(o => f.wheelbase.has(o.buildJson?.chassis?.wheelbase))
    if (f.gvwr?.size) list = list.filter(o => f.gvwr.has(o.buildJson?.chassis?.gvwr))
    if (f.powertrain?.size) list = list.filter(o => f.powertrain.has(o.buildJson?.chassis?.powertrain))
    if (f.bodyLength?.size) list = list.filter(o => f.bodyLength.has(String(o.buildJson?.bodySpecs?.length)))
    if (f.bodyMaterial?.size) list = list.filter(o => f.bodyMaterial.has(o.buildJson?.bodySpecs?.material))
    list = list.filter(o => isInNumberRange(o.pricingJson?.chassisMsrp, f.chassisMsrp))
    list = list.filter(o => isInNumberRange(o.pricingJson?.bodyPrice, f.bodyPrice))
    list = list.filter(o => isInNumberRange(o.pricingJson?.optionsPrice, f.optionsPrice))
    list = list.filter(o => isInNumberRange(o.pricingJson?.labor, f.labor))
    list = list.filter(o => isInNumberRange(o.pricingJson?.freight, f.freight))
    list = list.filter(o => isInNumberRange(o.pricingJson?.total, f.total))
    return list
  }, [orders, columnFilters])

  const formatDate = (s) => (s ? new Date(s).toLocaleDateString() : '')
  const searchableText = (o) => [
    o.id,
    o.stockNumber,
    o.status,
    getStatusLabel(o.status),
    o.vin,
    (o.inventoryStatus === 'SOLD' ? (o.buyerName || '') : ''),
    o.buildJson?.upfitter?.name,
    o.buildJson?.bodyType,
    o.buildJson?.manufacturer,
    o.buildJson?.chassis?.series,
    o.buildJson?.chassis?.cab,
    o.buildJson?.chassis?.drivetrain,
    o.buildJson?.chassis?.wheelbase,
    o.buildJson?.chassis?.gvwr,
    o.buildJson?.chassis?.powertrain,
    o.buildJson?.bodySpecs?.length,
    o.buildJson?.bodySpecs?.material,
    o.pricingJson?.chassisMsrp,
    o.pricingJson?.bodyPrice,
    o.pricingJson?.optionsPrice,
    o.pricingJson?.labor,
    o.pricingJson?.freight,
    o.pricingJson?.total,
    formatDate(o.oemEta), o.oemEta,
    formatDate(o.upfitterEta), o.upfitterEta,
    formatDate(o.deliveryEta), o.deliveryEta,
    formatDate(o.createdAt), o.createdAt,
    salesStatusLabel[getSalesStatus(o)],
    getDeliveryStatusLabel(o),
    (o.dealerWebsiteStatus === 'PUBLISHED' || o.listingStatus === 'PUBLISHED') ? 'Published' : (o.dealerWebsiteStatus === 'DRAFT' ? 'Draft' : 'Unpublished')
  ].filter(Boolean).join(' ').toLowerCase()

  const searchedOrders = useMemo(() => {
    if (!debouncedGlobalQ) return filteredOrders
    const q = debouncedGlobalQ.toLowerCase()
    return filteredOrders.filter(o => searchableText(o).includes(q))
  }, [filteredOrders, debouncedGlobalQ])

  // Pagination + view rows selector
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const totalPages = Math.max(1, Math.ceil((searchedOrders?.length || 0) / pageSize))
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return searchedOrders.slice(start, start + pageSize)
  }, [searchedOrders, page, pageSize])
  const fillerCount = Math.max(0, pageSize - (paginated?.length || 0))
  // Fixed table viewport equal to 10 rows. If pageSize > 10, enable vertical scrolling to keep height.
  const HEADER_HEIGHT_PX = 44
  const ROW_HEIGHT_PX = 48
  const VISIBLE_ROWS = 10
  // Slight reduction to avoid showing a sliver of the 11th row on some browsers
  const VIEWPORT_TWEAK_PX = 8
  const tableMaxHeight = HEADER_HEIGHT_PX + VISIBLE_ROWS * ROW_HEIGHT_PX - VIEWPORT_TWEAK_PX

  // Selection state for bulk delete
  const [selectedIds, setSelectedIds] = useState(new Set())
  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAllPage = () => {
    const allSelected = paginated.every(o => selectedIds.has(o.id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) paginated.forEach(o => next.delete(o.id))
      else paginated.forEach(o => next.add(o.id))
      return next
    })
  }
  const onDeleteSelected = async () => {
    if (selectedIds.size === 0 || deleting) return
    setDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      await deleteOrders(ids)
      setOrders(curr => curr.filter(o => !selectedIds.has(o.id)))
      setSelectedIds(new Set())
    } finally {
      setDeleting(false)
    }
  }

  const cycleDealerWebsiteStatus = (current) => {
    const order = ['DRAFT', 'PUBLISHED', 'UNPUBLISHED']
    const idx = order.indexOf(current || 'DRAFT')
    return order[(idx + 1) % order.length]
  }
  const onCycleDealerWebsite = async (id, current) => {
    const next = cycleDealerWebsiteStatus(current)
    try {
      setPublishing(id)
      await setDealerWebsiteStatus(id, next)
      setOrders((prev) => prev.map(o => o.id === id ? { ...o, dealerWebsiteStatus: next, listingStatus: next === 'PUBLISHED' ? 'PUBLISHED' : null } : o))
    } finally {
      setPublishing('')
    }
  }

  const etaText = (dateStr) => {
    if (!dateStr) return <span>-</span>
    const date = new Date(dateStr)
    return <span>{date.toLocaleDateString()}</span>
  }

  const textOrDash = (value) => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'string') {
      const t = value.trim()
      return t === '' ? '-' : t
    }
    return String(value)
  }

  const statusPill = (status) => {
    const map = {
      CONFIG_RECEIVED: 'bg-gray-200 text-gray-900',
      OEM_ALLOCATED: 'bg-blue-100 text-blue-800',
      OEM_PRODUCTION: 'bg-indigo-100 text-indigo-800',
      OEM_IN_TRANSIT: 'bg-sky-100 text-sky-800',
      AT_UPFITTER: 'bg-amber-100 text-amber-800',
      UPFIT_IN_PROGRESS: 'bg-orange-100 text-orange-800',
      READY_FOR_DELIVERY: 'bg-green-100 text-green-800',
      DELIVERED: 'bg-emerald-100 text-emerald-800',
      CANCELED: 'bg-red-100 text-red-800',
    }
    const cls = map[status] || 'bg-gray-200 text-gray-900'
    return <span className={`inline-block text-xs px-2 py-1 rounded-full ${cls}`}>{getStatusLabel(status)}</span>
  }

  // Column configuration with persistence, drag-reorder, and resize
  const useLocalStorage = (key, initialValue) => {
    const [val, setVal] = useState(() => {
      try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : initialValue
      } catch {
        return initialValue
      }
    })
    useEffect(() => {
      try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
    }, [key, val])
    return [val, setVal]
  }

  const defaultColumns = [
    { id: 'select', label: '', width: 44, visible: true, fixed: true, pin: 'left' },
    // Default visible order
    { id: 'id', label: 'Order ID', width: 160, visible: true, pin: 'none' },
    { id: 'stockNumber', label: 'Stock #', width: 120, visible: true, pin: 'none' },
    { id: 'status', label: 'Order Status', width: 140, visible: true, pin: 'none' },
    { id: 'series', label: 'Model', width: 140, visible: true, pin: 'none' },
    { id: 'bodyType', label: 'Body Type', width: 160, visible: true, pin: 'none' },
    { id: 'upfitter', label: 'Upfitter', width: 280, visible: true, pin: 'none' },
    { id: 'oemEta', label: 'Chassis ETA', width: 120, visible: true, pin: 'none' },
    { id: 'upfitterEta', label: 'Upfit ETA', width: 120, visible: true, pin: 'none' },
    { id: 'deliveryEta', label: 'Final ETA', width: 120, visible: true, pin: 'none' },
    { id: 'deliveryStatus', label: 'Delivery Status', width: 160, visible: true, pin: 'none' },
    { id: 'inventoryStatus', label: 'Sales Status', width: 100, visible: true, pin: 'none' },
    { id: 'total', label: 'Total Price', width: 140, visible: true, pin: 'none' },
    // New enhanced fields
    { id: 'buyerSegment', label: 'Buyer Segment', width: 120, visible: true, pin: 'none' },
    { id: 'priority', label: 'Priority', width: 100, visible: true, pin: 'none' },
    { id: 'tags', label: 'Tags', width: 150, visible: false, pin: 'none' },
    { id: 'actualOemCompleted', label: 'Actual OEM', width: 120, visible: false, pin: 'none' },
    { id: 'actualUpfitterCompleted', label: 'Actual Upfit', width: 120, visible: false, pin: 'none' },
    { id: 'actualDeliveryCompleted', label: 'Actual Delivery', width: 120, visible: false, pin: 'none' },
    { id: 'createdBy', label: 'Created By', width: 140, visible: false, pin: 'none' },
    { id: 'updatedBy', label: 'Updated By', width: 140, visible: false, pin: 'none' },
    // Additional columns available but hidden by default
    { id: 'vin', label: 'VIN', width: 180, visible: false, pin: 'none' },
    { id: 'buyer', label: 'Buyer', width: 200, visible: false, pin: 'none' },
    { id: 'createdAt', label: 'Created', width: 120, visible: false, pin: 'none' },
    { id: 'dealerWebsite', label: 'Dealer Website', width: 140, visible: false, pin: 'none' },
    // Extra configurator/pricing fields (hidden by default)
    { id: 'manufacturer', label: 'Body Mfg', width: 160, visible: false, pin: 'none' },
    { id: 'cab', label: 'Cab', width: 120, visible: false, pin: 'none' },
    { id: 'drivetrain', label: 'Drivetrain', width: 120, visible: false, pin: 'none' },
    { id: 'wheelbase', label: 'Wheelbase', width: 120, visible: false, pin: 'none' },
    { id: 'gvwr', label: 'GVWR', width: 100, visible: false, pin: 'none' },
    { id: 'powertrain', label: 'Powertrain', width: 120, visible: false, pin: 'none' },
    { id: 'bodyLength', label: 'Body Length', width: 120, visible: false, pin: 'none' },
    { id: 'bodyMaterial', label: 'Body Material', width: 140, visible: false, pin: 'none' },
    { id: 'chassisMsrp', label: 'Chassis MSRP', width: 140, visible: false, pin: 'none' },
    { id: 'bodyPrice', label: 'Body Price', width: 120, visible: false, pin: 'none' },
    { id: 'optionsPrice', label: 'Options Price', width: 130, visible: false, pin: 'none' },
    { id: 'labor', label: 'Labor', width: 100, visible: false, pin: 'none' },
    { id: 'freight', label: 'Freight', width: 100, visible: false, pin: 'none' },
  ]

  const [columns, setColumns] = useLocalStorage('orders_table_columns', defaultColumns)
  // Migrate any persisted 'dealer' column to the new 'buyer' column and 'publish' -> 'dealerWebsite'
  useEffect(() => {
    setColumns(prev => {
      if (!Array.isArray(prev)) return prev
      let changed = false
      // Ensure labels are synced to defaults for known ids
      const labelMap = Object.fromEntries((defaultColumns || []).map(c => [c.id, c.label]))
      let next = prev.map(c => {
        if (c.id === 'dealer') { changed = true; return { ...c, id: 'buyer', label: 'Buyer', width: 200, visible: true } }
        return c
      })
      next = next.map(c => {
        if (c.id === 'publish') { changed = true; return { ...c, id: 'dealerWebsite', label: 'Dealer Website', width: 140, visible: c.visible !== false, pin: c.pin || 'none' } }
        return c
      })
      // Update label for Sales Status and any other known ids if label differs
      next = next.map(c => {
        const desired = labelMap[c.id]
        if (desired && c.label !== desired) { changed = true; return { ...c, label: desired } }
        return c
      })
      // Inject new columns (Stock # and VIN) for users with older saved layouts
      if (!next.some(c => c.id === 'stockNumber')) {
        changed = true
        const stockCol = { id: 'stockNumber', label: 'Stock #', width: 120, visible: true, pin: 'none' }
        const idx = next.findIndex(c => c.id === 'id')
        if (idx >= 0) next = [...next.slice(0, idx + 1), stockCol, ...next.slice(idx + 1)]
        else next = [...next, stockCol]
      }
      if (!next.some(c => c.id === 'vin')) {
        changed = true
        const vinCol = { id: 'vin', label: 'VIN', width: 180, visible: true, pin: 'none' }
        const idx = next.findIndex(c => c.id === 'status')
        if (idx >= 0) next = [...next.slice(0, idx + 1), vinCol, ...next.slice(idx + 1)]
        else next = [...next, vinCol]
      }
      return changed ? next : prev
    })
  }, [setColumns])
  const visibleColumns = useMemo(() => {
    const pinOrder = { left: 0, none: 1, right: 2 }
    return columns.filter(c => c.visible).sort((a, b) => pinOrder[a.pin || 'none'] - pinOrder[b.pin || 'none'])
  }, [columns])
  const totalWidth = useMemo(() => {
    return (visibleColumns || []).reduce((sum, c) => sum + (Number(c.width) || 0), 0)
  }, [visibleColumns])

  // Reorder via drag and drop
  const [dragCol, setDragCol] = useState('')
  const onHeaderDragStart = (id) => setDragCol(id)
  const onHeaderDrop = (targetId) => {
    if (!dragCol || dragCol === targetId) return
    const a = columns.findIndex(c => c.id === dragCol)
    const b = columns.findIndex(c => c.id === targetId)
    if (a === -1 || b === -1) return
    if (columns[a]?.fixed || columns[b]?.fixed) { setDragCol(''); return }
    const next = [...columns]
    const [moved] = next.splice(a, 1)
    next.splice(b, 0, moved)
    setColumns(next)
    setDragCol('')
  }

  // Resize via mouse drag
  const [resizing, setResizing] = useState({ id: '', startX: 0, startWidth: 0 })
  useEffect(() => {
    const onMove = (e) => {
      if (!resizing.id) return
      const dx = e.clientX - resizing.startX
      setColumns(prev => prev.map(c => c.id === resizing.id ? { ...c, width: Math.max(80, resizing.startWidth + dx) } : c))
    }
    const onUp = () => setResizing({ id: '', startX: 0, startWidth: 0 })
    if (resizing.id) {
      // Improve UX during resize
      try {
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      } catch {}
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp, { once: true })
    }
    return () => {
      window.removeEventListener('mousemove', onMove)
      try {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      } catch {}
    }
  }, [resizing, setColumns])

  const [customizeOpen, setCustomizeOpen] = useState(false)
  const toggleColumnVisibility = (id) => setColumns(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c))
  const resetColumns = () => setColumns(defaultColumns)
  const setPin = (id, pin) => setColumns(prev => prev.map(c => c.id === id ? { ...c, pin } : c))
  const [panelDrag, setPanelDrag] = useState({ from: -1 })
  const [columnQ, setColumnQ] = useState('')
  const showAll = () => setColumns(prev => prev.map(c => c.id === 'select' ? c : { ...c, visible: true }))
  const hideAll = () => setColumns(prev => prev.map(c => c.id === 'select' ? c : { ...c, visible: false }))

  const customizeBtnRef = useRef(null)

  // Dual-list dialog state
  const [draftColumns, setDraftColumns] = useState([])
  const [snapshotColumns, setSnapshotColumns] = useState([])
  const [applyInstantly, setApplyInstantly] = useState(() => {
    try { const v = localStorage.getItem('orders_columns_live_apply'); return v ? JSON.parse(v) : true } catch { return true }
  })
  useEffect(() => { try { localStorage.setItem('orders_columns_live_apply', JSON.stringify(applyInstantly)) } catch {} }, [applyInstantly])

  useEffect(() => {
    if (!customizeOpen) return
    setSnapshotColumns(columns.map(c => ({ ...c })))
    setDraftColumns(columns.map(c => ({ ...c })))
  }, [customizeOpen])

  useEffect(() => {
    if (!customizeOpen) return
    if (applyInstantly) setColumns(draftColumns)
  }, [draftColumns, applyInstantly, customizeOpen])

  const applyFromDraft = () => setColumns(draftColumns)
  const cancelDraft = () => { if (!applyInstantly) setColumns(snapshotColumns); setCustomizeOpen(false) }
  const resetDraftToDefault = () => setDraftColumns(defaultColumns.map(c => ({ ...c })))

  const [availQ, setAvailQ] = useState('')
  const [selQ, setSelQ] = useState('')
  const [availableSelected, setAvailableSelected] = useState(new Set())
  const [selectedSelected, setSelectedSelected] = useState(new Set())
  const draftAvailable = useMemo(() => {
    const q = availQ.toLowerCase()
    return (draftColumns || []).filter(c => c.id !== 'select' && !c.visible && (c.label || c.id).toLowerCase().includes(q))
  }, [draftColumns, availQ])
  const draftSelected = useMemo(() => {
    const q = selQ.toLowerCase()
    return (draftColumns || []).filter(c => c.visible && (c.label || c.id).toLowerCase().includes(q))
  }, [draftColumns, selQ])

  const moveIdsToSelected = (ids) => {
    if (!ids?.size) return
    setDraftColumns(prev => {
      const next = prev.map(c => ids.has(c.id) ? { ...c, visible: true, pin: c.pin || 'none' } : c)
      const order = Array.from(ids)
      const arr = [...next]
      for (const id of order) {
        const idx = arr.findIndex(c => c.id === id)
        if (idx > -1) { const [m] = arr.splice(idx, 1); arr.push(m) }
      }
      return arr
    })
    setAvailableSelected(new Set())
  }
  const moveIdsToAvailable = (ids) => {
    if (!ids?.size) return
    setDraftColumns(prev => prev.map(c => ids.has(c.id) && c.id !== 'select' ? { ...c, visible: false, pin: 'none' } : c))
    setSelectedSelected(new Set())
  }
  const addAll = () => moveIdsToSelected(new Set(draftColumns.filter(c => !c.visible && c.id !== 'select').map(c => c.id)))
  const removeAll = () => moveIdsToAvailable(new Set(draftColumns.filter(c => c.visible && c.id !== 'select').map(c => c.id)))

  const [dragSelId, setDragSelId] = useState('')
  const onSelDragStart = (id) => setDragSelId(id)
  const onSelDrop = (targetId) => {
    if (!dragSelId || dragSelId === targetId) { setDragSelId(''); return }
    setDraftColumns(prev => {
      const visible = prev.filter(c => c.visible)
      const order = visible.map(c => c.id)
      const a = order.indexOf(dragSelId)
      const b = order.indexOf(targetId)
      if (a === -1 || b === -1) return prev
      const arr = [...prev]
      const ai = arr.findIndex(c => c.id === dragSelId)
      const bi = arr.findIndex(c => c.id === targetId)
      const [m] = arr.splice(ai, 1)
      const insertAt = bi > ai ? bi : bi
      arr.splice(insertAt, 0, m)
      return arr
    })
    setDragSelId('')
  }
  const setDraftPin = (id, pin) => setDraftColumns(prev => prev.map(c => c.id === id ? { ...c, pin } : c))

  // Export to Excel (respects visible columns, order, and current filters/search; exports all rows)
  const exportToExcel = () => {
    const cols = visibleColumns.filter(c => c.id !== 'select')
    const header = cols.map(c => c.label || c.id)

    const toCell = (o, key) => {
      const ch = o.buildJson?.chassis || {}
      const specs = o.buildJson?.bodySpecs || {}
      const pricing = o.pricingJson || {}
      switch (key) {
        case 'id':
          return o.id ?? ''
        case 'stockNumber':
          return o.stockNumber ?? ''
        case 'status':
          return getStatusLabel(o.status) || ''
        case 'vin':
          return o.status === 'CONFIG_RECEIVED' ? '' : (o.vin || '')
        case 'buyer':
        case 'dealer':
          return o.inventoryStatus === 'SOLD' ? (o.buyerName || '') : ''
        case 'upfitter':
          return o.buildJson?.upfitter?.name ?? ''
        case 'oemEta':
        case 'upfitterEta':
        case 'deliveryEta':
          return o[key] ? new Date(o[key]).toLocaleDateString() : ''
        case 'deliveryStatus':
          return getDeliveryStatusLabel(o)
        case 'createdAt':
          return o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''
        case 'inventoryStatus':
          return salesStatusLabel[getSalesStatus(o)]
        case 'dealerWebsite':
          if (o.inventoryStatus === 'SOLD') return ''
          {
            const s = o.dealerWebsiteStatus ?? (o.listingStatus === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')
            return s === 'PUBLISHED' ? 'Published' : (s === 'DRAFT' ? 'Draft' : 'Unpublished')
          }
        case 'series':
          return ch.series ?? ''
        case 'cab':
          return ch.cab ?? ''
        case 'drivetrain':
          return ch.drivetrain ?? ''
        case 'wheelbase':
          return ch.wheelbase ?? ''
        case 'gvwr':
          return ch.gvwr ?? ''
        case 'powertrain':
          return ch.powertrain ?? ''
        case 'bodyType':
          return o.buildJson?.bodyType ?? ''
        case 'manufacturer':
          return o.buildJson?.manufacturer ?? ''
        case 'bodyLength':
          return specs.length ?? ''
        case 'bodyMaterial':
          return specs.material ?? ''
        case 'optionsPrice':
          return pricing.optionsPrice != null ? `$${Number(pricing.optionsPrice).toLocaleString()}` : ''
        case 'chassisMsrp':
          return pricing.chassisMsrp != null ? `$${Number(pricing.chassisMsrp).toLocaleString()}` : ''
        case 'bodyPrice':
          return pricing.bodyPrice != null ? `$${Number(pricing.bodyPrice).toLocaleString()}` : ''
        case 'labor':
          return pricing.labor != null ? `$${Number(pricing.labor).toLocaleString()}` : ''
        case 'freight':
          return pricing.freight != null ? `$${Number(pricing.freight).toLocaleString()}` : ''
        case 'total':
          return pricing.total != null ? `$${Number(pricing.total).toLocaleString()}` : ''
        case 'buyerSegment':
          return o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') || o.buyerName?.includes('Inc') ? 'Fleet' : 'Retail'))
        case 'priority':
          return o.priority || 'Normal'
        case 'tags':
          return Array.isArray(o.tags) && o.tags.length > 0 ? o.tags.join(', ') : ''
        case 'actualOemCompleted':
          return o.actualOemCompleted ? new Date(o.actualOemCompleted).toLocaleDateString() : ''
        case 'actualUpfitterCompleted':
          return o.actualUpfitterCompleted ? new Date(o.actualUpfitterCompleted).toLocaleDateString() : ''
        case 'actualDeliveryCompleted':
          return o.actualDeliveryCompleted ? new Date(o.actualDeliveryCompleted).toLocaleDateString() : ''
        case 'createdBy':
          return o.createdBy || ''
        case 'updatedBy':
          return o.updatedBy || ''
        default:
          return o[key] ?? ''
      }
    }

    const rows = (searchedOrders || []).map(o => cols.map(c => toCell(o, c.id)))
    const aoa = [header, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Orders')
    const ts = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const name = `orders_export_${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.xlsx`
    XLSX.writeFile(wb, name)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-16">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="w-full sm:w-auto justify-start">
          <TabsTrigger value="dashboards" className="flex-1 sm:flex-initial text-xs sm:text-sm">Dashboards</TabsTrigger>
          <TabsTrigger value="orders" className="flex-1 sm:flex-initial text-xs sm:text-sm">My Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards">
          <OrderDashboards orders={allOrders} />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {/* Global search + Bulk actions */}
          <div className="mb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <input
          className="flex-1 w-full sm:min-w-[280px] sm:max-w-md border border-gray-300 rounded px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Search orders… (id, status, buyer, upfitter, dates, etc.)"
          value={globalQ}
          onChange={(e) => { setPage(1); setGlobalQ(e.target.value) }}
          aria-label="Search orders across all columns"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="px-2 py-1 border rounded bg-white inline-flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-initial sm:w-44 justify-center"
            onClick={exportToExcel}
            title="Export to Excel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M8 9l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 17a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-sm">Export to Excel</span>
          </button>
          <button ref={customizeBtnRef} className="px-2 py-1 border rounded bg-white inline-flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-initial sm:w-44 justify-center" onClick={() => setCustomizeOpen(true)} aria-expanded={customizeOpen} title="Manage Columns">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M19.4 15a1 1 0 0 1 .2 1.1l-1 1.8a1 1 0 0 1-1 .5l-2-.4a7 7 0 0 1-1.1.7l-.3 2a1 1 0 0 1-1 .8h-2a1 1 0 0 1-1-.8l-.3-2a7 7 0 0 1-1.1-.7l-2 .4a1 1 0 0 1-1-.5l-1-1.8a1 1 0 0 1 .2-1.1l1.7-1.3a6.2 6.2 0 0 1 0-1.4L4.6 11a1 1 0 0 1-.2-1.1l1-1.8a1 1 0 0 1 1-.5l2 .4 1.1-.7.3-2a1 1 0 0 1 1-.8h2a1 1 0 0 1 1 .8l.3 2 1.1.7 2-.4a1 1 0 0 1 1 .5l1 1.8a1 1 0 0 1-.2 1.1l-1.7 1.3c.1.5.1.9 0 1.4L19.4 15Z" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className="text-sm">Manage Columns</span>
          </button>
          {/* Reset Demo Data button removed per request */}
          {hasAnyFilters && (
            <button
              className="px-2 py-1 border rounded bg-white inline-flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-initial sm:w-44 justify-center"
              onClick={clearAllColumnFilters}
              title="Clear Filters"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M3 5h18M7 5v6l5 5v3l4-3v-5l5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Clear Filters</span>
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              className="px-2 py-1 border rounded bg-white inline-flex items-center gap-2 disabled:opacity-50 text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-initial sm:w-44 justify-center"
              disabled={deleting}
              onClick={onDeleteSelected}
              title="Delete selected"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M6 7v9m4-9v9m4-9v9M3 5h14M8 5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {deleting ? 'Deleting…' : `Delete Selected (${selectedIds.size})`}
            </button>
          )}
            </div>
      </div>

      <Dialog open={customizeOpen} onOpenChange={(v) => { if (!v) { setCustomizeOpen(false); } else { setCustomizeOpen(true) } }}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-3xl max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>Manage Columns</span>
              <span className="text-xs text-gray-500">Available ({(draftColumns||[]).filter(c => !c.visible && c.id !== 'select').length}) · Selected ({(draftColumns||[]).filter(c => c.visible).length})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-4">
            <div className="w-full">
              <div className="mb-2">
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Search columns…" value={availQ} onChange={(e) => setAvailQ(e.target.value)} aria-label="Search available columns" />
              </div>
              <div className="border rounded min-h-[200px] sm:min-h-64 max-h-[300px] sm:max-h-80 overflow-auto" role="listbox" aria-label="Available columns" tabIndex={0}>
                {draftAvailable.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No columns match your search.</div>
                ) : draftAvailable.map(c => (
                  <label key={c.id} className={`flex items-center gap-2 p-3 sm:p-2 text-sm hover:bg-gray-50 cursor-pointer ${availableSelected.has(c.id)?'bg-blue-50':''}`}
                    onClick={() => moveIdsToSelected(new Set([c.id]))}
                    onDoubleClick={() => moveIdsToSelected(new Set([c.id]))}
                    onKeyDown={(e) => { if (e.key==='Enter') moveIdsToSelected(new Set([c.id])) }}
                    tabIndex={0}
                  >
                    <input type="checkbox" className="w-4 h-4 sm:w-auto sm:h-auto" checked={availableSelected.has(c.id)} onChange={() => setAvailableSelected(prev => { const next = new Set(prev); next.has(c.id)?next.delete(c.id):next.add(c.id); return next })} />
                    <span className="truncate" title={c.label || c.id}>{c.label || c.id}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-2 py-2 sm:py-0">
              <button className="flex-1 sm:flex-initial px-4 py-2.5 sm:px-3 sm:py-1 border rounded bg-white disabled:opacity-50 text-sm font-medium min-h-[44px] sm:min-h-0" onClick={() => moveIdsToSelected(availableSelected)} disabled={availableSelected.size===0} aria-label="Add to selected">Add →</button>
              <button className="flex-1 sm:flex-initial px-4 py-2.5 sm:px-3 sm:py-1 border rounded bg-white disabled:opacity-50 text-sm font-medium min-h-[44px] sm:min-h-0" onClick={() => moveIdsToAvailable(selectedSelected)} disabled={selectedSelected.size===0} aria-label="Remove from selected">← Remove</button>
              <div className="flex items-center gap-4 sm:gap-3 text-sm sm:text-xs mt-0 sm:mt-2 w-full sm:w-auto justify-center sm:justify-start">
                <button className="text-blue-600 underline py-1" onClick={addAll} type="button">Add all</button>
                <button className="text-blue-600 underline py-1" onClick={removeAll} type="button">Remove all</button>
              </div>
            </div>

            <div className="w-full">
              <div className="mb-2">
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Search selected…" value={selQ} onChange={(e) => setSelQ(e.target.value)} aria-label="Search selected columns" />
              </div>
              <div className="border rounded min-h-[200px] sm:min-h-64 max-h-[300px] sm:max-h-80 overflow-auto" role="listbox" aria-label="Selected columns" tabIndex={0}>
                {draftSelected.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">Choose columns from the left to build your view.</div>
                ) : draftSelected.map(c => (
                  <div key={c.id} className={`group flex items-center gap-2 p-3 sm:p-2 text-sm hover:bg-gray-50 ${c.id==='select'?'opacity-60':''}`}
                    draggable
                    onDragStart={() => onSelDragStart(c.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onSelDrop(c.id)}
                    onDoubleClick={() => c.id==='select'?null:moveIdsToAvailable(new Set([c.id]))}
                    tabIndex={0}
                  >
                    <span className="text-gray-400 select-none text-lg sm:text-base" title="Drag to reorder" aria-hidden>≡</span>
                    <input type="checkbox" className="w-4 h-4 sm:w-auto sm:h-auto" disabled={c.id==='select'} checked={selectedSelected.has(c.id)} onChange={() => setSelectedSelected(prev => { const next = new Set(prev); next.has(c.id)?next.delete(c.id):next.add(c.id); return next })} aria-label={`Select ${c.label||c.id}`} />
                    <span className="truncate flex-1" title={c.label || c.id}>{c.label || c.id}</span>
                    <div className="flex items-center gap-1.5 sm:gap-1">
                      <button className={`px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs border rounded min-w-[36px] sm:min-w-0 ${c.pin==='left'?'bg-gray-200':''}`} onClick={() => setDraftPin(c.id, 'left')} title="Pin Left" type="button">L</button>
                      <button className={`px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs border rounded min-w-[36px] sm:min-w-0 ${c.pin==='none'||!c.pin?'bg-gray-200':''}`} onClick={() => setDraftPin(c.id, 'none')} title="Unpin" type="button">•</button>
                      <button className={`px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs border rounded min-w-[36px] sm:min-w-0 ${c.pin==='right'?'bg-gray-200':''}`} onClick={() => setDraftPin(c.id, 'right')} title="Pin Right" type="button">R</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-4 border-t">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={applyInstantly} onChange={(e) => setApplyInstantly(e.target.checked)} />
              <span>Apply changes instantly</span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button className="w-full sm:w-auto px-4 py-2.5 sm:px-2 sm:py-1 text-sm border rounded min-h-[44px] sm:min-h-0" onClick={resetDraftToDefault} type="button">Reset to default</button>
              <button className="w-full sm:w-auto px-4 py-2.5 sm:px-2 sm:py-1 text-sm border rounded min-h-[44px] sm:min-h-0" onClick={() => { cancelDraft() }} type="button">Cancel</button>
              <button className="w-full sm:w-auto px-4 py-2.5 sm:px-2 sm:py-1 text-sm border rounded bg-blue-600 text-white font-medium min-h-[44px] sm:min-h-0" onClick={() => { applyFromDraft(); setCustomizeOpen(false); toast('Table view updated.') }} type="button">Save</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Column filters are now provided in each table header */}

      {/* Mobile Card View */}
      <div className="block sm:hidden space-y-4">
        {loading ? (
          <div className="text-center py-8">Loading…</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8">No orders</div>
        ) : (
          paginated.map((o) => (
            <Card key={o.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Link to={`/ordermanagement/${o.id}`} className="text-blue-600 underline font-medium text-sm truncate block">
                      {o.id}
                    </Link>
                    <div className="text-xs text-gray-500 mt-1">{o.stockNumber && `Stock #: ${o.stockNumber}`}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(o.id)}
                    onChange={() => toggleSelected(o.id)}
                    className="mt-1"
                    aria-label={`Select ${o.id}`}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusPill(o.status)}
                    {o.vin && <span className="text-xs text-gray-600">VIN: {o.vin}</span>}
                  </div>
                  <div>
                    <span className="font-medium">Model:</span> {o.buildJson?.chassis?.series || '-'}
                  </div>
                  <div>
                    <span className="font-medium">Body:</span> {o.buildJson?.bodyType || '-'}
                  </div>
                  <div>
                    <span className="font-medium">Upfitter:</span> {o.buildJson?.upfitter?.name || '-'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600">Chassis ETA:</span>
                      <div>{etaText(o.oemEta)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Final ETA:</span>
                      <div>{etaText(o.deliveryEta)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        ${(o.pricingJson?.total || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">{getDeliveryStatusLabel(o)}</div>
                    </div>
                    <Link to={`/ordermanagement/${o.id}`}>
                      <Button size="sm" variant="outline">View</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto border rounded" style={{ maxHeight: `${tableMaxHeight}px`, overflowY: pageSize > 10 ? 'auto' : 'hidden' }}>
        <table className="text-sm table-fixed" style={{ minWidth: '100%', width: `${totalWidth}px` }}>
          <colgroup>
            {visibleColumns.map(col => (
              <col key={col.id} style={{ width: `${col.width}px` }} />
            ))}
          </colgroup>
          <thead className="bg-white">
            <tr className="border-b align-bottom bg-white">
              {visibleColumns.map((col) => {
                if (col.id === 'select') {
                  return (
                    <th key={col.id} className="py-2 pl-4 pr-2 text-center whitespace-nowrap sticky top-0 z-10 bg-white" draggable={false}>
                      <input type="checkbox" aria-label="Select all on page" checked={paginated.length>0 && paginated.every(o => selectedIds.has(o.id))} onChange={toggleSelectAllPage} />
                    </th>
                  )
                }
                const commonProps = {
                  draggable: !col.fixed,
                  onDragStart: () => onHeaderDragStart(col.id),
                  onDragOver: (e) => { e.preventDefault() },
                  onDrop: () => onHeaderDrop(col.id),
                }
                const Resizer = (
                  <span
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setResizing({ id: col.id, startX: e.clientX, startWidth: col.width }) }}
                    onDragStart={(e) => e.preventDefault()}
                    draggable={false}
                    className="absolute top-0 right-0 h-full w-3 z-10 cursor-col-resize select-none hover:bg-gray-300/40 active:bg-blue-400/30 border-l border-gray-200"
                    role="separator"
                    aria-label={`Resize ${col.label || col.id} column`}
                    aria-orientation="vertical"
                    title="Drag to resize"
                  />
                )
                if (col.id === 'id') {
                  return (
                    <HeaderWithFilter key={col.id} title="Order ID" isOpen={openFilter==='id'} onOpen={() => setOpenFilter(openFilter==='id'?'': 'id')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={idOptions} selectedValues={columnFilters.id} onApply={(vals) => { setColumnFilters(s => ({ ...s, id: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, id: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
              if (col.id === 'stockNumber') {
                return (
                  <HeaderWithFilter key={col.id} title="Stock #" isOpen={openFilter==='stockNumber'} onOpen={() => setOpenFilter(openFilter==='stockNumber'?'': 'stockNumber')} {...commonProps} extra={Resizer}>
                    <MultiSelectDropdown options={stockNumberOptions} selectedValues={columnFilters.stockNumber} onApply={(vals) => { setColumnFilters(s => ({ ...s, stockNumber: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, stockNumber: new Set() })); setOpenFilter('') }} />
                  </HeaderWithFilter>
                )
              }
                if (col.id === 'status') {
                  return (
                    <HeaderWithFilter key={col.id} title="Order Status" isOpen={openFilter==='status'} onOpen={() => setOpenFilter(openFilter==='status'?'': 'status')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={statusOptions} selectedValues={columnFilters.status} onApply={(vals) => { setColumnFilters(s => ({ ...s, status: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, status: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
              if (col.id === 'vin') {
                return (
                  <HeaderWithFilter key={col.id} title="VIN" isOpen={openFilter==='vin'} onOpen={() => setOpenFilter(openFilter==='vin'?'': 'vin')} {...commonProps} extra={Resizer}>
                    <MultiSelectDropdown options={vinOptions} selectedValues={columnFilters.vin} onApply={(vals) => { setColumnFilters(s => ({ ...s, vin: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, vin: new Set() })); setOpenFilter('') }} />
                  </HeaderWithFilter>
                )
              }
                if (col.id === 'buyer') {
                  return (
                    <HeaderWithFilter key={col.id} title="Buyer" isOpen={openFilter==='buyer'} onOpen={() => setOpenFilter(openFilter==='buyer'?'': 'buyer')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={buyerOptions} selectedValues={columnFilters.buyer} onApply={(vals) => { setColumnFilters(s => ({ ...s, buyer: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, buyer: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                // Backward-compat: if a stored 'dealer' column exists, treat it as Buyer with filter
                if (col.id === 'dealer') {
                  return (
                    <HeaderWithFilter key={col.id} title="Buyer" isOpen={openFilter==='buyer'} onOpen={() => setOpenFilter(openFilter==='buyer'?'': 'buyer')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={buyerOptions} selectedValues={columnFilters.buyer} onApply={(vals) => { setColumnFilters(s => ({ ...s, buyer: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, buyer: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'bodyType') {
                  return (
                    <HeaderWithFilter key={col.id} title="Body Type" isOpen={openFilter==='bodyType'} onOpen={() => setOpenFilter(openFilter==='bodyType'?'': 'bodyType')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={bodyTypeOptions} selectedValues={columnFilters.bodyType} onApply={(vals) => { setColumnFilters(s => ({ ...s, bodyType: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, bodyType: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'manufacturer') {
                  return (
                    <HeaderWithFilter key={col.id} title="Body Mfg" isOpen={openFilter==='manufacturer'} onOpen={() => setOpenFilter(openFilter==='manufacturer'?'': 'manufacturer')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={manufacturerOptions} selectedValues={columnFilters.manufacturer} onApply={(vals) => { setColumnFilters(s => ({ ...s, manufacturer: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, manufacturer: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'series') {
                  return (
                    <HeaderWithFilter key={col.id} title="Model" isOpen={openFilter==='series'} onOpen={() => setOpenFilter(openFilter==='series'?'': 'series')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={seriesOptions} selectedValues={columnFilters.series} onApply={(vals) => { setColumnFilters(s => ({ ...s, series: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, series: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'cab') {
                  return (
                    <HeaderWithFilter key={col.id} title="Cab" isOpen={openFilter==='cab'} onOpen={() => setOpenFilter(openFilter==='cab'?'': 'cab')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={cabOptions} selectedValues={columnFilters.cab} onApply={(vals) => { setColumnFilters(s => ({ ...s, cab: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, cab: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'drivetrain') {
                  return (
                    <HeaderWithFilter key={col.id} title="Drivetrain" isOpen={openFilter==='drivetrain'} onOpen={() => setOpenFilter(openFilter==='drivetrain'?'': 'drivetrain')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={drivetrainOptions} selectedValues={columnFilters.drivetrain} onApply={(vals) => { setColumnFilters(s => ({ ...s, drivetrain: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, drivetrain: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'wheelbase') {
                  return (
                    <HeaderWithFilter key={col.id} title="Wheelbase" isOpen={openFilter==='wheelbase'} onOpen={() => setOpenFilter(openFilter==='wheelbase'?'': 'wheelbase')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={wheelbaseOptions} selectedValues={columnFilters.wheelbase} onApply={(vals) => { setColumnFilters(s => ({ ...s, wheelbase: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, wheelbase: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'gvwr') {
                  return (
                    <HeaderWithFilter key={col.id} title="GVWR" isOpen={openFilter==='gvwr'} onOpen={() => setOpenFilter(openFilter==='gvwr'?'': 'gvwr')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={gvwrOptions} selectedValues={columnFilters.gvwr} onApply={(vals) => { setColumnFilters(s => ({ ...s, gvwr: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, gvwr: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'powertrain') {
                  return (
                    <HeaderWithFilter key={col.id} title="Powertrain" isOpen={openFilter==='powertrain'} onOpen={() => setOpenFilter(openFilter==='powertrain'?'': 'powertrain')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={powertrainOptions} selectedValues={columnFilters.powertrain} onApply={(vals) => { setColumnFilters(s => ({ ...s, powertrain: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, powertrain: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'bodyLength') {
                  return (
                    <HeaderWithFilter key={col.id} title="Body Length" isOpen={openFilter==='bodyLength'} onOpen={() => setOpenFilter(openFilter==='bodyLength'?'': 'bodyLength')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={bodyLengthOptions} selectedValues={columnFilters.bodyLength} onApply={(vals) => { setColumnFilters(s => ({ ...s, bodyLength: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, bodyLength: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'bodyMaterial') {
                  return (
                    <HeaderWithFilter key={col.id} title="Body Material" isOpen={openFilter==='bodyMaterial'} onOpen={() => setOpenFilter(openFilter==='bodyMaterial'?'': 'bodyMaterial')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={bodyMaterialOptions} selectedValues={columnFilters.bodyMaterial} onApply={(vals) => { setColumnFilters(s => ({ ...s, bodyMaterial: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, bodyMaterial: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'upfitter') {
                  return (
                    <HeaderWithFilter key={col.id} title="Upfitter" isOpen={openFilter==='upfitter'} onOpen={() => setOpenFilter(openFilter==='upfitter'?'': 'upfitter')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={upfitterOptions} selectedValues={columnFilters.upfitter} onApply={(vals) => { setColumnFilters(s => ({ ...s, upfitter: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, upfitter: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'oemEta' || col.id === 'upfitterEta' || col.id === 'deliveryEta' || col.id === 'createdAt') {
                  const titleMap = { oemEta: 'Chassis ETA', upfitterEta: 'Upfit ETA', deliveryEta: 'Final ETA', createdAt: 'Created' }
                  const key = col.id
                  const stateKey = key
                  return (
                    <HeaderWithFilter key={col.id} title={titleMap[key]} isOpen={openFilter===key} onOpen={() => setOpenFilter(openFilter===key?'': key)} {...commonProps} extra={Resizer}>
                      <DateRangeDropdown value={columnFilters[stateKey]} onApply={(range) => { setColumnFilters(s => ({ ...s, [stateKey]: range })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, [stateKey]: { from: '', to: '' } })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'inventoryStatus') {
                  return (
                    <HeaderWithFilter key={col.id} title={col.label} isOpen={openFilter==='inventoryStatus'} onOpen={() => setOpenFilter(openFilter==='inventoryStatus'?'': 'inventoryStatus')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={salesStatusOptions} selectedValues={columnFilters.inventoryStatus} onApply={(vals) => { setColumnFilters(s => ({ ...s, inventoryStatus: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, inventoryStatus: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'dealerWebsite') {
                  return (
                    <HeaderWithFilter key={col.id} title="Dealer Website" isOpen={openFilter==='listingStatus'} onOpen={() => setOpenFilter(openFilter==='listingStatus'?'': 'listingStatus')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={dealerWebsiteOptions} selectedValues={columnFilters.listingStatus} onApply={(vals) => { setColumnFilters(s => ({ ...s, listingStatus: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, listingStatus: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                if (col.id === 'deliveryStatus') {
                  return (
                    <HeaderWithFilter key={col.id} title="Delivery Status" isOpen={openFilter==='deliveryStatus'} onOpen={() => setOpenFilter(openFilter==='deliveryStatus'?'': 'deliveryStatus')} {...commonProps} extra={Resizer}>
                      <MultiSelectDropdown options={deliveryStatusOptions} selectedValues={columnFilters.deliveryStatus} onApply={(vals) => { setColumnFilters(s => ({ ...s, deliveryStatus: new Set(vals) })); setOpenFilter('') }} onClear={() => { setColumnFilters(s => ({ ...s, deliveryStatus: new Set() })); setOpenFilter('') }} />
                    </HeaderWithFilter>
                  )
                }
                // Plain header for extra columns
                return (
                  <th key={col.id} className="py-2 pr-4 text-center whitespace-nowrap relative sticky top-0 z-10 bg-white" draggable={!col.fixed} onDragStart={() => onHeaderDragStart(col.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => onHeaderDrop(col.id)}>
                    <div className="inline-flex items-center gap-1"><span>{col.label}</span></div>
                    <span onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setResizing({ id: col.id, startX: e.clientX, startWidth: col.width }) }} onDragStart={(e) => e.preventDefault()} draggable={false} className="absolute top-0 right-0 h-full w-3 z-10 cursor-col-resize select-none hover:bg-gray-300/40 active:bg-blue-400/30" />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-white"><td className="py-4 text-center" colSpan={visibleColumns.length}>Loading…</td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr className="bg-white"><td className="py-4 text-center" colSpan={visibleColumns.length}>No orders</td></tr>
            ) : (
              <>
              {paginated.map((o) => (
                <tr key={o.id} className="border-b bg-white hover:bg-gray-50">
                  {visibleColumns.map(col => {
                    const key = col.id
                    if (key === 'select') return (<td key={`${o.id}_sel`} className="py-3 pl-4 pr-2 text-center align-middle h-12"><input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelected(o.id)} aria-label={`Select ${o.id}`} /></td>)
                    if (key === 'id') return (
                      <td key={`${o.id}_id`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">
                        {o.id ? (
                          <Link className="text-blue-600 underline" to={`/ordermanagement/${o.id}`}>{o.id}</Link>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    )
                  if (key === 'stockNumber') return (
                    <td key={`${o.id}_sn`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis" title={textOrDash(o.stockNumber)}>
                      {textOrDash(o.stockNumber)}
                    </td>
                  )
                    if (key === 'status') return (<td key={`${o.id}_st`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{statusPill(o.status)}</td>)
                  if (key === 'vin') return (
                    <td key={`${o.id}_vn`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis" title={textOrDash(o.vin)}>
                      {textOrDash(o.status === 'CONFIG_RECEIVED' ? '' : (o.vin || ''))}
                    </td>
                  )
                    if (key === 'buyer') return (
                      <td key={`${o.id}_by`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis" title={textOrDash(o.inventoryStatus === 'SOLD' ? (o.buyerName || '') : '')}>
                        {textOrDash(o.inventoryStatus === 'SOLD' ? (o.buyerName || '') : '')}
                      </td>
                    )
                    // Backward-compat: render Buyer data if persisted column id is still 'dealer'
                    if (key === 'dealer') return (<td key={`${o.id}_dl`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis" title={o.inventoryStatus === 'SOLD' ? (o.buyerName || '') : ''}>{o.inventoryStatus === 'SOLD' ? (o.buyerName || '') : ''}</td>)
                    if (key === 'upfitter') return (
                      <td key={`${o.id}_up`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span className="truncate inline-block max-w-full" title={textOrDash(o.buildJson?.upfitter?.name ?? '')}>
                      {textOrDash(o.buildJson?.upfitter?.name ?? '')}
                    </span>
                  </td>
                    )
                    if (key === 'oemEta') return (<td key={`${o.id}_oe`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{etaText(o.oemEta)}</td>)
                    if (key === 'upfitterEta') return (<td key={`${o.id}_ue`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{etaText(o.upfitterEta)}</td>)
                    if (key === 'deliveryEta') return (<td key={`${o.id}_de`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{etaText(o.deliveryEta)}</td>)
                    if (key === 'deliveryStatus') {
                      const code = getDeliveryStatus(o)
                      const label = getDeliveryStatusLabel(o)
                      const clsMap = {
                        AHEAD: 'bg-blue-100 text-blue-800',
                        ON_TIME: 'bg-green-100 text-green-800',
                        DELAYED: 'bg-red-100 text-red-800',
                        DELIVERED: 'bg-gray-200 text-gray-800',
                      }
                      const cls = clsMap[code] || 'bg-gray-100 text-gray-800'
                      return (
                        <td key={`${o.id}_dst`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full ${cls}`}>{label}</span>
                        </td>
                      )
                    }
                    if (key === 'createdAt') return (<td key={`${o.id}_cr`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '-'}</td>)
                    if (key === 'inventoryStatus') {
                      const code = getSalesStatus(o)
                      const label = salesStatusLabel[code]
                      const clsMap = {
                        STOCK: 'bg-gray-100 text-gray-800',
                        PO_RECEIVED: 'bg-blue-100 text-blue-800',
                        INVOICED: 'bg-amber-100 text-amber-800',
                        PAYMENT_RECEIVED: 'bg-green-100 text-green-800',
                      }
                      const cls = clsMap[code] || 'bg-gray-100 text-gray-800'
                      return (
                        <td key={`${o.id}_is`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full ${cls}`}>{label}</span>
                        </td>
                      )
                    }
                    if (key === 'dealerWebsite') {
                      const status = o.dealerWebsiteStatus ?? (o.listingStatus === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')
                      const pill = (label, className, title) => (
                        <button
                          className={`inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs ${className} disabled:opacity-50`}
                          disabled={publishing === o.id}
                          onClick={() => onCycleDealerWebsite(o.id, status)}
                          title={title}
                        >
                          {publishing === o.id ? 'Updating…' : label}
                        </button>
                      )
                      const titleMap = {
                        PUBLISHED: 'Currently live on dealer website',
                        UNPUBLISHED: 'Not visible on dealer website',
                        DRAFT: 'Draft listing; ready to publish',
                      }
                      let node = null
                      if (status === 'PUBLISHED') node = pill('Published', 'bg-green-100 text-green-800', titleMap.PUBLISHED)
                      else if (status === 'UNPUBLISHED') node = pill('Unpublished', 'bg-gray-100 text-gray-800', titleMap.UNPUBLISHED)
                      else node = pill('Draft', 'bg-amber-100 text-amber-800', titleMap.DRAFT)
                      return (
                        <td key={`${o.id}_dw`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">
                          {o.inventoryStatus !== 'SOLD' ? node : <span className="text-gray-500">-</span>}
                        </td>
                      )
                    }
                    // Extra fields from configurator/pricing
                    const ch = o.buildJson?.chassis || {}
                    const specs = o.buildJson?.bodySpecs || {}
                    const pricing = o.pricingJson || {}
                    if (key === 'series') return (<td key={`${o.id}_se`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(ch.series)}</td>)
                    if (key === 'cab') return (<td key={`${o.id}_cb`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(ch.cab)}</td>)
                    if (key === 'drivetrain') return (<td key={`${o.id}_dt`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(ch.drivetrain)}</td>)
                    if (key === 'wheelbase') return (<td key={`${o.id}_wb`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(ch.wheelbase)}</td>)
                    if (key === 'gvwr') return (<td key={`${o.id}_gv`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(ch.gvwr)}</td>)
                    if (key === 'powertrain') return (<td key={`${o.id}_pt`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(ch.powertrain)}</td>)
                    if (key === 'bodyType') return (<td key={`${o.id}_bt`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(o.buildJson?.bodyType)}</td>)
                    if (key === 'manufacturer') return (<td key={`${o.id}_mf`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(o.buildJson?.manufacturer)}</td>)
                    if (key === 'bodyLength') return (<td key={`${o.id}_bl`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(specs.length)}</td>)
                    if (key === 'bodyMaterial') return (<td key={`${o.id}_bm`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{textOrDash(specs.material)}</td>)
                    if (key === 'optionsPrice') return (<td key={`${o.id}_op`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{pricing.optionsPrice != null ? `$${Number(pricing.optionsPrice).toLocaleString()}` : <span>-</span>}</td>)
                    if (key === 'chassisMsrp') return (<td key={`${o.id}_cm`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{pricing.chassisMsrp != null ? `$${Number(pricing.chassisMsrp).toLocaleString()}` : <span>-</span>}</td>)
                    if (key === 'bodyPrice') return (<td key={`${o.id}_bp`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{pricing.bodyPrice != null ? `$${Number(pricing.bodyPrice).toLocaleString()}` : <span>-</span>}</td>)
                    if (key === 'labor') return (<td key={`${o.id}_la`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{pricing.labor != null ? `$${Number(pricing.labor).toLocaleString()}` : <span>-</span>}</td>)
                    if (key === 'freight') return (<td key={`${o.id}_fr`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{pricing.freight != null ? `$${Number(pricing.freight).toLocaleString()}` : <span>-</span>}</td>)
                    if (key === 'total') return (<td key={`${o.id}_tt`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{pricing.total != null ? `$${Number(pricing.total).toLocaleString()}` : <span>-</span>}</td>)
                    if (key === 'buyerSegment') {
                      const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') || o.buyerName?.includes('Inc') ? 'Fleet' : 'Retail'))
                      const clsMap = {
                        Fleet: 'bg-blue-100 text-blue-800',
                        Retail: 'bg-green-100 text-green-800',
                        Dealer: 'bg-gray-100 text-gray-800',
                      }
                      const cls = clsMap[segment] || 'bg-gray-100 text-gray-800'
                      return (
                        <td key={`${o.id}_bs`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full ${cls}`}>{segment}</span>
                        </td>
                      )
                    }
                    if (key === 'priority') {
                      const priority = o.priority || 'Normal'
                      const clsMap = {
                        Urgent: 'bg-red-100 text-red-800',
                        High: 'bg-orange-100 text-orange-800',
                        Normal: 'bg-blue-100 text-blue-800',
                        Low: 'bg-gray-100 text-gray-800',
                      }
                      const cls = clsMap[priority] || 'bg-gray-100 text-gray-800'
                      return (
                        <td key={`${o.id}_pr`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full ${cls}`}>{priority}</span>
                        </td>
                      )
                    }
                    if (key === 'tags') {
                      const tags = Array.isArray(o.tags) && o.tags.length > 0 ? o.tags : []
                      return (
                        <td key={`${o.id}_tg`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis" title={tags.join(', ')}>
                          {tags.length > 0 ? (
                            <span className="inline-block text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                              {tags.slice(0, 2).join(', ')}{tags.length > 2 ? ` +${tags.length - 2}` : ''}
                            </span>
                          ) : <span>-</span>}
                        </td>
                      )
                    }
                    if (key === 'actualOemCompleted') return (<td key={`${o.id}_aoc`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{o.actualOemCompleted ? new Date(o.actualOemCompleted).toLocaleDateString() : '-'}</td>)
                    if (key === 'actualUpfitterCompleted') return (<td key={`${o.id}_auc`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{o.actualUpfitterCompleted ? new Date(o.actualUpfitterCompleted).toLocaleDateString() : '-'}</td>)
                    if (key === 'actualDeliveryCompleted') return (<td key={`${o.id}_adc`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis">{o.actualDeliveryCompleted ? new Date(o.actualDeliveryCompleted).toLocaleDateString() : '-'}</td>)
                    if (key === 'createdBy') return (<td key={`${o.id}_cb`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis" title={o.createdBy || ''}>{textOrDash(o.createdBy)}</td>)
                    if (key === 'updatedBy') return (<td key={`${o.id}_ub`} className="py-3 pr-4 text-center align-middle h-12 whitespace-nowrap overflow-hidden text-ellipsis" title={o.updatedBy || ''}>{textOrDash(o.updatedBy)}</td>)
                    return (<td key={`${o.id}_${key}`} className="py-3 pr-4 text-center align-middle h-12">-</td>)
                  })}
                </tr>
              ))}
              {fillerCount > 0 && Array.from({ length: fillerCount }).map((_, i) => (
                <tr key={`filler_${i}`} className="h-12">
                  <td className="py-3" colSpan={visibleColumns.length}></td>
                </tr>
              ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between mt-3 gap-3">
        <div className="text-sm text-gray-600">Page {page} of {totalPages}</div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <label className="text-sm text-gray-700 flex items-center gap-1">
            <span>Rows:</span>
            <select
              className="border rounded px-2 py-1 bg-white text-sm"
              value={pageSize}
              onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)) }}
              aria-label="Rows per page">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button className="flex-1 sm:flex-initial px-3 py-1 border rounded bg-white disabled:opacity-50 text-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
            <button className="flex-1 sm:flex-initial px-3 py-1 border rounded bg-white disabled:opacity-50 text-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
          </div>
        </div>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}



// Reusable header cell that shows a dropdown filter when open
function HeaderWithFilter({ title, isOpen, onOpen, children, extra, ...rest }) {
  const thRef = useRef(null)
  const dropdownWidth = 288 // Tailwind w-72 (18rem)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const update = () => {
      const el = thRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const left = Math.min(
        window.scrollX + r.right - dropdownWidth,
        window.scrollX + window.innerWidth - dropdownWidth - 8
      )
      const safeLeft = Math.max(8, left)
      const top = window.scrollY + r.bottom + 4
      setPos({ top, left: safeLeft })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    const onDown = (e) => {
      const th = thRef.current
      const dd = dropdownRef.current
      if (th?.contains(e.target) || dd?.contains(e.target)) return
      onOpen()
    }
    const onKey = (e) => { if (e.key === 'Escape') onOpen() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  return (
    <th className="py-2 pr-4 text-center whitespace-nowrap relative" ref={thRef} {...rest}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-gray-900"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Filter ${title}`}
      >
        <span>{title}</span>
        <span className="ml-1 text-gray-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3 5h18M7 5v6l5 5v3l4-3v-5l5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {isOpen && createPortal(
        <div
          className="w-72 bg-white border rounded shadow-lg p-2 text-left"
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000 }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>,
        document.body
      )}
      {extra}
    </th>
  )
}

// Searchable multi-select dropdown with Apply/Clear
function MultiSelectDropdown({ options, selectedValues, onApply, onClear }) {
  const [query, setQuery] = useState('')
  const [localSelected, setLocalSelected] = useState(new Set(Array.from(selectedValues || [])))
  const selectAllRef = useRef(null)

  useEffect(() => {
    setLocalSelected(new Set(Array.from(selectedValues || [])))
  }, [selectedValues])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return (options || []).filter(opt => opt.label.toLowerCase().includes(q))
  }, [options, query])

  const allVisibleSelected = useMemo(() => {
    if (!filtered.length) return false
    return filtered.every(opt => localSelected.has(opt.value))
  }, [filtered, localSelected])

  const someVisibleSelected = useMemo(() => {
    return filtered.some(opt => localSelected.has(opt.value)) && !allVisibleSelected
  }, [filtered, localSelected, allVisibleSelected])

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected
    }
  }, [someVisibleSelected])

  const toggle = (value) => {
    setLocalSelected(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const apply = () => onApply(Array.from(localSelected))

  return (
    <div>
      <input
        className="w-full border border-gray-200 rounded px-2 py-1 mb-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="max-h-48 overflow-auto border border-gray-100 rounded">
        {filtered.length === 0 ? (
          <div className="p-2 text-sm text-gray-500">No results</div>
        ) : (
          <>
            <label className="flex items-center gap-2 p-2 text-sm font-medium bg-gray-50 sticky top-0">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => {
                  setLocalSelected(prev => {
                    const next = new Set(prev)
                    if (allVisibleSelected) {
                      filtered.forEach(opt => next.delete(opt.value))
                    } else {
                      filtered.forEach(opt => next.add(opt.value))
                    }
                    return next
                  })
                }}
              />
              <span>Select All</span>
            </label>
            {filtered.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 p-2 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={localSelected.has(opt.value)} onChange={() => toggle(opt.value)} />
                <span className="truncate" title={opt.label}>{opt.label}</span>
              </label>
            ))}
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button type="button" className="px-2 py-1 text-sm border rounded" onClick={onClear}>Clear</button>
        <button type="button" className="px-2 py-1 text-sm border rounded bg-blue-600 text-white" onClick={apply}>Apply</button>
      </div>
    </div>
  )
}

// Date range dropdown for table headers
function DateRangeDropdown({ value, onApply, onClear }) {
  const [from, setFrom] = useState(value?.from || '')
  const [to, setTo] = useState(value?.to || '')

  useEffect(() => {
    setFrom(value?.from || '')
    setTo(value?.to || '')
  }, [value])

  return (
    <div>
      <div className="flex items-center gap-2 w-full">
        <input type="date" className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-gray-500 flex-none">to</span>
        <input type="date" className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <button type="button" className="px-2 py-1 text-sm border rounded" onClick={onClear}>Clear</button>
        <button type="button" className="px-2 py-1 text-sm border rounded bg-blue-600 text-white" onClick={() => onApply({ from, to })}>Apply</button>
      </div>
    </div>
  )
}

