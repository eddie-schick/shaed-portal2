import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Stepper } from '@/components/Stepper'
import { BodySpecsForm } from '@/components/BodySpecsForm'
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
import { getBodies, getOptions, getChassis } from '@/api/routes'

export function ConfiguratorBodySpecs() {
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

  // Redirect if prerequisites not met
  useEffect(() => {
    if (!isDemoMode() && (!configuration.bodyType || !configuration.bodyManufacturer || !configuration.chassis?.series)) {
      navigate('/configurator/chassis-selection')
    }
  }, [configuration.bodyType, configuration.bodyManufacturer, configuration.chassis?.series, navigate])

  // Update URL when configuration changes
  useEffect(() => {
    const query = configToQuery(configuration)
    const newUrl = `${location.pathname}?${query}`
    window.history.replaceState(null, '', newUrl)
  }, [configuration, location.pathname])

  const handleBodySpecsChange = async ({ specs, accessories }) => {
    // Update configuration
    const updated = {
      ...configuration,
      bodySpecs: specs,
      bodyAccessories: accessories
    }

    // Recalculate pricing
    try {
      const [chassisData, bodiesData, optionsData] = await Promise.all([
        getChassis(),
        getBodies(),
        getOptions()
      ])
      
      const pricing = calculatePricing(updated, chassisData, bodiesData, optionsData)
      updated.pricing = pricing
    } catch (error) {
      console.error('Error calculating pricing:', error)
    }

    setConfiguration(updated)
    saveConfiguration(updated)
  }

  const handleBack = () => {
    navigate('/configurator/chassis-options?' + configToQuery(configuration))
  }

  const handleContinue = () => {
    if (isDemoMode() || validateStep(4, configuration)) {
      const updated = {
        ...configuration,
        completedSteps: [...new Set([...configuration.completedSteps, 4])]
      }
      saveConfiguration(updated)
      navigate('/configurator/upfitter?' + configToQuery(updated))
    }
  }

  // Allow continue even if a body type has no specific required specs
  const isValid = true

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Stepper currentStep={4} completedSteps={configuration.completedSteps} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Step 4: Body Specifications</CardTitle>
                <CardDescription className="text-sm">
                  Configure the specifications for your {configuration.bodyType}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BodySpecsForm
                  bodyType={configuration.bodyType}
                  initialSpecs={configuration.bodySpecs}
                  initialAccessories={configuration.bodyAccessories}
                  onChange={handleBodySpecsChange}
                  wheelbase={configuration.chassis?.wheelbase}
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
      />
    </div>
  )
}
