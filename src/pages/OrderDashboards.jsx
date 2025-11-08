import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { calculateMargin } from '@/lib/marginUtils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDownIcon } from 'lucide-react'
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Legend, 
  ScatterChart, Scatter, Area, AreaChart
} from 'recharts'

const COLORS = {
  primary: '#3b82f6',
  secondary: '#64748b',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const DASHBOARD_OPTIONS = [
  { value: 'executive', label: 'Executive' },
  { value: 'financial', label: 'Financial' },
  { value: 'operations', label: 'Operations' },
  { value: 'accountability', label: 'Activity' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'sla', label: 'SLA' },
]

// AR Collections Analysis Component
function ARCollectionsAnalysis({ orders = [] }) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  
  // Reset to page 1 when orders change
  useEffect(() => {
    setCurrentPage(1)
  }, [orders])
  
  // Get outstanding invoices (delivered orders that haven't been paid)
  const outstandingInvoices = useMemo(() => {
    return orders
      .filter(o => {
        if (!o.actualDeliveryCompleted || !o.pricingJson?.total || o.status !== 'DELIVERED') {
          return false
        }
        const deliveryDate = new Date(o.actualDeliveryCompleted)
        deliveryDate.setHours(0, 0, 0, 0)
        const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24))
        return daysSinceDelivery >= 0 && daysSinceDelivery <= 90
      })
      .map(o => {
        const deliveryDate = new Date(o.actualDeliveryCompleted)
        deliveryDate.setHours(0, 0, 0, 0)
        const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24))
        
        let agingBucket = '0-30'
        if (daysSinceDelivery > 90) agingBucket = '90+'
        else if (daysSinceDelivery > 60) agingBucket = '61-90'
        else if (daysSinceDelivery > 30) agingBucket = '31-60'
        
        return {
          orderId: o.id,
          displayId: o.stockNumber || o.id,
          buyerName: o.buyerName || 'Unknown',
          buyerSegment: o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 'Fleet'),
          invoiceDate: deliveryDate,
          daysOutstanding: daysSinceDelivery,
          agingBucket,
          amount: o.pricingJson.total,
          margin: calculateMargin(o.pricingJson, o).margin
        }
      })
      .sort((a, b) => b.daysOutstanding - a.daysOutstanding)
  }, [orders])
  
  if (outstandingInvoices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No outstanding invoices found.
      </div>
    )
  }
  
  // Calculate totals by aging bucket
  const agingData = ['0-30', '31-60', '61-90', '90+'].map(bucket => {
    const invoices = outstandingInvoices.filter(inv => inv.agingBucket === bucket)
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0)
    const count = invoices.length
    return {
      bucket,
      count,
      amount: totalAmount,
      avgAmount: count > 0 ? totalAmount / count : 0
    }
  })
  
  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const totalCount = outstandingInvoices.length
  
  // Pagination calculations
  const totalPages = Math.ceil(outstandingInvoices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInvoices = outstandingInvoices.slice(startIndex, endIndex)
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              ${totalOutstanding.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">{totalCount} invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Days Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {Math.round(outstandingInvoices.reduce((sum, inv) => sum + inv.daysOutstanding, 0) / totalCount)}
            </div>
            <div className="text-xs text-gray-500 mt-1">days</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Over 60 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-600">
              ${outstandingInvoices
                .filter(inv => inv.daysOutstanding > 60)
                .reduce((sum, inv) => sum + inv.amount, 0)
                .toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {outstandingInvoices.filter(inv => inv.daysOutstanding > 60).length} invoices
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Aging Bucket Chart */}
      <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full mb-0">
        <BarChart data={agingData} margin={{ top: 5, right: 10, left: 10, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="bucket" 
            label={{ value: 'Days Outstanding', position: 'insideBottom', offset: -5 }}
            tick={{ fontSize: 10 }}
          />
          <YAxis 
            yAxisId="amount"
            label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }}
            tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
            tick={{ fontSize: 10 }}
          />
          <YAxis 
            yAxisId="count"
            orientation="right"
            label={{ value: 'Invoice Count', angle: 90, position: 'insideRight' }}
            tickFormatter={(value) => Math.round(value).toLocaleString()}
            tick={{ fontSize: 10 }}
          />
          <ChartTooltip 
            formatter={(value, name) => {
              if (name === 'amount') {
                return [`$${Math.round(value).toLocaleString()}`, 'Total Amount']
              }
              if (name === 'count') {
                return [Math.round(value).toLocaleString(), 'Invoice Count']
              }
              return [Math.round(value), name]
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar yAxisId="amount" dataKey="amount" fill={COLORS.primary} name="Total Amount" />
          <Bar yAxisId="count" dataKey="count" fill={COLORS.secondary} name="Invoice Count" />
        </BarChart>
      </ChartContainer>
      
      {/* Outstanding Invoices Table */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Outstanding Invoices Detail</h3>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center whitespace-nowrap">Order ID</TableHead>
                <TableHead className="text-center whitespace-nowrap">Buyer</TableHead>
                <TableHead className="text-center whitespace-nowrap">Segment</TableHead>
                <TableHead className="text-center whitespace-nowrap">Invoice Date</TableHead>
                <TableHead className="text-center whitespace-nowrap">Days Outstanding</TableHead>
                <TableHead className="text-center whitespace-nowrap">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map((inv, idx) => (
                <TableRow key={`${inv.orderId}-${idx}`}>
                  <TableCell className="text-center font-medium">
                    <Link 
                      to={`/ordermanagement/${inv.orderId}`}
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      {inv.displayId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">{inv.buyerName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={inv.buyerSegment === 'Fleet' ? 'default' : 'secondary'}>
                      {inv.buyerSegment}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{inv.invoiceDate.toLocaleDateString()}</TableCell>
                  <TableCell className="text-center">
                    <span className={inv.daysOutstanding > 60 ? 'text-red-600 font-semibold' : inv.daysOutstanding > 30 ? 'text-orange-600' : ''}>
                      {inv.daysOutstanding}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    ${inv.amount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="p-4 border-t">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(prev => Math.max(1, prev - 1))
                      }}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(page)
                        }}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext 
                      onClick={(e) => {
                        e.preventDefault()
                        setCurrentPage(prev => Math.min(totalPages, prev + 1))
                      }}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <div className="text-sm text-gray-500 text-center mt-2">
                Showing {startIndex + 1} to {Math.min(endIndex, outstandingInvoices.length)} of {outstandingInvoices.length} outstanding invoices
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function OrderDashboards({ orders = [] }) {
  const [activeDashboard, setActiveDashboard] = useState('executive')
  const [topCardsCollapsed, setTopCardsCollapsed] = useState({
    customers: true,
    upfitters: true,
    models: true,
    bodies: true,
  })

  // Calculate all metrics from orders
  const metrics = useMemo(() => {
    if (!orders || orders.length === 0) {
      return {
        totalOrders: 0,
        deliveredOrders: 0,
        activeOrders: 0,
        avgGrossProfit: 0,
        avgGrossMargin: 0,
        revenueBySegment: {},
        onTimeRate: 0,
      }
    }

    const delivered = orders.filter(o => o.status === 'DELIVERED')
    const active = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELED')
    
    // Average gross profit and margin using industry-standard calculations
    const marginData = orders
      .filter(o => o.pricingJson?.total)
      .map(o => calculateMargin(o.pricingJson, o))
    
    const avgGrossProfit = marginData.length > 0
      ? Math.round(marginData.reduce((sum, m) => sum + m.margin, 0) / marginData.length)
      : 0
    
    const avgGrossMargin = marginData.length > 0
      ? Math.round(marginData.reduce((sum, m) => sum + m.marginPercent, 0) / marginData.length)
      : 0

    // Revenue by segment
    const revenueBySegment = orders.reduce((acc, o) => {
      const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 
        (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') ? 'Fleet' : 'Retail'))
      const revenue = o.pricingJson?.total || 0
      acc[segment] = (acc[segment] || 0) + revenue
      return acc
    }, {})

    // Calculate on-time delivery rate: % of delivered orders with no delays in any stage
    const deliveredWithEta = delivered.filter(o => o.deliveryEta && o.actualDeliveryCompleted)
    const onTimeDeliveries = deliveredWithEta.filter(o => {
      // Check if there are any delays in the chain
      // OEM delay
      if (o.oemEta && o.actualOemCompleted) {
        const oemPlanned = new Date(o.oemEta)
        const oemActual = new Date(o.actualOemCompleted)
        if (oemActual > oemPlanned) return false // OEM was delayed
      }
      // Upfitter delay
      if (o.upfitterEta && o.actualUpfitterCompleted) {
        const upfitterPlanned = new Date(o.upfitterEta)
        const upfitterActual = new Date(o.actualUpfitterCompleted)
        if (upfitterActual > upfitterPlanned) return false // Upfitter was delayed
      }
      // Delivery delay
      const planned = new Date(o.deliveryEta)
      const actual = new Date(o.actualDeliveryCompleted)
      if (actual > planned) return false // Delivery was delayed
      // On time = no delays in any stage
      return true
    })
    const onTimeRate = deliveredWithEta.length > 0
      ? Math.round((onTimeDeliveries.length / deliveredWithEta.length) * 100)
      : 0

    return {
      totalOrders: orders.length,
      deliveredOrders: delivered.length,
      activeOrders: active.length,
      avgGrossProfit,
      avgGrossMargin,
      revenueBySegment,
      onTimeRate,
    }
  }, [orders])

  // Calculate prior month metrics for variance
  const priorMonthMetrics = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const priorOrders = orders.filter(o => {
      if (!o.createdAt) return false
      const created = new Date(o.createdAt)
      return created < thirtyDaysAgo
    })

    const priorDelivered = priorOrders.filter(o => o.status === 'DELIVERED')
    const priorActive = priorOrders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELED')

    // Calculate prior month average gross profit and margin
    const priorMarginData = priorOrders
      .filter(o => o.pricingJson?.total)
      .map(o => calculateMargin(o.pricingJson, o))
    
    const priorAvgGrossProfit = priorMarginData.length > 0
      ? Math.round(priorMarginData.reduce((sum, m) => sum + m.margin, 0) / priorMarginData.length)
      : 0
    
    const priorAvgGrossMargin = priorMarginData.length > 0
      ? Math.round(priorMarginData.reduce((sum, m) => sum + m.marginPercent, 0) / priorMarginData.length)
      : 0

    return {
      totalOrders: priorOrders.length,
      deliveredOrders: priorDelivered.length,
      activeOrders: priorActive.length,
      avgGrossProfit: priorAvgGrossProfit,
      avgGrossMargin: priorAvgGrossMargin,
    }
  }, [orders])

  // Variance calculation
  const variance = (current, prior) => {
    if (prior === 0) return current > 0 ? 100 : 0
    return Math.round(((current - prior) / prior) * 100)
  }

  // Scroll to top when dashboard tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeDashboard])

  return (
    <div className="space-y-4 sm:space-y-6">
      <Tabs value={activeDashboard} onValueChange={setActiveDashboard}>
        {/* Mobile: Dropdown Select */}
        <div className="sm:hidden mb-4">
          <Select value={activeDashboard} onValueChange={setActiveDashboard}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Dashboard" />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop: Regular tab list */}
        <TabsList className="hidden sm:grid w-full grid-cols-4 lg:grid-cols-7 gap-1 sm:gap-2">
          <TabsTrigger value="executive" className="text-xs sm:text-sm">Executive</TabsTrigger>
          <TabsTrigger value="financial" className="text-xs sm:text-sm">Financial</TabsTrigger>
          <TabsTrigger value="operations" className="text-xs sm:text-sm">Operations</TabsTrigger>
          <TabsTrigger value="accountability" className="text-xs sm:text-sm">Activity</TabsTrigger>
          <TabsTrigger value="delivery" className="text-xs sm:text-sm">Delivery</TabsTrigger>
          <TabsTrigger value="buyer" className="text-xs sm:text-sm">Buyer</TabsTrigger>
          <TabsTrigger value="sla" className="text-xs sm:text-sm">SLA</TabsTrigger>
        </TabsList>

        {/* 1. Executive Overview Dashboard */}
        <TabsContent value="executive" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{metrics.totalOrders}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {variance(metrics.totalOrders, priorMonthMetrics.totalOrders) > 0 ? (
                    <span className="text-green-600">↑ {Math.abs(variance(metrics.totalOrders, priorMonthMetrics.totalOrders))}% vs prior month</span>
                  ) : variance(metrics.totalOrders, priorMonthMetrics.totalOrders) < 0 ? (
                    <span className="text-red-600">↓ {Math.abs(variance(metrics.totalOrders, priorMonthMetrics.totalOrders))}% vs prior month</span>
                  ) : (
                    <span>No change</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Delivered Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{metrics.deliveredOrders}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {variance(metrics.deliveredOrders, priorMonthMetrics.deliveredOrders) > 0 ? (
                    <span className="text-green-600">↑ {Math.abs(variance(metrics.deliveredOrders, priorMonthMetrics.deliveredOrders))}% vs prior month</span>
                  ) : variance(metrics.deliveredOrders, priorMonthMetrics.deliveredOrders) < 0 ? (
                    <span className="text-red-600">↓ {Math.abs(variance(metrics.deliveredOrders, priorMonthMetrics.deliveredOrders))}% vs prior month</span>
                  ) : (
                    <span>No change</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Active Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{metrics.activeOrders}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const change = metrics.activeOrders - priorMonthMetrics.activeOrders
                    if (change > 0) {
                      return <span className="text-green-600">↑ {Math.abs(change)} vs prior month</span>
                    } else if (change < 0) {
                      return <span className="text-red-600">↓ {Math.abs(change)} vs prior month</span>
                    } else {
                      return <span>No change</span>
                    }
                  })()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Gross Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">${Math.round(metrics.avgGrossProfit).toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const change = metrics.avgGrossProfit - priorMonthMetrics.avgGrossProfit
                    if (change > 0) {
                      return <span className="text-green-600">↑ ${Math.abs(change).toLocaleString()} vs prior month</span>
                    } else if (change < 0) {
                      return <span className="text-red-600">↓ ${Math.abs(change).toLocaleString()} vs prior month</span>
                    } else {
                      return <span>No change</span>
                    }
                  })()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Gross Margin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{Math.round(metrics.avgGrossMargin)}%</div>
                <div className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const change = metrics.avgGrossMargin - priorMonthMetrics.avgGrossMargin
                    if (change > 0) {
                      return <span className="text-green-600">↑ {Math.abs(change)}% vs prior month</span>
                    } else if (change < 0) {
                      return <span className="text-red-600">↓ {Math.abs(change)}% vs prior month</span>
                    } else {
                      return <span>No change</span>
                    }
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Top Customers */}
          <Collapsible 
            open={!topCardsCollapsed.customers} 
            onOpenChange={(open) => setTopCardsCollapsed(prev => ({ ...prev, customers: !open }))}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Top Customers</CardTitle>
                      <CardDescription>Top customers by total revenue</CardDescription>
                    </div>
                    <ChevronDownIcon 
                      className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                        topCardsCollapsed.customers ? '' : 'rotate-180'
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
              {useMemo(() => {
                const buyerData = orders
                  .filter(o => o.buyerName)
                  .reduce((acc, o) => {
                    const buyer = o.buyerName || 'Unknown'
                    if (!acc[buyer]) {
                      acc[buyer] = { buyer, revenue: 0, count: 0, orders: [] }
                    }
                    acc[buyer].revenue += (o.pricingJson?.total || 0)
                    acc[buyer].count++
                    acc[buyer].orders.push(o)
                    return acc
                  }, {})
                
                const chartData = Object.values(buyerData)
                  .map(item => ({ ...item, revenue: Math.round(item.revenue) }))
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 10)
                
                return (
                  <>
                    <ChartContainer config={{}} className="h-[300px] sm:h-[400px] lg:h-[550px] w-full mb-0">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="buyer" 
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fontSize: 9 }}
                          interval={0}
                        />
                        <YAxis 
                          label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }}
                          tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
                        />
                        <ChartTooltip 
                          formatter={(value) => `$${Math.round(value).toLocaleString()}`}
                        />
                        <Bar dataKey="revenue" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                    <div className="border rounded-lg overflow-x-auto mt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center whitespace-nowrap">Customer</TableHead>
                            <TableHead className="text-center whitespace-nowrap">Order Count</TableHead>
                            <TableHead className="text-center whitespace-nowrap">Total Revenue</TableHead>
                            <TableHead className="text-center whitespace-nowrap">View Orders</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {chartData.map((item) => (
                            <TableRow key={item.buyer}>
                              <TableCell className="text-center font-medium">{item.buyer}</TableCell>
                              <TableCell className="text-center">{item.count}</TableCell>
                              <TableCell className="text-center">${item.revenue.toLocaleString()}</TableCell>
                              <TableCell className="text-center">
                                <Link 
                                  to={`/ordermanagement?tab=orders&q=${encodeURIComponent(item.buyer)}`}
                                  className="text-blue-600 hover:text-blue-700 underline"
                                >
                                  View Orders
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )
              }, [orders])}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Top Upfitters */}
          <Collapsible 
            open={!topCardsCollapsed.upfitters} 
            onOpenChange={(open) => setTopCardsCollapsed(prev => ({ ...prev, upfitters: !open }))}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Top Upfitters</CardTitle>
                      <CardDescription>Top upfitters by order count</CardDescription>
                    </div>
                    <ChevronDownIcon 
                      className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                        topCardsCollapsed.upfitters ? '' : 'rotate-180'
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
              {useMemo(() => {
                const upfitterData = orders
                  .filter(o => o.buildJson?.upfitter?.name || o.upfitterId)
                  .reduce((acc, o) => {
                    const upfitter = o.buildJson?.upfitter?.name || o.upfitterId || 'Unknown'
                    if (!acc[upfitter]) {
                      acc[upfitter] = { upfitter, count: 0, orders: [] }
                    }
                    acc[upfitter].count++
                    acc[upfitter].orders.push(o)
                    return acc
                  }, {})
                
                const chartData = Object.values(upfitterData)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                
                return (
                  <>
                    <ChartContainer config={{}} className="h-[300px] sm:h-[400px] lg:h-[550px] w-full mb-0">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="upfitter" 
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fontSize: 9 }}
                          interval={0}
                        />
                        <YAxis 
                          label={{ value: 'Order Count', angle: -90, position: 'insideLeft' }}
                          tickFormatter={(value) => Math.round(value).toLocaleString()}
                        />
                        <ChartTooltip 
                          formatter={(value) => Math.round(value).toLocaleString()}
                        />
                        <Bar dataKey="count" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                    <div className="border rounded-lg overflow-x-auto mt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center whitespace-nowrap">Upfitter</TableHead>
                            <TableHead className="text-center whitespace-nowrap">Order Count</TableHead>
                            <TableHead className="text-center whitespace-nowrap">Total Revenue</TableHead>
                            <TableHead className="text-center whitespace-nowrap">View Orders</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {chartData.map((item) => {
                            const totalRevenue = item.orders.reduce((sum, o) => sum + (o.pricingJson?.total || 0), 0)
                            return (
                              <TableRow key={item.upfitter}>
                                <TableCell className="text-center font-medium">{item.upfitter}</TableCell>
                                <TableCell className="text-center">{item.count}</TableCell>
                                <TableCell className="text-center">${Math.round(totalRevenue).toLocaleString()}</TableCell>
                                <TableCell className="text-center">
                                  <Link 
                                    to={`/ordermanagement?tab=orders&q=${encodeURIComponent(item.upfitter)}`}
                                    className="text-blue-600 hover:text-blue-700 underline"
                                  >
                                    View Orders
                                  </Link>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )
              }, [orders])}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Top Models */}
          <Collapsible 
            open={!topCardsCollapsed.models} 
            onOpenChange={(open) => setTopCardsCollapsed(prev => ({ ...prev, models: !open }))}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Top Models</CardTitle>
                      <CardDescription>Most popular vehicle models by order count</CardDescription>
                    </div>
                    <ChevronDownIcon 
                      className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                        topCardsCollapsed.models ? '' : 'rotate-180'
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
              {useMemo(() => {
                const modelData = orders.reduce((acc, o) => {
                  const model = o.buildJson?.chassis?.series || 'Unknown'
                  if (!acc[model]) {
                    acc[model] = { model, count: 0, orders: [] }
                  }
                  acc[model].count++
                  acc[model].orders.push(o)
                  return acc
                }, {})
                
                const chartData = Object.values(modelData)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                
                return (
                  <>
                    <ChartContainer config={{}} className="h-[300px] sm:h-[400px] lg:h-[550px] w-full mb-0">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="model" 
                          angle={-45}
                          textAnchor="end"
                          height={50}
                          tick={{ fontSize: 9 }}
                          interval={0}
                        />
                        <YAxis 
                          label={{ value: 'Order Count', angle: -90, position: 'insideLeft' }}
                          tickFormatter={(value) => Math.round(value).toLocaleString()}
                        />
                        <ChartTooltip 
                          formatter={(value) => Math.round(value).toLocaleString()}
                        />
                        <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                    <div className="border rounded-lg overflow-x-auto mt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center whitespace-nowrap text-base">Model</TableHead>
                            <TableHead className="text-center whitespace-nowrap text-base">Order Count</TableHead>
                            <TableHead className="text-center whitespace-nowrap text-base">Total Revenue</TableHead>
                            <TableHead className="text-center whitespace-nowrap text-base">View Orders</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {chartData.map((item) => {
                            const totalRevenue = item.orders.reduce((sum, o) => sum + (o.pricingJson?.total || 0), 0)
                            return (
                              <TableRow key={item.model}>
                                <TableCell className="text-center font-medium text-base">{item.model}</TableCell>
                                <TableCell className="text-center text-base">{item.count}</TableCell>
                                <TableCell className="text-center text-base">${Math.round(totalRevenue).toLocaleString()}</TableCell>
                                <TableCell className="text-center text-base">
                                  <Link 
                                    to={`/ordermanagement?tab=orders&q=${encodeURIComponent(item.model)}`}
                                    className="text-blue-600 hover:text-blue-700 underline"
                                  >
                                    View Orders
                                  </Link>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )
              }, [orders])}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Top Body Types */}
          <Collapsible 
            open={!topCardsCollapsed.bodies} 
            onOpenChange={(open) => setTopCardsCollapsed(prev => ({ ...prev, bodies: !open }))}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Top Body Types</CardTitle>
                      <CardDescription>Most popular body types by order count</CardDescription>
                    </div>
                    <ChevronDownIcon 
                      className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                        topCardsCollapsed.bodies ? '' : 'rotate-180'
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
              {useMemo(() => {
                const bodyData = orders.reduce((acc, o) => {
                  const bodyType = o.buildJson?.bodyType || 'Chassis Only'
                  if (!acc[bodyType]) {
                    acc[bodyType] = { bodyType, count: 0, orders: [] }
                  }
                  acc[bodyType].count++
                  acc[bodyType].orders.push(o)
                  return acc
                }, {})
                
                const chartData = Object.values(bodyData)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                
                return (
                  <>
                    <ChartContainer config={{}} className="h-[300px] sm:h-[400px] lg:h-[550px] w-full mb-0">
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="bodyType" 
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fontSize: 9 }}
                          interval={0}
                        />
                        <YAxis 
                          label={{ value: 'Order Count', angle: -90, position: 'insideLeft' }}
                          tickFormatter={(value) => Math.round(value).toLocaleString()}
                        />
                        <ChartTooltip 
                          formatter={(value) => Math.round(value).toLocaleString()}
                        />
                        <Bar dataKey="count" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                    <div className="border rounded-lg overflow-x-auto mt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-center whitespace-nowrap">Body Type</TableHead>
                            <TableHead className="text-center whitespace-nowrap">Order Count</TableHead>
                            <TableHead className="text-center whitespace-nowrap">Total Revenue</TableHead>
                            <TableHead className="text-center whitespace-nowrap">View Orders</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {chartData.map((item) => {
                            const totalRevenue = item.orders.reduce((sum, o) => sum + (o.pricingJson?.total || 0), 0)
                            return (
                              <TableRow key={item.bodyType}>
                                <TableCell className="text-center font-medium">{item.bodyType}</TableCell>
                                <TableCell className="text-center">{item.count}</TableCell>
                                <TableCell className="text-center">${Math.round(totalRevenue).toLocaleString()}</TableCell>
                                <TableCell className="text-center">
                                  <Link 
                                    to={`/ordermanagement?tab=orders&q=${encodeURIComponent(item.bodyType)}`}
                                    className="text-blue-600 hover:text-blue-700 underline"
                                  >
                                    View Orders
                                  </Link>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )
              }, [orders])}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        {/* 2. Financial & Margin Analytics Dashboard */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  ${useMemo(() => {
                    return orders
                      .filter(o => o.pricingJson?.total)
                      .reduce((sum, o) => sum + (o.pricingJson.total || 0), 0)
                      .toLocaleString()
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Gross Margin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  ${useMemo(() => {
                    const totalMargin = orders
                      .filter(o => o.pricingJson?.total)
                      .reduce((sum, o) => {
                        const marginData = calculateMargin(o.pricingJson, o)
                        return sum + marginData.margin
                      }, 0)
                    return totalMargin.toLocaleString()
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Margin %</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    const margins = orders
                      .filter(o => o.pricingJson?.total)
                      .map(o => {
                        const marginData = calculateMargin(o.pricingJson, o)
                        return marginData.marginPercent
                      })
                    return margins.length > 0
                      ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length)
                      : 0
                  }, [orders])}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Order Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  ${useMemo(() => {
                    const totals = orders
                      .filter(o => o.pricingJson?.total)
                      .map(o => o.pricingJson.total)
                    return totals.length > 0
                      ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length).toLocaleString()
                      : 0
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
          </div>

            <Card>
              <CardHeader>
              <CardTitle>AR Collections Analysis</CardTitle>
              <CardDescription>Outstanding invoices aging analysis</CardDescription>
              </CardHeader>
              <CardContent>
              <ARCollectionsAnalysis orders={orders} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
              <CardTitle>Margin % by Model</CardTitle>
              </CardHeader>
              <CardContent>
              <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full">
                <BarChart data={useMemo(() => {
                  const byModel = orders
                    .filter(o => o.pricingJson?.total && o.buildJson?.chassis?.series)
                    .reduce((acc, o) => {
                      const model = o.buildJson.chassis.series
                      if (!acc[model]) {
                        acc[model] = { model, margins: [] }
                      }
                      const marginData = calculateMargin(o.pricingJson, o)
                      acc[model].margins.push(marginData.marginPercent)
                      return acc
                    }, {})
                  
                  return Object.values(byModel).map(m => ({
                    model: m.model,
                    avgMargin: Math.round(m.margins.reduce((a, b) => a + b, 0) / m.margins.length)
                  }))
                  }, [orders])}>
                    <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="model" angle={-45} textAnchor="end" height={100} />
                  <YAxis tickFormatter={(value) => `${Math.round(value)}%`} />
                  <ChartTooltip 
                    formatter={(value) => `${Math.round(value)}%`}
                  />
                  <Bar dataKey="avgMargin" fill={COLORS.primary} />
                </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line of Credit Forecasting</CardTitle>
              <CardDescription>Current balance, available credit, and future projections</CardDescription>
            </CardHeader>
            <CardContent>
              {useMemo(() => {
                const now = new Date()
                now.setHours(0, 0, 0, 0)
                
                // Calculate current outstanding AR (invoiced but not paid)
                const outstandingAR = orders
                  .filter(o => {
                    if (!o.actualDeliveryCompleted || !o.pricingJson?.total || o.status !== 'DELIVERED') {
                      return false
                    }
                    const deliveryDate = new Date(o.actualDeliveryCompleted)
                    deliveryDate.setHours(0, 0, 0, 0)
                    const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24))
                    return daysSinceDelivery >= 0 && daysSinceDelivery <= 90
                  })
                  .reduce((sum, o) => sum + (o.pricingJson.total || 0), 0)
                
                // Calculate floor plan inventory (vehicles delivered by OEM but not yet invoiced to customer)
                // These are vehicles on the floor plan after OEM delivery but before final customer delivery
                const floorPlanInventory = orders
                  .filter(o => {
                    // Vehicle must have been delivered by OEM (actualOemCompleted exists)
                    // But not yet delivered to customer (status !== 'DELIVERED')
                    // And not canceled
                    if (!o.actualOemCompleted || o.status === 'DELIVERED' || o.status === 'CANCELED' || !o.pricingJson?.total) {
                      return false
                    }
                    // Only count vehicles that are past OEM delivery stage
                    // Statuses: OEM_IN_TRANSIT, AT_UPFITTER, UPFIT_IN_PROGRESS, READY_FOR_DELIVERY
                    const floorPlanStatuses = ['OEM_IN_TRANSIT', 'AT_UPFITTER', 'UPFIT_IN_PROGRESS', 'READY_FOR_DELIVERY']
                    return floorPlanStatuses.includes(o.status)
                  })
                  .reduce((sum, o) => {
                    // Use chassis cost (chassisMsrp) as the floor plan amount, or total if chassisMsrp not available
                    const floorPlanAmount = o.pricingJson.chassisMsrp || o.pricingJson.total || 0
                    return sum + floorPlanAmount
                  }, 0)
                
                // Current balance = Outstanding AR + Floor Plan Inventory
                // The dealer carries the cost on floor plan after OEM delivery until final customer delivery/invoicing
                const currentBalance = outstandingAR + floorPlanInventory
                
                // Calculate expected collections (simulate payment collection based on aging)
                const expectedCollections = orders
                  .filter(o => {
                    if (!o.actualDeliveryCompleted || !o.pricingJson?.total || o.status !== 'DELIVERED') {
                      return false
                    }
                    const deliveryDate = new Date(o.actualDeliveryCompleted)
                    deliveryDate.setHours(0, 0, 0, 0)
                    const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24))
                    return daysSinceDelivery >= 0 && daysSinceDelivery <= 90
                  })
                  .map(o => {
                    const deliveryDate = new Date(o.actualDeliveryCompleted)
                    deliveryDate.setHours(0, 0, 0, 0)
                    const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24))
                    // Estimate collection probability based on aging
                    let collectionProb = 1.0
                    if (daysSinceDelivery > 60) collectionProb = 0.5
                    else if (daysSinceDelivery > 30) collectionProb = 0.75
                    return (o.pricingJson.total || 0) * collectionProb
                  })
                  .reduce((sum, val) => sum + val, 0)
                
                // Line of Credit parameters (configurable - in real app these would come from settings)
                const lineOfCreditLimit = 5000000 // $5M line of credit
                const availableCredit = Math.max(0, lineOfCreditLimit - currentBalance)
                const utilizationRate = lineOfCreditLimit > 0 ? (currentBalance / lineOfCreditLimit) * 100 : 0
                
                // Calculate pending orders that will enter floor plan (not yet at OEM delivery stage)
                const pendingOrdersForFloorPlan = orders.filter(o => {
                  if (o.status === 'DELIVERED' || o.status === 'CANCELED' || !o.pricingJson?.total) {
                    return false
                  }
                  // Orders that haven't reached OEM_IN_TRANSIT yet
                  const earlyStatuses = ['CONFIG_RECEIVED', 'OEM_ALLOCATED', 'OEM_PRODUCTION']
                  return earlyStatuses.includes(o.status) || !o.actualOemCompleted
                })
                
                const pendingFloorPlanValue = pendingOrdersForFloorPlan.reduce((sum, o) => {
                  const floorPlanAmount = o.pricingJson.chassisMsrp || o.pricingJson.total || 0
                  return sum + floorPlanAmount
                }, 0)
                
                // Forecast data for next 6 months
                const forecastData = []
                
                // Calculate monthly purchases (vehicles entering floor plan - OEM deliveries)
                const monthlyPurchases = orders
                  .filter(o => o.actualOemCompleted)
                  .reduce((acc, o) => {
                    const month = new Date(o.actualOemCompleted).toISOString().slice(0, 7)
                    const purchaseAmount = o.pricingJson?.chassisMsrp || o.pricingJson?.total || 0
                    acc[month] = (acc[month] || 0) + purchaseAmount
                    return acc
                  }, {})
                
                // Calculate monthly collections (payments received)
                const monthlyCollections = orders
                  .filter(o => {
                    if (!o.actualDeliveryCompleted || !o.pricingJson?.total || o.status !== 'DELIVERED') {
                      return false
                    }
                    const deliveryDate = new Date(o.actualDeliveryCompleted)
                    deliveryDate.setHours(0, 0, 0, 0)
                    const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24))
                    return daysSinceDelivery >= 0 && daysSinceDelivery <= 90
                  })
                  .reduce((acc, o) => {
                    const deliveryDate = new Date(o.actualDeliveryCompleted)
                    const month = deliveryDate.toISOString().slice(0, 7)
                    const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24))
                    // Estimate collection probability based on aging
                    let collectionProb = 1.0
                    if (daysSinceDelivery > 60) collectionProb = 0.5
                    else if (daysSinceDelivery > 30) collectionProb = 0.75
                    const collectionAmount = (o.pricingJson.total || 0) * collectionProb
                    acc[month] = (acc[month] || 0) + collectionAmount
                    return acc
                  }, {})
                
                // Get historical monthly values for variation
                const purchaseValues = Object.values(monthlyPurchases).map(v => Math.round(v))
                const collectionValues = Object.values(monthlyCollections).map(v => Math.round(v))
                
                const avgMonthlyPurchases = purchaseValues.length > 0
                  ? Math.round(purchaseValues.reduce((a, b) => a + b, 0) / purchaseValues.length)
                  : 0
                
                const avgMonthlyCollections = collectionValues.length > 0
                  ? Math.round(collectionValues.reduce((a, b) => a + b, 0) / collectionValues.length)
                  : 0
                
                // Calculate standard deviation for variation
                const purchaseStdDev = purchaseValues.length > 1
                  ? Math.sqrt(purchaseValues.reduce((sum, val) => sum + Math.pow(val - avgMonthlyPurchases, 2), 0) / purchaseValues.length)
                  : avgMonthlyPurchases * 0.2 // Default 20% variation
                
                const collectionStdDev = collectionValues.length > 1
                  ? Math.sqrt(collectionValues.reduce((sum, val) => sum + Math.pow(val - avgMonthlyCollections, 2), 0) / collectionValues.length)
                  : avgMonthlyCollections * 0.2 // Default 20% variation
                
                // Track running balance
                let runningBalance = currentBalance
                
                for (let i = 0; i < 6; i++) {
                  const forecastDate = new Date(now)
                  forecastDate.setMonth(forecastDate.getMonth() + i)
                  const monthKey = forecastDate.toISOString().slice(0, 7)
                  
                  let projectedPurchases = 0
                  let projectedCollections = 0
                  
                  if (i > 0) {
                    // Add deterministic variation to purchases and collections each month
                    // Use historical patterns if available, otherwise use a sine wave pattern
                    // This creates natural variation where some months are higher/lower
                    const monthIndex = i - 1
                    
                    // Create variation pattern using sine/cosine for smooth fluctuations
                    // Purchases and collections vary independently
                    const purchaseWave = Math.sin(monthIndex * Math.PI / 2.5) * 0.25 + 1 // Varies between 0.75 and 1.25
                    const collectionWave = Math.cos(monthIndex * Math.PI / 3) * 0.3 + 1 // Varies between 0.7 and 1.3
                    
                    // Add some additional variation based on month index for more realistic patterns
                    const purchaseVariation = (monthIndex % 3 === 0 ? 1.15 : monthIndex % 3 === 1 ? 0.9 : 1.05)
                    const collectionVariation = (monthIndex % 2 === 0 ? 1.1 : 0.95)
                    
                    projectedPurchases = Math.max(0, Math.round(avgMonthlyPurchases * purchaseWave * purchaseVariation))
                    projectedCollections = Math.max(0, Math.round(avgMonthlyCollections * collectionWave * collectionVariation))
                    
                    // Each month:
                    // Purchases increase the balance (new vehicles entering floor plan)
                    // Collections decrease the balance (payments received)
                    runningBalance = Math.max(0, runningBalance + projectedPurchases - projectedCollections)
                  }
                  
                  const projectedAvailable = Math.max(0, lineOfCreditLimit - runningBalance)
                  const projectedUtilization = lineOfCreditLimit > 0 ? Math.round((runningBalance / lineOfCreditLimit) * 100) : 0
                  
                  forecastData.push({
                    month: monthKey,
                    monthLabel: forecastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    balance: i === 0 ? Math.round(currentBalance) : Math.round(runningBalance),
                    available: i === 0 ? Math.round(availableCredit) : Math.round(projectedAvailable),
                    utilization: i === 0 ? Math.round(utilizationRate) : projectedUtilization,
                    purchases: projectedPurchases,
                    collections: projectedCollections
                  })
                }
                
                return (
                  <div className="space-y-6">
                    {/* Current Status Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-600">Current Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xl sm:text-2xl font-bold">
                            ${currentBalance.toLocaleString()}
          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.round(utilizationRate)}% utilized
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-600">Available Credit</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-xl sm:text-2xl font-bold ${availableCredit < lineOfCreditLimit * 0.2 ? 'text-red-600' : availableCredit < lineOfCreditLimit * 0.4 ? 'text-orange-600' : 'text-green-600'}`}>
                            ${availableCredit.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            of ${lineOfCreditLimit.toLocaleString()} limit
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Forecast Chart */}
                    <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full">
                      <LineChart data={forecastData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="monthLabel" 
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis 
                          label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }}
                          tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
                        />
                        <ChartTooltip 
                          formatter={(value, name) => {
                            if (name === 'balance') {
                              return [`$${Math.round(value).toLocaleString()}`, 'Projected Balance']
                            }
                            if (name === 'available') {
                              return [`$${Math.round(value).toLocaleString()}`, 'Available Credit']
                            }
                            return [Math.round(value), name]
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="balance" 
                          stroke={COLORS.danger} 
                          strokeWidth={2}
                          name="Projected Balance"
                          dot={{ r: 4 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="available" 
                          stroke={COLORS.success} 
                          strokeWidth={2}
                          name="Available Credit"
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ChartContainer>
                    
                    {/* Utilization Chart */}
                    <ChartContainer config={{}} className="h-[300px] w-full">
                      <BarChart data={forecastData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="monthLabel" 
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
                          tickFormatter={(value) => `${Math.round(value)}%`}
                          domain={[0, 100]}
                        />
                        <ChartTooltip 
                          formatter={(value) => `${Math.round(value)}%`}
                        />
                        <Bar dataKey="utilization" fill={COLORS.primary} name="Utilization %">
                          {forecastData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.utilization > 80 ? COLORS.danger : entry.utilization > 60 ? COLORS.warning : COLORS.primary} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                    
                    {/* Forecast Table */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3">6-Month Forecast</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-center">Month</TableHead>
                              <TableHead className="text-center">Projected Balance</TableHead>
                              <TableHead className="text-center">Available Credit</TableHead>
                              <TableHead className="text-center">Utilization</TableHead>
                              <TableHead className="text-center">Purchases</TableHead>
                              <TableHead className="text-center">Collections</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {forecastData.map((row, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-center font-medium">{row.monthLabel}</TableCell>
                                <TableCell className="text-center font-semibold">
                                  ${Math.round(row.balance).toLocaleString()}
                                </TableCell>
                                <TableCell className={`text-center ${row.available < lineOfCreditLimit * 0.2 ? 'text-red-600 font-semibold' : ''}`}>
                                  ${Math.round(row.available).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className={row.utilization > 80 ? 'text-red-600 font-semibold' : row.utilization > 60 ? 'text-orange-600' : ''}>
                                    {Math.round(row.utilization)}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-center text-gray-600">
                                  {idx === 0 ? '-' : `+$${Math.round(row.purchases).toLocaleString()}`}
                                </TableCell>
                                <TableCell className="text-center text-gray-600">
                                  {idx === 0 ? '-' : `-$${Math.round(row.collections).toLocaleString()}`}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )
              }, [orders])}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Operations Timeline Dashboard */}
        <TabsContent value="operations" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. OEM Transit Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    const durations = orders
                      .filter(o => o.createdAt && o.actualOemCompleted)
                      .map(o => {
                        const start = new Date(o.createdAt)
                        const end = new Date(o.actualOemCompleted)
                        return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
                      })
                    return durations.length > 0 
                      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                      : 0
                  }, [orders])} days
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Upfit Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    const durations = orders
                      .filter(o => o.actualOemCompleted && o.actualUpfitterCompleted)
                      .map(o => {
                        const start = new Date(o.actualOemCompleted)
                        const end = new Date(o.actualUpfitterCompleted)
                        return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
                      })
                    return durations.length > 0 
                      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                      : 0
                  }, [orders])} days
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Delivery Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    const durations = orders
                      .filter(o => o.actualUpfitterCompleted && o.actualDeliveryCompleted)
                      .map(o => {
                        const start = new Date(o.actualUpfitterCompleted)
                        const end = new Date(o.actualDeliveryCompleted)
                        return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
                      })
                    return durations.length > 0 
                      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                      : 0
                  }, [orders])} days
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Delay Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    return orders
                      .filter(o => o.deliveryEta && o.actualDeliveryCompleted)
                      .reduce((sum, o) => {
                        const planned = new Date(o.deliveryEta)
                        const actual = new Date(o.actualDeliveryCompleted)
                        const delay = Math.max(0, Math.ceil((actual - planned) / (1000 * 60 * 60 * 24)))
                        return sum + delay
                      }, 0)
                  }, [orders])} days
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Average Days at Upfitter</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full">
                <BarChart data={useMemo(() => {
                  const byUpfitter = orders.reduce((acc, o) => {
                    const upfitter = o.buildJson?.upfitter?.name || 'Unknown'
                    if (!acc[upfitter]) {
                      acc[upfitter] = { upfitter, upfit: 0, count: 0 }
                    }
                    acc[upfitter].count++
                    if (o.actualOemCompleted && o.actualUpfitterCompleted) {
                      const days = Math.ceil((new Date(o.actualUpfitterCompleted) - new Date(o.actualOemCompleted)) / (1000 * 60 * 60 * 24))
                      acc[upfitter].upfit += days
                    }
                    return acc
                  }, {})
                  
                  return Object.values(byUpfitter)
                    .map(u => ({
                      upfitter: u.upfitter,
                      avgDays: u.count > 0 ? Math.round(u.upfit / u.count) : 0,
                    }))
                    .filter(u => u.avgDays > 0)
                    .sort((a, b) => b.avgDays - a.avgDays)
                }, [orders])}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="upfitter" angle={-45} textAnchor="end" height={100} />
                  <YAxis tickFormatter={(value) => value.toLocaleString()} />
                  <ChartTooltip 
                    formatter={(value) => `${Math.round(value)} days`}
                  />
                  <Bar dataKey="avgDays" fill={COLORS.warning} name="Average Days" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Time Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[400px] w-full">
                <LineChart data={useMemo(() => {
                  const monthly = orders
                    .filter(o => o.createdAt && o.actualDeliveryCompleted)
                    .reduce((acc, o) => {
                      const month = new Date(o.createdAt).toISOString().slice(0, 7)
                      if (!acc[month]) acc[month] = { month, leadTimes: [] }
                      const leadTime = Math.ceil((new Date(o.actualDeliveryCompleted) - new Date(o.createdAt)) / (1000 * 60 * 60 * 24))
                      acc[month].leadTimes.push(leadTime)
                      return acc
                    }, {})
                  
                  return Object.entries(monthly)
                    .map(([month, data]) => ({
                      month,
                      avgLeadTime: Math.round(data.leadTimes.reduce((a, b) => a + b, 0) / data.leadTimes.length)
                    }))
                    .sort((a, b) => a.month.localeCompare(b.month))
                }, [orders])}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => value.toLocaleString()} />
                  <ChartTooltip 
                    formatter={(value) => `${Math.round(value)} days`}
                  />
                  <Line type="monotone" dataKey="avgLeadTime" stroke={COLORS.primary} strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. User Activity Dashboard */}
        <TabsContent value="accountability" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Orders Created by User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    const byUser = orders.reduce((acc, o) => {
                      const user = o.createdBy || 'Unknown'
                      acc[user] = (acc[user] || 0) + 1
                      return acc
                    }, {})
                    return Object.keys(byUser).length
                  }, [orders])} users
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Orders Updated per Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    const weekAgo = new Date()
                    weekAgo.setDate(weekAgo.getDate() - 7)
                    return orders.filter(o => o.updatedAt && new Date(o.updatedAt) >= weekAgo).length
                  }, [orders])} orders
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Orders by Created By → Updated By → Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created By</TableHead>
                    <TableHead>Updated By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {useMemo(() => {
                    const grouped = orders.reduce((acc, o) => {
                      const key = `${o.createdBy || 'Unknown'}|${o.updatedBy || 'Unknown'}|${o.status || 'Unknown'}`
                      acc[key] = (acc[key] || 0) + 1
                      return acc
                    }, {})
                    
                    return Object.entries(grouped)
                      .map(([key, count]) => {
                        const [createdBy, updatedBy, status] = key.split('|')
                        return { createdBy, updatedBy, status, count }
                      })
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 10)
                  }, [orders]).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.createdBy}</TableCell>
                      <TableCell>{row.updatedBy}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avg. Days to Move Between Stages by User</CardTitle>
            </CardHeader>
            <CardContent>
              {useMemo(() => {
                const byUser = orders.reduce((acc, o) => {
                  const user = o.updatedBy || o.createdBy || 'Unknown'
                  if (!acc[user]) acc[user] = { user, durations: [] }
                  // Calculate stage duration if we have both dates
                  if (o.createdAt && o.updatedAt) {
                    const days = Math.ceil((new Date(o.updatedAt) - new Date(o.createdAt)) / (1000 * 60 * 60 * 24))
                    if (days > 0) {
                      acc[user].durations.push(days)
                    }
                  }
                  return acc
                }, {})
                
                const chartData = Object.values(byUser)
                  .map(u => ({
                    user: u.user,
                    avgDays: u.durations.length > 0 
                      ? Math.round(u.durations.reduce((a, b) => a + b, 0) / u.durations.length)
                      : 0
                  }))
                  .filter(u => u.avgDays > 0)
                  .sort((a, b) => b.avgDays - a.avgDays)
                
                if (chartData.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No data available. Orders need to have both createdAt and updatedAt dates.
                    </div>
                  )
                }
                
                return (
                  <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="user" 
                        angle={-45} 
                        textAnchor="end" 
                        height={100}
                        interval={0}
                      />
                      <YAxis tickFormatter={(value) => value.toLocaleString()} />
                      <ChartTooltip 
                        formatter={(value) => `${Math.round(value)} days`}
                      />
                      <Bar dataKey="avgDays" fill={COLORS.primary} />
                    </BarChart>
                  </ChartContainer>
                )
              }, [orders])}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Delivery Performance Dashboard */}
        <TabsContent value="delivery" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Planned vs Actual Variance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    const variances = orders
                      .filter(o => o.deliveryEta && o.actualDeliveryCompleted)
                      .map(o => {
                        const planned = new Date(o.deliveryEta)
                        const actual = new Date(o.actualDeliveryCompleted)
                        // Direct delay at delivery
                        const directDelay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                        // Calculate cascading delays from earlier stages
                        let oemDelay = 0
                        let upfitterDelay = 0
                        if (o.oemEta && o.actualOemCompleted) {
                          const oemPlanned = new Date(o.oemEta)
                          const oemActual = new Date(o.actualOemCompleted)
                          oemDelay = Math.max(0, Math.ceil((oemActual - oemPlanned) / (1000 * 60 * 60 * 24)))
                        }
                        if (o.upfitterEta && o.actualUpfitterCompleted) {
                          const upfitterPlanned = new Date(o.upfitterEta)
                          const upfitterActual = new Date(o.actualUpfitterCompleted)
                          upfitterDelay = Math.max(0, Math.ceil((upfitterActual - upfitterPlanned) / (1000 * 60 * 60 * 24)))
                        }
                        // Cumulative variance includes cascading delays
                        return directDelay + oemDelay + upfitterDelay
                      })
                    return variances.length > 0
                      ? Math.round(variances.reduce((a, b) => a + b, 0) / variances.length)
                      : 0
                  }, [orders])} days
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">% Delivered On Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{metrics.onTimeRate}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Orders Ahead Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    return orders.filter(o => {
                      // Order is ahead only if delivery was early AND there were no delays in earlier stages
                      if (!o.deliveryEta || !o.actualDeliveryCompleted) return false
                      
                      // Check for delays in earlier stages
                      if (o.oemEta && o.actualOemCompleted) {
                        const planned = new Date(o.oemEta)
                        const actual = new Date(o.actualOemCompleted)
                        if (actual > planned) return false // OEM was delayed, can't be ahead
                      }
                      
                      if (o.upfitterEta && o.actualUpfitterCompleted) {
                        const planned = new Date(o.upfitterEta)
                        const actual = new Date(o.actualUpfitterCompleted)
                        if (actual > planned) return false // Upfitter was delayed, can't be ahead
                      }
                      
                      // Check if delivery was early
                      const planned = new Date(o.deliveryEta)
                      const actual = new Date(o.actualDeliveryCompleted)
                      return actual < planned // Delivery was early and no earlier delays
                    }).length
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Orders Behind Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {useMemo(() => {
                    return orders.filter(o => {
                      // Check if order has any delays in the chain
                      let hasDelay = false
                      
                      // Check OEM delay
                      if (o.oemEta && o.actualOemCompleted) {
                        const planned = new Date(o.oemEta)
                        const actual = new Date(o.actualOemCompleted)
                        if (actual > planned) hasDelay = true
                      }
                      
                      // Check Upfitter delay
                      if (o.upfitterEta && o.actualUpfitterCompleted) {
                        const planned = new Date(o.upfitterEta)
                        const actual = new Date(o.actualUpfitterCompleted)
                        if (actual > planned) hasDelay = true
                      }
                      
                      // Check Delivery delay (including cascading delays)
                      if (o.deliveryEta && o.actualDeliveryCompleted) {
                        const planned = new Date(o.deliveryEta)
                        const actual = new Date(o.actualDeliveryCompleted)
                        const directDelay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                        // Calculate cascading delays
                        let oemDelay = 0
                        let upfitterDelay = 0
                        if (o.oemEta && o.actualOemCompleted) {
                          const oemPlanned = new Date(o.oemEta)
                          const oemActual = new Date(o.actualOemCompleted)
                          oemDelay = Math.max(0, Math.ceil((oemActual - oemPlanned) / (1000 * 60 * 60 * 24)))
                        }
                        if (o.upfitterEta && o.actualUpfitterCompleted) {
                          const upfitterPlanned = new Date(o.upfitterEta)
                          const upfitterActual = new Date(o.actualUpfitterCompleted)
                          upfitterDelay = Math.max(0, Math.ceil((upfitterActual - upfitterPlanned) / (1000 * 60 * 60 * 24)))
                        }
                        // Order is behind if there's any delay in the chain
                        if (directDelay > 0 || oemDelay > 0 || upfitterDelay > 0) hasDelay = true
                      }
                      
                      return hasDelay
                    }).length
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Average Delay by Stage</CardTitle>
              <CardDescription>Average delay days for each delivery stage</CardDescription>
            </CardHeader>
            <CardContent>
              {useMemo(() => {
                // Calculate delays for each stage
                const stageData = {
                  OEM: { delays: [], label: 'OEM Delay' },
                  Upfitter: { delays: [], label: 'Upfitter Delay' },
                  Delivery: { delays: [], label: 'Total Delay' }
                }
                
                orders.forEach(o => {
                  let oemDelay = 0
                  let upfitterDelay = 0
                  
                  // OEM stage delay
                  if (o.oemEta && o.actualOemCompleted) {
                    const planned = new Date(o.oemEta)
                    const actual = new Date(o.actualOemCompleted)
                    oemDelay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                    stageData.OEM.delays.push(oemDelay)
                  }
                  
                  // Upfitter stage delay
                  if (o.upfitterEta && o.actualUpfitterCompleted) {
                    const planned = new Date(o.upfitterEta)
                    const actual = new Date(o.actualUpfitterCompleted)
                    upfitterDelay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                    stageData.Upfitter.delays.push(upfitterDelay)
                  }
                  
                  // Delivery stage delay - includes cascading delays from earlier stages
                  if (o.deliveryEta && o.actualDeliveryCompleted) {
                    const planned = new Date(o.deliveryEta)
                    const actual = new Date(o.actualDeliveryCompleted)
                    // Direct delay at delivery stage
                    const directDelay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                    // Cumulative delay: direct delay + any delays from earlier stages
                    // If OEM or Upfitter were delayed, that affects the final delivery
                    const cumulativeDelay = directDelay + Math.max(0, oemDelay) + Math.max(0, upfitterDelay)
                    stageData.Delivery.delays.push(cumulativeDelay)
                  }
                })
                
                const chartData = Object.entries(stageData).map(([stage, data]) => {
                  const avgDelay = data.delays.length > 0
                    ? data.delays.reduce((sum, d) => sum + d, 0) / data.delays.length
                    : 0
                  const count = data.delays.length
                  const lateCount = data.delays.filter(d => d > 0).length
                  const earlyCount = data.delays.filter(d => d < 0).length
                  const onTimeCount = data.delays.filter(d => d === 0).length
                  
                    return {
                    stage: data.label,
                    avgDelay: Math.round(avgDelay),
                    count,
                    lateCount,
                    earlyCount,
                    onTimeCount,
                    fill: avgDelay > 0 ? COLORS.danger : avgDelay < 0 ? COLORS.success : COLORS.primary
                  }
                })
                
                if (chartData.every(d => d.count === 0)) {
                  return (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No data available. Orders need to have ETA and actual completion dates for stages.
                    </div>
                  )
                }
                
                return (
                  <div className="space-y-4">
                    <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full">
                      <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="stage" />
                      <YAxis 
                          label={{ value: 'Average Delay (days)', angle: -90, position: 'insideLeft' }}
                          tickFormatter={(value) => `${value > 0 ? '+' : ''}${Math.round(value)}`}
                      />
                      <ChartTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="bg-white p-3 border rounded-lg shadow-lg">
                                  <p className="font-semibold mb-2">{data.stage}</p>
                                  <p className="text-sm mb-1">
                                    <span className="font-medium">Avg Delay: </span>
                                    <span className={data.avgDelay > 0 ? 'text-red-600' : data.avgDelay < 0 ? 'text-green-600' : 'text-blue-600'}>
                                      {data.avgDelay > 0 ? '+' : ''}{Math.round(data.avgDelay)} days
                                    </span>
                                  </p>
                                  <p className="text-sm mb-1">
                                    <span className="font-medium">Total Orders: </span>
                                    {data.count}
                                  </p>
                                  <div className="text-xs mt-2 pt-2 border-t space-y-1">
                                    <p><span className="text-red-600">●</span> Late: {data.lateCount}</p>
                                    <p><span className="text-blue-600">●</span> On Time: {data.onTimeCount}</p>
                                    <p><span className="text-green-600">●</span> Early: {data.earlyCount}</p>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar dataKey="avgDelay" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                  </ChartContainer>
                    
                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      {chartData.map((data) => (
                        <div key={data.stage} className="text-center">
                          <div className="text-sm font-medium text-gray-600 mb-1">{data.stage}</div>
                          <div className={`text-2xl font-bold ${data.avgDelay > 0 ? 'text-red-600' : data.avgDelay < 0 ? 'text-green-600' : 'text-blue-600'}`}>
                            {data.avgDelay > 0 ? '+' : ''}{Math.round(data.avgDelay)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">days avg</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }, [orders])}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stage Performance Breakdown</CardTitle>
              <CardDescription>Early, on-time, and late performance by stage</CardDescription>
            </CardHeader>
            <CardContent>
              {useMemo(() => {
                // Calculate performance breakdown for each stage
                const stageData = {
                  OEM: { early: 0, onTime: 0, late: 0, label: 'OEM Delay' },
                  Upfitter: { early: 0, onTime: 0, late: 0, label: 'Upfitter Delay' },
                  Delivery: { early: 0, onTime: 0, late: 0, label: 'Total Delay' }
                }
                
                orders.forEach(o => {
                  // OEM stage
                  if (o.oemEta && o.actualOemCompleted) {
                    const planned = new Date(o.oemEta)
                    const actual = new Date(o.actualOemCompleted)
                    const delay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                    if (delay < 0) stageData.OEM.early++
                    else if (delay === 0) stageData.OEM.onTime++
                    else stageData.OEM.late++
                  }
                  
                  // Upfitter stage
                  if (o.upfitterEta && o.actualUpfitterCompleted) {
                    const planned = new Date(o.upfitterEta)
                    const actual = new Date(o.actualUpfitterCompleted)
                    const delay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                    if (delay < 0) stageData.Upfitter.early++
                    else if (delay === 0) stageData.Upfitter.onTime++
                    else stageData.Upfitter.late++
                  }
                  
                  // Delivery stage
                  if (o.deliveryEta && o.actualDeliveryCompleted) {
                      const planned = new Date(o.deliveryEta)
                      const actual = new Date(o.actualDeliveryCompleted)
                      const delay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                    if (delay < 0) stageData.Delivery.early++
                    else if (delay === 0) stageData.Delivery.onTime++
                    else stageData.Delivery.late++
                  }
                })
                
                const chartData = Object.entries(stageData).map(([key, data]) => ({
                  stage: data.label,
                  Early: data.early,
                  'On Time': data.onTime,
                  Late: data.late
                }))
                
                if (chartData.every(d => d.Early + d['On Time'] + d.Late === 0)) {
                  return (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No data available. Orders need to have ETA and actual completion dates for stages.
                    </div>
                  )
                }
                
                return (
                  <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full">
                    <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stage" />
                      <YAxis 
                        label={{ value: 'Number of Orders', angle: -90, position: 'insideLeft' }}
                        tickFormatter={(value) => Math.round(value).toLocaleString()}
                      />
                      <ChartTooltip 
                        formatter={(value) => Math.round(value).toLocaleString()}
                      />
                  <Legend />
                      <Bar dataKey="Early" stackId="a" fill={COLORS.success} />
                      <Bar dataKey="On Time" stackId="a" fill={COLORS.primary} />
                      <Bar dataKey="Late" stackId="a" fill={COLORS.danger} />
                </BarChart>
              </ChartContainer>
                )
              }, [orders])}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. Buyer & Segment Insights Dashboard */}
        <TabsContent value="buyer" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Fleet Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    return orders.filter(o => {
                      const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 
                        (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') ? 'Fleet' : 'Retail'))
                      return segment === 'Fleet'
                    }).length
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Retail Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    return orders.filter(o => {
                      const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 
                        (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') ? 'Fleet' : 'Retail'))
                      return segment === 'Retail'
                    }).length
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Dealer Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    return orders.filter(o => {
                      const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 
                        (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') ? 'Fleet' : 'Retail'))
                      return segment === 'Dealer'
                    }).length
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Value per Segment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${useMemo(() => {
                    const totals = orders
                      .filter(o => o.pricingJson?.total)
                      .map(o => o.pricingJson.total)
                    return totals.length > 0
                      ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length).toLocaleString()
                      : 0
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Repeat Buyer Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    const buyers = orders
                      .filter(o => o.buyerName)
                      .map(o => o.buyerName)
                    const unique = new Set(buyers)
                    return buyers.length > 0
                      ? Math.round((unique.size / buyers.length) * 100)
                      : 0
                  }, [orders])}%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Volume by Segment</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full">
                  <PieChart>
                    <Pie
                      data={useMemo(() => {
                        const bySegment = orders.reduce((acc, o) => {
                          const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 
                            (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') ? 'Fleet' : 'Retail'))
                          acc[segment] = (acc[segment] || 0) + 1
                          return acc
                        }, {})
                        return Object.entries(bySegment).map(([name, value]) => ({ name, value }))
                      }, [orders])}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${Math.round(percent * 100)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {useMemo(() => {
                        const segments = orders.reduce((acc, o) => {
                          const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 
                            (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') ? 'Fleet' : 'Retail'))
                          acc.add(segment)
                          return acc
                        }, new Set())
                        return Array.from(segments)
                      }, [orders]).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      formatter={(value) => Math.round(value).toLocaleString()}
                    />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Avg. Lead Time by Segment</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full">
                  <BarChart data={useMemo(() => {
                    const bySegment = orders
                      .filter(o => o.createdAt && o.actualDeliveryCompleted)
                      .reduce((acc, o) => {
                        const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 
                          (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') ? 'Fleet' : 'Retail'))
                        if (!acc[segment]) acc[segment] = { segment, leadTimes: [] }
                        const leadTime = Math.ceil((new Date(o.actualDeliveryCompleted) - new Date(o.createdAt)) / (1000 * 60 * 60 * 24))
                        acc[segment].leadTimes.push(leadTime)
                        return acc
                      }, {})
                    
                    return Object.values(bySegment).map(s => ({
                      segment: s.segment,
                      avgLeadTime: Math.round(s.leadTimes.reduce((a, b) => a + b, 0) / s.leadTimes.length)
                    }))
                  }, [orders])}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="segment" />
                    <YAxis tickFormatter={(value) => value.toLocaleString()} />
                    <ChartTooltip 
                      formatter={(value) => `${Math.round(value)} days`}
                    />
                    <Bar dataKey="avgLeadTime" fill={COLORS.primary} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Buyers by Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Avg. Order Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {useMemo(() => {
                    const byBuyer = orders
                      .filter(o => o.buyerName && o.pricingJson?.total)
                      .reduce((acc, o) => {
                        if (!acc[o.buyerName]) {
                          acc[o.buyerName] = { buyer: o.buyerName, orders: 0, total: 0 }
                        }
                        acc[o.buyerName].orders++
                        acc[o.buyerName].total += o.pricingJson.total
                        return acc
                      }, {})
                    
                    return Object.values(byBuyer)
                      .map(b => ({
                        ...b,
                        avgValue: Math.round(b.total / b.orders)
                      }))
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 10)
                  }, [orders]).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.buyer}</TableCell>
                      <TableCell>{row.orders}</TableCell>
                      <TableCell>${row.total.toLocaleString()}</TableCell>
                      <TableCell>${row.avgValue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. SLA & Priority Management Dashboard */}
        <TabsContent value="sla" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">High-Priority Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    return orders.filter(o => 
                      (o.priority === 'High' || o.priority === 'Urgent') && 
                      o.status !== 'DELIVERED' && 
                      o.status !== 'CANCELED'
                    ).length
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">SLA Breach Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    const slaOrders = orders.filter(o => o.priority && o.deliveryEta && o.actualDeliveryCompleted)
                    const breached = slaOrders.filter(o => {
                      const planned = new Date(o.deliveryEta)
                      const actual = new Date(o.actualDeliveryCompleted)
                      return actual > planned
                    }).length
                    return slaOrders.length > 0
                      ? Math.round((breached / slaOrders.length) * 100)
                      : 0
                  }, [orders])}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Completion vs SLA Target</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    const slaOrders = orders.filter(o => o.priority && o.deliveryEta && o.actualDeliveryCompleted)
                    const avgVariance = slaOrders.reduce((sum, o) => {
                      const planned = new Date(o.deliveryEta)
                      const actual = new Date(o.actualDeliveryCompleted)
                      return sum + Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                    }, 0)
                    return slaOrders.length > 0
                      ? Math.round(avgVariance / slaOrders.length)
                      : 0
                  }, [orders])} days
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Orders Missing ETA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    return orders.filter(o => 
                      !o.deliveryEta && 
                      o.status !== 'DELIVERED' && 
                      o.status !== 'CANCELED'
                    ).length
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Priority vs SLA Status Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead>SLA Status</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {useMemo(() => {
                    const matrix = orders
                      .filter(o => o.priority && o.deliveryEta && o.actualDeliveryCompleted)
                      .reduce((acc, o) => {
                        const priority = o.priority || 'Normal'
                        const planned = new Date(o.deliveryEta)
                        const actual = new Date(o.actualDeliveryCompleted)
                        const status = actual <= planned ? 'Met' : actual > planned ? 'Breached' : 'Pending'
                        const key = `${priority}|${status}`
                        acc[key] = (acc[key] || 0) + 1
                        return acc
                      }, {})
                    
                    const total = Object.values(matrix).reduce((a, b) => a + b, 0)
                    
                    return Object.entries(matrix)
                      .map(([key, count]) => {
                        const [priority, status] = key.split('|')
                        return { priority, status, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }
                      })
                      .sort((a, b) => b.count - a.count)
                  }, [orders]).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Badge variant={row.priority === 'Urgent' ? 'destructive' : row.priority === 'High' ? 'default' : 'secondary'}>
                          {row.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'Met' ? 'default' : row.status === 'Breached' ? 'destructive' : 'secondary'}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{row.percent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SLA Compliance by Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[250px] sm:h-[300px] lg:h-[400px] w-full">
                <BarChart data={useMemo(() => {
                  const byPriority = orders
                    .filter(o => o.priority && o.deliveryEta && o.actualDeliveryCompleted)
                    .reduce((acc, o) => {
                      const priority = o.priority || 'Normal'
                      if (!acc[priority]) {
                        acc[priority] = { priority, met: 0, total: 0 }
                      }
                      acc[priority].total++
                      const planned = new Date(o.deliveryEta)
                      const actual = new Date(o.actualDeliveryCompleted)
                      if (actual <= planned) acc[priority].met++
                      return acc
                    }, {})
                  
                  return Object.values(byPriority).map(p => ({
                    priority: p.priority,
                    compliance: p.total > 0 ? Math.round((p.met / p.total) * 100) : 0
                  }))
                }, [orders])}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="priority" />
                  <YAxis tickFormatter={(value) => `${Math.round(value)}%`} />
                  <ChartTooltip 
                    formatter={(value) => `${Math.round(value)}%`}
                  />
                  <Bar dataKey="compliance" fill={COLORS.primary} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}

