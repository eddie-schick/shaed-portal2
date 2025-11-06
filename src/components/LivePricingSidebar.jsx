import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CompletedUnitsPreview } from './CompletedUnitsGallery'
import { 
  DollarSign, 
  Truck, 
  Package, 
  Wrench, 
  Calculator,
  TrendingUp,
  Info
} from 'lucide-react'
import { getChassis, getBodies, getOptions } from '@/api/routes'
import { calculatePricing } from '@/lib/configurationStore'

export function LivePricingSidebar({ configuration, className = '' }) {
  const [pricing, setPricing] = useState({
    chassisMSRP: 0,
    bodyPrice: 0,
    optionsPrice: 0,
    laborPrice: 0,
    subtotal: 0,
    total: 0
  })
  const [loading, setLoading] = useState(false)

  // Recalculate pricing whenever configuration changes
  useEffect(() => {
    const calculateLivePricing = async () => {
      // If neither a chassis series nor a body type is selected, there's nothing to price
      if (!configuration.chassis?.series && !configuration.bodyType) {
        setPricing({
          chassisMSRP: 0,
          bodyPrice: 0,
          optionsPrice: 0,
          laborPrice: 0,
          subtotal: 0,
          total: 0
        })
        return
      }

      setLoading(true)
      try {
        const [chassisData, bodiesData, optionsData] = await Promise.all([
          getChassis(),
          getBodies(),
          getOptions()
        ])
        
        const livePrice = calculatePricing(configuration, chassisData, bodiesData, optionsData)
        setPricing(livePrice)
      } catch (error) {
        console.error('Error calculating live pricing:', error)
      }
      setLoading(false)
    }

    calculateLivePricing()
  }, [
    configuration.chassis?.powertrain,
    configuration.chassis?.series, 
    configuration.bodyType,
    configuration.bodySpecs,
    configuration.bodyAccessories
  ])

  return (
    <div className={`w-full lg:w-80 ${className}`}>
      <Card className="lg:sticky lg:top-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            My Order
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Configuration Summary */}
          <div className="space-y-2 text-sm">
            {configuration.chassis?.series && (
              <div>
                <span className="font-medium">{configuration.chassis.series}</span>
                {configuration.chassis.cab && (
                  <Badge variant="outline" className="text-xs ml-2">
                    {configuration.chassis.cab}
                  </Badge>
                )}
              </div>
            )}
            {configuration.bodyType && (
              <div>
                <span className="font-medium">{configuration.bodyType}</span>
                {configuration.bodyManufacturer && (
                  <Badge variant="outline" className="text-xs ml-2">
                    {configuration.bodyManufacturer}
                  </Badge>
                )}
              </div>
            )}
            {configuration.bodyAccessories?.length > 0 && (
              <div className="text-xs text-gray-600">
                {configuration.bodyAccessories.length} accessories
              </div>
            )}
          </div>

          <Separator />

          {/* Completed Unit Preview */}
          <CompletedUnitsPreview 
            selectedChassis={configuration.chassis?.series}
            selectedBodyType={configuration.bodyType}
            className="mb-4"
          />

          {/* Pricing Breakdown */}
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {pricing.chassisMSRP > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Chassis MSRP</span>
                  <span className="font-semibold">${Math.round(pricing.chassisMSRP).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              
              {pricing.bodyPrice > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Body & Equipment</span>
                  <span className="font-semibold">${Math.round(pricing.bodyPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              
              {pricing.optionsPrice > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Options</span>
                  <span className="font-semibold">${Math.round(pricing.optionsPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              
              {pricing.laborPrice > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Installation</span>
                  <span className="font-semibold">${Math.round(pricing.laborPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}

              {pricing.total > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Est. Total</span>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">
                        ${Math.round(pricing.total).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {pricing.total === 0 && configuration.chassis?.series && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-700">
                    Select options to see pricing
                  </span>
                </div>
              )}

              {!configuration.chassis?.series && !configuration.bodyType && (
                <div className="text-center text-gray-500 text-sm py-4">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  Start configuring to see pricing
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
