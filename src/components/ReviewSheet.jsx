import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
// Removed decorative icons for a cleaner, icon-free configurator experience
import { submitOrder, exportPDFQuote, emailQuote, getChassis, getBodies, getOptions, getUpfitters } from '@/api/routes'
import { intakeOrder } from '@/lib/orderApi'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { calculatePricing, calculateMonthlyPayment } from '@/lib/configurationStore'
import { useEffect, useMemo, useState } from 'react'

export function ReviewSheet({ configuration }) {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState(null)
  const [emailSent, setEmailSent] = useState(false)
  const [viewPricing, setViewPricing] = useState(null)
  const [hydratedUpfitter, setHydratedUpfitter] = useState(configuration.upfitter || null)

  // Derive pricing snapshot so the review page mirrors Step 6 even if saved state was partial
  useEffect(() => {
    const compute = async () => {
      try {
        const [chassisData, bodiesData, optionsData] = await Promise.all([
          getChassis(),
          getBodies(),
          getOptions()
        ])
        const base = calculatePricing(configuration, chassisData, bodiesData, optionsData)
        const freight = 1500
        const subtotal = (base.chassisMSRP || 0) + (base.bodyPrice || 0) + (base.optionsPrice || 0) + (base.laborPrice || 0) + freight
        const totalIncentives = configuration.pricing?.totalIncentives || 0
        const taxes = Math.round((subtotal - totalIncentives) * 0.0875)
        const total = subtotal - totalIncentives + taxes
        setViewPricing({
          chassis: base.chassisMSRP || 0,
          body: base.bodyPrice || 0,
          options: base.optionsPrice || 0,
          labor: base.laborPrice || 0,
          freight,
          subtotal,
          totalIncentives,
          taxes,
          total
        })
      } catch (e) {
        console.error('Error computing review pricing:', e)
      }
    }
    compute()
  }, [configuration])

  // Hydrate upfitter details if only an id is present
  useEffect(() => {
    const hydrate = async () => {
      try {
        if (configuration.upfitter && (!configuration.upfitter.name || !configuration.upfitter.leadTime)) {
          const list = await getUpfitters({})
          const found = list.find(u => u.id === (configuration.upfitter.id || configuration.upfitter))
          setHydratedUpfitter(found || configuration.upfitter)
        } else {
          setHydratedUpfitter(configuration.upfitter || null)
        }
      } catch (e) {
        setHydratedUpfitter(configuration.upfitter || null)
      }
    }
    hydrate()
  }, [configuration.upfitter])

  // Helpers to read pricing from either saved config or derived snapshot
  const pricingDisplay = useMemo(() => {
    const p = configuration.pricing || {}
    return {
      chassis: p.chassisMSRP ?? p.chassis ?? viewPricing?.chassis ?? 0,
      body: p.bodyPrice ?? p.body ?? viewPricing?.body ?? 0,
      options: p.optionsPrice ?? p.options ?? viewPricing?.options ?? 0,
      labor: p.laborPrice ?? p.labor ?? viewPricing?.labor ?? 0,
      subtotal: p.subtotal ?? viewPricing?.subtotal ?? 0,
      totalIncentives: p.totalIncentives ?? viewPricing?.totalIncentives ?? 0,
      taxes: p.taxes ?? viewPricing?.taxes ?? 0,
      total: p.total ?? viewPricing?.total ?? 0
    }
  }, [configuration.pricing, viewPricing])

  // Defaults and helpers
  const defaultChassisLeadTime = (series) => ({
    'F-350': '8–12 weeks',
    'F-450': '10–14 weeks',
    'F-550': '12–16 weeks',
    'F-600': '14–18 weeks',
    'F-650': '16–20 weeks',
    'F-750': '16–22 weeks',
    'E-350': '6–10 weeks',
    'E-450': '6–10 weeks',
    'Transit': '4–8 weeks',
    'E-Transit': '6–10 weeks',
  }[series] || '6–12 weeks')

  const aprPercent = (configuration.financing?.apr ?? 6.99)
  const termMonths = (configuration.financing?.term ?? 60)
  const downPaymentFraction = (() => {
    const dp = configuration.financing?.downPayment ?? 0.2
    return dp > 1 ? dp / 100 : dp
  })()
  const downPaymentAmount = Math.round(pricingDisplay.total * downPaymentFraction)
  const monthlyPayment = Math.round(
    calculateMonthlyPayment(pricingDisplay.total, aprPercent, termMonths, downPaymentFraction) || 0
  )

  // ETA helpers
  const parseWeeks = (text) => {
    if (!text) return null
    try {
      const nums = (text.match(/\d+/g) || []).map(n => parseInt(n, 10))
      if (nums.length === 1) return { min: nums[0], max: nums[0] }
      if (nums.length >= 2) return { min: nums[0], max: nums[1] }
    } catch (_) { /* noop */ }
    return null
  }
  const chassisEtaText = configuration.chassis?.leadTime || defaultChassisLeadTime(configuration.chassis?.series)
  const chassisEta = parseWeeks(chassisEtaText)
  const upfitterEta = parseWeeks(hydratedUpfitter?.leadTime)
  const finalDeliveryETA = (() => {
    if (chassisEta && upfitterEta) {
      return `${chassisEta.min + upfitterEta.min}\u2013${chassisEta.max + upfitterEta.max} weeks`
    }
    if (chassisEta) return `${chassisEta.min}\u2013${chassisEta.max} weeks`
    if (upfitterEta) return `${upfitterEta.min}\u2013${upfitterEta.max} weeks`
    return '—'
  })()

  const handleExportPDF = async () => {
    try {
      await exportPDFQuote(configuration)
    } catch (error) {
      console.error('Error exporting PDF:', error)
    }
  }

  const handleEmailQuote = async (recipient) => {
    try {
      await emailQuote(configuration, recipient)
      setEmailSent(true)
    } catch (error) {
      console.error('Error emailing quote:', error)
    }
  }

  const handleSubmitOrder = async () => {
    setSubmitting(true)
    try {
      const cfg = configuration
      const p = cfg.pricing || {}
      const payload = {
        dealerCode: cfg.dealerCode || 'DEMO',
        upfitterId: cfg.upfitter?.id,
        isStock: Boolean(cfg.isStock),
        build: {
          bodyType: cfg.bodyType,
          manufacturer: cfg.bodyManufacturer,
          chassis: {
            series: cfg.chassis?.series,
            cab: cfg.chassis?.cab,
            drivetrain: cfg.chassis?.drivetrain,
            wheelbase: String(cfg.chassis?.wheelbase || ''),
            gvwr: String(cfg.chassis?.gvwr || ''),
            powertrain: (cfg.chassis?.powertrain || 'Gas')
          },
          bodySpecs: cfg.bodySpecs || {},
          upfitter: cfg.upfitter ? { id: cfg.upfitter.id, name: cfg.upfitter.name } : undefined,
        },
        pricing: {
          chassisMsrp: Math.round(p.chassisMSRP || 0),
          bodyPrice: Math.round(p.bodyPrice || 0),
          optionsPrice: Math.round(p.optionsPrice || 0),
          labor: Math.round(p.laborPrice || 0),
          freight: Math.round(p.freight || 1500),
          incentives: (p.incentives || []).map(id => ({ code: String(id), label: String(id), amount: 0 })),
          taxes: Math.round(p.taxes || 0),
          total: Math.round(p.total || 0)
        }
      }
      await intakeOrder(payload)
      navigate('/ordermanagement')
    } catch (error) {
      console.error('Error submitting order:', error)
    }
    setSubmitting(false)
  }

  const handleShare = () => {
    // Generate shareable URL with configuration
    const params = new URLSearchParams()
    params.set('bt', configuration.bodyType)
    params.set('bm', configuration.bodyManufacturer)
    params.set('series', configuration.chassis.series)
    params.set('cab', configuration.chassis.cab)
    params.set('dr', configuration.chassis.drivetrain)
    params.set('wb', configuration.chassis.wheelbase)
    params.set('pt', configuration.chassis.powertrain)
    
    const url = `${window.location.origin}/configure?${params.toString()}`
    
    if (navigator.share) {
      navigator.share({
        title: 'SHAED Commercial Vehicle Configuration',
        text: 'Check out my custom commercial vehicle build',
        url: url
      })
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(url)
      alert('Configuration link copied to clipboard!')
    }
  }

  if (orderNumber) {
    return (
      <div className="space-y-6">
        <Alert className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <div className="font-medium text-green-900 text-lg mb-2">
              Order Submitted Successfully!
            </div>
            <div className="space-y-1">
              <p>Order Number: <strong>{orderNumber}</strong></p>
              <p>A dealer representative will contact you within 24-48 hours to finalize your order.</p>
            </div>
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start">
                <span className="font-semibold mr-2">1.</span>
                <span>Dealer review and confirmation of specifications</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">2.</span>
                <span>Final pricing and financing approval</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">3.</span>
                <span>Production scheduling and order tracking</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">4.</span>
                <span>Upfit coordination and installation</span>
              </li>
              <li className="flex items-start">
                <span className="font-semibold mr-2">5.</span>
                <span>Delivery and final inspection</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Build Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Build Summary</CardTitle>
          <CardDescription>
            Review your configuration before submitting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Chassis Specs - comprehensive */}
          <div>
            <h3 className="font-semibold mb-3">Chassis Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">Series</span><span className="font-medium">{configuration.chassis.series || '—'}</span></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">Cab</span><span className="font-medium">{configuration.chassis.cab || '—'}</span></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">Drivetrain</span><span className="font-medium">{configuration.chassis.drivetrain || '—'}</span></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">Wheelbase</span><span className="font-medium">{configuration.chassis.wheelbase ? `${configuration.chassis.wheelbase}"` : '—'}</span></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">Suspension</span><span className="font-medium">{configuration.chassis.suspensionPackage || '—'}</span></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">Powertrain</span><span className="font-medium">{configuration.chassis.powertrain || '—'}</span></div>
              {/* Dummy extended specs that vary by series */}
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">GVWR</span><span className="font-medium">{({ 'F-350':'12,000–14,000 lbs','F-450':'14,000–16,500 lbs','F-550':'17,500–19,500 lbs','F-600':'22,000 lbs','F-650':'25,600–29,000 lbs','F-750':'Up to 37,000 lbs','E-350':'10,050–12,700 lbs','E-450':'Up to 14,500 lbs' }[configuration.chassis.series] || '—')}</span></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">Fuel Type</span><span className="font-medium">{configuration.chassis.powertrain?.toLowerCase?.().includes('diesel') ? 'Diesel' : 'Gasoline'}</span></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">Axle Ratio</span><span className="font-medium">{configuration.chassis.drivetrain?.includes('4x4') ? '4.30' : '3.73'}</span></div>
              <div className="grid grid-cols-2 gap-2"><span className="text-gray-600">Towing (est.)</span><span className="font-medium">{configuration.chassis.series?.startsWith('F-6') ? '25,000+ lbs' : configuration.chassis.series?.startsWith('F-5') ? '20,000+ lbs' : '15,000+ lbs'}</span></div>
            </div>
          </div>

          {/* Chassis Delivery ETA */}
          <div>
            <h3 className="font-semibold mb-3">Chassis Delivery ETA</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-lg font-medium">{chassisEtaText}</div>
            </div>
          </div>

          {/* Body Specs - comprehensive */}
          <div>
            <h3 className="font-semibold mb-3">Body Specifications</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* Force Body Type and Manufacturer into the left column */}
                <div className="grid grid-cols-2 gap-2 md:col-start-1 md:col-end-2">
                  <span className="text-gray-600">Body Type</span>
                  <span className="font-medium">{configuration.bodyType || '—'}</span>
                </div>
                {configuration.bodyType !== 'Chassis Only' && (
                  <div className="grid grid-cols-2 gap-2 md:col-start-1 md:col-end-2">
                    <span className="text-gray-600">Manufacturer</span>
                    <span className="font-medium">{configuration.bodyManufacturer || '—'}</span>
                  </div>
                )}

                {/* Remaining specs flow into two columns */}
                {configuration.bodyType !== 'Chassis Only' && (
                  <>
                    {Object.entries(configuration.bodySpecs || {}).length > 0 ? (
                      Object.entries(configuration.bodySpecs).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-2 text-sm gap-2">
                          <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g,' $1').trim()}</span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-600 col-span-1 md:col-span-2">No body specifications selected.</div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          

          {/* Upfitter */}
          <div>
            <h3 className="font-semibold mb-3">Upfitter/Installer</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              {hydratedUpfitter ? (
                <>
                  <div className="font-medium">{hydratedUpfitter.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{hydratedUpfitter.address}</div>
                  <div className="text-sm text-gray-600">{hydratedUpfitter.phone}</div>
                  <div className="flex gap-2 mt-2">
                    {hydratedUpfitter.certifications?.map((cert) => (
                      <Badge key={cert} variant="outline" className="text-xs">
                        {cert}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-sm mt-2">
                    <span className="text-gray-600">Lead Time:</span>
                    <span className="ml-2 font-medium">{hydratedUpfitter.leadTime}</span>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">No upfitter selected</p>
              )}
            </div>
          </div>

          {/* Final Delivery ETA */}
          <div>
            <h3 className="font-semibold mb-3">Final Delivery ETA</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-lg font-medium">{finalDeliveryETA}</div>
            </div>
          </div>

          {/* Pricing */}
          <div>
            <h3 className="font-semibold mb-3">Pricing Summary</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Chassis MSRP:</span>
                <span className="font-medium">${Math.round(pricingDisplay.chassis).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Body & Equipment:</span>
                <span className="font-medium">${Math.round(pricingDisplay.body).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              {pricingDisplay.options > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Options:</span>
                  <span className="font-medium">${Math.round(pricingDisplay.options).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Labor & Installation:</span>
                <span className="font-medium">${Math.round(pricingDisplay.labor).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Freight & Delivery:</span>
                <span className="font-medium">${Math.round(configuration.pricing?.freight || 1500).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              {pricingDisplay.totalIncentives > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Incentives:</span>
                  <span className="font-medium">-${Math.round(pricingDisplay.totalIncentives).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Estimated Total:</span>
                <span className="text-blue-600">${Math.round(pricingDisplay.total).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* Financing */}
              {(configuration.financing?.enabled) && (
            <div>
              <h3 className="font-semibold mb-3">Financing Details</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                      <span className="text-gray-600">APR:</span>
                      <span className="font-medium">{aprPercent}%</span>
                </div>
                <div className="flex justify-between">
                      <span className="text-gray-600">Term:</span>
                      <span className="font-medium">{termMonths} months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Down Payment:</span>
                      <span className="font-medium">${downPaymentAmount.toLocaleString()} ({(downPaymentFraction * 100)}%)</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Est. Monthly Payment:</span>
                      <span>${monthlyPayment.toLocaleString()}/mo</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" onClick={handleShare}>Share</Button>
            <Button variant="outline" onClick={handleExportPDF}>Export PDF</Button>
            <Button 
              variant="outline" 
              onClick={() => handleEmailQuote('dealer@example.com')}
              disabled={emailSent}
            >
              {emailSent ? 'Sent!' : 'Email'}
            </Button>
            <Button variant="outline" onClick={() => window.print()}>Print</Button>
          </div>
          
          <div className="mt-6 pt-6 border-t">
            <Button 
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? 'Submitting...' : 'Submit Order Request'}
            </Button>
            <p className="text-xs text-gray-500 text-center mt-2">
              By submitting, you'll receive a quote from the dealer within 24-48 hours
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
