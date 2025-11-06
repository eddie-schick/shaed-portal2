import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getBodies, getOptions } from '@/api/routes'

const BODY_TYPE_ICONS = {}

export function BodySpecsForm({ 
  bodyType,
  initialSpecs = {},
  initialAccessories = [],
  onChange,
  wheelbase = null
}) {
  const [bodyData, setBodyData] = useState(null)
  const [optionsData, setOptionsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [specs, setSpecs] = useState(initialSpecs)
  const [accessories, setAccessories] = useState(initialAccessories)

  // Load body and options data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [bodies, options] = await Promise.all([
          getBodies(bodyType),
          getOptions()
        ])
        setBodyData(bodies)
        setOptionsData(options)
      } catch (error) {
        console.error('Error loading data:', error)
      }
      setLoading(false)
    }
    if (bodyType) {
      loadData()
    }
  }, [bodyType])

  const handleSpecChange = (field, value) => {
    const newSpecs = { ...specs, [field]: value }
    setSpecs(newSpecs)
    onChange({ specs: newSpecs, accessories })
  }

  const handleAccessoryToggle = (accessoryId) => {
    const newAccessories = accessories.includes(accessoryId)
      ? accessories.filter(id => id !== accessoryId)
      : [...accessories, accessoryId]
    setAccessories(newAccessories)
    onChange({ specs, accessories: newAccessories })
  }

  const Icon = null

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!bodyData) {
    return (
      <Alert>
        <AlertDescription>
          No specifications available for {bodyType}
        </AlertDescription>
      </Alert>
    )
  }

  // Render fields based on body type
  const renderBodyFields = () => {
    switch (bodyType) {
      case 'Flatbed':
        return (
          <>
            <div>
              <Label>Bed Length</Label>
              <RadioGroup 
                value={specs.bedLength?.toString() || ''} 
                onValueChange={(value) => handleSpecChange('bedLength', parseInt(value))}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.bedLength.map((length) => (
                    <Label key={length} htmlFor={`flatbed-len-${length}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={length.toString()} id={`flatbed-len-${length}`} />
                      <div className="font-medium">{length} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Material</Label>
              <RadioGroup 
                value={specs.material || ''} 
                onValueChange={(value) => handleSpecChange('material', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.material.map((mat) => (
                    <Label key={mat} htmlFor={`flatbed-mat-${mat}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={mat} id={`flatbed-mat-${mat}`} />
                      <div className="font-medium">{mat}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="sideOptions">Side Configuration</Label>
              <RadioGroup 
                value={specs.sideOptions || ''} 
                onValueChange={(value) => handleSpecChange('sideOptions', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.sideOptions.map((option) => (
                    <Label key={option} htmlFor={`flatbed-side-${option}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={option} id={`flatbed-side-${option}`} />
                      <div className="font-medium">{option}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )

      case 'Dump Body':
        return (
          <>
            <div>
              <Label>Bed Length</Label>
              <RadioGroup value={specs.bedLength?.toString() || ''} onValueChange={(value) => handleSpecChange('bedLength', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.bedLength.map((length) => (
                    <Label key={length} htmlFor={`dump-len-${length}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={length.toString()} id={`dump-len-${length}`} />
                      <div className="font-medium">{length} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Material</Label>
              <RadioGroup value={specs.material || ''} onValueChange={(value) => handleSpecChange('material', value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.material.map((mat) => (
                    <Label key={mat} htmlFor={`dump-mat-${mat}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={mat} id={`dump-mat-${mat}`} />
                      <div className="font-medium">{mat}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Side Height</Label>
              <RadioGroup value={specs.sideHeight?.toString() || ''} onValueChange={(value) => handleSpecChange('sideHeight', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.sideHeight.map((height) => (
                    <Label key={height} htmlFor={`dump-side-${height}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={height.toString()} id={`dump-side-${height}`} />
                      <div className="font-medium">{height} inches</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="hoistType">Hoist Type</Label>
              <RadioGroup 
                value={specs.hoistType || ''} 
                onValueChange={(value) => handleSpecChange('hoistType', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.hoistType.map((type) => (
                    <Label key={type} htmlFor={`hoist-${type}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={type} id={`hoist-${type}`} />
                      <div className="font-medium">{type}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )

      case 'Dry Freight Body':
        return (
          <>
            <div>
              <Label>Box Length</Label>
              <RadioGroup value={specs.length?.toString() || ''} onValueChange={(value) => handleSpecChange('length', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.length.map((len) => (
                    <Label key={len} htmlFor={`dry-len-${len}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={len.toString()} id={`dry-len-${len}`} />
                      <div className="font-medium">{len} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Box Height</Label>
              <RadioGroup value={specs.height?.toString() || ''} onValueChange={(value) => handleSpecChange('height', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.height.map((h) => (
                    <Label key={h} htmlFor={`dry-h-${h}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={h.toString()} id={`dry-h-${h}`} />
                      <div className="font-medium">{h} inches</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="doorType">Door Type</Label>
              <RadioGroup 
                value={specs.doorType || ''} 
                onValueChange={(value) => handleSpecChange('doorType', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.doorType.map((type) => (
                    <Label key={type} htmlFor={`door-${type}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={type} id={`door-${type}`} />
                      <div className="font-medium">{type}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Interior Options</Label>
              <RadioGroup value={specs.interiorOptions || ''} onValueChange={(value) => handleSpecChange('interiorOptions', value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.interiorOptions.map((option) => (
                    <Label key={option} htmlFor={`int-${option}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={option} id={`int-${option}`} />
                      <div className="font-medium">{option}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )

      case 'Refrigerated Body':
        return (
          <>
            <div>
              <Label>Box Length</Label>
              <RadioGroup value={specs.length?.toString() || ''} onValueChange={(value) => handleSpecChange('length', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.length.map((len) => (
                    <Label key={len} htmlFor={`ref-len-${len}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={len.toString()} id={`ref-len-${len}`} />
                      <div className="font-medium">{len} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Box Height</Label>
              <RadioGroup value={specs.height?.toString() || ''} onValueChange={(value) => handleSpecChange('height', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.height.map((h) => (
                    <Label key={h} htmlFor={`ref-h-${h}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={h.toString()} id={`ref-h-${h}`} />
                      <div className="font-medium">{h} inches</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="insulationPackage">Insulation Package</Label>
              <RadioGroup 
                value={specs.insulationPackage || ''} 
                onValueChange={(value) => handleSpecChange('insulationPackage', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.insulationPackage.map((pkg) => (
                    <Label key={pkg} htmlFor={`ins-${pkg}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={pkg} id={`ins-${pkg}`} />
                      <div className="font-medium">{pkg}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Refrigeration Unit</Label>
              <RadioGroup value={specs.reeferUnit || ''} onValueChange={(value) => handleSpecChange('reeferUnit', value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.reeferUnit.map((unit) => (
                    <Label key={unit} htmlFor={`reefer-${unit}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={unit} id={`reefer-${unit}`} />
                      <div className="font-medium">{unit}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="tempRange">Temperature Range</Label>
              <RadioGroup 
                value={specs.tempRange || ''} 
                onValueChange={(value) => handleSpecChange('tempRange', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.tempRange.map((range) => (
                    <Label key={range} htmlFor={`temp-${range}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={range} id={`temp-${range}`} />
                      <div className="font-medium">{range}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )

      case 'Tow & Recovery':
        return (
          <>
            <div>
              <Label>Deck Length</Label>
              <RadioGroup value={specs.deckLength?.toString() || ''} onValueChange={(value) => handleSpecChange('deckLength', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.deckLength.map((len) => (
                    <Label key={len} htmlFor={`tow-len-${len}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={len.toString()} id={`tow-len-${len}`} />
                      <div className="font-medium">{len} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="winchCapacity">Winch Capacity</Label>
              <RadioGroup 
                value={specs.winchCapacity || ''} 
                onValueChange={(value) => handleSpecChange('winchCapacity', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.winchCapacity.map((capacity) => (
                    <Label key={capacity} htmlFor={`winch-${capacity}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={capacity} id={`winch-${capacity}`} />
                      <div className="font-medium">{capacity}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="wheelLift">Wheel Lift Capacity</Label>
              <RadioGroup 
                value={specs.wheelLift || ''} 
                onValueChange={(value) => handleSpecChange('wheelLift', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.wheelLift.map((lift) => (
                    <Label key={lift} htmlFor={`wheel-${lift}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={lift} id={`wheel-${lift}`} />
                      <div className="font-medium">{lift}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )

      case 'Bucket':
        return (
          <>
            <div>
              <Label>Working Height</Label>
              <RadioGroup value={specs.workingHeight?.toString() || ''} onValueChange={(value) => handleSpecChange('workingHeight', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.workingHeight.map((height) => (
                    <Label key={height} htmlFor={`bucket-h-${height}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={height.toString()} id={`bucket-h-${height}`} />
                      <div className="font-medium">{height} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Side Reach</Label>
              <RadioGroup value={specs.sideReach?.toString() || ''} onValueChange={(value) => handleSpecChange('sideReach', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.sideReach.map((reach) => (
                    <Label key={reach} htmlFor={`bucket-r-${reach}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={reach.toString()} id={`bucket-r-${reach}`} />
                      <div className="font-medium">{reach} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="insulated">Insulation</Label>
              <RadioGroup 
                value={specs.insulated || ''} 
                onValueChange={(value) => handleSpecChange('insulated', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.insulated.map((option) => (
                    <Label key={option} htmlFor={`ins-${option}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={option} id={`ins-${option}`} />
                      <div className="font-medium">{option}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="bucketCapacity">Bucket Capacity</Label>
              <RadioGroup 
                value={specs.bucketCapacity || ''} 
                onValueChange={(value) => handleSpecChange('bucketCapacity', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.bucketCapacity.map((capacity) => (
                    <Label key={capacity} htmlFor={`bucket-cap-${capacity}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={capacity} id={`bucket-cap-${capacity}`} />
                      <div className="font-medium">{capacity}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )

      case 'Contractor Body':
        return (
          <>
            <div>
              <Label>Bed Length</Label>
              <RadioGroup value={specs.bedLength?.toString() || ''} onValueChange={(value) => handleSpecChange('bedLength', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.bedLength.map((length) => (
                    <Label key={length} htmlFor={`contractor-len-${length}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={length.toString()} id={`contractor-len-${length}`} />
                      <div className="font-medium">{length} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="compartments">Compartment Configuration</Label>
              <RadioGroup 
                value={specs.compartments || ''} 
                onValueChange={(value) => handleSpecChange('compartments', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.compartments.map((config) => (
                    <Label key={config} htmlFor={`comp-${config}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={config} id={`comp-${config}`} />
                      <div className="font-medium">{config} Compartments</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="ladderRack">Ladder Rack Type</Label>
              <RadioGroup 
                value={specs.ladderRack || ''} 
                onValueChange={(value) => handleSpecChange('ladderRack', value)}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.ladderRack.map((type) => (
                    <Label key={type} htmlFor={`rack-${type}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={type} id={`rack-${type}`} />
                      <div className="font-medium">{type}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )

      case 'Service Body':
        return (
          <>
            <div>
              <Label>Body Length</Label>
              <RadioGroup value={specs.bodyLength?.toString() || ''} onValueChange={(value) => handleSpecChange('bodyLength', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.bodyLength.map((len) => (
                    <Label key={len} htmlFor={`svc-len-${len}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={len.toString()} id={`svc-len-${len}`} />
                      <div className="font-medium">{len} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Compartments</Label>
              <RadioGroup value={specs.compartments || ''} onValueChange={(value) => handleSpecChange('compartments', value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.compartments.map((config) => (
                    <Label key={config} htmlFor={`svc-comp-${config}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={config} id={`svc-comp-${config}`} />
                      <div className="font-medium">{config} Compartments</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Material</Label>
              <RadioGroup value={specs.material || ''} onValueChange={(value) => handleSpecChange('material', value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.material.map((mat) => (
                    <Label key={mat} htmlFor={`svc-mat-${mat}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={mat} id={`svc-mat-${mat}`} />
                      <div className="font-medium">{mat}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )

      case 'Ambulance':
        return (
          <>
            <div>
              <Label>Ambulance Type</Label>
              <RadioGroup value={specs.type || ''} onValueChange={(value) => handleSpecChange('type', value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.type.map((t) => (
                    <Label key={t} htmlFor={`amb-type-${t}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={t} id={`amb-type-${t}`} />
                      <div className="font-medium">{t}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Module Length</Label>
              <RadioGroup value={specs.moduleLength?.toString() || ''} onValueChange={(value) => handleSpecChange('moduleLength', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.moduleLength.map((ml) => (
                    <Label key={ml} htmlFor={`amb-ml-${ml}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={ml.toString()} id={`amb-ml-${ml}`} />
                      <div className="font-medium">{ml} in</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Equipment Package</Label>
              <RadioGroup value={specs.equipment || ''} onValueChange={(value) => handleSpecChange('equipment', value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {bodyData.specifications.equipment.map((e) => (
                    <Label key={e} htmlFor={`amb-eq-${e}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={e} id={`amb-eq-${e}`} />
                      <div className="font-medium">{e}</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )

      case 'Box w/ Lift Gate':
        return (
          <>
            <div>
              <Label>Box Length</Label>
              <RadioGroup value={specs.boxLength?.toString() || ''} onValueChange={(value) => handleSpecChange('boxLength', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.boxLength.map((len) => (
                    <Label key={len} htmlFor={`liftgate-len-${len}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={len.toString()} id={`liftgate-len-${len}`} />
                      <div className="font-medium">{len} ft</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Box Height</Label>
              <RadioGroup value={specs.boxHeight?.toString() || ''} onValueChange={(value) => handleSpecChange('boxHeight', parseInt(value))}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {bodyData.specifications.boxHeight.map((h) => (
                    <Label key={h} htmlFor={`liftgate-h-${h}`} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <RadioGroupItem value={h.toString()} id={`liftgate-h-${h}`} />
                      <div className="font-medium">{h} inches</div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="liftgateType">Liftgate Type</Label>
              <RadioGroup 
                value={specs.liftgateType || ''} 
                onValueChange={(value) => handleSpecChange('liftgateType', value)}
              >
                {bodyData.specifications.liftgateType.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <RadioGroupItem value={type} id={type} />
                    <Label htmlFor={type}>{type}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="liftgateCapacity">Liftgate Capacity</Label>
              <RadioGroup 
                value={specs.liftgateCapacity || ''} 
                onValueChange={(value) => handleSpecChange('liftgateCapacity', value)}
              >
                {bodyData.specifications.liftgateCapacity.map((capacity) => (
                  <div key={capacity} className="flex items-center space-x-2">
                    <RadioGroupItem value={capacity} id={capacity} />
                    <Label htmlFor={capacity}>{capacity}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </>
        )

      default:
        return <p>No specifications available for {bodyType}</p>
    }
  }

  // Get compatible accessories for this body type
  const getCompatibleAccessories = () => {
    if (!optionsData) return []
    
    return Object.entries(optionsData.commonAccessories).filter(([id, accessory]) => {
      if (accessory.compatible === 'all') return true
      if (Array.isArray(accessory.compatible)) {
        return accessory.compatible.includes(bodyType)
      }
      return false
    })
  }

  const compatibleAccessories = getCompatibleAccessories()

  return (
    <div className="space-y-6">
      {/* Body Specifications */}
      <Card>
        <CardHeader>
          <CardTitle>{bodyType} Specifications</CardTitle>
          <CardDescription>
            Configure the specifications for your {bodyType.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {renderBodyFields()}
          </div>
          
          {/* Price estimate based on selections (always mirrors body cost) */}
          {(() => {
            const baseTable = bodyData?.basePrice || {}
            const selectedKey = (
              specs.length ??
              specs.bedLength ??
              specs.boxLength ??
              specs.bodyLength ??
              specs.deckLength ??
              specs.workingHeight ??
              specs.moduleLength ??
              specs.type // for Ambulance (Type I/II/III)
            )
            const fallbackKey = Object.keys(baseTable)[0]
            const price = baseTable[selectedKey] ?? baseTable[fallbackKey] ?? 0
            return (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium">Base Price Estimate</div>
                  <div className="text-2xl font-bold text-green-600">
                    ${price.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    * Does not include accessories or installation
                  </div>
                </AlertDescription>
              </Alert>
            )
          })()}
        </CardContent>
      </Card>

      {/* Common Accessories */}
      <Card>
        <CardHeader>
          <CardTitle>Common Accessories & Options</CardTitle>
          <CardDescription>
            Select additional equipment and features for your build
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {compatibleAccessories.map(([id, accessory]) => (
              <div key={id} className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id={id}
                  checked={accessories.includes(id)}
                  onCheckedChange={() => handleAccessoryToggle(id)}
                />
                <div className="flex-1">
                  <Label htmlFor={id} className="cursor-pointer">
                    <div className="font-medium">{accessory.name}</div>
                    {accessory.description && (
                      <div className="text-sm text-gray-600">{accessory.description}</div>
                    )}
                  </Label>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">
                    +${accessory.price.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {accessories.length > 0 && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium">Accessories Total</div>
                <div className="text-xl font-bold text-green-600">
                  +${accessories.reduce((total, id) => {
                    const acc = optionsData.commonAccessories[id]
                    return total + (acc?.price || 0)
                  }, 0).toLocaleString()}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
