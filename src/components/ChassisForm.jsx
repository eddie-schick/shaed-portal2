import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getChassis } from '@/api/routes'

export function ChassisForm({ 
  initialValues = {},
  onChange,
  compatibleSeries = [],
  bodyType = null,
  showSeries = true
}) {
  const [chassisOptions, setChassisOptions] = useState([])
  const [selectedChassis, setSelectedChassis] = useState(null)
  const [selectedTrim, setSelectedTrim] = useState(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState({
    series: initialValues.series || '',
    cab: initialValues.cab || '',
    drivetrain: initialValues.drivetrain || '',
    wheelbase: initialValues.wheelbase || '',
    gvwrPackage: initialValues.gvwrPackage || '',
    suspensionPackage: initialValues.suspensionPackage || '',
    powertrain: initialValues.powertrain || ''
  })

  // Load chassis data
  useEffect(() => {
    const loadChassis = async () => {
      setLoading(true)
      try {
        const data = await getChassis()
        setChassisOptions(data)
      } catch (error) {
        console.error('Error loading chassis:', error)
      }
      setLoading(false)
    }
    loadChassis()
  }, [])

  // Update selected chassis when series changes
  useEffect(() => {
    if (values.series && chassisOptions.length > 0) {
      const chassis = chassisOptions.find(c => c.series === values.series)
      setSelectedChassis(chassis)
    }
  }, [values.series, chassisOptions])

  // Update selected trim when cab/drivetrain changes
  useEffect(() => {
    if (selectedChassis && values.cab && values.drivetrain) {
      let trim = selectedChassis.trims?.find(t => 
        t.cab === values.cab && t.drivetrain === values.drivetrain
      )
      
      // If 4x4 is selected but no trim exists, fall back to the corresponding 4x2 trim
      if (!trim && values.drivetrain === '4x4') {
        trim = selectedChassis.trims?.find(t => 
          t.cab === values.cab && t.drivetrain === '4x2'
        )
      }
      
      setSelectedTrim(trim)
    }
  }, [selectedChassis, values.cab, values.drivetrain])

  const handleChange = (field, value) => {
    const newValues = { ...values, [field]: value }
    
    // Reset dependent fields when parent changes
    if (field === 'series') {
      newValues.cab = ''
      newValues.drivetrain = ''
      newValues.wheelbase = ''
      newValues.powertrain = ''
      newValues.suspensionPackage = ''
    } else if (field === 'cab' || field === 'drivetrain') {
      newValues.wheelbase = ''
      newValues.powertrain = ''
    }
    
    setValues(newValues)
    onChange(newValues)
  }

  // Filter chassis options based on compatibility
  const availableChassisOptions = compatibleSeries.length > 0
    ? chassisOptions.filter(c => compatibleSeries.includes(c.series))
    : chassisOptions

  // Get available options based on current selection
  const availableCabs = selectedChassis
    ? [...new Set(selectedChassis.trims.map(t => t.cab))]
    : []
  
  const availableDrivetrains = selectedChassis && values.cab
    ? (() => {
        const drivetrains = [...new Set(selectedChassis.trims
          .filter(t => t.cab === values.cab)
          .map(t => t.drivetrain))]
        
        // If 4x2 is available, also add 4x4 (if not already present)
        if (drivetrains.includes('4x2') && !drivetrains.includes('4x4')) {
          drivetrains.push('4x4')
        }
        
        return drivetrains
      })()
    : []
  
  const availableWheelbases = selectedTrim?.wheelbases || []
  const availableSuspensions = selectedTrim?.suspensionPackages || []
  const availablePowertrains = selectedTrim?.powertrains || []

  // Calculate payload/tow estimates
  const getCapacityEstimates = () => {
    if (!selectedChassis || !values.wheelbase) return null
    
    // Mock calculations based on chassis and wheelbase
    const basePayload = {
      'F-350': 4000,
      'F-450': 5000,
      'F-550': 6000,
      'F-600': 7500
    }[selectedChassis.series] || 4000
    
    const wheelbaseModifier = (values.wheelbase - 140) * 10
    const payload = basePayload + wheelbaseModifier
    const towing = payload * 2.5
    
    return {
      payload: Math.round(payload),
      towing: Math.round(towing)
    }
  }

  const estimates = getCapacityEstimates()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Series Selection (optional - hidden if showSeries is false) */}
      {showSeries && (
        <Card>
          <CardHeader>
          <CardTitle>Chassis Series</CardTitle>
            <CardDescription>
              Select the base chassis platform for your build
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={values.series} onValueChange={(value) => handleChange('series', value)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableChassisOptions.map((chassis) => (
                  <Label
                    key={chassis.series}
                    htmlFor={chassis.series}
                    className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <RadioGroupItem value={chassis.series} id={chassis.series} />
                    <div className="flex-1">
                      <div className="font-medium">{chassis.series}</div>
                      <div className="text-sm text-gray-600">{chassis.class} • GVWR {chassis.gvwr}</div>
                      {bodyType && !chassis.compatibleBodies?.includes(bodyType) && (
                        <Badge variant="destructive" className="mt-1">
                          Not compatible with {bodyType}
                        </Badge>
                      )}
                    </div>
                  </Label>
                ))}
              </div>
            </RadioGroup>
            {availableChassisOptions.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No compatible chassis available for the selected body type.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cab Configuration */}
      {values.series && (
        <Card>
          <CardHeader>
            <CardTitle>Cab Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cab Style</Label>
              <RadioGroup value={values.cab} onValueChange={(value) => handleChange('cab', value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {availableCabs.map((cab) => (
                    <Label
                      key={cab}
                      htmlFor={`cab-${cab}`}
                      className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <RadioGroupItem value={cab} id={`cab-${cab}`} />
                      <div className="flex-1">
                        <div className="font-medium">{cab}</div>
                      </div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {values.cab && (
              <div>
                <Label>Drivetrain</Label>
                <RadioGroup value={values.drivetrain} onValueChange={(value) => handleChange('drivetrain', value)}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {availableDrivetrains.map((dt) => (
                      <Label
                        key={dt}
                        htmlFor={`dt-${dt}`}
                        className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <RadioGroupItem value={dt} id={`dt-${dt}`} />
                        <div className="flex-1">
                          <div className="font-medium">{dt}</div>
                        </div>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Wheelbase */}
      {selectedTrim && values.drivetrain && (
        <Card>
          <CardHeader>
            <CardTitle>Wheelbase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Wheelbase</Label>
              <RadioGroup value={(values.wheelbase || '').toString()} onValueChange={(value) => handleChange('wheelbase', value)}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableWheelbases.map((wb) => (
                    <Label
                      key={wb}
                      htmlFor={`wb-${wb}`}
                      className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <RadioGroupItem value={wb.toString()} id={`wb-${wb}`} />
                      <div className="flex-1">
                        <div className="font-medium">{wb}"</div>
                      </div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
              {values.wheelbase && (
                <p className="text-sm text-gray-600 mt-1">
                  Recommended body length: 10-{Math.round(parseInt(values.wheelbase) / 10)} ft
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suspension */}
      {selectedTrim && values.drivetrain && values.wheelbase && (
        <Card>
          <CardHeader>
            <CardTitle>Suspension Package</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Suspension Package</Label>
              <RadioGroup value={values.suspensionPackage} onValueChange={(value) => handleChange('suspensionPackage', value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {availableSuspensions.map((susp) => (
                    <Label
                      key={susp}
                      htmlFor={`susp-${susp}`}
                      className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <RadioGroupItem value={susp} id={`susp-${susp}`} />
                      <div className="flex-1">
                        <div className="font-medium">{susp}</div>
                      </div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Powertrain */}
      {selectedTrim && values.drivetrain && values.wheelbase && values.suspensionPackage && (
        <Card>
          <CardHeader>
            <CardTitle>Powertrain</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup 
              value={values.powertrain} 
              onValueChange={(value) => handleChange('powertrain', value)}
            >
              <div className="space-y-3">
                {availablePowertrains.map((pt) => (
                  <Label
                    key={pt.id}
                    htmlFor={pt.id}
                    className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <RadioGroupItem value={pt.id} id={pt.id} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{pt.name}</span>
                        <span className="font-semibold text-green-600">
                          ${pt.basePrice.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        {pt.type === 'diesel' && (
                          <Badge variant="secondary">Diesel</Badge>
                        )}
                        {pt.type === 'gas' && (
                          <Badge variant="outline">Gasoline</Badge>
                        )}
                        {pt.type === 'ev' && (
                          <Badge className="bg-green-100 text-green-800">Electric</Badge>
                        )}
                      </div>
                    </div>
                  </Label>
                ))}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Capacity Estimates */}
      {estimates && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-1">Estimated Capacities:</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Max Payload: ~{estimates.payload.toLocaleString()} lbs</div>
              <div>Max Towing: ~{estimates.towing.toLocaleString()} lbs</div>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              * Actual capacities depend on final configuration and options
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
