import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Stepper } from '@/components/Stepper'
import { ChassisForm } from '@/components/ChassisForm'
import { LivePricingSidebar } from '@/components/LivePricingSidebar'
import { StickyActions } from '@/components/Layout/StickyActions'
import { 
  loadConfiguration, 
  saveConfiguration, 
  validateStep,
  parseQueryToConfig,
  configToQuery,
  isDemoMode
} from '@/lib/configurationStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ConfiguratorChassis() {
  const navigate = useNavigate()
  const location = useLocation()
  const [configuration, setConfiguration] = useState(() => {
    // Load from URL params first, then localStorage
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

  // Update URL when configuration changes
  useEffect(() => {
    const query = configToQuery(configuration)
    const newUrl = `${location.pathname}?${query}`
    window.history.replaceState(null, '', newUrl)
  }, [configuration, location.pathname])

  const handleChassisChange = (chassisData) => {
    const updated = {
      ...configuration,
      chassis: chassisData
    }
    setConfiguration(updated)
    saveConfiguration(updated)
  }

  // Redirect if prerequisites not met
  useEffect(() => {
    if (isDemoMode()) return
    if (!configuration.bodyType) {
      navigate('/configurator/chassis-selection')
    } else if (configuration.bodyType !== 'Chassis Only' && !configuration.bodyManufacturer) {
      navigate('/configurator/body-type?' + configToQuery(configuration))
    }
  }, [configuration, navigate])

  const handleBack = () => {
    navigate('/configurator/body-type?' + configToQuery(configuration))
  }

  const handleContinue = () => {
    const updated = {
      ...configuration,
      completedSteps: [...new Set([...configuration.completedSteps, 3])]
    }
    saveConfiguration(updated)
    if (configuration.bodyType === 'Chassis Only') {
      navigate('/configurator/pricing?' + configToQuery(updated))
    } else {
      navigate('/configurator/body-specs?' + configToQuery(updated))
    }
  }

  const isValid = true

  // Get compatible series based on body type
  const getCompatibleSeries = () => {
    // This would normally come from the UPFIT_MATRIX
    const compatibilityMap = {
      'Flatbed': ['F-350', 'F-450', 'F-550', 'F-600', 'F-650', 'F-750'],
      'Dump Body': ['F-350', 'F-450', 'F-550', 'F-600', 'F-650'],
      'Dry Freight Body': ['Transit', 'E-Transit', 'E-350', 'E-450', 'F-450', 'F-550', 'F-600', 'F-650'],
      'Refrigerated Body': ['Transit', 'E-Transit', 'E-450', 'F-450', 'F-550', 'F-600', 'F-650'],
      'Tow & Recovery': ['F-450', 'F-550', 'F-600'],
      'Bucket': ['F-550', 'F-600', 'F-650', 'F-750'],
      'Contractor Body': ['F-350', 'F-450', 'F-550', 'F-600'],
      'Box w/ Lift Gate': ['F-450', 'F-550', 'F-600', 'F-650'],
      'Service Body': ['F-350', 'F-450', 'F-550'],
      'Ambulance': ['F-450', 'F-550']
    }
    return compatibilityMap[configuration.bodyType] || []
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Stepper currentStep={3} completedSteps={configuration.completedSteps} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Step 3: Chassis & Vehicle Options</CardTitle>
                <CardDescription className="text-sm">
                  Configure your base chassis for {configuration.bodyType} by {configuration.bodyManufacturer}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChassisForm
                  initialValues={configuration.chassis}
                  onChange={handleChassisChange}
                  compatibleSeries={getCompatibleSeries()}
                  bodyType={configuration.bodyType}
                  showSeries={false}
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
