import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Stepper } from '@/components/Stepper'
import { LivePricingSidebar } from '@/components/LivePricingSidebar'
import { CompletedUnitsGallery } from '@/components/CompletedUnitsGallery'
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
import { Button } from '@/components/ui/button'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Badge } from '@/components/ui/badge'
import { Circle, Truck } from 'lucide-react'
import { getChassis } from '@/api/routes'

const CHASSIS_CATALOG = [
  { id: 'f350', name: 'Chassis Cab F-350 XL (2025)', series: 'F-350', class: 'Class 3', gvwr: '12,000–14,000 lbs', description: 'Popular for municipal fleets, trades, and lighter vocational upfits.', imageKey: 'F-350' },
  { id: 'f450', name: 'Chassis Cab F-450 XL (2025)', series: 'F-450', class: 'Class 4', gvwr: '14,000–16,500 lbs', description: 'More payload/towing than F-350 while staying maneuverable.', imageKey: 'F-450' },
  { id: 'f550', name: 'Chassis Cab F-550 XL (2025)', series: 'F-550', class: 'Class 5', gvwr: '17,500–19,500 lbs', description: 'Workhorse for utilities, construction, and municipalities.', imageKey: 'F-550' },
  { id: 'f600', name: 'Chassis Cab F-600 XL (2025)', series: 'F-600', class: 'Class 6', gvwr: '22,000 lbs', description: 'Bridges gap between Super Duty and true Medium Duty.', imageKey: 'F-600' },
  { id: 'f650', name: 'F-650 SD Straight Frame (2025)', series: 'F-650', class: 'Class 6/7', gvwr: '25,600–29,000 lbs', description: 'For heavier regional delivery, construction, and municipal operations.', imageKey: 'F-650' },
  { id: 'f750', name: 'F-750 SD Straight Frame (2025)', series: 'F-750', class: 'Class 7', gvwr: 'Up to 37,000 lbs', description: 'Heavy vocational use and long-haul vocational fleets.', imageKey: 'F-750' },
  { id: 'e350', name: 'E-Series Cutaway E-350 (2025)', series: 'E-350', class: 'Class 3', gvwr: '10,050–12,700 lbs', description: 'Versatile cutaway platform for box and utility bodies.', imageKey: 'E-350' },
  { id: 'e450', name: 'E-Series Cutaway E-450 (2025)', series: 'E-450', class: 'Class 4', gvwr: 'Up to 14,500 lbs', description: 'Higher GVWR cutaway ideal for delivery and service applications.', imageKey: 'E-450' },
  { id: 'transit', name: 'Transit 350 Cutaway (2025)', series: 'Transit', class: 'Class 2B', gvwr: '9,000–10,360 lbs', description: 'Cutaway platform ideal for city delivery, dry freight, and reefer.', imageKey: 'Transit' },
  { id: 'etransit', name: 'E-Transit 350 Cutaway (2025)', series: 'E-Transit', class: 'Class 2B Electric', gvwr: '9,500–10,360 lbs', description: 'All-electric cutaway for last-mile vocational upfits.', imageKey: 'E-Transit' }
]

function ChassisSelectionCard({ chassis, selected, onSelect, cardRef }) {
  const [imgIdx, setImgIdx] = useState(0)
  // Map of available images per chassis, sourced from the Vehicle Images folder
  // Using same approach as home page (App.jsx)
  const IMAGE_MAP = {
    'F-350': [
      '/vehicle-images/F-350 Super Duty Chassis Cab.avif',
      '/vehicle-images/F-350 Super Duty Chassis Cab 2.avif',
      '/vehicle-images/F-350 Super Duty Chassis Cab 3.avif',
      '/vehicle-images/F-350 Super Duty Chassis Cab 4.avif',
      '/vehicle-images/F-350 Super Duty Chassis Cab 5.avif',
      '/vehicle-images/F-350 Super Duty Chassis Cab 6.png',
      '/vehicle-images/F-350 Super Duty Chassis Cab 7.avif',
    ],
    'F-450': [
      '/vehicle-images/F-450 Super Duty Chassis Cab.webp',
      '/vehicle-images/F-450 Super Duty Chassis Cab 2.webp',
      '/vehicle-images/F-450 Super Duty Chassis Cab 3.avif',
      '/vehicle-images/F-450 Super Duty Chassis Cab 4.avif',
      '/vehicle-images/F-450 Super Duty Chassis Cab 5.avif',
      '/vehicle-images/F-450 Super Duty Chassis Cab 6.avif',
      '/vehicle-images/F-450 Super Duty Chassis Cab 7.webp',
    ],
    'F-550': [
      '/vehicle-images/F-550 Super Duty Chassis Cab.avif',
      '/vehicle-images/F-550 Super Duty Chassis Cab 2.png',
      '/vehicle-images/F-550 Super Duty Chassis Cab 3.png',
      '/vehicle-images/F-550 Super Duty Chassis Cab 4.avif',
      '/vehicle-images/F-550 Super Duty Chassis Cab 5.webp',
      '/vehicle-images/F-550 Super Duty Chassis Cab 6.png',
      '/vehicle-images/F-550 Super Duty Chassis Cab 7.png',
    ],
    'F-600': [
      '/vehicle-images/F-600 Super Duty Chassis Cab.avif',
      '/vehicle-images/F-600 Super Duty Chassis Cab 2.avif',
      '/vehicle-images/F-600 Super Duty Chassis Cab 3.avif',
      '/vehicle-images/F-600 Super Duty Chassis Cab 4.webp',
      '/vehicle-images/F-600 Super Duty Chassis Cab 5.avif',
      '/vehicle-images/F-600 Super Duty Chassis Cab 6.webp',
      '/vehicle-images/F-600 Super Duty Chassis Cab 7.avif',
    ],
    'F-650': [
      '/vehicle-images/F-650 2.avif',
      '/vehicle-images/Ford F-650.avif',
      '/vehicle-images/Ford F-650 3.avif',
      '/vehicle-images/Ford F-650 4.avif',
      '/vehicle-images/Ford F-650 5.avif',
      '/vehicle-images/Ford F-650 6.avif',
    ],
    'F-750': [
      '/vehicle-images/Ford F-750.avif',
      '/vehicle-images/Ford F-750 2.avif',
      '/vehicle-images/Ford F-750 3.avif',
      '/vehicle-images/Ford F-750 4.avif',
    ],
    'E-350': [
      '/vehicle-images/Ford E-350.avif',
    ],
    'E-450': [
      '/vehicle-images/E-450.avif',
      '/vehicle-images/E-450 2.avif',
      '/vehicle-images/E-450.jpg',
    ],
    'Transit': [
      '/vehicle-images/Ford E-350.avif', // Using E-350 image as placeholder for Transit
    ],
    'E-Transit': [
      '/vehicle-images/E-450.avif', // Using E-450 image as placeholder for E-Transit
      '/vehicle-images/E-450 2.avif',
      '/vehicle-images/E-450.jpg',
    ],
  }
  const candidateSources = IMAGE_MAP[chassis.imageKey] || [
    `/vehicle-images/${chassis.imageKey}.avif`,
    `/vehicle-images/${chassis.imageKey}.png`,
    `/vehicle-images/${chassis.imageKey}.jpg`,
    `/vehicle-images/${chassis.imageKey}.webp`
  ]

  return (
    <div ref={cardRef}>
      <Card 
        className={`hover:shadow-lg transition-shadow cursor-pointer ${
          selected ? 'ring-2 ring-black bg-gray-50' : ''
        }`}
        onClick={() => onSelect(chassis)}
      >
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          {chassis.name}
          {selected && <Badge className="bg-black">Selected</Badge>}
        </CardTitle>
        <CardDescription>
          {chassis.class} • GVWR {chassis.gvwr}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <AspectRatio ratio={16/9}>
            <img
              src={candidateSources[imgIdx]}
              alt={`${chassis.name}`}
              className="w-full h-full object-cover rounded"
              onError={(e) => {
                const nextIdx = imgIdx + 1
                if (nextIdx < candidateSources.length) {
                  setImgIdx(nextIdx)
                } else {
                  e.currentTarget.style.display = 'none'
                  const placeholder = e.currentTarget.nextSibling
                  if (placeholder) placeholder.style.display = 'flex'
                }
              }}
            />
            <div className="hidden w-full h-full rounded bg-gray-100 border border-dashed text-gray-600 items-center justify-center">
              <span className="text-sm">Image: {chassis.imageKey}</span>
            </div>
          </AspectRatio>
          <div>
            <div className="text-sm text-gray-700">{chassis.description}</div>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}

export function ConfiguratorChassisSelection() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedChassisRef = useRef(null)
  const hasScrolledToChassis = useRef(false)
  const lastScrolledSeries = useRef(null)
  
  const [configuration, setConfiguration] = useState(() => {
    const params = new URLSearchParams(location.search)
    if (params.toString()) {
      return parseQueryToConfig(params)
    }
    return loadConfiguration()
  })

  const [selectedChassis, setSelectedChassis] = useState(() => {
    // Default to series passed in query (from home page) or existing configuration
    const params = new URLSearchParams(location.search)
    const seriesFromQuery = params.get('series')
    const initialSeries = seriesFromQuery || configuration.chassis?.series
    return initialSeries ? CHASSIS_CATALOG.find(c => c.series === initialSeries) : null
  })

  // Scroll to selected chassis when coming from home page
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const seriesFromQuery = params.get('series')
    
    // Reset scroll flag if series changed (new series selected from home page)
    if (seriesFromQuery && seriesFromQuery !== lastScrolledSeries.current) {
      hasScrolledToChassis.current = false
    }
    
    // Only scroll if we have a series from query (coming from home page) and haven't scrolled yet
    if (seriesFromQuery && selectedChassis && !hasScrolledToChassis.current) {
      // Wait for DOM to be ready, then scroll to the selected chassis
      const scrollToChassis = () => {
        if (selectedChassisRef.current) {
          selectedChassisRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          })
          hasScrolledToChassis.current = true
          lastScrolledSeries.current = seriesFromQuery
        }
      }
      
      // Use requestAnimationFrame to ensure DOM is rendered, then add a small delay
      requestAnimationFrame(() => {
        setTimeout(scrollToChassis, 200)
      })
    } else if (!seriesFromQuery) {
      // If no series from query, scroll to top as usual
      window.scrollTo(0, 0)
      lastScrolledSeries.current = null
    }
  }, [selectedChassis, location.search])

  // Automatically update configuration when chassis is pre-selected from query parameter
  useEffect(() => {
    if (selectedChassis) {
      const currentSeries = configuration.chassis?.series
      if (!currentSeries || currentSeries !== selectedChassis.series) {
        const updated = {
          ...configuration,
          chassis: {
            ...configuration.chassis,
            series: selectedChassis.series,
            class: selectedChassis.class
          },
          completedSteps: [1]
        }
        setConfiguration(updated)
        saveConfiguration(updated)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChassis])

  // Update URL when configuration changes
  useEffect(() => {
    const query = configToQuery(configuration)
    const newUrl = `${location.pathname}?${query}`
    window.history.replaceState(null, '', newUrl)
  }, [configuration, location.pathname])

  const handleChassisSelect = (chassis) => {
    setSelectedChassis(chassis)
    const updated = {
      ...configuration,
      chassis: {
        ...configuration.chassis,
        series: chassis.series,
        class: chassis.class
      },
      completedSteps: [1]
    }
    setConfiguration(updated)
    saveConfiguration(updated)
  }

  const handleContinue = () => {
    if (selectedChassis || isDemoMode()) {
      const query = configToQuery(configuration)
      navigate(`/configurator/body-type?${query}`)
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  const isValid = isDemoMode() || !!selectedChassis

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Stepper currentStep={1} completedSteps={configuration.completedSteps || []} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
                  Step 1: Select Your Chassis
                </CardTitle>
                <CardDescription className="text-sm">
                  Choose the base chassis platform for your commercial vehicle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {CHASSIS_CATALOG.map((chassis) => (
                    <ChassisSelectionCard
                      key={chassis.id}
                      chassis={chassis}
                      selected={selectedChassis?.id === chassis.id}
                      onSelect={handleChassisSelect}
                      cardRef={selectedChassis?.id === chassis.id ? selectedChassisRef : null}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Completed Units Gallery */}
            <CompletedUnitsGallery
              selectedChassis={selectedChassis?.series}
              selectedBodyType={null}
              className="mt-6 sm:mt-8"
              title="Example Completed Builds"
            />
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
        continueLabel="Continue to Body Type"
        backLabel="Back to Home"
      />
    </div>
  )
}
