import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Helpers for API middleware
const __filename = typeof document === 'undefined' ? fileURLToPath(import.meta.url) : ''
const __dirname = typeof document === 'undefined' ? dirname(__filename) : ''

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return null
  const text = Buffer.concat(chunks).toString('utf-8')
  try { return JSON.parse(text) } catch { return null }
}

// Very small file-based datastore (ported from order-portal)
const DATA_DIR = path.join(__dirname, 'src', 'data')
const ORDERS_PATH = path.join(DATA_DIR, 'orders.json')
const EVENTS_PATH = path.join(DATA_DIR, 'statusEvents.json')

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try { await fs.access(ORDERS_PATH) } catch { await fs.writeFile(ORDERS_PATH, '[]', 'utf-8') }
  try { await fs.access(EVENTS_PATH) } catch { await fs.writeFile(EVENTS_PATH, '[]', 'utf-8') }

  const [ordersRaw] = await Promise.all([
    fs.readFile(ORDERS_PATH, 'utf-8').catch(() => '[]')
  ])
  const hasOrders = (JSON.parse(ordersRaw || '[]')).length > 0
  if (!hasOrders) {
    const now = new Date()
    const mkDate = (offsetDays) => new Date(now.getTime() + offsetDays * 86400000).toISOString()
    const demo = [
      { id: 'ord_demo01', status: 'CONFIG_RECEIVED', dealerCode: 'CVC001', oemEta: mkDate(30), upfitterEta: null, deliveryEta: null, isStock: false },
      { id: 'ord_demo02', status: 'OEM_ALLOCATED', dealerCode: 'CVC002', oemEta: mkDate(25), upfitterEta: null, deliveryEta: null, isStock: true },
      { id: 'ord_demo03', status: 'OEM_PRODUCTION', dealerCode: 'CVC003', oemEta: mkDate(20), upfitterEta: null, deliveryEta: null, isStock: false },
      { id: 'ord_demo04', status: 'OEM_IN_TRANSIT', dealerCode: 'CVC004', oemEta: mkDate(10), upfitterEta: mkDate(20), deliveryEta: mkDate(35), isStock: true },
      { id: 'ord_demo05', status: 'AT_UPFITTER', dealerCode: 'CVC005', oemEta: mkDate(-5), upfitterEta: mkDate(10), deliveryEta: mkDate(25), isStock: false },
      { id: 'ord_demo06', status: 'UPFIT_IN_PROGRESS', dealerCode: 'CVC006', oemEta: mkDate(-10), upfitterEta: mkDate(5), deliveryEta: mkDate(20), isStock: true },
      { id: 'ord_demo07', status: 'READY_FOR_DELIVERY', dealerCode: 'CVC007', oemEta: mkDate(-15), upfitterEta: mkDate(-5), deliveryEta: mkDate(5), isStock: true },
      { id: 'ord_demo08', status: 'DELIVERED', dealerCode: 'CVC008', oemEta: mkDate(-40), upfitterEta: mkDate(-25), deliveryEta: mkDate(-10), isStock: false },
    ]
    const orders = demo.map(d => ({
      id: d.id,
      dealerCode: d.dealerCode,
      upfitterId: null,
      status: d.status,
      oemEta: d.oemEta,
      upfitterEta: d.upfitterEta,
      deliveryEta: d.deliveryEta,
      buildJson: {
        bodyType: 'Flatbed/Stake/Platform',
        manufacturer: 'Rugby Manufacturing',
        chassis: { series: 'F-550', cab: 'Crew Cab', drivetrain: '4x4', wheelbase: '169', gvwr: '19500', powertrain: 'Gas' },
        bodySpecs: { length: 12, material: 'Steel' },
        upfitter: { id: 'u_demo', name: 'Demo Upfits' }
      },
      pricingJson: { chassisMsrp: 64500, bodyPrice: 21500, optionsPrice: 2500, labor: 3800, freight: 1500, incentives: [], taxes: 0, total: 91800 },
      isStock: d.isStock,
      listingStatus: null,
      createdAt: mkDate(-7),
      updatedAt: mkDate(-1),
    }))
    await fs.writeFile(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf-8')

    const flow = ['CONFIG_RECEIVED','OEM_ALLOCATED','OEM_PRODUCTION','OEM_IN_TRANSIT','AT_UPFITTER','UPFIT_IN_PROGRESS','READY_FOR_DELIVERY','DELIVERED']
    const events = orders.flatMap(o => {
      const idx = flow.indexOf(o.status)
      const created = new Date(o.createdAt).getTime()
      return flow.slice(0, Math.max(idx, 1)).map((to, i) => ({
        id: `evt_${o.id}_${i}`,
        orderId: o.id,
        from: i === 0 ? '' : flow[i-1],
        to,
        at: new Date(created + i * 86400000).toISOString()
      }))
    })
    await fs.writeFile(EVENTS_PATH, JSON.stringify(events, null, 2), 'utf-8')
  }
}

async function readOrders() {
  await ensureDataFiles()
  const raw = await fs.readFile(ORDERS_PATH, 'utf-8')
  return JSON.parse(raw)
}
async function writeOrders(orders) {
  await ensureDataFiles()
  await fs.writeFile(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf-8')
}
async function readEvents() {
  await ensureDataFiles()
  const raw = await fs.readFile(EVENTS_PATH, 'utf-8')
  return JSON.parse(raw)
}
async function writeEvents(events) {
  await ensureDataFiles()
  await fs.writeFile(EVENTS_PATH, JSON.stringify(events, null, 2), 'utf-8')
}
async function getOrderById(id) {
  const orders = await readOrders()
  return orders.find(o => o.id === id)
}
async function upsertOrder(updated) {
  const orders = await readOrders()
  const idx = orders.findIndex(o => o.id === updated.id)
  if (idx === -1) orders.push(updated)
  else orders[idx] = updated
  await writeOrders(orders)
}
async function addStatusEvent(event) {
  const events = await readEvents()
  events.push(event)
  await writeEvents(events)
}

const ORDER_FLOW = ['CONFIG_RECEIVED','OEM_ALLOCATED','OEM_PRODUCTION','OEM_IN_TRANSIT','AT_UPFITTER','UPFIT_IN_PROGRESS','READY_FOR_DELIVERY','DELIVERED']
function canTransition(from, to) {
  if (to === 'CANCELED') return true
  if (from === 'CANCELED') return false
  const currentIndex = ORDER_FLOW.indexOf(from)
  const nextIndex = ORDER_FLOW.indexOf(to)
  return nextIndex === currentIndex + 1
}

function orderApiMiddleware(server) {
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return next()

    try {
      // GET /api/orders
      if (req.method === 'GET' && url.pathname === '/api/orders') {
        const status = url.searchParams.get('status')
        const dealerCode = url.searchParams.get('dealerCode')
        const stock = url.searchParams.get('stock')
        const q = url.searchParams.get('q')
        const from = url.searchParams.get('from')
        const to = url.searchParams.get('to')
        let orders = await readOrders()
        if (status) orders = orders.filter(o => o.status === status)
        if (dealerCode) orders = orders.filter(o => o.dealerCode === dealerCode)
        if (stock != null && stock !== '') {
          const want = stock === 'true'
          orders = orders.filter(o => o.isStock === want)
        }
        if (q) orders = orders.filter(o => o.id.includes(q))
        if (from) orders = orders.filter(o => new Date(o.createdAt) >= new Date(from))
        if (to) orders = orders.filter(o => new Date(o.createdAt) <= new Date(to))
        return json(res, 200, { orders })
      }

      // GET /api/orders/:id
      const orderIdMatch = url.pathname.match(/^\/api\/orders\/([^\/]+)$/)
      if (req.method === 'GET' && orderIdMatch) {
        const id = decodeURIComponent(orderIdMatch[1])
        const order = await getOrderById(id)
        if (!order) return json(res, 404, { error: 'Not found' })
        const events = (await readEvents()).filter(e => e.orderId === order.id)
        return json(res, 200, { order, events })
      }

      // POST /api/orders/:id/transition
      const transitionMatch = url.pathname.match(/^\/api\/orders\/([^\/]+)\/transition$/)
      if (req.method === 'POST' && transitionMatch) {
        const id = decodeURIComponent(transitionMatch[1])
        const body = await readBody(req)
        const to = body?.to
        if (!to) return json(res, 400, { error: 'Missing target status' })
        const order = await getOrderById(id)
        if (!order) return json(res, 404, { error: 'Not found' })
        if (!canTransition(order.status, to)) return json(res, 400, { error: 'Illegal transition' })
        const prev = order.status
        order.status = to
        order.updatedAt = new Date().toISOString()
        await upsertOrder(order)
        await addStatusEvent({ id: `evt_${order.id}_${Date.now()}`, orderId: order.id, from: prev, to, at: order.updatedAt })
        return json(res, 200, { ok: true, status: to })
      }

      // PATCH /api/orders/:id/etas
      const etasMatch = url.pathname.match(/^\/api\/orders\/([^\/]+)\/etas$/)
      if (req.method === 'PATCH' && etasMatch) {
        const id = decodeURIComponent(etasMatch[1])
        const body = await readBody(req)
        const order = await getOrderById(id)
        if (!order) return json(res, 404, { error: 'Not found' })
        const { oemEta, upfitterEta, deliveryEta } = body || {}
        order.oemEta = oemEta ?? order.oemEta ?? null
        order.upfitterEta = upfitterEta ?? order.upfitterEta ?? null
        order.deliveryEta = deliveryEta ?? order.deliveryEta ?? null
        order.updatedAt = new Date().toISOString()
        await upsertOrder(order)
        return json(res, 200, { ok: true, order })
      }

      // POST /api/orders/intake
      if (req.method === 'POST' && url.pathname === '/api/orders/intake') {
        const payload = await readBody(req)
        if (!payload) return json(res, 400, { error: 'Intake failed' })
        const now = new Date().toISOString()
        const id = `ord_${Math.random().toString(36).slice(2, 8)}`
        const newOrder = {
          id,
          dealerCode: payload.dealerCode,
          upfitterId: payload.upfitterId ?? payload.build?.upfitter?.id ?? null,
          status: 'CONFIG_RECEIVED',
          oemEta: null,
          upfitterEta: null,
          deliveryEta: null,
          buildJson: payload.build,
          pricingJson: payload.pricing,
          isStock: Boolean(payload.isStock),
          listingStatus: null,
          createdAt: now,
          updatedAt: now,
        }
        const orders = await readOrders()
        orders.unshift(newOrder)
        await writeOrders(orders)
        await addStatusEvent({ id: `evt_${id}`, orderId: id, from: '', to: 'CONFIG_RECEIVED', at: now })
        return json(res, 201, { id })
      }

      // POST /api/listings/:id/publish (stub)
      const publishMatch = url.pathname.match(/^\/api\/listings\/([^\/]+)\/publish$/)
      if (req.method === 'POST' && publishMatch) {
        return json(res, 200, { ok: true, channel: 'DEALER_WEBSITE' })
      }

      // GET /api/listings (unused stub)
      if (req.method === 'GET' && url.pathname === '/api/listings') {
        return json(res, 200, { listings: [] })
      }

      return next()
    } catch (err) {
      return json(res, 500, { error: 'Internal error' })
    }
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Dev server API
    {
      name: 'ford-order-api',
      configureServer(server) { orderApiMiddleware(server) },
      configurePreviewServer(server) { orderApiMiddleware(server) },
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
