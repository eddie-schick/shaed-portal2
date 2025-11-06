import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  Star, 
  Clock, 
  Filter, 
  Building2,
  Zap,
  Award,
  ChevronRight
} from 'lucide-react'
import { getUpfitters, geocodeZIP } from '@/api/routes'

export function UpfitterPicker({ 
  initialUpfitter = null,
  onChange,
  chassisSeries = null,
  bodyType = null,
  bodyManufacturer = null
}) {
  const [upfitters, setUpfitters] = useState([])
  const [filteredUpfitters, setFilteredUpfitters] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedUpfitter, setSelectedUpfitter] = useState(initialUpfitter)
  
  // Search filters
  const [zipCode, setZipCode] = useState('')
  const [searchRadius, setSearchRadius] = useState('50')
  const [filterQVM, setFilterQVM] = useState(false)
  const [filterEQVM, setFilterEQVM] = useState(false)
  const [filterEVReady, setFilterEVReady] = useState(false)
  const [location, setLocation] = useState(null)

  const loadUpfitters = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      const data = await getUpfitters(params)
      
      // Filter by manufacturer if provided
      let filtered = data
      if (bodyManufacturer) {
        filtered = filtered.filter(upfitter => 
          upfitter.manufacturer && 
          upfitter.manufacturer.toLowerCase() === bodyManufacturer.toLowerCase()
        )
      }
      
      setUpfitters(data)
      setFilteredUpfitters(filtered)
    } catch (error) {
      console.error('Error loading upfitters:', error)
    }
    setLoading(false)
  }, [bodyManufacturer])

  // Load upfitters on mount and when manufacturer changes
  useEffect(() => {
    loadUpfitters()
  }, [loadUpfitters])

  const handleSearch = async () => {
    if (!zipCode) {
      // Reset to all upfitters
      loadUpfitters()
      return
    }

    setLoading(true)
    try {
      // Get coordinates for ZIP code
      const coords = await geocodeZIP(zipCode)
      setLocation(coords)

      // Build search params
      const params = {
        lat: coords.lat,
        lng: coords.lng,
        radius: parseInt(searchRadius)
      }

      // Add certification filters
      const certs = []
      if (filterQVM) certs.push('QVM')
      if (filterEQVM) certs.push('eQVM')
      if (certs.length > 0) {
        params.certs = certs.join(',')
      }

      if (filterEVReady) {
        params.evReady = 'true'
      }

      const data = await getUpfitters(params)
      
      // Filter by manufacturer if provided
      let filtered = data
      if (bodyManufacturer) {
        filtered = filtered.filter(upfitter => 
          upfitter.manufacturer && 
          upfitter.manufacturer.toLowerCase() === bodyManufacturer.toLowerCase()
        )
      }
      
      // Additional filtering for chassis compatibility
      if (chassisSeries) {
        filtered = filtered.filter(upfitter => 
          !upfitter.shipThru || upfitter.shipThru.includes(chassisSeries)
        )
      }
      
      // Filter by body type specialty if available
      if (bodyType) {
        // Prioritize upfitters that specialize in this body type
        filtered.sort((a, b) => {
          const aSpecializes = a.specialties?.some(s => 
            s.toLowerCase().includes(bodyType.toLowerCase())
          )
          const bSpecializes = b.specialties?.some(s => 
            s.toLowerCase().includes(bodyType.toLowerCase())
          )
          if (aSpecializes && !bSpecializes) return -1
          if (!aSpecializes && bSpecializes) return 1
          return 0
        })
      }

      setFilteredUpfitters(filtered)
    } catch (error) {
      console.error('Error searching upfitters:', error)
    }
    setLoading(false)
  }

  const handleSelectUpfitter = (upfitter) => {
    setSelectedUpfitter(upfitter)
    onChange(upfitter)
  }

  const calculateDistance = (upfitter) => {
    if (!location) return null
    // Simple distance calculation (already sorted by API)
    const R = 3959 // Earth radius in miles
    const dLat = (upfitter.lat - location.lat) * Math.PI / 180
    const dLon = (upfitter.lng - location.lng) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(location.lat * Math.PI / 180) * Math.cos(upfitter.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return Math.round(R * c)
  }

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Find an Upfitter
          </CardTitle>
          <CardDescription>
            Search for qualified upfitters in your area or use ship-thru options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Location Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="zip">ZIP Code / City</Label>
                <Input
                  id="zip"
                  placeholder="Enter ZIP code"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div>
                <Label htmlFor="radius">Search Radius</Label>
                <Select value={searchRadius} onValueChange={setSearchRadius}>
                  <SelectTrigger id="radius">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 miles</SelectItem>
                    <SelectItem value="50">50 miles</SelectItem>
                    <SelectItem value="100">100 miles</SelectItem>
                    <SelectItem value="250">250 miles</SelectItem>
                    <SelectItem value="500">500 miles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>

            {/* Filter Options */}
            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-3 block">Filter by Certifications</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="qvm"
                    checked={filterQVM}
                    onChange={(e) => setFilterQVM(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="qvm" className="text-sm cursor-pointer">
                    QVM Certified
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="eqvm"
                    checked={filterEQVM}
                    onChange={(e) => setFilterEQVM(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="eqvm" className="text-sm cursor-pointer">
                    eQVM Certified
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="evready"
                    checked={filterEVReady}
                    onChange={(e) => setFilterEVReady(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="evready" className="text-sm cursor-pointer">
                    EV Ready
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Upfitters</CardTitle>
          <CardDescription>
            {loading ? 'Searching...' : `${filteredUpfitters.length} upfitters found`}
            {location && ` near ${location.city}, ${location.state}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredUpfitters.length === 0 ? (
            <Alert>
              <AlertDescription>
                No upfitters found matching your criteria. Try expanding your search radius or removing filters.
              </AlertDescription>
            </Alert>
          ) : (
            <RadioGroup 
              value={selectedUpfitter?.id || ''} 
              onValueChange={(id) => {
                const upfitter = filteredUpfitters.find(u => u.id === id)
                handleSelectUpfitter(upfitter)
              }}
            >
              <div className="space-y-4">
                {filteredUpfitters.map((upfitter) => {
                  const distance = calculateDistance(upfitter)
                  const isSpecialist = bodyType && upfitter.specialties?.some(s => 
                    s.toLowerCase().includes(bodyType.toLowerCase())
                  )
                  
                  return (
                    <Label
                      key={upfitter.id}
                      htmlFor={upfitter.id}
                      className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <RadioGroupItem value={upfitter.id} id={upfitter.id} className="mt-1" />
                      <div className="ml-4 flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-base">{upfitter.name}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {upfitter.address}
                                {distance && (
                                  <span className="font-medium ml-2">
                                    ({distance} miles)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-medium">{upfitter.rating}</span>
                            </div>
                            {isSpecialist && (
                              <Badge variant="secondary" className="text-xs">
                                {bodyType} Specialist
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-3 flex flex-wrap gap-2">
                          {upfitter.certifications?.includes('QVM') && (
                            <Badge variant="outline" className="text-xs">
                              <Award className="w-3 h-3 mr-1" />
                              QVM
                            </Badge>
                          )}
                          {upfitter.certifications?.includes('eQVM') && (
                            <Badge variant="outline" className="text-xs">
                              <Award className="w-3 h-3 mr-1" />
                              eQVM
                            </Badge>
                          )}
                          {upfitter.evReady && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              <Zap className="w-3 h-3 mr-1" />
                              EV Ready
                            </Badge>
                          )}
                          {upfitter.shipThru?.includes(chassisSeries) && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              Ship-Thru Available
                            </Badge>
                          )}
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Phone className="w-3 h-3" />
                            {upfitter.phone}
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="w-3 h-3" />
                            Lead time: {upfitter.leadTime}
                          </div>
                        </div>
                        
                        {upfitter.specialties && (
                          <div className="mt-3">
                            <div className="text-xs text-gray-500">Specialties:</div>
                            <div className="text-sm text-gray-700">
                              {upfitter.specialties.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    </Label>
                  )
                })}
              </div>
            </RadioGroup>
          )}
        </CardContent>
      </Card>

      {/* Selected Upfitter Details */}
      {selectedUpfitter && (
        <Alert className="border-blue-200 bg-blue-50">
          <Building2 className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <div className="font-medium text-blue-900">Selected Upfitter</div>
            <div className="mt-1">
              <strong>{selectedUpfitter.name}</strong>
              <br />
              {selectedUpfitter.address}
              <br />
              Lead Time: {selectedUpfitter.leadTime}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
