import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { advanceOrder, getOrder, publishListing, updateEtas, cancelOrder, setStock, getNotes, addNote, getStatusLabel, setInventoryStatus, ensureDemoOrder, generateDealerBuyerName } from '@/lib/orderApi'
import { calculateMargin } from '@/lib/marginUtils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ChevronRight, Clock, MessageSquare, Users, Settings, BarChart3 } from 'lucide-react'

// Helper to read from localStorage
function readLocal(key, fallback) {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : fallback
  } catch {
    return fallback
  }
}

// Generate unique demo comments for each order based on order ID
function generateDemoComments(orderId, order) {
  // Use order ID to create a deterministic seed for variety
  const idHash = orderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const seed = idHash % 100
  
  const users = ['Sarah Johnson', 'Mike Chen', 'Taylor Steele', 'Alex Rivera', 'Jordan Smith', 'Casey Williams', 'Morgan Davis']
  const user = users[seed % users.length]
  
  const commentTemplates = [
    [
      { text: `Order ${orderId} has been received and is being processed. Chassis allocation is in progress.`, user: 'System', daysAgo: 5 },
      { text: `Confirmed ${order?.buildJson?.bodyType || 'body type'} configuration with ${order?.buildJson?.manufacturer || 'manufacturer'}. All specifications match customer requirements.`, user: user, daysAgo: 4 },
      { text: `OEM allocation confirmed. Expected chassis delivery to upfitter in ${order?.oemEta ? Math.ceil((new Date(order.oemEta) - new Date()) / (1000 * 60 * 60 * 24)) : 10} days.`, user: 'System', daysAgo: 3 },
      { text: `Upfitter ${order?.buildJson?.upfitter?.name || 'assigned'} has been notified and is preparing for arrival.`, user: user, daysAgo: 2 },
    ],
    [
      { text: `Initial order review completed for ${orderId}. All documentation verified.`, user: user, daysAgo: 6 },
      { text: `Customer requested ${order?.buildJson?.chassis?.series || 'chassis'} with ${order?.buildJson?.chassis?.drivetrain || 'drivetrain'} configuration. Confirmed availability.`, user: 'System', daysAgo: 5 },
      { text: `Pricing approved at $${Number(order?.pricingJson?.total || 0).toLocaleString()}. Purchase order received.`, user: user, daysAgo: 4 },
      { text: `Production scheduled. Tracking updates will be provided as order progresses through stages.`, user: 'System', daysAgo: 1 },
    ],
    [
      { text: `Order ${orderId} entered into system. Initial validation complete.`, user: 'System', daysAgo: 7 },
      { text: `Special attention needed: ${order?.buildJson?.bodyType || 'body'} requires custom mounting brackets. Upfitter has been briefed.`, user: user, daysAgo: 6 },
      { text: `Chassis build sheet received from OEM. All options confirmed.`, user: 'System', daysAgo: 4 },
      { text: `Quality check scheduled for upfit completion. Estimated ${order?.deliveryEta ? new Date(order.deliveryEta).toLocaleDateString() : 'TBD'}.`, user: user, daysAgo: 2 },
    ],
    [
      { text: `Fleet order ${orderId} processing initiated. ${order?.buyerName || 'Customer'} notified of timeline.`, user: user, daysAgo: 8 },
      { text: `Bulk order coordination: This unit is part of a larger fleet delivery. Coordinating with logistics.`, user: 'System', daysAgo: 6 },
      { text: `Upfit modifications approved. ${order?.buildJson?.upfitter?.name || 'Upfitter'} can proceed with installation.`, user: user, daysAgo: 3 },
      { text: `Final inspection scheduled. Delivery preparation in progress.`, user: 'System', daysAgo: 1 },
    ],
    [
      { text: `Order ${orderId} received. Priority status: ${order?.isStock ? 'Stock Unit' : 'Customer Order'}.`, user: 'System', daysAgo: 5 },
      { text: `Configuration review: ${order?.buildJson?.chassis?.series || 'Series'} with ${order?.buildJson?.chassis?.powertrain || 'powertrain'} powertrain. All specs verified.`, user: user, daysAgo: 4 },
      { text: `Upfitter communication: Discussed ${order?.buildJson?.bodyType || 'body type'} requirements. Timeline confirmed.`, user: user, daysAgo: 2 },
      { text: `Status update: Order progressing on schedule. Next milestone: ${order?.upfitterEta ? new Date(order.upfitterEta).toLocaleDateString() : 'TBD'}.`, user: 'System', daysAgo: 0 },
    ],
  ]
  
  const templateIndex = seed % commentTemplates.length
  const template = commentTemplates[templateIndex]
  
  const now = Date.now()
  return template.map((comment, index) => {
    const createdAt = new Date(now - comment.daysAgo * 24 * 60 * 60 * 1000)
    return {
      id: `note_${orderId}_${index}_${seed}`,
      orderId: orderId,
      text: comment.text,
      user: comment.user,
      at: createdAt.toISOString(),
    }
  })
}

export function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [events, setEvents] = useState([])
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showEtaEditor, setShowEtaEditor] = useState(false)
  const [role, setRole] = useState('INTERNAL')
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [messageTo, setMessageTo] = useState('Dealer')
  const [activeTab, setActiveTab] = useState('timeline')
  const [mobileTabSheetOpen, setMobileTabSheetOpen] = useState(false)
  const [showTrackingModal, setShowTrackingModal] = useState(false)

  const FLOW = ['CONFIG_RECEIVED', 'OEM_ALLOCATED', 'OEM_PRODUCTION', 'OEM_IN_TRANSIT', 'AT_UPFITTER', 'UPFIT_IN_PROGRESS', 'READY_FOR_DELIVERY', 'DELIVERED']

  async function load() {
    if (!id) {
      console.error('No order ID provided')
      setLoading(false)
      return
    }

    setLoading(true)
    let resolved = null
    let eventsData = []
    
    try {
      // Use getOrder API as primary method to ensure consistency with table data
      // This ensures we get the same transformations (status calculation, bodySpecs normalization) 
      // that are applied in the Orders table via getOrders()
      const data = await getOrder(id)
      if (data?.order) {
        resolved = data.order
        eventsData = data.events || []
        console.log('Loaded order via API (consistent with table):', resolved.id, resolved.buildJson?.bodyType, resolved.status)
      }
    } catch (err) {
      console.error('Error loading order via API:', err)
      // Fallback: try reading directly from localStorage
      try {
        const orders = readLocal('orders', [])
        let foundOrder = orders.find(o => o.id === id) || null
        
        // Try case-insensitive match if exact match fails
        if (!foundOrder) {
          const lc = String(id || '').toLowerCase()
          foundOrder = orders.find(o => 
            String(o.id || '').toLowerCase() === lc ||
            String(o.stockNumber || '').toLowerCase() === lc ||
            String(o.vin || '').toLowerCase() === lc
          ) || null
        }
        
        if (foundOrder) {
          resolved = { ...foundOrder }
          const events = readLocal('orderEvents', [])
          eventsData = events.filter(e => e.orderId === foundOrder.id) || []
          console.log('Found order from localStorage fallback:', resolved.id)
        }
      } catch (localErr) {
        console.error('Error reading from localStorage:', localErr)
      }
    }

    // Only create a fallback order as absolute last resort
    if (!resolved) {
      console.warn('Creating fallback order for ID:', id)
      const now = new Date().toISOString()
      resolved = {
        id: String(id),
        dealerCode: 'CVC101',
        upfitterId: 'knapheide-detroit',
        status: 'OEM_ALLOCATED',
        oemEta: new Date(Date.now() + 10 * 86400000).toISOString(),
        upfitterEta: new Date(Date.now() + 20 * 86400000).toISOString(),
        deliveryEta: new Date(Date.now() + 35 * 86400000).toISOString(),
        buildJson: {
          bodyType: 'Service Body',
          manufacturer: 'Knapheide',
          chassis: { series: 'F-550', cab: 'Crew Cab', drivetrain: '4x4', wheelbase: '169', gvwr: '19500', powertrain: 'diesel-6.7L' },
          bodySpecs: { bodyLength: 11, material: 'Steel' },
          upfitter: { id: 'knapheide-detroit', name: 'Knapheide Detroit' },
        },
        pricingJson: { chassisMsrp: 64000, bodyPrice: 21000, optionsPrice: 2500, labor: 3800, freight: 1500, incentives: [], taxes: 0, total: 91800 },
        inventoryStatus: 'STOCK',
        isStock: true,
        buyerName: '',
        listingStatus: null,
        dealerWebsiteStatus: 'DRAFT',
        createdAt: now,
        updatedAt: now,
        stockNumber: `STK-${String(id).slice(-6)}`,
        vin: '',
      }
    }

    // Always set the order, even if it's a fallback
    console.log('Setting order:', resolved?.id)
    setOrder(resolved)
    setEvents(eventsData || [])
    
    try {
      let ns = await getNotes(id)
      // If no notes exist, create demo comments for this order
      if (!ns || ns.length === 0) {
        ns = generateDemoComments(id, resolved)
        // Save the demo comments to localStorage (using the same key as orderApi)
        if (ns.length > 0) {
          const allNotes = readLocal('orderNotes', [])
          // Filter out any existing notes for this order to avoid duplicates
          const otherNotes = allNotes.filter(n => n.orderId !== id)
          const updated = [...otherNotes, ...ns]
          try {
            localStorage.setItem('orderNotes', JSON.stringify(updated))
          } catch {}
        }
      }
      setNotes(ns || [])
    } catch (err) {
      console.warn('getNotes failed:', err)
      setNotes([])
    }
    
      try {
        const raw = localStorage.getItem(`LS_MSGS_${id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        setMessages(Array.isArray(parsed) ? parsed : [])
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
    
    setLoading(false)
  }

  useEffect(() => { if (id) load() }, [id])

  useEffect(() => {
    const r = (localStorage.getItem('role') || 'INTERNAL').toUpperCase()
    setRole(r === 'BUYER' ? 'BUYER' : 'INTERNAL')
  }, [])

  // Scroll to top when navigating to order detail (especially important on mobile)
  useEffect(() => {
    if (id) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [id])

  const nextLabel = useMemo(() => {
    if (!order) return null
    const idx = FLOW.indexOf(order.status)
    return FLOW[idx + 1] || null
  }, [order])

  const progressPercentage = useMemo(() => {
    if (!order) return 0
    const idx = FLOW.indexOf(order.status)
    return ((idx + 1) / FLOW.length) * 100
  }, [order])

  const orderType = useMemo(() => {
    if (!order) return 'Retail'
    if (order.isStock) return 'Stock'
    if (order.buyerName?.includes('Fleet') || order.buyerName?.includes('LLC') || order.buyerName?.includes('Corp')) return 'Fleet'
    return 'Retail'
  }, [order])

  // Compute Sales Status from inventory state and delivery dates relative to today
  // This matches the logic from the Orders table
  const getSalesStatus = (o) => {
    if (!o) return 'STOCK'
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

  // Compute sales status for the current order
  const salesStatus = useMemo(() => getSalesStatus(order), [order])

  // Generate unique contact names based on order ID
  const contactNames = useMemo(() => {
    if (!order?.id) return {}
    const idHash = order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    
    const firstNames = [
      'James', 'Sarah', 'Michael', 'Robert', 'David', 'Jennifer', 'Thomas', 'Emily',
      'Christopher', 'Jessica', 'Daniel', 'Amanda', 'Matthew', 'Michelle', 'Andrew', 'Lisa',
      'Joshua', 'Stephanie', 'Kevin', 'Nicole', 'Ryan', 'Ashley', 'Justin', 'Melissa',
      'Brandon', 'Rachel', 'Tyler', 'Lauren', 'Jacob', 'Kimberly', 'Nicholas', 'Samantha'
    ]
    const lastNames = [
      'Mitchell', 'Johnson', 'Chen', 'Williams', 'Martinez', 'Davis', 'Anderson', 'Taylor',
      'Wilson', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
      'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Hall',
      'Allen', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams'
    ]
    
    const getIndex = (offset) => (idHash + offset) % firstNames.length
    
    return {
      buyer: `${firstNames[getIndex(0)]} ${lastNames[getIndex(0)]}`,
      seller: `${firstNames[getIndex(1)]} ${lastNames[getIndex(1)]}`,
      oem: `${firstNames[getIndex(2)]} ${lastNames[getIndex(2)]}`,
      bodyManufacturer: `${firstNames[getIndex(3)]} ${lastNames[getIndex(3)]}`,
      upfitter: `${firstNames[getIndex(4)]} ${lastNames[getIndex(4)]}`,
      financing: `${firstNames[getIndex(5)]} ${lastNames[getIndex(5)]}`,
      logistics: `${firstNames[getIndex(6)]} ${lastNames[getIndex(6)]}`,
      accountManager: `${firstNames[getIndex(7)]} ${lastNames[getIndex(7)]}`
    }
  }, [order?.id])

  // Generate unique tracking location based on order ID
  const trackingLocation = useMemo(() => {
    if (!order?.id) {
      return {
        lat: 41.45496659976631,
        lng: -70.56068388481569,
        place: 'Provincetown Harbor',
        embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2990.274257380938!2d-70.56068388481569!3d41.45496659976631!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89e52963ac45bbcb%3A0x05c8e81b3550517!2sProvincetown%20Harbor!5e0!3m2!1sen!2sus!4v1671222966401!5m2!1sen!2sus'
      }
    }
    
    const idHash = order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    
    // Different locations across the US (manufacturing plants, distribution centers, etc.)
    const locations = [
      { lat: 42.3314, lng: -83.0458, place: 'Detroit, MI', name: 'Ford Manufacturing Plant - Detroit' },
      { lat: 40.7128, lng: -74.0060, place: 'New York, NY', name: 'Ford Distribution Center - New York' },
      { lat: 34.0522, lng: -118.2437, place: 'Los Angeles, CA', name: 'Ford Distribution Center - Los Angeles' },
      { lat: 29.7604, lng: -95.3698, place: 'Houston, TX', name: 'Ford Manufacturing Plant - Houston' },
      { lat: 41.8781, lng: -87.6298, place: 'Chicago, IL', name: 'Ford Distribution Center - Chicago' },
      { lat: 33.4484, lng: -112.0740, place: 'Phoenix, AZ', name: 'Ford Distribution Center - Phoenix' },
      { lat: 39.9526, lng: -75.1652, place: 'Philadelphia, PA', name: 'Ford Distribution Center - Philadelphia' },
      { lat: 32.7767, lng: -96.7970, place: 'Dallas, TX', name: 'Ford Distribution Center - Dallas' },
      { lat: 37.7749, lng: -122.4194, place: 'San Francisco, CA', name: 'Ford Distribution Center - San Francisco' },
      { lat: 47.6062, lng: -122.3321, place: 'Seattle, WA', name: 'Ford Distribution Center - Seattle' },
      { lat: 39.7392, lng: -104.9903, place: 'Denver, CO', name: 'Ford Distribution Center - Denver' },
      { lat: 25.7617, lng: -80.1918, place: 'Miami, FL', name: 'Ford Distribution Center - Miami' },
      { lat: 33.7490, lng: -84.3880, place: 'Atlanta, GA', name: 'Ford Distribution Center - Atlanta' },
      { lat: 45.5152, lng: -122.6784, place: 'Portland, OR', name: 'Ford Distribution Center - Portland' },
      { lat: 44.9778, lng: -93.2650, place: 'Minneapolis, MN', name: 'Ford Distribution Center - Minneapolis' },
      { lat: 35.2271, lng: -80.8431, place: 'Charlotte, NC', name: 'Ford Distribution Center - Charlotte' },
      { lat: 36.1627, lng: -86.7816, place: 'Nashville, TN', name: 'Ford Distribution Center - Nashville' },
      { lat: 38.6270, lng: -90.1994, place: 'St. Louis, MO', name: 'Ford Distribution Center - St. Louis' },
      { lat: 40.4406, lng: -79.9959, place: 'Pittsburgh, PA', name: 'Ford Distribution Center - Pittsburgh' },
      { lat: 41.2565, lng: -95.9345, place: 'Omaha, NE', name: 'Ford Distribution Center - Omaha' },
      { lat: 35.4676, lng: -97.5164, place: 'Oklahoma City, OK', name: 'Ford Distribution Center - Oklahoma City' },
      { lat: 36.1699, lng: -115.1398, place: 'Las Vegas, NV', name: 'Ford Distribution Center - Las Vegas' },
      { lat: 43.6532, lng: -79.3832, place: 'Toronto, ON', name: 'Ford Distribution Center - Toronto' },
      { lat: 45.5017, lng: -73.5673, place: 'Montreal, QC', name: 'Ford Distribution Center - Montreal' },
    ]
    
    const locationIndex = idHash % locations.length
    const location = locations[locationIndex]
    
    // Generate Google Maps embed URL using coordinates
    // Using a simple format that centers on the coordinates
    const embedUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}&hl=en&z=12&output=embed`
    
    return {
      lat: location.lat,
      lng: location.lng,
      place: location.place,
      name: location.name,
      embedUrl: embedUrl
    }
  }, [order?.id])

  const doAdvance = async () => {
    if (!nextLabel) return
    setSaving(true)
    try {
      await advanceOrder(id, nextLabel)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onCancel = async () => {
    setSaving(true)
    try {
      await cancelOrder(id)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onUpdateEtas = async (payload) => {
    setSaving(true)
    try {
      await updateEtas(id, payload)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onPublish = async () => {
    setSaving(true)
    try {
      await publishListing(id)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onSetStock = async (checked) => {
    setSaving(true)
    try {
      await setStock(id, checked)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onAddNote = async (ev) => {
    ev.preventDefault()
    if (!noteText.trim()) return
    setSaving(true)
    try {
      await addNote(id, noteText.trim())
      setNoteText('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const onSendMessage = (ev) => {
    ev.preventDefault()
    if (!messageText.trim()) return
    const next = [{ id: `msg_${Date.now()}`, to: messageTo, text: messageText.trim(), at: new Date().toISOString(), user: 'You' }, ...messages]
    setMessages(next)
    setMessageText('')
    try { localStorage.setItem(`LS_MSGS_${id}`, JSON.stringify(next)) } catch {}
  }

  // Calculate margin using industry-standard calculations
  const marginData = useMemo(() => {
    if (!order?.pricingJson) return null
    return calculateMargin(order.pricingJson, order)
  }, [order])
  const margin = marginData?.margin || null

  // Calculate lead time - safe even if order is null
  const leadTime = useMemo(() => {
    if (!order?.createdAt || !order?.deliveryEta) return null
    try {
      const created = new Date(order.createdAt)
      const delivery = new Date(order.deliveryEta)
      const days = Math.ceil((delivery.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      return days
    } catch {
      return null
    }
  }, [order])

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">Loading…</div>
  }
  
  // This should never happen now since we always create a fallback order
  if (!order) {
    // Force reload with fallback
    setTimeout(() => load(), 100)
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">Loading order...</div>
  }

  const canEditEta = role === 'INTERNAL'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* 🧩 1. Header Summary */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
                <CardTitle className="text-xl sm:text-2xl">Order {order.id}</CardTitle>
                <Badge variant={order.status === 'DELIVERED' ? 'default' : order.status === 'CANCELED' ? 'destructive' : 'secondary'}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                <span>Reference: {order.stockNumber || order.id}</span>
                {order.vin && <span>VIN: {order.vin}</span>}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => navigate('/ordermanagement?tab=orders')}>
                Back to Orders
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setShowTrackingModal(true)}
              >
                View Tracking Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => navigate(`/documentation/deal-jacket/${order.id}`)}
              >
                View Deal Jacket
              </Button>
              {nextLabel && (
                <Button size="sm" className="w-full sm:w-auto" onClick={doAdvance} disabled={saving}>
                  Advance to {getStatusLabel(nextLabel)}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Created</div>
              <div>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</div>
              {order.createdBy && (
                <div className="text-xs text-gray-400 mt-1">by {order.createdBy}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Last Updated</div>
              <div>{order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : '-'}</div>
              {order.updatedBy && (
                <div className="text-xs text-gray-400 mt-1">by {order.updatedBy}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Account Manager</div>
              <div>{contactNames.accountManager || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Sales Status</div>
              <Badge variant={
                salesStatus === 'PAYMENT_RECEIVED' ? 'default' :
                salesStatus === 'INVOICED' ? 'default' :
                salesStatus === 'PO_RECEIVED' ? 'secondary' :
                'outline'
              }>
                {salesStatusLabel[salesStatus]}
              </Badge>
            </div>
          </div>
          {(order.buyerSegment || order.priority || (order.tags && order.tags.length > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm pt-2 border-t">
              {order.buyerSegment && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Buyer Type</div>
                  <Badge variant={order.buyerSegment === 'Fleet' ? 'default' : order.buyerSegment === 'Retail' ? 'secondary' : 'outline'}>
                    {order.buyerSegment}
                  </Badge>
                </div>
              )}
              {order.priority && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Priority</div>
                  <Badge variant={order.priority === 'Urgent' ? 'destructive' : order.priority === 'High' ? 'default' : order.priority === 'Normal' ? 'secondary' : 'outline'}>
                    {order.priority}
                  </Badge>
                </div>
              )}
              {order.tags && order.tags.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {order.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Order Progress</span>
              <span className="font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Created</span>
              <span>Delivered</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🚚 2. Vehicle Details */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-2">
              <div className="text-sm text-gray-700 uppercase font-semibold tracking-wide">VIN / Stock Number</div>
              <div className="text-xs text-gray-900">{order.vin || '-'} / {order.stockNumber || '-'}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-700 uppercase font-semibold tracking-wide">Condition</div>
              <div className="text-xs text-gray-900">New</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-700 uppercase font-semibold tracking-wide">Make / Model / Year</div>
              <div className="text-xs text-gray-900">Ford / {order.buildJson?.chassis?.series || '-'} / {new Date(order.createdAt || Date.now()).getFullYear()}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-700 uppercase font-semibold tracking-wide">Extended Model / Powertrain</div>
              <div className="text-xs text-gray-900">{order.buildJson?.chassis?.series || '-'} {order.buildJson?.bodyType || '-'} / {order.buildJson?.chassis?.powertrain || '-'}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-700 uppercase font-semibold tracking-wide">Upfit Configuration</div>
              <div className="text-xs text-gray-900">{order.buildJson?.bodyType || '-'} – {order.buildJson?.manufacturer || '-'}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-700 uppercase font-semibold tracking-wide">Body Manufacturer & Serial #</div>
              <div className="text-xs text-gray-900">{order.buildJson?.manufacturer || '-'} / {order.stockNumber || 'N/A'}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-700 uppercase font-semibold tracking-wide">Chassis Details</div>
              <div className="text-xs text-gray-900">
                GVWR: {order.buildJson?.chassis?.gvwr || '-'} lbs<br />
                Wheelbase: {order.buildJson?.chassis?.wheelbase || '-'}"<br />
                Drive Type: {order.buildJson?.chassis?.drivetrain || '-'}<br />
                Fuel Type: {order.buildJson?.chassis?.powertrain?.includes('diesel') ? 'Diesel' : 'Gas'}<br />
                {order.buildJson?.chassis?.powertrain?.includes('EV') && <span>Range: 200-300 miles (estimated)</span>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-700 uppercase font-semibold tracking-wide">Paint / Exterior / Interior</div>
              <div className="text-xs text-gray-900">
                Paint: Standard White<br />
                Exterior: {order.buildJson?.bodySpecs?.material || 'Steel'}<br />
                Interior: Standard Cloth
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-700 uppercase font-semibold tracking-wide">Pricing</div>
              <div className="text-xs text-gray-900 space-y-1">
                <div>MSRP: ${Number(order.pricingJson?.chassisMsrp || 0).toLocaleString()}</div>
                <div>Invoice: ${Number((order.pricingJson?.chassisMsrp || 0) * 0.92).toLocaleString()}</div>
                <div>Deal Price: ${Number(order.pricingJson?.total || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Mobile: Button to open side sheet */}
        <div className="sm:hidden mb-4">
          <Button
            variant="outline"
            onClick={() => setMobileTabSheetOpen(true)}
            className="w-full justify-between h-12 text-base font-medium shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2">
              {activeTab === 'timeline' && <Clock className="h-5 w-5" />}
              {activeTab === 'comments' && <MessageSquare className="h-5 w-5" />}
              {activeTab === 'participants' && <Users className="h-5 w-5" />}
              {activeTab === 'operational' && <Settings className="h-5 w-5" />}
              {activeTab === 'analytics' && <BarChart3 className="h-5 w-5" />}
              <span className="capitalize">
                {activeTab === 'timeline' ? 'Timeline' : activeTab === 'comments' ? 'Comments' : activeTab === 'participants' ? 'Participants' : activeTab === 'operational' ? 'Operational' : 'Analytics'}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Button>
        </div>

        {/* Desktop: Regular tab list */}
        <TabsList className="hidden sm:flex flex-wrap h-auto">
          <TabsTrigger value="timeline" className="text-xs sm:text-sm">Timeline</TabsTrigger>
          <TabsTrigger value="comments" className="text-xs sm:text-sm">Comments</TabsTrigger>
          <TabsTrigger value="participants" className="text-xs sm:text-sm">Participants</TabsTrigger>
          <TabsTrigger value="operational" className="text-xs sm:text-sm">Operational</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">Analytics</TabsTrigger>
        </TabsList>

        {/* Mobile: Side sheet with tab options sliding from right */}
        <Sheet open={mobileTabSheetOpen} onOpenChange={setMobileTabSheetOpen}>
          <SheetContent side="right" className="w-[85vw] max-w-[320px] p-0 sm:slide-in-from-right">
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <SheetTitle className="text-xl font-semibold">Select Section</SheetTitle>
            </SheetHeader>
            <div className="mt-2 py-2">
              <button
                onClick={() => {
                  setActiveTab('timeline')
                  setMobileTabSheetOpen(false)
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${
                  activeTab === 'timeline'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <Clock className={`h-6 w-6 ${activeTab === 'timeline' ? 'text-primary-foreground' : 'text-gray-500'}`} />
                <span className="text-base">Timeline</span>
                {activeTab === 'timeline' && <ChevronRight className="h-5 w-5 ml-auto text-primary-foreground" />}
              </button>
              <button
                onClick={() => {
                  setActiveTab('comments')
                  setMobileTabSheetOpen(false)
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${
                  activeTab === 'comments'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <MessageSquare className={`h-6 w-6 ${activeTab === 'comments' ? 'text-primary-foreground' : 'text-gray-500'}`} />
                <span className="text-base">Comments</span>
                {activeTab === 'comments' && <ChevronRight className="h-5 w-5 ml-auto text-primary-foreground" />}
              </button>
              <button
                onClick={() => {
                  setActiveTab('participants')
                  setMobileTabSheetOpen(false)
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${
                  activeTab === 'participants'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <Users className={`h-6 w-6 ${activeTab === 'participants' ? 'text-primary-foreground' : 'text-gray-500'}`} />
                <span className="text-base">Participants</span>
                {activeTab === 'participants' && <ChevronRight className="h-5 w-5 ml-auto text-primary-foreground" />}
              </button>
              <button
                onClick={() => {
                  setActiveTab('operational')
                  setMobileTabSheetOpen(false)
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${
                  activeTab === 'operational'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <Settings className={`h-6 w-6 ${activeTab === 'operational' ? 'text-primary-foreground' : 'text-gray-500'}`} />
                <span className="text-base">Operational</span>
                {activeTab === 'operational' && <ChevronRight className="h-5 w-5 ml-auto text-primary-foreground" />}
              </button>
              <button
                onClick={() => {
                  setActiveTab('analytics')
                  setMobileTabSheetOpen(false)
                }}
                className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${
                  activeTab === 'analytics'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <BarChart3 className={`h-6 w-6 ${activeTab === 'analytics' ? 'text-primary-foreground' : 'text-gray-500'}`} />
                <span className="text-base">Analytics</span>
                {activeTab === 'analytics' && <ChevronRight className="h-5 w-5 ml-auto text-primary-foreground" />}
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* 🧾 3. Buyer & Seller Information */}
        <TabsContent value="participants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Role</TableHead>
                      <TableHead className="text-xs sm:text-sm">Company</TableHead>
                      <TableHead className="text-xs sm:text-sm">Contact</TableHead>
                      <TableHead className="text-xs sm:text-sm">Key Info</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Buyer</TableCell>
                    <TableCell>{order.buyerName || (order.isStock ? 'N/A (Stock)' : 'TBD')}</TableCell>
                    <TableCell>
                      {order.buyerName ? (
                        <>
                          Contact: {contactNames.buyer || 'James Mitchell'}<br />
                          Email: {contactNames.buyer ? `${contactNames.buyer.split(' ')[0][0].toLowerCase()}.${contactNames.buyer.split(' ')[1].toLowerCase()}@${order.buyerName.toLowerCase().replace(/\s+/g, '')}.com` : `j.mitchell@${order.buyerName.toLowerCase().replace(/\s+/g, '')}.com`}<br />
                          Phone: (555) 123-4567
                        </>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {order.buyerName ? (
                        <>
                          Shipping Address:<br />
                          123 Main St, City, ST 12345
                        </>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Seller</TableCell>
                    <TableCell>
                      {(() => {
                        // If buyer is a dealer (buyerSegment === 'Dealer' or isStock === true), seller is "Ford Commercial Vehicle Center"
                        // If buyer is a fleet, seller is a dealer name
                        const isBuyerDealer = order.buyerSegment === 'Dealer' || order.isStock === true
                        if (isBuyerDealer) {
                          return 'Ford Commercial Vehicle Center'
                        } else {
                          // Generate a deterministic dealer name based on order ID
                          const orderIdHash = order.id ? order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0
                          return generateDealerBuyerName(orderIdHash)
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      Contact: {contactNames.seller || 'Sarah Johnson'}<br />
                      Email: {contactNames.seller ? `${contactNames.seller.split(' ')[0][0].toLowerCase()}.${contactNames.seller.split(' ')[1].toLowerCase()}@${order.dealerCode?.toLowerCase() || 'dealer'}.com` : `s.johnson@${order.dealerCode?.toLowerCase() || 'dealer'}.com`}<br />
                      Phone: (555) 234-5678
                    </TableCell>
                    <TableCell>Location: 123 Commercial Vehicle Way, Detroit, MI 48201</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">OEM</TableCell>
                    <TableCell>Ford Motor Company</TableCell>
                    <TableCell>
                      Contact: {contactNames.oem || 'Michael Chen'}<br />
                      Email: {contactNames.oem ? `${contactNames.oem.split(' ')[0][0].toLowerCase()}.${contactNames.oem.split(' ')[1].toLowerCase()}@ford.com` : 'm.chen@ford.com'}<br />
                      Phone: (555) 789-0123
                    </TableCell>
                    <TableCell>Manufacturer: Ford Motor Company</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Body Manufacturer</TableCell>
                    <TableCell>{order.buildJson?.manufacturer || 'N/A'}</TableCell>
                    <TableCell>
                      Contact: {contactNames.bodyManufacturer || 'Robert Williams'}<br />
                      Email: {contactNames.bodyManufacturer ? `${contactNames.bodyManufacturer.split(' ')[0][0].toLowerCase()}.${contactNames.bodyManufacturer.split(' ')[1].toLowerCase()}@${order.buildJson?.manufacturer?.toLowerCase().replace(/\s+/g, '') || 'manufacturer'}.com` : `r.williams@${order.buildJson?.manufacturer?.toLowerCase().replace(/\s+/g, '') || 'manufacturer'}.com`}<br />
                      Phone: (555) 890-1234
                    </TableCell>
                    <TableCell>Body Type: {order.buildJson?.bodyType || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Upfitter</TableCell>
                    <TableCell>{order.buildJson?.upfitter?.name || 'N/A'}</TableCell>
                    <TableCell>
                      Contact: {contactNames.upfitter || 'David Martinez'}<br />
                      Email: {contactNames.upfitter ? `${contactNames.upfitter.split(' ')[0][0].toLowerCase()}.${contactNames.upfitter.split(' ')[1].toLowerCase()}@${order.buildJson?.upfitter?.id || 'upfitter'}.com` : `d.martinez@${order.buildJson?.upfitter?.id || 'upfitter'}.com`}<br />
                      Phone: (555) 345-6789
                    </TableCell>
                    <TableCell>Location: {order.buildJson?.upfitter?.name?.split(' - ')[1] || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Financing Provider</TableCell>
                    <TableCell>Ford Credit</TableCell>
                    <TableCell>
                      Contact: {contactNames.financing || 'Jennifer Davis'}<br />
                      Email: {contactNames.financing ? `${contactNames.financing.split(' ')[0][0].toLowerCase()}.${contactNames.financing.split(' ')[1].toLowerCase()}@fordcredit.com` : 'j.davis@fordcredit.com'}<br />
                      Phone: (555) 456-7890
                    </TableCell>
                    <TableCell>Status: {order.inventoryStatus === 'SOLD' ? 'Approved' : 'Pending'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Logistics Provider</TableCell>
                    <TableCell>Ford Logistics</TableCell>
                    <TableCell>
                      Contact: {contactNames.logistics || 'Thomas Anderson'}<br />
                      Email: {contactNames.logistics ? `${contactNames.logistics.split(' ')[0][0].toLowerCase()}.${contactNames.logistics.split(' ')[1].toLowerCase()}@fordlogistics.com` : 't.anderson@fordlogistics.com'}<br />
                      Phone: (555) 567-8901
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => setShowTrackingModal(true)}
                        className="text-blue-600 underline hover:text-blue-800 cursor-pointer"
                      >
                        Tracking Link
                      </button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ⏱️ 4. Order Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute left-3 sm:left-4 top-0 bottom-4 w-0.5 bg-gray-200"></div>
                  {(() => {
                    // Helper function to get raw date for a stage (before chronological ordering)
                    const getRawStageDate = (status, statusIndex) => {
                      const event = events.find(e => e.to === status)
                      
                      // First priority: use event if available
                      if (event) return event.at
                      
                      // For first stage (CONFIG_RECEIVED), use order.createdAt if no event
                      if (status === 'CONFIG_RECEIVED' && order.createdAt) return order.createdAt
                      
                      const isCompleted = FLOW.indexOf(order.status) > statusIndex
                      
                      // For completed stages without events, infer dates from actual completion dates or ETAs
                      if (isCompleted) {
                        // Use actual completion dates when available
                        if (status === 'OEM_IN_TRANSIT' && order.actualOemCompleted) return order.actualOemCompleted
                        if (status === 'UPFIT_IN_PROGRESS' && order.actualUpfitterCompleted) return order.actualUpfitterCompleted
                        if (status === 'DELIVERED' && order.actualDeliveryCompleted) return order.actualDeliveryCompleted
                        
                        // For stages that lead to actual completion dates, use those dates
                        if (status === 'AT_UPFITTER' && order.actualOemCompleted) return order.actualOemCompleted
                        if (status === 'READY_FOR_DELIVERY' && order.actualUpfitterCompleted) return order.actualUpfitterCompleted
                        
                        // For other completed stages, try to find previous stage's date and add estimated duration
                        // Or use ETAs as fallback
                        if (status === 'OEM_ALLOCATED' || status === 'OEM_PRODUCTION') {
                          if (order.oemEta) {
                            // Estimate: OEM stages happen before OEM_IN_TRANSIT
                            const oemEtaDate = new Date(order.oemEta)
                            const daysBefore = status === 'OEM_ALLOCATED' ? 3 : 1
                            oemEtaDate.setDate(oemEtaDate.getDate() - daysBefore)
                            return oemEtaDate.toISOString()
                          }
                        }
                        
                        // For AT_UPFITTER, use upfitterEta if available
                        if (status === 'AT_UPFITTER' && order.upfitterEta) {
                          return order.upfitterEta
                        }
                        
                        // For UPFIT_IN_PROGRESS, estimate based on upfitterEta
                        if (status === 'UPFIT_IN_PROGRESS' && order.upfitterEta) {
                          const upfitEtaDate = new Date(order.upfitterEta)
                          upfitEtaDate.setDate(upfitEtaDate.getDate() - 1)
                          return upfitEtaDate.toISOString()
                        }
                      }
                      
                      return null
                    }
                    
                    // Calculate all stage dates in chronological order
                    // This ensures each stage date is >= the previous stage date
                    const stageDates = []
                    for (let i = 0; i < FLOW.length; i++) {
                      const status = FLOW[i]
                      let rawDate = getRawStageDate(status, i)
                      
                      if (rawDate) {
                        const date = new Date(rawDate)
                        
                        // Ensure this date is >= the previous stage's date
                        if (i > 0 && stageDates[i - 1]) {
                          const prevDate = new Date(stageDates[i - 1])
                          if (date < prevDate) {
                            // If this date is earlier than previous, set it to 1 day after previous
                            date.setTime(prevDate.getTime() + 24 * 60 * 60 * 1000)
                          }
                        }
                        
                        stageDates[i] = date.toISOString()
                      } else {
                        stageDates[i] = null
                      }
                    }
                    
                    // Get current status index for timeline calculations
                    const currentStatusIndex = FLOW.indexOf(order.status)
                    
                    return FLOW.map((status, index) => {
                      const isCompleted = FLOW.indexOf(order.status) > index
                      const isCurrent = order.status === status
                      const isFuture = FLOW.indexOf(order.status) < index
                      const isLast = index === FLOW.length - 1
                      const stageDate = stageDates[index]
                      
                      // Get event for this status to determine update source
                      const statusEvent = events.find(e => e.to === status)
                      const updateSource = statusEvent ? 'Updated by System' : (stageDate ? 'Calculated' : null)
                      
                      // Calculate stage duration (time from previous stage to current stage)
                      // For first stage, duration is 0 (no previous stage)
                      const getStageDuration = () => {
                        if (index === 0) return 0 // First stage has 0 duration
                        if (!stageDate) return null
                        
                        const prevDate = stageDates[index - 1]
                        if (!prevDate) return null
                        
                        const start = new Date(prevDate)
                        const end = new Date(stageDate)
                        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
                        return Math.max(0, days) // Ensure non-negative
                      }
                      const stageDuration = getStageDuration()
                    
                    // Get actual completion date and variance
                    // This ensures dates update when the order reaches that stage, not after
                    const getActualDate = () => {
                      const statusEvent = events.find(e => e.to === status)
                      const statusIndex = FLOW.indexOf(status)
                      
                      // First priority: use event if available
                      if (statusEvent?.at) return statusEvent.at
                      
                      // Second priority: if order status is at this stage or later, use stored date or updatedAt
                      if (currentStatusIndex >= statusIndex) {
                        // For specific stages, check stored actual completion dates
                        if (status === 'AT_UPFITTER' && order.actualOemCompleted) return order.actualOemCompleted
                        if (status === 'READY_FOR_DELIVERY' && order.actualUpfitterCompleted) return order.actualUpfitterCompleted
                        if (status === 'DELIVERED' && order.actualDeliveryCompleted) return order.actualDeliveryCompleted
                        
                        // For other stages, use updatedAt (when status changed to this stage)
                        if (order.updatedAt) return order.updatedAt
                      }
                      
                      return null
                    }
                    const actualDate = getActualDate()
                    
                    // Calculate variance/delay (days difference between actual and planned)
                    const getVariance = () => {
                      if (!actualDate) return null
                      let plannedDate = null
                      if (status === 'OEM_IN_TRANSIT' && order.oemEta) plannedDate = new Date(order.oemEta)
                      if (status === 'UPFIT_IN_PROGRESS' && order.upfitterEta) plannedDate = new Date(order.upfitterEta)
                      if (status === 'DELIVERED' && order.deliveryEta) plannedDate = new Date(order.deliveryEta)
                      if (!plannedDate) return null
                      const actual = new Date(actualDate)
                      const days = Math.ceil((actual - plannedDate) / (1000 * 60 * 60 * 24))
                      return days
                    }
                    const variance = getVariance()
                    
                    // Get planned ETA for current stage
                    const getPlannedEta = () => {
                      if (status === 'OEM_IN_TRANSIT' && order.oemEta) return order.oemEta
                      if (status === 'UPFIT_IN_PROGRESS' && order.upfitterEta) return order.upfitterEta
                      if (status === 'READY_FOR_DELIVERY' && order.deliveryEta) return order.deliveryEta
                      if (status === 'DELIVERED' && order.deliveryEta) return order.deliveryEta
                      return null
                    }
                    const plannedEta = getPlannedEta()
                    
                    // For future stages, show minimal info but still show planned ETA if available
                    if (isFuture) {
                      return (
                        <div key={status} className={`relative flex items-start gap-3 sm:gap-4 ${isLast ? '' : 'pb-4 sm:pb-6'}`}>
                          <div className={`relative z-10 flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 bg-white border-gray-300`}>
                          </div>
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-500">
                                {getStatusLabel(status)}
                              </span>
                            </div>
                            {plannedEta && (
                              <div className="text-xs text-gray-500">
                                Planned ETA: {new Date(plannedEta).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }
                    
                    // For completed and current stages, show full details
                    // Ensure we always have a date to display (use stageDate or fallback)
                    const displayDate = stageDate || (status === 'CONFIG_RECEIVED' ? order.createdAt : null) || (isCurrent && actualDate ? actualDate : null)
                    
                    return (
                      <div key={status} className={`relative flex items-start gap-3 sm:gap-4 ${isLast ? '' : 'pb-4 sm:pb-6'}`}>
                        <div className={`relative z-10 flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 ${
                          isCompleted ? 'bg-green-600 border-green-600' : isCurrent ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                        }`}>
                          {isCompleted && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                              {getStatusLabel(status)}
                            </span>
                            {isCurrent && <Badge variant="secondary">Current</Badge>}
                          </div>
                          {displayDate && (
                            <div className="text-sm text-gray-600">
                              {new Date(displayDate).toLocaleString('en-US', { 
                                month: '2-digit', 
                                day: '2-digit', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true
                              })}<br />
                              <span className="text-xs text-gray-500">Update Source: {updateSource || 'Updated by System'}</span>
                            </div>
                          )}
                          {stageDuration !== null && (
                            <div className="text-xs text-gray-500">
                              Duration: {stageDuration} {stageDuration === 1 ? 'day' : 'days'}
                            </div>
                          )}
                          {isCurrent && plannedEta && (
                            <div className="text-xs text-gray-500">
                              Planned ETA: {new Date(plannedEta).toLocaleDateString()}
                            </div>
                          )}
                          {variance !== null && (
                            <div className={`text-xs ${variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                              Variance: {variance > 0 ? '+' : ''}{variance} {variance === 1 ? 'day' : 'days'}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Stage Duration Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Stage Duration Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm text-center">Stage</TableHead>
                      <TableHead className="text-xs sm:text-sm text-center">Planned ETA</TableHead>
                      <TableHead className="text-xs sm:text-sm text-center">Actual Completed</TableHead>
                      <TableHead className="text-xs sm:text-sm text-center">Duration (Days)</TableHead>
                      <TableHead className="text-xs sm:text-sm text-center">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {(() => {
                    // Helper function to get raw date for a stage (same logic as timeline)
                    const getRawStageDate = (status, statusIndex) => {
                      const event = events.find(e => e.to === status)
                      
                      // First priority: use event if available
                      if (event) return event.at
                      
                      // For first stage (CONFIG_RECEIVED), use order.createdAt if no event
                      if (status === 'CONFIG_RECEIVED' && order.createdAt) return order.createdAt
                      
                      const isCompleted = FLOW.indexOf(order.status) > statusIndex
                      
                      // For completed stages without events, infer dates from actual completion dates or ETAs
                      if (isCompleted) {
                        // Use actual completion dates when available
                        if (status === 'OEM_IN_TRANSIT' && order.actualOemCompleted) return order.actualOemCompleted
                        if (status === 'UPFIT_IN_PROGRESS' && order.actualUpfitterCompleted) return order.actualUpfitterCompleted
                        if (status === 'DELIVERED' && order.actualDeliveryCompleted) return order.actualDeliveryCompleted
                        
                        // For stages that lead to actual completion dates, use those dates
                        if (status === 'AT_UPFITTER' && order.actualOemCompleted) return order.actualOemCompleted
                        if (status === 'READY_FOR_DELIVERY' && order.actualUpfitterCompleted) return order.actualUpfitterCompleted
                        
                        // For other completed stages, try to find previous stage's date and add estimated duration
                        // Or use ETAs as fallback
                        if (status === 'OEM_ALLOCATED' || status === 'OEM_PRODUCTION') {
                          if (order.oemEta) {
                            // Estimate: OEM stages happen before OEM_IN_TRANSIT
                            const oemEtaDate = new Date(order.oemEta)
                            const daysBefore = status === 'OEM_ALLOCATED' ? 3 : 1
                            oemEtaDate.setDate(oemEtaDate.getDate() - daysBefore)
                            return oemEtaDate.toISOString()
                          }
                        }
                        
                        // For AT_UPFITTER, use upfitterEta if available
                        if (status === 'AT_UPFITTER' && order.upfitterEta) {
                          return order.upfitterEta
                        }
                        
                        // For UPFIT_IN_PROGRESS, estimate based on upfitterEta
                        if (status === 'UPFIT_IN_PROGRESS' && order.upfitterEta) {
                          const upfitEtaDate = new Date(order.upfitterEta)
                          upfitEtaDate.setDate(upfitEtaDate.getDate() - 1)
                          return upfitEtaDate.toISOString()
                        }
                      }
                      
                      return null
                    }
                    
                    // Calculate all stage dates in chronological order (same logic as timeline)
                    const stageDates = []
                    for (let i = 0; i < FLOW.length; i++) {
                      const status = FLOW[i]
                      let rawDate = getRawStageDate(status, i)
                      
                      if (rawDate) {
                        const date = new Date(rawDate)
                        
                        // Ensure this date is >= the previous stage's date
                        if (i > 0 && stageDates[i - 1]) {
                          const prevDate = new Date(stageDates[i - 1])
                          if (date < prevDate) {
                            // If this date is earlier than previous, set it to 1 day after previous
                            date.setTime(prevDate.getTime() + 24 * 60 * 60 * 1000)
                          }
                        }
                        
                        stageDates[i] = date.toISOString()
                      } else {
                        stageDates[i] = null
                      }
                    }
                    
                    // Helper to get event date for a status (using chronological dates)
                    const getEventDate = (status) => {
                      const statusIndex = FLOW.indexOf(status)
                      return stageDates[statusIndex] || null
                    }
                    
                    // Get actual completion dates from timeline events
                    // These are populated from the order timeline as they are completed
                    const configReceivedEvent = events.find(e => e.to === 'CONFIG_RECEIVED') || (order.createdAt ? { at: order.createdAt } : null)
                    const atUpfitterEvent = events.find(e => e.to === 'AT_UPFITTER')
                    const readyForDeliveryEvent = events.find(e => e.to === 'READY_FOR_DELIVERY')
                    const deliveredEvent = events.find(e => e.to === 'DELIVERED')
                    
                    // Determine which stages are completed based on order.status
                    // Use >= to include the current stage (e.g., if at READY_FOR_DELIVERY, upfit is completed)
                    const atUpfitterIndex = FLOW.indexOf('AT_UPFITTER')
                    const readyForDeliveryIndex = FLOW.indexOf('READY_FOR_DELIVERY')
                    const deliveredIndex = FLOW.indexOf('DELIVERED')
                    const currentStatusIndex = FLOW.indexOf(order.status)
                    
                    const isOemCompleted = currentStatusIndex >= atUpfitterIndex
                    const isUpfitCompleted = currentStatusIndex >= readyForDeliveryIndex
                    const isDeliveryCompleted = currentStatusIndex >= deliveredIndex
                    
                    // Helper to get actual completed date: check event first, then order status/updatedAt
                    // This ensures dates update when the order reaches that stage, not after
                    const getActualCompletedDate = (targetStatus, event, fallbackDate) => {
                      // First priority: use event if available
                      if (event?.at) return event.at
                      
                      // Second priority: if order status is at this stage or later, use updatedAt or fallback
                      const targetIndex = FLOW.indexOf(targetStatus)
                      if (currentStatusIndex >= targetIndex) {
                        // If order has actual completion date stored, use it
                        if (fallbackDate) return fallbackDate
                        // Otherwise use updatedAt (when status changed to this stage)
                        if (order.updatedAt) return order.updatedAt
                      }
                      
                      return null
                    }
                    
                    // 1. OEM Completed: Order Received through At Upfitter
                    // Planned ETA: Chassis ETA from orders table
                    // Actual Completed: Date it arrives at the upfitter (AT_UPFITTER event or when status reached AT_UPFITTER)
                    // Duration: At Upfitter - Order Received
                    const oemStartDate = configReceivedEvent?.at || order.createdAt // Order Received
                    const oemEndDate = getActualCompletedDate('AT_UPFITTER', atUpfitterEvent, order.actualOemCompleted)
                    const oemPlannedEta = order.oemEta // Chassis ETA from orders table
                    const oemActualCompleted = isOemCompleted && oemEndDate ? oemEndDate : null
                    const oemDuration = oemStartDate && oemEndDate ? Math.max(0, Math.ceil((new Date(oemEndDate) - new Date(oemStartDate)) / (1000 * 60 * 60 * 24))) : null
                    const oemVariance = oemPlannedEta && oemActualCompleted ? Math.ceil((new Date(oemActualCompleted) - new Date(oemPlannedEta)) / (1000 * 60 * 60 * 24)) : null
                    
                    // 2. Upfit Completed: At Upfitter through Ready for Delivery
                    // Planned ETA: Upfit ETA from orders table
                    // Actual Completed: Date it is ready for delivery (READY_FOR_DELIVERY event or when status reached READY_FOR_DELIVERY)
                    // Duration: Ready for Delivery - At Upfitter
                    const upfitStartDate = atUpfitterEvent?.at || (isOemCompleted && oemEndDate ? oemEndDate : null) // At Upfitter (from event or calculated)
                    const upfitEndDate = getActualCompletedDate('READY_FOR_DELIVERY', readyForDeliveryEvent, order.actualUpfitterCompleted)
                    const upfitPlannedEta = order.upfitterEta // Upfit ETA from orders table
                    const upfitActualCompleted = isUpfitCompleted && upfitEndDate ? upfitEndDate : null
                    const upfitDuration = upfitStartDate && upfitEndDate ? Math.max(0, Math.ceil((new Date(upfitEndDate) - new Date(upfitStartDate)) / (1000 * 60 * 60 * 24))) : null
                    const upfitVariance = upfitPlannedEta && upfitActualCompleted ? Math.ceil((new Date(upfitActualCompleted) - new Date(upfitPlannedEta)) / (1000 * 60 * 60 * 24)) : null
                    
                    // 3. Final Delivery: Ready for Delivery through Delivered
                    // Planned ETA: Final ETA from orders table
                    // Actual Completed: Delivered date (DELIVERED event or when status reached DELIVERED)
                    // Duration: Delivered - Ready for Delivery
                    const deliveryStartDate = readyForDeliveryEvent?.at || (isUpfitCompleted && upfitEndDate ? upfitEndDate : null) // Ready for Delivery (from event or calculated)
                    const deliveryEndDate = getActualCompletedDate('DELIVERED', deliveredEvent, order.actualDeliveryCompleted)
                    const deliveryPlannedEta = order.deliveryEta // Final ETA from orders table
                    const deliveryActualCompleted = isDeliveryCompleted && deliveryEndDate ? deliveryEndDate : null
                    const deliveryDuration = deliveryStartDate && deliveryEndDate ? Math.max(0, Math.ceil((new Date(deliveryEndDate) - new Date(deliveryStartDate)) / (1000 * 60 * 60 * 24))) : null
                    const deliveryVariance = deliveryPlannedEta && deliveryActualCompleted ? Math.ceil((new Date(deliveryActualCompleted) - new Date(deliveryPlannedEta)) / (1000 * 60 * 60 * 24)) : null
                    
                    return (
                      <>
                        <TableRow>
                          <TableCell className="font-medium text-center">OEM Completed</TableCell>
                          <TableCell className="text-center">
                            {oemPlannedEta ? new Date(oemPlannedEta).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {oemActualCompleted ? new Date(oemActualCompleted).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {oemDuration !== null ? oemDuration : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {oemVariance !== null ? (
                              <span className={oemVariance > 0 ? 'text-red-600' : oemVariance < 0 ? 'text-green-600' : 'text-gray-600'}>
                                {oemVariance > 0 ? '+' : ''}{oemVariance} days
                              </span>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-center">Upfit Completed</TableCell>
                          <TableCell className="text-center">
                            {upfitPlannedEta ? new Date(upfitPlannedEta).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {upfitActualCompleted ? new Date(upfitActualCompleted).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {upfitDuration !== null ? upfitDuration : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {upfitVariance !== null ? (
                              <span className={upfitVariance > 0 ? 'text-red-600' : upfitVariance < 0 ? 'text-green-600' : 'text-gray-600'}>
                                {upfitVariance > 0 ? '+' : ''}{upfitVariance} days
                              </span>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-center">Final Delivery</TableCell>
                          <TableCell className="text-center">
                            {deliveryPlannedEta ? new Date(deliveryPlannedEta).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {deliveryActualCompleted ? new Date(deliveryActualCompleted).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {deliveryDuration !== null ? deliveryDuration : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {deliveryVariance !== null ? (
                              <span className={deliveryVariance > 0 ? 'text-red-600' : deliveryVariance < 0 ? 'text-green-600' : 'text-gray-600'}>
                                {deliveryVariance > 0 ? '+' : ''}{deliveryVariance} days
                              </span>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      </>
                    )
                  })()}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 💬 5. Comments & Collaboration Feed */}
        <TabsContent value="comments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comments & Collaboration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {[...notes.map(n => ({ ...n, type: 'note' })), ...messages.map(m => ({ ...m, type: 'message' }))].sort((a, b) => new Date(b.at) - new Date(a.at)).map((item) => (
                  <div key={item.id} className="border rounded p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.type === 'note' ? 'Note' : 'Message'}</Badge>
                        <span className="font-medium">{item.user || 'System'}</span>
                        {item.type === 'message' && <span className="text-sm text-gray-500">→ {item.to}</span>}
                      </div>
                      <span className="text-xs text-gray-500">{new Date(item.at).toLocaleString()}</span>
                    </div>
                    <div className="text-sm">{item.text}</div>
                  </div>
                ))}
                {notes.length === 0 && messages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">No comments or messages yet.</div>
                )}
              </div>
              <div className="border-t pt-4 space-y-3">
                <form onSubmit={onAddNote} className="space-y-2">
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="Add a note or comment..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                  />
                  <Button type="submit" disabled={saving || !noteText.trim()} size="sm">
                    Add Note
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ⚙️ 7. Operational Data */}
        <TabsContent value="operational" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Financing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Rate:</span>
                  <span>4.9% APR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Term:</span>
                  <span>60 months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lender:</span>
                  <span>Ford Credit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant={order.inventoryStatus === 'SOLD' ? 'default' : 'secondary'}>
                    {order.inventoryStatus === 'SOLD' ? 'Approved' : 'Pending'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Logistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Carrier:</span>
                  <span>Ford Logistics</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Route:</span>
                  <span>OEM → Upfitter → Dealer</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ETA:</span>
                  <span>{order.deliveryEta ? new Date(order.deliveryEta).toLocaleDateString() : 'TBD'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tracking:</span>
                  <button 
                    onClick={() => setShowTrackingModal(true)}
                    className="text-blue-600 underline hover:text-blue-800 cursor-pointer"
                  >
                    View GPT Link
                  </button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Warranty & Service</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">OEM Warranty:</span>
                  <span>3 years / 36,000 miles</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Upfit Warranty:</span>
                  <span>1 year / 12,000 miles</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Service Plan:</span>
                  <span>Standard</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Charging Readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Installation Status:</span>
                  <Badge variant="secondary">Not Applicable</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Charger Type:</span>
                  <span>N/A (Diesel/Gas)</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 📊 8. Analytics / Insights */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Margin Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Revenue:</span>
                  <span className="font-medium">${Number(order.pricingJson?.total || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Cost:</span>
                  <span>${marginData?.cost ? marginData.cost.toLocaleString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Gross Margin:</span>
                  <span className={`font-medium ${margin && margin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${margin ? margin.toLocaleString() : 'N/A'} ({marginData?.marginPercent ? marginData.marginPercent.toFixed(1) : '0'}%)
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Lead Time Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Lead Time:</span>
                  <span className="font-medium">{leadTime ? `${leadTime} days` : 'TBD'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">OEM Stage:</span>
                  <span>~10 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Upfit Stage:</span>
                  <span>~15 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Average per Stage:</span>
                  <span>{leadTime ? (leadTime / FLOW.length).toFixed(1) : 'N/A'} days</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>SLA Tracking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Target Delivery:</span>
                  <span>{order.deliveryEta ? new Date(order.deliveryEta).toLocaleDateString() : 'TBD'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant={order.status === 'DELIVERED' ? 'default' : order.deliveryEta && new Date(order.deliveryEta) < new Date() ? 'destructive' : 'secondary'}>
                    {order.status === 'DELIVERED' ? 'On Time' : order.deliveryEta && new Date(order.deliveryEta) < new Date() ? 'Overdue' : 'On Track'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Carbon Footprint</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Vehicle Type:</span>
                  <span>{order.buildJson?.chassis?.powertrain?.includes('EV') ? 'Electric' : 'Diesel/Gas'}</span>
                </div>
                {order.buildJson?.chassis?.powertrain?.includes('EV') && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estimated Offset:</span>
                      <span className="text-green-600">~8.5 tons CO₂/year</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Lifetime Offset:</span>
                      <span className="text-green-600">~85 tons CO₂</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ETA Editor Modal */}
      {showEtaEditor && canEditEta && (
        <div className="fixed inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEtaEditor(false)}></div>
          <div className="relative bg-white rounded shadow-lg w-full max-w-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Edit ETAs</div>
              <button className="text-sm" onClick={() => setShowEtaEditor(false)}>Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm">OEM ETA<input name="oemEta" id="eta_oem" type="date" defaultValue={order.oemEta ? order.oemEta.slice(0,10) : ''} className="border rounded px-2 py-1 w-full" /></label>
              <label className="text-sm">Upfitter ETA<input name="upfitterEta" id="eta_upfitter" type="date" defaultValue={order.upfitterEta ? order.upfitterEta.slice(0,10) : ''} className="border rounded px-2 py-1 w-full" /></label>
              <label className="text-sm">Final Delivery ETA<input name="deliveryEta" id="eta_delivery" type="date" defaultValue={order.deliveryEta ? order.deliveryEta.slice(0,10) : ''} className="border rounded px-2 py-1 w-full" /></label>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowEtaEditor(false)}>Cancel</Button>
              <Button disabled={saving} onClick={async () => {
                const payload = {
                  oemEta: document.getElementById('eta_oem').value || null,
                  upfitterEta: document.getElementById('eta_upfitter').value || null,
                  deliveryEta: document.getElementById('eta_delivery').value || null,
                }
                await onUpdateEtas(payload)
                setShowEtaEditor(false)
              }}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      <Dialog open={showTrackingModal} onOpenChange={setShowTrackingModal}>
        <DialogContent className="max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 w-[95vw] sm:w-full">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg sm:text-xl">Shipment Tracking</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Order {order?.id} - {order?.stockNumber || 'N/A'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6 mt-2 sm:mt-4">
            {/* Shipment Status */}
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Shipment Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Current Status</div>
                    <Badge variant={
                      order?.status === 'DELIVERED' ? 'default' :
                      order?.status === 'OEM_IN_TRANSIT' || order?.status === 'AT_UPFITTER' ? 'secondary' :
                      'outline'
                    } className="text-xs sm:text-sm">
                      {getStatusLabel(order?.status || 'CONFIG_RECEIVED')}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Carrier</div>
                    <div className="text-sm sm:text-base">Ford Logistics</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Tracking Number</div>
                    <div className="text-sm sm:text-base font-mono break-all">TRK-{order?.id?.slice(-8) || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Estimated Delivery</div>
                    <div className="text-sm sm:text-base">
                      {order?.deliveryEta ? new Date(order.deliveryEta).toLocaleDateString() : 'TBD'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Map */}
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Current Location</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="w-full h-64 sm:h-80 md:h-96 rounded-lg overflow-hidden border">
                  <iframe
                    src={trackingLocation.embedUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={true}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Shipment Location"
                  />
                </div>
                <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-600">
                  <div className="font-medium mb-0.5 sm:mb-1">Location:</div>
                  <div className="break-words">{trackingLocation.name || trackingLocation.place}</div>
                  <div className="font-medium mb-0.5 sm:mb-1 mt-2">Last Update:</div>
                  <div className="break-words">{new Date().toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>

            {/* Tracking Timeline */}
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Tracking History</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 sm:space-y-4">
                  {order?.status && (() => {
                    const statusIndex = FLOW.indexOf(order.status)
                    const trackingEvents = []
                    
                    // Generate tracking events based on order status
                    if (statusIndex >= 0) {
                      trackingEvents.push({
                        status: 'CONFIG_RECEIVED',
                        location: 'Ford Commercial Vehicle Center',
                        timestamp: order.createdAt || new Date().toISOString(),
                        description: 'Order received and configuration confirmed'
                      })
                    }
                    if (statusIndex >= 1) {
                      trackingEvents.push({
                        status: 'OEM_ALLOCATED',
                        location: 'Ford Manufacturing Plant',
                        timestamp: order.oemEta ? new Date(new Date(order.oemEta).getTime() - 5 * 86400000).toISOString() : new Date().toISOString(),
                        description: 'Chassis allocated to production line'
                      })
                    }
                    if (statusIndex >= 2) {
                      trackingEvents.push({
                        status: 'OEM_PRODUCTION',
                        location: 'Ford Manufacturing Plant',
                        timestamp: order.oemEta ? new Date(new Date(order.oemEta).getTime() - 3 * 86400000).toISOString() : new Date().toISOString(),
                        description: 'Chassis in production'
                      })
                    }
                    if (statusIndex >= 3) {
                      trackingEvents.push({
                        status: 'OEM_IN_TRANSIT',
                        location: 'In Transit',
                        timestamp: order.oemEta || new Date().toISOString(),
                        description: 'Chassis shipped from OEM to upfitter'
                      })
                    }
                    if (statusIndex >= 4) {
                      trackingEvents.push({
                        status: 'AT_UPFITTER',
                        location: order.buildJson?.upfitter?.name || 'Upfitter Facility',
                        timestamp: order.upfitterEta ? new Date(new Date(order.upfitterEta).getTime() - 2 * 86400000).toISOString() : new Date().toISOString(),
                        description: 'Chassis arrived at upfitter facility'
                      })
                    }
                    if (statusIndex >= 5) {
                      trackingEvents.push({
                        status: 'UPFIT_IN_PROGRESS',
                        location: order.buildJson?.upfitter?.name || 'Upfitter Facility',
                        timestamp: order.upfitterEta || new Date().toISOString(),
                        description: 'Upfit work in progress'
                      })
                    }
                    if (statusIndex >= 6) {
                      trackingEvents.push({
                        status: 'READY_FOR_DELIVERY',
                        location: order.buildJson?.upfitter?.name || 'Upfitter Facility',
                        timestamp: order.deliveryEta ? new Date(new Date(order.deliveryEta).getTime() - 1 * 86400000).toISOString() : new Date().toISOString(),
                        description: 'Vehicle ready for final delivery'
                      })
                    }
                    if (statusIndex >= 7) {
                      trackingEvents.push({
                        status: 'DELIVERED',
                        location: 'Ford Commercial Vehicle Center',
                        timestamp: order.deliveryEta || new Date().toISOString(),
                        description: 'Vehicle delivered to dealer'
                      })
                    }

                    return trackingEvents.map((event, idx) => (
                      <div key={idx} className="flex gap-2 sm:gap-4">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${
                            idx === trackingEvents.length - 1 ? 'bg-blue-600' : 'bg-green-600'
                          }`} />
                          {idx < trackingEvents.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-3 sm:pb-4 min-w-0">
                          <div className="font-medium text-xs sm:text-sm break-words">{getStatusLabel(event.status)}</div>
                          <div className="text-xs text-gray-500 mt-0.5 sm:mt-1 break-words">{event.location}</div>
                          <div className="text-xs text-gray-400 mt-0.5 sm:mt-1 break-words">
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5 sm:mt-1 break-words">{event.description}</div>
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
