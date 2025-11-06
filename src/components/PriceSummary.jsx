import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// Removed leasing tabs per requirements
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
// Icons removed per design preference
import { getIncentives, getChassis, getBodies, getOptions } from '@/api/routes'
import { calculateMonthlyPayment, calculatePricing } from '@/lib/configurationStore'

export function PriceSummary({ 
  configuration,
  onChange
}) {
  const [incentivesData, setIncentivesData] = useState({ incentives: [], financing: {} })
  const [loading, setLoading] = useState(true)
  const [selectedIncentives, setSelectedIncentives] = useState([])
  const [computedPricing, setComputedPricing] = useState(configuration.pricing || {})
  
  // Financing inputs
  const [financingOptions, setFinancingOptions] = useState({
    creditTier: 'tier2',
    apr: 4.9,
    term: 60,
    downPayment: 20
  })
  const [enableFinancing, setEnableFinancing] = useState(Boolean(configuration.financing?.enabled) || false)

  // Compute pricing and load incentives when core config changes (not when user tweaks finance inputs)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [chassisData, bodiesData, optionsData] = await Promise.all([
          getChassis(),
          getBodies(),
          getOptions()
        ])
        const newPricing = calculatePricing(configuration, chassisData, bodiesData, optionsData)
        setComputedPricing(newPricing)

        const filters = {
          powertrain: configuration.chassis?.powertrain?.includes('diesel') ? 'diesel' : 
                     configuration.chassis?.powertrain?.includes('ev') ? 'ev' : 'gas',
          series: configuration.chassis?.series,
          bodyType: configuration.bodyType,
          units: configuration.units || 1,
          state: 'MI'
        }
        const data = await getIncentives(filters)
        setIncentivesData(data)
        // Auto-select applicable incentives
        const applicable = data.incentives.filter(inc => {
          if (inc.conditions.requiresUpfit && !configuration.upfitter) return false
          if (inc.conditions.minUnits && (configuration.units || 1) < inc.conditions.minUnits) return false
          return true
        })
        setSelectedIncentives(applicable.map(inc => inc.id))
      } catch (error) {
        console.error('Error loading incentives:', error)
      } finally {
        setLoading(false)
      }
    }
    if (configuration.chassis?.series) {
      loadData()
    }
    // Only re-run when core config changes
  }, [
    configuration.chassis?.series,
    configuration.chassis?.powertrain,
    configuration.bodyType,
    configuration.units,
    configuration.upfitter
  ])

  // Update financing APR based on credit tier
  useEffect(() => {
    if (incentivesData.financing?.rates) {
      const rate = incentivesData.financing.rates.find(r => r.creditTier === financingOptions.creditTier)
      if (rate) {
        setFinancingOptions(prev => ({ ...prev, apr: rate.apr }))
      }
    }
  }, [financingOptions.creditTier, incentivesData])

  // Calculate pricing breakdown
  const calcViewPricing = () => {
    const chassis = computedPricing?.chassisMSRP || 0
    const body = computedPricing?.bodyPrice || 0
    const options = computedPricing?.optionsPrice || 0
    const labor = computedPricing?.laborPrice || 0
    const freight = 1500 // Standard freight charge
    
    const subtotal = chassis + body + options + labor + freight
    
    // Calculate incentives
    const totalIncentives = selectedIncentives.reduce((total, id) => {
      const incentive = incentivesData.incentives.find(inc => inc.id === id)
      return total + (incentive?.amount || 0)
    }, 0)
    
    const taxableAmount = subtotal - totalIncentives
    const taxes = Math.round(taxableAmount * 0.0875) // 8.75% tax rate
    const total = taxableAmount + taxes
    
    return {
      chassis,
      body,
      options,
      labor,
      freight,
      subtotal,
      totalIncentives,
      taxes,
      total
    }
  }

  const pricing = useMemo(() => calcViewPricing(), [
    computedPricing?.chassisMSRP,
    computedPricing?.bodyPrice,
    computedPricing?.optionsPrice,
    computedPricing?.laborPrice,
    selectedIncentives
  ])
  
  // Calculate monthly payment
  const monthlyPayment = useMemo(() => (
    calculateMonthlyPayment(
      pricing.total,
      financingOptions.apr,
      financingOptions.term,
      financingOptions.downPayment / 100
    )
  ), [pricing.total, financingOptions.apr, financingOptions.term, financingOptions.downPayment])
  
  const downPaymentAmount = useMemo(() => pricing.total * (financingOptions.downPayment / 100), [pricing.total, financingOptions.downPayment])
  const financeAmount = useMemo(() => pricing.total - downPaymentAmount, [pricing.total, downPaymentAmount])

  // Update configuration with pricing
  useEffect(() => {
    // Only propagate to parent if values actually changed to avoid update loops
    const prevPricing = configuration.pricing || {}
    const prevFinancing = configuration.financing || {}
    const pricingChanged = (
      prevPricing.subtotal !== pricing.subtotal ||
      prevPricing.total !== pricing.total ||
      prevPricing.taxes !== pricing.taxes ||
      prevPricing.chassis !== pricing.chassis ||
      prevPricing.body !== pricing.body ||
      prevPricing.options !== pricing.options ||
      prevPricing.labor !== pricing.labor ||
      prevPricing.freight !== pricing.freight ||
      (Array.isArray(prevPricing.incentives) ? prevPricing.incentives.join(',') : '') !== selectedIncentives.join(',')
    )
    const financingChanged = (
      prevFinancing.apr !== financingOptions.apr ||
      prevFinancing.term !== financingOptions.term ||
      prevFinancing.downPayment !== financingOptions.downPayment ||
      prevFinancing.monthlyPayment !== monthlyPayment ||
      prevFinancing.downPaymentAmount !== downPaymentAmount ||
      prevFinancing.financeAmount !== financeAmount ||
      Boolean(prevFinancing.enabled) !== Boolean(enableFinancing)
    )
    if (pricingChanged || financingChanged) {
      onChange({
        pricing: {
          ...pricing,
          incentives: selectedIncentives
        },
        financing: {
          ...financingOptions,
          monthlyPayment,
          downPaymentAmount,
          financeAmount,
          enabled: enableFinancing
        }
      })
    }
  }, [pricing, financingOptions, monthlyPayment, downPaymentAmount, financeAmount, selectedIncentives, configuration, enableFinancing])

  const toggleIncentive = (incentiveId) => {
    setSelectedIncentives(prev => 
      prev.includes(incentiveId) 
        ? prev.filter(id => id !== incentiveId)
        : [...prev, incentiveId]
    )
  }

  return (
    <div className="space-y-6">
      {/* Price Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Price Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span>Chassis MSRP</span>
              <span className="font-semibold">${Math.round(pricing.chassis).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b">
              <span>Body & Equipment</span>
              <span className="font-semibold">${Math.round(pricing.body).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            
            {pricing.options > 0 && (
              <div className="flex justify-between items-center py-2 border-b">
                <span>Options & Accessories</span>
                <span className="font-semibold">${Math.round(pricing.options).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center py-2 border-b">
              <span>Labor & Installation</span>
              <span className="font-semibold">${Math.round(pricing.labor).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b">
              <span>Freight & Delivery</span>
              <span className="font-semibold">${Math.round(pricing.freight).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 font-medium">
              <span>Subtotal</span>
              <span>${Math.round(pricing.subtotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            
            {pricing.totalIncentives > 0 && (
              <div className="flex justify-between items-center py-2 text-green-600 border-b">
                <span>Incentives & Rebates</span>
                <span className="font-semibold">-${Math.round(pricing.totalIncentives).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center py-2 border-b">
              <span>Estimated Taxes (8.75%)</span>
              <span className="font-semibold">${Math.round(pricing.taxes).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            
            <div className="flex justify-between items-center py-3 text-lg font-bold">
              <span>Estimated Total</span>
              <span className="text-2xl text-blue-600">${Math.round(pricing.total).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incentives */}
      <Card>
        <CardHeader>
          <CardTitle>Available Incentives</CardTitle>
          <CardDescription>Select applicable incentives and rebates</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : incentivesData.incentives.length === 0 ? (
            <Alert>
              <AlertDescription>
                No incentives currently available for this configuration.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {incentivesData.incentives
                .filter((inc) => !inc.conditions?.minUnits) // hide raw unit-tier rows
                .map((incentive) => (
                <div 
                  key={incentive.id}
                  className="flex items-start p-3 border rounded-lg hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    id={incentive.id}
                    checked={selectedIncentives.includes(incentive.id)}
                    onChange={() => toggleIncentive(incentive.id)}
                    className="mt-1 rounded border-gray-300"
                  />
                  <Label htmlFor={incentive.id} className="ml-3 flex-1 cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{incentive.name}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {incentive.conditions.description}
                        </div>
                      </div>
                      <div className="ml-4">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          ${incentive.amount.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}

              {/* Collapsed Fleet Volume: show single computed row when units >= 5 */}
              {(() => {
                const u = configuration.units || 1
                const tiers = [
                  { min: 25, amount: 4000 },
                  { min: 10, amount: 2500 },
                  { min: 5, amount: 1500 },
                ]
                const matched = tiers.find(t => u >= t.min)
                if (!matched) return null
                const id = `fleet-volume-computed-${matched.min}`
                const checked = selectedIncentives.includes(id)
                return (
                  <div className="flex items-start p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      id={id}
                      checked={checked}
                      onChange={() => toggleIncentive(id)}
                      className="mt-1 rounded border-gray-300"
                    />
                    <Label htmlFor={id} className="ml-3 flex-1 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">Fleet Purchase Discount ({matched.min}+ units)</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Based on quantity ({u} units). Only one fleet discount applies.
                          </div>
                        </div>
                        <div className="ml-4">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            ${matched.amount.toLocaleString()}
                          </Badge>
                        </div>
                      </div>
                    </Label>
                  </div>
                )
              })()}
            </div>
          )}
          
          {selectedIncentives.length > 0 && (
            <Alert className="mt-4 bg-green-50 border-green-200">
              <AlertDescription>
                <span className="font-medium text-green-900">
                  Total Savings: ${pricing.totalIncentives.toLocaleString()}
                </span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Financing */}
      <Card>
        <CardHeader>
          <CardTitle>Financing Options</CardTitle>
          <CardDescription>Calculate your monthly payment</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Finance toggle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="enableFinancing">Financing?</Label>
              <Select
                value={enableFinancing ? 'yes' : 'no'}
                onValueChange={(value) => setEnableFinancing(value === 'yes')}
              >
                <SelectTrigger id="enableFinancing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {enableFinancing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="creditTier">Credit Tier</Label>
                  <Select 
                    value={financingOptions.creditTier} 
                    onValueChange={(value) => setFinancingOptions(prev => ({ ...prev, creditTier: value }))}
                  >
                    <SelectTrigger id="creditTier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tier1">Tier 1 (740+)</SelectItem>
                      <SelectItem value="tier2">Tier 2 (680-739)</SelectItem>
                      <SelectItem value="tier3">Tier 3 (620-679)</SelectItem>
                      <SelectItem value="tier4">Tier 4 (580-619)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="apr">APR</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="apr"
                      type="number"
                      value={financingOptions.apr}
                      onChange={(e) => setFinancingOptions(prev => ({ ...prev, apr: parseFloat(e.target.value) }))}
                      step="0.1"
                      min="0"
                      max="30"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="term">Loan Term</Label>
                <Select 
                  value={financingOptions.term.toString()} 
                  onValueChange={(value) => setFinancingOptions(prev => ({ ...prev, term: parseInt(value) }))}
                >
                  <SelectTrigger id="term">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="36">36 months</SelectItem>
                    <SelectItem value="48">48 months</SelectItem>
                    <SelectItem value="60">60 months</SelectItem>
                    <SelectItem value="72">72 months</SelectItem>
                    <SelectItem value="84">84 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="downPayment">Down Payment: {financingOptions.downPayment}%</Label>
                <Slider
                  id="downPayment"
                  min={0}
                  max={50}
                  step={5}
                  value={[financingOptions.downPayment]}
                  onValueChange={(value) => setFinancingOptions(prev => ({ ...prev, downPayment: value[0] }))}
                  className="mt-2"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>0%</span>
                  <span>${downPaymentAmount.toLocaleString()}</span>
                  <span>50%</span>
                </div>
              </div>
              
              {/* Payment Summary */}
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Finance Amount:</span>
                      <span className="font-semibold">${financeAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Down Payment:</span>
                      <span className="font-semibold">${downPaymentAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-blue-900">
                      <span>Estimated Monthly Payment:</span>
                      <span>${Math.round(monthlyPayment).toLocaleString()}/mo</span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
