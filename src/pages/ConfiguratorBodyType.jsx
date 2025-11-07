import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Stepper } from '@/components/Stepper'
import { LivePricingSidebar } from '@/components/LivePricingSidebar'
import { CompletedUnitsGallery } from '@/components/CompletedUnitsGallery'
import { StickyActions } from '@/components/Layout/StickyActions'
import UpfitterLogo from '../components/UpfitterLogo'
import { 
  loadConfiguration, 
  saveConfiguration, 
  validateStep,
  parseQueryToConfig,
  configToQuery,
  isDemoMode
} from '@/lib/configurationStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'

// Use the shared UPFIT_MATRIX from top of file
const UPFIT_MATRIX = {
  'Service Body': {
    chassis: ['F-350', 'F-450', 'F-550'],
    manufacturers: ['Knapheide', 'Royal Truck Body', 'Duramag', 'Reading Truck']
  },
  'Flatbed': {
    chassis: ['F-350', 'F-450', 'F-550', 'F-600'],
    manufacturers: ["Rugby Manufacturing", "PJ's Truck Bodies", 'Duramag', 'SH Truck Bodies']
  },
  'Dump Body': {
    chassis: ['F-350', 'F-450', 'F-550', 'F-600'],
    manufacturers: ['Rugby Manufacturing', 'Godwin Group', 'Brandon Manufacturing', 'Downeaster']
  },
  'Dry Freight Body': {
    chassis: ['Transit', 'E-Transit', 'E-350', 'E-450', 'F-450', 'F-550', 'F-600', 'F-650'],
    manufacturers: ['Morgan Truck Body', 'Rockport', 'Reading Truck', 'Wabash']
  },
  'Refrigerated Body': {
    chassis: ['Transit', 'E-Transit', 'E-450', 'F-450', 'F-550', 'F-600', 'F-650'],
    manufacturers: ['Morgan Truck Body', 'Rockport', 'Great Dane Johnson', 'Wabash']
  },
  'Tow & Recovery': {
    chassis: ['F-450', 'F-550', 'F-600'],
    manufacturers: ['Jerr-Dan', 'Miller Industries', 'Dynamic Towing', 'Chevron']
  },
  'Ambulance': {
    chassis: ['E-450', 'F-450', 'F-550'],
    manufacturers: ['Wheeled Coach', 'Braun Industries', 'Horton Emergency Vehicles', 'AEV']
  },
  'Bucket': {
    chassis: ['F-550', 'F-600', 'F-650', 'F-750'],
    manufacturers: ['Altec', 'Versalift', 'Terex Utilities', 'Dur-A-Lift']
  },
  'Contractor Body': {
    chassis: ['F-350', 'F-450', 'F-550', 'F-600'],
    manufacturers: ['Knapheide', 'Royal Truck Body', 'Scelzi', 'Duramag']
  },
  'Box w/ Lift Gate': {
    chassis: ['F-450', 'F-550', 'F-600', 'F-650'],
    manufacturers: ['Morgan Truck Body', 'Wabash', 'Rockport', 'Complete Truck Bodies']
  }
}

export function ConfiguratorBodyType() {
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

  // Redirect if no chassis selected
  useEffect(() => {
    if (!isDemoMode() && !configuration.chassis?.series) {
      navigate('/configurator/chassis-selection')
    }
  }, [configuration.chassis?.series, navigate])

  // Update URL when configuration changes
  useEffect(() => {
    const query = configToQuery(configuration)
    const newUrl = `${location.pathname}?${query}`
    window.history.replaceState(null, '', newUrl)
  }, [configuration, location.pathname])

  const selectedChassis = configuration.chassis?.series
  const CHASSIS_ONLY = 'Chassis Only'
  const allBodyTypes = [CHASSIS_ONLY, ...Object.keys(UPFIT_MATRIX)]
  const isBodyTypeAllowed = (bt, chassis = selectedChassis) => {
    // Always allow "Chassis Only"
    if (bt === CHASSIS_ONLY) return true
    // If no chassis is selected, disallow all body types (except Chassis Only, already handled above)
    if (!chassis) return false
    // Check if the body type is compatible with the selected chassis
    // This check always applies, regardless of demo mode
    const isCompatible = UPFIT_MATRIX[bt]?.chassis?.includes(chassis) || false
    return isCompatible
  }

  const [selectedBodyType, setSelectedBodyType] = useState(() => {
    // Initialize with configuration body type, but validate it's allowed
    const initialBodyType = configuration.bodyType || CHASSIS_ONLY
    const chassis = configuration.chassis?.series
    if (isDemoMode() || initialBodyType === CHASSIS_ONLY) {
      return initialBodyType
    }
    // If chassis is selected, check if body type is allowed
    if (chassis && !isBodyTypeAllowed(initialBodyType, chassis)) {
      return CHASSIS_ONLY
    }
    return initialBodyType
  })
  const [selectedManufacturer, setSelectedManufacturer] = useState(configuration.bodyManufacturer || null)

  // Validate and fix incompatible body types on mount and when configuration changes
  useEffect(() => {
    if (!selectedChassis) {
      // No chassis selected, ensure body type is Chassis Only
      if (configuration.bodyType && configuration.bodyType !== CHASSIS_ONLY) {
        const updated = {
          ...configuration,
          bodyType: CHASSIS_ONLY,
          bodyManufacturer: null,
        }
        setConfiguration(updated)
        saveConfiguration(updated)
        setSelectedBodyType(CHASSIS_ONLY)
        setSelectedManufacturer(null)
      }
      return
    }

    // Chassis is selected - validate body type compatibility
    if (configuration.bodyType && !isBodyTypeAllowed(configuration.bodyType, selectedChassis)) {
      // Body type is incompatible, reset to Chassis Only
      const updated = {
        ...configuration,
        bodyType: CHASSIS_ONLY,
        bodyManufacturer: null,
      }
      setConfiguration(updated)
      saveConfiguration(updated)
      setSelectedBodyType(CHASSIS_ONLY)
      setSelectedManufacturer(null)
    } else if (!configuration.bodyType) {
      // No body type set, default to Chassis Only
      const updated = {
        ...configuration,
        bodyType: CHASSIS_ONLY,
      }
      setConfiguration(updated)
      saveConfiguration(updated)
      setSelectedBodyType(CHASSIS_ONLY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChassis, configuration.bodyType])

  // Sync selectedBodyType with configuration.bodyType and validate compatibility
  useEffect(() => {
    // If configuration body type doesn't match selected, sync it
    if (configuration.bodyType !== selectedBodyType) {
      if (configuration.bodyType && isBodyTypeAllowed(configuration.bodyType, selectedChassis)) {
        setSelectedBodyType(configuration.bodyType)
      } else if (configuration.bodyType && !isBodyTypeAllowed(configuration.bodyType, selectedChassis)) {
        // Configuration has incompatible body type, reset it
        const updated = {
          ...configuration,
          bodyType: CHASSIS_ONLY,
          bodyManufacturer: null,
        }
        setConfiguration(updated)
        saveConfiguration(updated)
        setSelectedBodyType(CHASSIS_ONLY)
        setSelectedManufacturer(null)
      }
    }
    
    // If selected body type is incompatible, reset to Chassis Only
    if (selectedChassis && selectedBodyType && !isBodyTypeAllowed(selectedBodyType, selectedChassis)) {
      setSelectedBodyType(CHASSIS_ONLY)
      setSelectedManufacturer(null)
      const updated = {
        ...configuration,
        bodyType: CHASSIS_ONLY,
        bodyManufacturer: null,
        completedSteps: [...new Set([...configuration.completedSteps, 1, 2])]
      }
      setConfiguration(updated)
      saveConfiguration(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChassis, selectedBodyType, configuration.bodyType])

  const manufacturersForSelected = selectedBodyType
    ? (selectedBodyType === CHASSIS_ONLY ? [] : UPFIT_MATRIX[selectedBodyType].manufacturers)
    : []

  const handleBodyTypeSelect = (bodyType) => {
    // Prevent selection of incompatible body types - double check
    if (!isBodyTypeAllowed(bodyType, selectedChassis)) {
      console.warn(`Attempted to select incompatible body type: ${bodyType} for chassis: ${selectedChassis}`)
      // If trying to select incompatible, reset to Chassis Only
      const updated = {
        ...configuration,
        bodyType: CHASSIS_ONLY,
        bodyManufacturer: null,
      }
      setConfiguration(updated)
      saveConfiguration(updated)
      setSelectedBodyType(CHASSIS_ONLY)
      setSelectedManufacturer(null)
      return
    }
    setSelectedBodyType(bodyType)
    setSelectedManufacturer(null) // Reset manufacturer when body type changes
    const updated = {
      ...configuration,
      bodyType: bodyType,
      bodyManufacturer: null,
      completedSteps: [...new Set([...configuration.completedSteps, 1, ...(bodyType === CHASSIS_ONLY ? [2] : [])])]
    }
    setConfiguration(updated)
    saveConfiguration(updated)
  }

  const handleManufacturerSelect = (manufacturer) => {
    setSelectedManufacturer(manufacturer)
    
    const updated = {
      ...configuration,
      bodyManufacturer: manufacturer,
      completedSteps: [...new Set([...configuration.completedSteps, 1, 2])]
    }
    setConfiguration(updated)
    saveConfiguration(updated)
  }

  const handleBack = () => {
    navigate('/configurator/chassis-selection?' + configToQuery(configuration))
  }

  const handleContinue = () => {
    const query = configToQuery(configuration)
    // Always continue to chassis options; manufacturer is not required for Chassis Only
    if (isDemoMode() || (selectedBodyType && (selectedBodyType === CHASSIS_ONLY || selectedManufacturer))) {
      navigate(`/configurator/chassis-options?${query}`)
    }
  }

  const isValid = isDemoMode() || (!!selectedBodyType && (selectedBodyType === CHASSIS_ONLY || !!selectedManufacturer))

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Stepper currentStep={2} completedSteps={configuration.completedSteps || []} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6" />
                  Step 2: Select Body Type & Manufacturer
                </CardTitle>
                <CardDescription className="text-sm">
                  Choose the body type and manufacturer for your {configuration.chassis?.series || 'chassis'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 sm:space-y-8">
                  {/* Body Type Selection */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold mb-3">Body Type</h3>
                    {!selectedChassis && (
                      <p className="text-sm text-gray-600 mb-3">Select a chassis in Step 1 to see available body types</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                      {allBodyTypes.map((bt) => {
                        const allowed = isBodyTypeAllowed(bt)
                        const isSelected = selectedBodyType === bt && allowed
                        return (
                          <div
                            key={bt}
                            className={!allowed ? 'relative' : ''}
                            onClick={(e) => {
                              if (!allowed) {
                                e.preventDefault()
                                e.stopPropagation()
                                return false
                              }
                            }}
                            onMouseDown={(e) => {
                              if (!allowed) {
                                e.preventDefault()
                                e.stopPropagation()
                                return false
                              }
                            }}
                          >
                            {!allowed && (
                              <div 
                                className="absolute inset-0 z-10 cursor-not-allowed touch-none"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  return false
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  return false
                                }}
                                onTouchStart={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  return false
                                }}
                                title={`Not available for ${selectedChassis || 'this chassis'}`}
                                aria-label={`${bt} is not available for ${selectedChassis || 'this chassis'}`}
                              />
                            )}
                            <Button
                              variant={isSelected ? 'default' : 'outline'}
                              disabled={!allowed}
                              onClick={(e) => {
                                if (!allowed) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  return false
                                }
                                handleBodyTypeSelect(bt)
                              }}
                              className={`justify-start h-auto py-2.5 sm:py-3 px-3 sm:px-4 text-sm sm:text-base w-full min-h-[44px] sm:min-h-[48px] ${
                                !allowed 
                                  ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 hover:bg-gray-100 hover:text-gray-400 border-gray-300' 
                                  : 'active:scale-[0.98] transition-transform'
                              }`}
                              title={allowed ? '' : `Not available for ${selectedChassis || 'this chassis'}`}
                              aria-disabled={!allowed}
                              aria-label={allowed ? `Select ${bt}` : `${bt} is not available for ${selectedChassis || 'this chassis'}`}
                            >
                              <span className={`text-left whitespace-normal ${!allowed ? 'text-gray-400' : ''}`}>{bt}</span>
                            </Button>
                          </div>
                        )
                      })}
                      {allBodyTypes.length === 0 && (
                        <div className="text-sm text-gray-600 col-span-full">
                          No body types available for this chassis.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Manufacturer Selection */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold mb-3">Body Manufacturer</h3>
                    {selectedBodyType === CHASSIS_ONLY ? (
                      <div className="text-sm text-gray-600">Not applicable for chassis-only orders.</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {manufacturersForSelected.map((m) => (
                          <button
                            key={m}
                            onClick={() => handleManufacturerSelect(m)}
                            className={`border rounded-md p-3 sm:p-4 flex items-center justify-center hover:shadow-md active:scale-[0.98] transition-all min-h-[80px] sm:min-h-[100px] touch-manipulation ${
                              selectedManufacturer === m 
                                ? 'ring-2 ring-blue-600 ring-offset-2 bg-blue-50' 
                                : 'hover:bg-gray-50'
                            }`}
                            aria-label={`Select ${m} as manufacturer`}
                          >
                            <UpfitterLogo manufacturer={m} size="lg" />
                          </button>
                        ))}
                        {selectedBodyType && manufacturersForSelected.length === 0 && (
                          <div className="text-sm text-gray-600 col-span-full">
                            No manufacturers listed for this body type.
                          </div>
                        )}
                        {!selectedBodyType && (
                          <div className="text-sm text-gray-600 col-span-full">
                            Choose a body type to see manufacturers.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Completed Units Gallery */}
            <CompletedUnitsGallery
              selectedChassis={configuration.chassis?.series}
              selectedBodyType={selectedBodyType}
              className="mt-6 sm:mt-8"
              title="See Your Build in Action"
            />
          </div>

          {/* Live Pricing Sidebar */}
          <div className="lg:w-80 w-full order-1 lg:order-2">
            <LivePricingSidebar 
              configuration={configuration}
              currentStep={2}
              onBodyTypeChange={handleBodyTypeSelect}
              allBodyTypes={allBodyTypes}
              isBodyTypeAllowed={isBodyTypeAllowed}
            />
          </div>
        </div>
      </div>

      <StickyActions
        onBack={handleBack}
        onContinue={handleContinue}
        disableContinue={!isValid}
        continueLabel="Continue to Chassis Options"
      />
    </div>
  )
}
