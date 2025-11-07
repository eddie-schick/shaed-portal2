import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { advanceOrder, getOrder, publishListing, updateEtas, cancelOrder, setStock, getNotes, addNote, getStatusLabel, setInventoryStatus, ensureDemoOrder } from '@/lib/orderApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'

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
      // Directly read from localStorage to get the exact order from the table
      // This bypasses any transformations in ensureSeedData
      // Use the same localStorage keys as orderApi.js
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
        // Use the exact order object from localStorage (same as table)
        // Make a shallow copy to avoid mutations, but keep all original data
        resolved = { ...foundOrder }
        // Get events for this order
        const events = readLocal('orderEvents', [])
        eventsData = events.filter(e => e.orderId === foundOrder.id) || []
        console.log('Found actual order from table:', resolved.id, resolved.buildJson?.bodyType, resolved.status)
      } else {
        console.warn('Order not found in localStorage, trying getOrder API')
        // Fallback to API if not found directly
        try {
          const data = await getOrder(id)
          if (data?.order) {
            resolved = data.order
            eventsData = data.events || []
            console.log('Found order via API:', resolved.id)
          }
        } catch (apiErr) {
          console.warn('getOrder API failed:', apiErr)
        }
      }
    } catch (err) {
      console.error('Error loading order:', err)
      // Last resort: try API
      try {
        const data = await getOrder(id)
        if (data?.order) {
          resolved = data.order
          eventsData = data.events || []
        }
      } catch (apiErr) {
        console.error('All order loading methods failed:', apiErr)
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

  // Calculate margin (simplified) - safe even if order is null
  const margin = useMemo(() => {
    if (!order?.pricingJson) return null
    const total = order.pricingJson.total || 0
    const cost = (order.pricingJson.chassisMsrp || 0) * 0.85 + (order.pricingJson.bodyPrice || 0) * 0.80 + (order.pricingJson.labor || 0) * 0.70
    return total - cost
  }, [order])

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
                <div className="flex flex-wrap gap-2">
                  <Badge variant={orderType === 'Fleet' ? 'default' : orderType === 'Stock' ? 'secondary' : 'outline'}>
                    {orderType}
                  </Badge>
                  <Badge variant={order.status === 'DELIVERED' ? 'default' : order.status === 'CANCELED' ? 'destructive' : 'secondary'}>
                    {getStatusLabel(order.status)}
                  </Badge>
                </div>
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
              {nextLabel && (
                <Button size="sm" className="w-full sm:w-auto" onClick={doAdvance} disabled={saving}>
                  Advance to {getStatusLabel(nextLabel)}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
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
              <div>Sales Rep {order.dealerCode || 'N/A'}</div>
            </div>
          </div>
          {(order.buyerSegment || order.priority || (order.tags && order.tags.length > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm pt-2 border-t">
              {order.buyerSegment && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Buyer Segment</div>
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
        {/* Mobile: Button to open tab menu */}
        <div className="sm:hidden mb-4">
          <Button
            variant="outline"
            onClick={() => setMobileTabSheetOpen(true)}
            className="w-full justify-between"
          >
            <span className="capitalize">{activeTab === 'timeline' ? 'Timeline' : activeTab === 'comments' ? 'Comments' : activeTab === 'participants' ? 'Participants' : activeTab === 'operational' ? 'Operational' : 'Analytics'}</span>
            <Menu className="h-4 w-4" />
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

        {/* Mobile: Sheet with tab options */}
        <Sheet open={mobileTabSheetOpen} onOpenChange={setMobileTabSheetOpen}>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>Select Tab</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              <Button
                variant={activeTab === 'timeline' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab('timeline')
                  setMobileTabSheetOpen(false)
                }}
              >
                Timeline
              </Button>
              <Button
                variant={activeTab === 'comments' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab('comments')
                  setMobileTabSheetOpen(false)
                }}
              >
                Comments
              </Button>
              <Button
                variant={activeTab === 'participants' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab('participants')
                  setMobileTabSheetOpen(false)
                }}
              >
                Participants
              </Button>
              <Button
                variant={activeTab === 'operational' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab('operational')
                  setMobileTabSheetOpen(false)
                }}
              >
                Operational
              </Button>
              <Button
                variant={activeTab === 'analytics' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab('analytics')
                  setMobileTabSheetOpen(false)
                }}
              >
                Analytics
              </Button>
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
                          Contact: {order.buyerName.split(' ')[0]}<br />
                          Email: contact@{order.buyerName.toLowerCase().replace(/\s+/g, '')}.com<br />
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
                    <TableCell className="font-medium">Seller / Dealer</TableCell>
                    <TableCell>Dealer {order.dealerCode || 'N/A'}</TableCell>
                    <TableCell>
                      Rep: Sales Rep {order.dealerCode || 'N/A'}<br />
                      Email: sales@{order.dealerCode?.toLowerCase() || 'dealer'}.com<br />
                      Phone: (555) 234-5678
                    </TableCell>
                    <TableCell>OEM: Ford Motor Company</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Upfitter / Distributor</TableCell>
                    <TableCell>{order.buildJson?.upfitter?.name || 'N/A'}</TableCell>
                    <TableCell>
                      Contact: {order.buildJson?.upfitter?.name?.split(' ')[0] || 'N/A'}<br />
                      Email: contact@{order.buildJson?.upfitter?.id || 'upfitter'}.com<br />
                      Phone: (555) 345-6789
                    </TableCell>
                    <TableCell>Location: {order.buildJson?.upfitter?.name?.split(' - ')[1] || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Financing Provider</TableCell>
                    <TableCell>Ford Credit</TableCell>
                    <TableCell>
                      Loan/Lease Type: Commercial Lease<br />
                      Contact: (555) 456-7890
                    </TableCell>
                    <TableCell>Status: {order.inventoryStatus === 'SOLD' ? 'Approved' : 'Pending'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Logistics Provider</TableCell>
                    <TableCell>Ford Logistics</TableCell>
                    <TableCell>
                      Pickup: OEM Plant<br />
                      Drop-off: {order.buildJson?.upfitter?.name?.split(' - ')[1] || 'Upfitter Location'}
                    </TableCell>
                    <TableCell>
                      <a href="#" className="text-blue-600 underline">Tracking Link</a>
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
                  {FLOW.map((status, index) => {
                    const isCompleted = FLOW.indexOf(order.status) > index
                    const isCurrent = order.status === status
                    const event = events.find(e => e.to === status)
                    const isLast = index === FLOW.length - 1
                    
                    // Calculate stage duration
                    const getStageDuration = () => {
                      if (!event) return null
                      const prevEvent = index > 0 ? events.find(e => e.to === FLOW[index - 1]) : null
                      if (!prevEvent) return null
                      const start = new Date(prevEvent.at)
                      const end = new Date(event.at)
                      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
                      return days
                    }
                    const stageDuration = getStageDuration()
                    
                    // Get actual completion date and variance
                    const getActualDate = () => {
                      if (status === 'OEM_IN_TRANSIT' && order.actualOemCompleted) return order.actualOemCompleted
                      if (status === 'UPFIT_IN_PROGRESS' && order.actualUpfitterCompleted) return order.actualUpfitterCompleted
                      if (status === 'DELIVERED' && order.actualDeliveryCompleted) return order.actualDeliveryCompleted
                      return null
                    }
                    const actualDate = getActualDate()
                    
                    // Calculate variance (days difference between actual and planned)
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
                          {event && (
                            <div className="text-sm text-gray-600">
                              {new Date(event.at).toLocaleString()} – Updated by System
                            </div>
                          )}
                          {actualDate && (
                            <div className="text-sm text-green-600">
                              Actual: {new Date(actualDate).toLocaleDateString()}
                              {variance !== null && (
                                <span className={`ml-2 ${variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                  ({variance > 0 ? '+' : ''}{variance} days)
                                </span>
                              )}
                            </div>
                          )}
                          {index === FLOW.indexOf(order.status) && (
                            <div className="text-xs text-gray-500">
                              {order.oemEta && status.includes('OEM') && `Planned ETA: ${new Date(order.oemEta).toLocaleDateString()}`}
                              {order.upfitterEta && status.includes('UPFIT') && `Planned ETA: ${new Date(order.upfitterEta).toLocaleDateString()}`}
                              {order.deliveryEta && status.includes('DELIVERY') && `Planned ETA: ${new Date(order.deliveryEta).toLocaleDateString()}`}
                            </div>
                          )}
                          {stageDuration !== null && (
                            <div className="text-xs text-gray-500">
                              Duration: {stageDuration} days
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
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
                      <TableHead className="text-xs sm:text-sm">Stage</TableHead>
                      <TableHead className="text-xs sm:text-sm">Planned ETA</TableHead>
                      <TableHead className="text-xs sm:text-sm">Actual Completed</TableHead>
                      <TableHead className="text-xs sm:text-sm">Duration (Days)</TableHead>
                      <TableHead className="text-xs sm:text-sm">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">OEM In Transit</TableCell>
                    <TableCell>{order.oemEta ? new Date(order.oemEta).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{order.actualOemCompleted ? new Date(order.actualOemCompleted).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      {order.actualOemCompleted && order.createdAt ? (
                        Math.ceil((new Date(order.actualOemCompleted) - new Date(order.createdAt)) / (1000 * 60 * 60 * 24))
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {order.actualOemCompleted && order.oemEta ? (() => {
                        const variance = Math.ceil((new Date(order.actualOemCompleted) - new Date(order.oemEta)) / (1000 * 60 * 60 * 24))
                        return (
                          <span className={variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-gray-600'}>
                            {variance > 0 ? '+' : ''}{variance} days
                          </span>
                        )
                      })() : '-'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Upfit In Progress</TableCell>
                    <TableCell>{order.upfitterEta ? new Date(order.upfitterEta).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{order.actualUpfitterCompleted ? new Date(order.actualUpfitterCompleted).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      {order.actualUpfitterCompleted && order.actualOemCompleted ? (
                        Math.ceil((new Date(order.actualUpfitterCompleted) - new Date(order.actualOemCompleted)) / (1000 * 60 * 60 * 24))
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {order.actualUpfitterCompleted && order.upfitterEta ? (() => {
                        const variance = Math.ceil((new Date(order.actualUpfitterCompleted) - new Date(order.upfitterEta)) / (1000 * 60 * 60 * 24))
                        return (
                          <span className={variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-gray-600'}>
                            {variance > 0 ? '+' : ''}{variance} days
                          </span>
                        )
                      })() : '-'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Delivery</TableCell>
                    <TableCell>{order.deliveryEta ? new Date(order.deliveryEta).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{order.actualDeliveryCompleted ? new Date(order.actualDeliveryCompleted).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      {order.actualDeliveryCompleted && order.actualUpfitterCompleted ? (
                        Math.ceil((new Date(order.actualDeliveryCompleted) - new Date(order.actualUpfitterCompleted)) / (1000 * 60 * 60 * 24))
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {order.actualDeliveryCompleted && order.deliveryEta ? (() => {
                        const variance = Math.ceil((new Date(order.actualDeliveryCompleted) - new Date(order.deliveryEta)) / (1000 * 60 * 60 * 24))
                        return (
                          <span className={variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-gray-600'}>
                            {variance > 0 ? '+' : ''}{variance} days
                          </span>
                        )
                      })() : '-'}
                    </TableCell>
                  </TableRow>
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
                <form onSubmit={onSendMessage} className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={messageTo}
                      onChange={(e) => setMessageTo(e.target.value)}
                    >
                      <option>OEM</option>
                      <option>Upfitter</option>
                      <option>Dealer</option>
                      <option>Buyer</option>
                    </select>
                    <input
                      className="flex-1 border rounded px-3 py-2 text-sm"
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                    />
                    <Button type="submit" disabled={!messageText.trim()} size="sm">
                      Send
                    </Button>
                  </div>
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
                  <a href="#" className="text-blue-600 underline">View GPS</a>
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
                  <span>${margin ? (order.pricingJson?.total - margin).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">Gross Margin:</span>
                  <span className={`font-medium ${margin && margin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${margin ? margin.toLocaleString() : 'N/A'} ({margin ? ((margin / order.pricingJson?.total) * 100).toFixed(1) : '0'}%)
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
    </div>
  )
}
