import { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  { value: 'operations', label: 'Operations' },
  { value: 'accountability', label: 'Activity' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'sla', label: 'SLA' },
  { value: 'financial', label: 'Financial' },
]

export function OrderDashboards({ orders = [] }) {
  const [activeDashboard, setActiveDashboard] = useState('executive')

  // Calculate all metrics from orders
  const metrics = useMemo(() => {
    if (!orders || orders.length === 0) {
      return {
        totalOrders: 0,
        deliveredOrders: 0,
        activeOrders: 0,
        avgLeadTime: 0,
        onTimeRate: 0,
        avgMargin: 0,
        revenueBySegment: {},
        slaCompliance: 0,
      }
    }

    const now = new Date()
    const delivered = orders.filter(o => o.status === 'DELIVERED')
    const active = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELED')
    
    // Calculate lead times
    const leadTimes = orders
      .filter(o => o.createdAt && o.actualDeliveryCompleted)
      .map(o => {
        const created = new Date(o.createdAt)
        const completed = new Date(o.actualDeliveryCompleted)
        return Math.ceil((completed - created) / (1000 * 60 * 60 * 24))
      })
    const avgLeadTime = leadTimes.length > 0 
      ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
      : 0

    // On-time vs delayed
    const onTime = orders.filter(o => {
      if (!o.deliveryEta || !o.actualDeliveryCompleted) return false
      const planned = new Date(o.deliveryEta)
      const actual = new Date(o.actualDeliveryCompleted)
      return actual <= planned
    }).length
    const onTimeRate = orders.filter(o => o.deliveryEta && o.actualDeliveryCompleted).length > 0
      ? Math.round((onTime / orders.filter(o => o.deliveryEta && o.actualDeliveryCompleted).length) * 100)
      : 0

    // Average margin
    const margins = orders
      .filter(o => o.pricingJson?.total)
      .map(o => {
        const total = o.pricingJson.total || 0
        const cost = (o.pricingJson.chassisMsrp || 0) * 0.85 + 
                     (o.pricingJson.bodyPrice || 0) * 0.80 + 
                     (o.pricingJson.labor || 0) * 0.70
        return total - cost
      })
    const avgMargin = margins.length > 0
      ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length)
      : 0

    // Revenue by segment
    const revenueBySegment = orders.reduce((acc, o) => {
      const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 
        (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') ? 'Fleet' : 'Retail'))
      const revenue = o.pricingJson?.total || 0
      acc[segment] = (acc[segment] || 0) + revenue
      return acc
    }, {})

    // SLA compliance
    const slaOrders = orders.filter(o => o.priority && o.deliveryEta && o.actualDeliveryCompleted)
    const slaMet = slaOrders.filter(o => {
      const planned = new Date(o.deliveryEta)
      const actual = new Date(o.actualDeliveryCompleted)
      return actual <= planned
    }).length
    const slaCompliance = slaOrders.length > 0
      ? Math.round((slaMet / slaOrders.length) * 100)
      : 0

    return {
      totalOrders: orders.length,
      deliveredOrders: delivered.length,
      activeOrders: active.length,
      avgLeadTime,
      onTimeRate,
      avgMargin,
      revenueBySegment,
      slaCompliance,
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

    return {
      totalOrders: priorOrders.length,
      deliveredOrders: priorOrders.filter(o => o.status === 'DELIVERED').length,
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
          <TabsTrigger value="operations" className="text-xs sm:text-sm">Operations</TabsTrigger>
          <TabsTrigger value="accountability" className="text-xs sm:text-sm">Activity</TabsTrigger>
          <TabsTrigger value="delivery" className="text-xs sm:text-sm">Delivery</TabsTrigger>
          <TabsTrigger value="buyer" className="text-xs sm:text-sm">Buyer</TabsTrigger>
          <TabsTrigger value="sla" className="text-xs sm:text-sm">SLA</TabsTrigger>
          <TabsTrigger value="financial" className="text-xs sm:text-sm">Financial</TabsTrigger>
        </TabsList>

        {/* 1. Executive Overview Dashboard */}
        <TabsContent value="executive" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalOrders}</div>
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
                <div className="text-2xl font-bold">{metrics.deliveredOrders}</div>
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
                <div className="text-2xl font-bold">{metrics.activeOrders}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Lead Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.avgLeadTime} days</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">On-Time Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.onTimeRate}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Gross Margin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${metrics.avgMargin.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">SLA Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.slaCompliance}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Orders by Buyer Segment</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[400px] w-full">
                  <PieChart>
                    <Pie
                      data={Object.entries(metrics.revenueBySegment).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(metrics.revenueBySegment).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Volume vs Delivery Volume Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[400px] w-full">
                  <AreaChart data={useMemo(() => {
                    const monthly = orders.reduce((acc, o) => {
                      if (!o.createdAt) return acc
                      const month = new Date(o.createdAt).toISOString().slice(0, 7)
                      if (!acc[month]) acc[month] = { month, orders: 0, deliveries: 0 }
                      acc[month].orders++
                      if (o.status === 'DELIVERED' && o.actualDeliveryCompleted) {
                        const deliveryMonth = new Date(o.actualDeliveryCompleted).toISOString().slice(0, 7)
                        if (!acc[deliveryMonth]) acc[deliveryMonth] = { month: deliveryMonth, orders: 0, deliveries: 0 }
                        acc[deliveryMonth].deliveries++
                      }
                      return acc
                    }, {})
                    return Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month))
                  }, [orders])}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip />
                    <Area type="monotone" dataKey="orders" stackId="1" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.6} />
                    <Area type="monotone" dataKey="deliveries" stackId="2" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.6} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. Operations Timeline Dashboard */}
        <TabsContent value="operations" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. OEM Transit Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
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
                <div className="text-2xl font-bold">
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
                <div className="text-2xl font-bold">
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
                <div className="text-2xl font-bold">
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
              <ChartContainer config={{}} className="h-[400px] w-full">
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
                  <YAxis />
                  <ChartTooltip />
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
                  <YAxis />
                  <ChartTooltip />
                  <Line type="monotone" dataKey="avgLeadTime" stroke={COLORS.primary} strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. User Activity Dashboard */}
        <TabsContent value="accountability" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Orders Created by User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
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
                <div className="text-2xl font-bold">
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
                  <ChartContainer config={{}} className="h-[400px] w-full">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="user" 
                        angle={-45} 
                        textAnchor="end" 
                        height={100}
                        interval={0}
                      />
                      <YAxis />
                      <ChartTooltip />
                      <Bar dataKey="avgDays" fill={COLORS.primary} />
                    </BarChart>
                  </ChartContainer>
                )
              }, [orders])}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Delivery Performance Dashboard */}
        <TabsContent value="delivery" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Planned vs Actual Variance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    const variances = orders
                      .filter(o => o.deliveryEta && o.actualDeliveryCompleted)
                      .map(o => {
                        const planned = new Date(o.deliveryEta)
                        const actual = new Date(o.actualDeliveryCompleted)
                        return Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
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
                <div className="text-2xl font-bold">{metrics.onTimeRate}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Orders Ahead Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    return orders.filter(o => {
                      if (!o.deliveryEta || !o.actualDeliveryCompleted) return false
                      const planned = new Date(o.deliveryEta)
                      const actual = new Date(o.actualDeliveryCompleted)
                      return actual < planned
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
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    return orders.filter(o => {
                      if (!o.deliveryEta || !o.actualDeliveryCompleted) return false
                      const planned = new Date(o.deliveryEta)
                      const actual = new Date(o.actualDeliveryCompleted)
                      return actual > planned
                    }).length
                  }, [orders])}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Final ETA vs Actual Completion (Delay Visualization)</CardTitle>
            </CardHeader>
            <CardContent>
              {useMemo(() => {
                const chartData = orders
                  .filter(o => o.deliveryEta && o.actualDeliveryCompleted)
                  .map(o => {
                    const planned = new Date(o.deliveryEta).getTime()
                    const actual = new Date(o.actualDeliveryCompleted).getTime()
                    const delay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                    return {
                      planned: planned,
                      actual: actual,
                      delay: delay,
                      orderId: o.id,
                      fill: delay > 0 ? COLORS.danger : delay < 0 ? COLORS.success : COLORS.primary
                    }
                  })
                
                if (chartData.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No data available. Orders need to have both deliveryEta and actualDeliveryCompleted dates.
                    </div>
                  )
                }
                
                // Calculate date range from data
                const allPlanned = chartData.map(d => d.planned)
                const allActual = chartData.map(d => d.actual)
                const minPlanned = Math.min(...allPlanned)
                const maxPlanned = Math.max(...allPlanned)
                const minActual = Math.min(...allActual)
                const maxActual = Math.max(...allActual)
                
                // Use the overall min/max for both axes to keep them aligned
                const minDate = Math.min(minPlanned, minActual)
                const maxDate = Math.max(maxPlanned, maxActual)
                
                // Add padding (5% on each side)
                const dateRange = maxDate - minDate
                const padding = dateRange * 0.05
                const domainMin = minDate - padding
                const domainMax = maxDate + padding
                
                return (
                  <ChartContainer config={{}} className="h-[400px] w-full !aspect-auto">
                    <ScatterChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        dataKey="planned" 
                        name="Planned"
                        domain={[domainMin, domainMax]}
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="actual" 
                        name="Actual"
                        domain={[domainMin, domainMax]}
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <ChartTooltip 
                        formatter={(value, name) => {
                          if (name === 'delay') {
                            return [`${value} days`, 'Delay'];
                          }
                          return [new Date(value).toLocaleDateString(), name];
                        }}
                      />
                      <Scatter dataKey="actual" fill={COLORS.primary} />
                    </ScatterChart>
                  </ChartContainer>
                )
              }, [orders])}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>On-time vs Late vs Early by Upfitter</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[400px] w-full">
                <BarChart data={useMemo(() => {
                  const byUpfitter = orders
                    .filter(o => o.deliveryEta && o.actualDeliveryCompleted && o.buildJson?.upfitter?.name)
                    .reduce((acc, o) => {
                      const upfitter = o.buildJson.upfitter.name
                      if (!acc[upfitter]) {
                        acc[upfitter] = { upfitter, onTime: 0, late: 0, early: 0 }
                      }
                      const planned = new Date(o.deliveryEta)
                      const actual = new Date(o.actualDeliveryCompleted)
                      const delay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                      if (delay === 0) acc[upfitter].onTime++
                      else if (delay > 0) acc[upfitter].late++
                      else acc[upfitter].early++
                      return acc
                    }, {})
                  
                  return Object.values(byUpfitter)
                }, [orders])}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="upfitter" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <ChartTooltip />
                  <Legend />
                  <Bar dataKey="early" stackId="a" fill={COLORS.success} name="Early" />
                  <Bar dataKey="onTime" stackId="a" fill={COLORS.primary} name="On Time" />
                  <Bar dataKey="late" stackId="a" fill={COLORS.danger} name="Late" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Buyer & Segment Insights Dashboard */}
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
                <ChartContainer config={{}} className="h-[400px] w-full">
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
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
                    <ChartTooltip />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Avg. Lead Time by Segment</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[400px] w-full">
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
                    <YAxis />
                    <ChartTooltip />
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

        {/* 6. SLA & Priority Management Dashboard */}
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
              <ChartContainer config={{}} className="h-[400px] w-full">
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
                  <YAxis />
                  <ChartTooltip />
                  <Bar dataKey="compliance" fill={COLORS.primary} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. Financial & Margin Analytics Dashboard */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
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
                <div className="text-2xl font-bold">
                  ${useMemo(() => {
                    const totalMargin = orders
                      .filter(o => o.pricingJson?.total)
                      .reduce((sum, o) => {
                        const total = o.pricingJson.total || 0
                        const cost = (o.pricingJson.chassisMsrp || 0) * 0.85 + 
                                     (o.pricingJson.bodyPrice || 0) * 0.80 + 
                                     (o.pricingJson.labor || 0) * 0.70
                        return sum + (total - cost)
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
                <div className="text-2xl font-bold">
                  {useMemo(() => {
                    const margins = orders
                      .filter(o => o.pricingJson?.total)
                      .map(o => {
                        const total = o.pricingJson.total || 0
                        const cost = (o.pricingJson.chassisMsrp || 0) * 0.85 + 
                                     (o.pricingJson.bodyPrice || 0) * 0.80 + 
                                     (o.pricingJson.labor || 0) * 0.70
                        return total > 0 ? ((total - cost) / total) * 100 : 0
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Margin % by Model</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[400px] w-full">
                <BarChart data={useMemo(() => {
                  const byModel = orders
                    .filter(o => o.pricingJson?.total && o.buildJson?.chassis?.series)
                    .reduce((acc, o) => {
                      const model = o.buildJson.chassis.series
                      if (!acc[model]) {
                        acc[model] = { model, margins: [] }
                      }
                      const total = o.pricingJson.total || 0
                      const cost = (o.pricingJson.chassisMsrp || 0) * 0.85 + 
                                   (o.pricingJson.bodyPrice || 0) * 0.80 + 
                                   (o.pricingJson.labor || 0) * 0.70
                      const marginPct = total > 0 ? ((total - cost) / total) * 100 : 0
                      acc[model].margins.push(marginPct)
                      return acc
                    }, {})
                  
                  return Object.values(byModel).map(m => ({
                    model: m.model,
                    avgMargin: Math.round(m.margins.reduce((a, b) => a + b, 0) / m.margins.length)
                  }))
                }, [orders])}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="model" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <ChartTooltip />
                  <Bar dataKey="avgMargin" fill={COLORS.primary} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Buyer Segment Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[400px] w-full">
                <AreaChart data={useMemo(() => {
                  const monthly = orders
                    .filter(o => o.createdAt && o.pricingJson?.total)
                    .reduce((acc, o) => {
                      const month = new Date(o.createdAt).toISOString().slice(0, 7)
                      const segment = o.buyerSegment || (o.inventoryStatus === 'STOCK' ? 'Dealer' : 
                        (o.buyerName?.includes('Fleet') || o.buyerName?.includes('LLC') || o.buyerName?.includes('Corp') ? 'Fleet' : 'Retail'))
                      if (!acc[month]) {
                        acc[month] = { month, Fleet: 0, Retail: 0, Dealer: 0 }
                      }
                      acc[month][segment] = (acc[month][segment] || 0) + (o.pricingJson.total || 0)
                      return acc
                    }, {})
                  
                  return Object.values(monthly)
                    .sort((a, b) => a.month.localeCompare(b.month))
                }, [orders])}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip />
                  <Legend />
                  <Area type="monotone" dataKey="Fleet" stackId="1" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Retail" stackId="1" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Dealer" stackId="1" stroke={COLORS.warning} fill={COLORS.warning} fillOpacity={0.6} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delay Days vs Margin (Cost of Slippage)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[400px] w-full">
                <ScatterChart data={useMemo(() => {
                  return orders
                    .filter(o => o.deliveryEta && o.actualDeliveryCompleted && o.pricingJson?.total)
                    .map(o => {
                      const planned = new Date(o.deliveryEta)
                      const actual = new Date(o.actualDeliveryCompleted)
                      const delay = Math.ceil((actual - planned) / (1000 * 60 * 60 * 24))
                      const total = o.pricingJson.total || 0
                      const cost = (o.pricingJson.chassisMsrp || 0) * 0.85 + 
                                   (o.pricingJson.bodyPrice || 0) * 0.80 + 
                                   (o.pricingJson.labor || 0) * 0.70
                      const margin = total - cost
                      return { delay, margin }
                    })
                })}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="delay" name="Delay (days)" />
                  <YAxis dataKey="margin" name="Margin ($)" />
                  <ChartTooltip />
                  <Scatter dataKey="margin" fill={COLORS.primary} />
                </ScatterChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

