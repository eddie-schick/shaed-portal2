import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Stepper } from '@/components/Stepper'
import { PriceSummary } from '@/components/PriceSummary'
import { LivePricingSidebar } from '@/components/LivePricingSidebar'
import { StickyActions } from '@/components/Layout/StickyActions'
import { 
  loadConfiguration, 
  saveConfiguration, 
  validateStep,
  parseQueryToConfig,
  configToQuery,
  calculatePricing,
  isDemoMode
} from '@/lib/configurationStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getChassis, getBodies, getOptions } from '@/api/routes'

export function ConfiguratorPricing() {
  const navigate = useNavigate()
  const location = useLocation()
  const [configuration, setConfiguration] = useState(() => {
    const params = new URLSearchParams(location.search)
    if (params.toString()) {
      return parseQueryToConfig(params)
    }
    return loadConfiguration()
  })
  
  // Always position view at top on step entry
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const [loading, setLoading] = useState(true)

  // Calculate pricing fresh every time this page mounts (refresh on open)
  useEffect(() => {
    const initializePricing = async () => {
      setLoading(true)
      try {
        const [chassisData, bodiesData, optionsData] = await Promise.all([
          getChassis(),
          getBodies(),
          getOptions()
        ])
        const pricing = calculatePricing(configuration, chassisData, bodiesData, optionsData)
        const updated = {
          ...configuration,
          pricing
        }
        setConfiguration(updated)
        saveConfiguration(updated)
      } catch (error) {
        console.error('Error calculating pricing:', error)
      } finally {
        setLoading(false)
      }
    }
    initializePricing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirect if prerequisites not met (allow pricing without upfitter)
  useEffect(() => {
    if (!isDemoMode() && (!configuration.bodyType || !configuration.chassis?.series)) {
      navigate('/configurator/chassis-selection')
    }
  }, [configuration, navigate])

  // Update URL when configuration changes
  useEffect(() => {
    const query = configToQuery(configuration)
    const newUrl = `${location.pathname}?${query}`
    window.history.replaceState(null, '', newUrl)
  }, [configuration, location.pathname])

  const handlePricingChange = (pricingData) => {
    const updated = {
      ...configuration,
      ...pricingData
    }
    setConfiguration(updated)
    saveConfiguration(updated)
  }

  const handleBack = () => {
    navigate('/configurator/upfitter?' + configToQuery(configuration))
  }

  const handleContinue = () => {
    const updated = {
      ...configuration,
      completedSteps: [...new Set([...configuration.completedSteps, 6])]
    }
    saveConfiguration(updated)
    navigate('/configurator/review?' + configToQuery(updated))
  }

  const isValid = true

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Stepper currentStep={6} completedSteps={configuration.completedSteps} />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Stepper currentStep={6} completedSteps={configuration.completedSteps} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Step 6: Pricing & Incentives</CardTitle>
                <CardDescription className="text-sm">
                  Review pricing and available incentives for your build
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PriceSummary
                  configuration={configuration}
                  onChange={handlePricingChange}
                />
              </CardContent>
            </Card>
          </div>

          {/* Live Pricing Sidebar */}
          <div className="lg:w-80 w-full">
            <LivePricingSidebar configuration={configuration} />
          </div>
        </div>
      </div>

      <StickyActions
        onBack={handleBack}
        onContinue={handleContinue}
        disableContinue={!isValid}
        continueLabel="Review Order"
      />
    </div>
  )
}
