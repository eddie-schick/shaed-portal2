import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Stepper } from '@/components/Stepper'
import { ReviewSheet } from '@/components/ReviewSheet'
import { LivePricingSidebar } from '@/components/LivePricingSidebar'
import { CompletedUnitsGallery } from '@/components/CompletedUnitsGallery'
import { StickyActions } from '@/components/Layout/StickyActions'
import { 
  loadConfiguration, 
  saveConfiguration, 
  validateStep,
  parseQueryToConfig,
  configToQuery,
  isDemoMode,
  clearConfiguration
} from '@/lib/configurationStore'
import { calculatePricing } from '@/lib/configurationStore'
import { getChassis, getBodies, getOptions, getIncentives } from '@/api/routes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Home, RotateCcw, CheckCircle2 } from 'lucide-react'
import { intakeOrder } from '@/lib/orderApi'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

export function ConfiguratorReview() {
  const navigate = useNavigate()
  const location = useLocation()
  const [configuration, setConfiguration] = useState(() => {
    // Deep-merge URL params onto saved config so we don't lose nested values
    const base = loadConfiguration()
    const params = new URLSearchParams(location.search)
    if (params.toString()) {
      const parsed = parseQueryToConfig(params)
      // Preserve full upfitter object from base if parsed only has an id
      const mergedUpfitter = (() => {
        const parsedUf = parsed.upfitter
        if (!parsedUf) return base.upfitter
        // If parsed contains only an id, keep base object if present
        if (typeof parsedUf === 'object' && Object.keys(parsedUf).length === 1 && parsedUf.id) {
          // If base upfitter matches the id, keep it; otherwise store minimal object with id
          if (base.upfitter && base.upfitter.id === parsedUf.id) return base.upfitter
          return { id: parsedUf.id }
        }
        return parsedUf
      })()

      return {
        ...base,
        ...parsed,
        upfitter: mergedUpfitter,
        chassis: { ...(base.chassis || {}), ...(parsed.chassis || {}) },
        pricing: { ...(base.pricing || {}), ...(parsed.pricing || {}) },
        financing: { ...(base.financing || {}), ...(parsed.financing || {}) },
        bodySpecs: { ...(base.bodySpecs || {}), ...(parsed.bodySpecs || {}) },
        bodyAccessories: parsed.bodyAccessories?.length ? parsed.bodyAccessories : (base.bodyAccessories || []),
      }
    }
    return base
  })

  // Always position view at top on step entry
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const [orderSubmitted, setOrderSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  // Redirect to first incomplete step instead of jumping to step 1 always
  useEffect(() => {
    if (isDemoMode()) return
    const cfg = configuration
    if (!cfg.bodyType) {
      navigate('/configurator/chassis-selection')
      return
    }
    if (cfg.bodyType !== 'Chassis Only' && !cfg.bodyManufacturer) {
      navigate('/configurator/body-type?' + configToQuery(cfg))
      return
    }
    if (!cfg.chassis?.series) {
      navigate('/configurator/chassis-options?' + configToQuery(cfg))
      return
    }
    if (cfg.bodyType !== 'Chassis Only' && !cfg.upfitter) {
      navigate('/configurator/upfitter?' + configToQuery(cfg))
      return
    }
    if (!cfg.pricing?.total || cfg.pricing.total === 0) {
      navigate('/configurator/pricing?' + configToQuery(cfg))
      return
    }
  }, [configuration, navigate])

  // Update URL when configuration changes
  useEffect(() => {
    const query = configToQuery(configuration)
    const newUrl = `${location.pathname}?${query}`
    window.history.replaceState(null, '', newUrl)
  }, [configuration, location.pathname])

  // Ensure pricing snapshot exists and mirrors current configuration
  useEffect(() => {
    const ensurePricing = async () => {
      try {
        const [chassisData, bodiesData, optionsData] = await Promise.all([
          getChassis(),
          getBodies(),
          getOptions()
        ])
        // Base prices
        const base = calculatePricing(configuration, chassisData, bodiesData, optionsData)

        // Incentives identical to Step 6
        const filters = {
          powertrain: configuration.chassis?.powertrain?.includes('diesel') ? 'diesel' : 
                     configuration.chassis?.powertrain?.includes('ev') ? 'ev' : 'gas',
          series: configuration.chassis?.series,
          bodyType: configuration.bodyType,
          units: configuration.units || 1,
          state: 'MI'
        }
        const incentivesData = await getIncentives(filters)
        const selectedIds = configuration.pricing?.incentives || []
        const totalIncentives = selectedIds.reduce((sum, id) => {
          const inc = incentivesData.incentives.find(i => i.id === id)
          return sum + (inc?.amount || 0)
        }, 0)

        const freight = 1500
        const subtotal = base.chassisMSRP + base.bodyPrice + base.optionsPrice + base.laborPrice + freight
        const taxes = Math.round((subtotal - totalIncentives) * 0.0875)
        const total = subtotal - totalIncentives + taxes

        const latest = {
          ...base,
          subtotal,
          taxes,
          total,
          freight,
          totalIncentives,
          incentives: selectedIds
        }

        const needsUpdate = !configuration.pricing || configuration.pricing.total !== latest.total
        if (needsUpdate) {
          const updated = { ...configuration, pricing: latest }
          saveConfiguration(updated)
          setConfiguration(updated)
        }
      } catch (e) {
        console.error('Error ensuring pricing on review:', e)
      }
    }
    if (configuration.chassis?.series) {
      ensurePricing()
    }
  }, [configuration.chassis?.series, configuration.bodyType, configuration.bodySpecs, configuration.bodyAccessories, configuration.pricing?.incentives, configuration.units])

  const handleBack = () => {
    if (!orderSubmitted) {
      navigate('/configurator/pricing?' + configToQuery(configuration))
    }
  }

  const handleStartNew = () => {
    clearConfiguration()
    navigate('/configure')
  }

  const handleReturnHome = () => {
    navigate('/')
  }

  const mapToIntakePayload = () => {
    const cfg = configuration
    const pricing = cfg.pricing || {}
    return {
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
        chassisMsrp: Math.round(pricing.chassisMSRP || 0),
        bodyPrice: Math.round(pricing.bodyPrice || 0),
        optionsPrice: Math.round(pricing.optionsPrice || 0),
        labor: Math.round(pricing.laborPrice || 0),
        freight: Math.round(pricing.freight || 0),
        incentives: (pricing.incentives || []).map(id => ({ code: String(id), label: String(id), amount: 0 })),
        taxes: Math.round(pricing.taxes || 0),
        total: Math.round(pricing.total || 0)
      }
    }
  }

  const handleSubmit = async () => {
    setSubmitError('')
    setSubmitting(true)
    try {
      const payload = mapToIntakePayload()
      await intakeOrder(payload)
      setOrderSubmitted(true)
      setShowSuccessDialog(true)
      // Show toast for desktop
      toast.success('Order submitted successfully!', {
        description: 'Your order request has been sent to order management.',
        duration: 5000,
      })
    } catch (e) {
      console.error('Submit failed', e)
      setSubmitError(e?.message || 'Submit failed')
      toast.error('Failed to submit order', {
        description: e?.message || 'Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Mark step as completed
  useEffect(() => {
    if (!configuration.completedSteps?.includes(7)) {
      const updated = {
        ...configuration,
        completedSteps: [...new Set([...configuration.completedSteps, 7])]
      }
      saveConfiguration(updated)
      setConfiguration(updated)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Stepper currentStep={7} completedSteps={configuration.completedSteps} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Step 7: Review & Submit</CardTitle>
                <CardDescription className="text-sm">
                  Review your complete configuration and submit your order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReviewSheet configuration={configuration} />
              </CardContent>
            </Card>

            {/* Completed Units Gallery */}
            <CompletedUnitsGallery
              selectedChassis={configuration.chassis?.series}
              selectedBodyType={configuration.bodyType}
              className="mt-6 sm:mt-8"
              title="Your Final Build"
            />
          </div>

          {/* Live Pricing Sidebar */}
          <div className="lg:w-80 w-full">
            <LivePricingSidebar configuration={configuration} />
          </div>
        </div>

        {/* Additional Actions after order submission */}
        {orderSubmitted && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button onClick={handleStartNew} variant="outline" className="flex-1 w-full sm:w-auto">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Start New Configuration
                </Button>
                <Button onClick={handleReturnHome} variant="outline" className="flex-1 w-full sm:w-auto">
                  <Home className="w-4 h-4 mr-2" />
                  Return to Marketplace
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {!orderSubmitted && (
        <StickyActions
          onBack={handleBack}
          onContinue={handleSubmit}
          continueLabel={submitting ? 'Submitting…' : 'Submit Order Request'}
          disableContinue={submitting}
        />
      )}
      {submitError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 text-red-600 text-sm">{submitError}</div>
      )}

      {/* Success Dialog - Optimized for Mobile and Desktop */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-left">
            <div className="flex justify-center sm:justify-start mb-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-center sm:text-left">
              Order Submitted Successfully!
            </DialogTitle>
            <DialogDescription className="text-base sm:text-lg text-center sm:text-left mt-3">
              Your order request has been sent to order management. A dealer representative will contact you within 24-48 hours to finalize your order.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-3">
            <Button 
              onClick={() => {
                setShowSuccessDialog(false)
                handleStartNew()
              }}
              className="w-full"
              size="lg"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Start New Configuration
            </Button>
            <Button 
              onClick={() => {
                setShowSuccessDialog(false)
                handleReturnHome()
              }}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Return to Marketplace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
