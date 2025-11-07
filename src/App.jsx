import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { AspectRatio } from '@/components/ui/aspect-ratio.jsx'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu.jsx'
import { Toaster } from '@/components/ui/sonner.jsx'
import UpfitterLogo from './components/UpfitterLogo.jsx'
// Removed FordProLogo import; using Ford CVC logo from public assets
import { 
  Search, 
  Star,
  MapPin,
  Menu,
  X,
  Circle,
  ChevronDown
} from 'lucide-react'
import './App.css'
import Hero from './components/Hero.jsx'

// Import new configurator pages
import { ConfiguratorChassisSelection } from './pages/ConfiguratorChassisSelection.jsx'
import { ConfiguratorBodyType } from './pages/ConfiguratorBodyType.jsx'
import { ConfiguratorChassis } from './pages/ConfiguratorChassis.jsx'
import { ConfiguratorBodySpecs } from './pages/ConfiguratorBodySpecs.jsx'
import { ConfiguratorUpfitter } from './pages/ConfiguratorUpfitter.jsx'
import { ConfiguratorPricing } from './pages/ConfiguratorPricing.jsx'
import { ConfiguratorReview } from './pages/ConfiguratorReview.jsx'
import { OrdersPage } from './pages/Orders.jsx'
import { OrderDetailPage } from './pages/OrderDetail.jsx'
import { DocumentationPage } from './pages/Documentation.jsx'
import { loadConfiguration, saveConfiguration, configToQuery, parseQueryToConfig } from './lib/configurationStore.js'

// Frontend-only demo: all data is mocked locally

// Shared upfit matrix used by both marketplace and configurator to keep body
// types exactly consistent across the app
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
    chassis: ['E-350', 'E-450', 'F-450', 'F-550', 'F-600', 'F-650'],
    manufacturers: ['Morgan Truck Body', 'Rockport', 'Reading Truck', 'Wabash']
  },
  'Refrigerated Body': {
    chassis: ['E-450', 'F-450', 'F-550', 'F-600', 'F-650'],
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

// Helpers shared across views
const KNOWN_MODEL_CODES = ['F-350', 'F-450', 'F-550', 'F-600', 'F-650', 'F-750', 'E-350', 'E-450']
const getModelCodeFromChassis = (c) => {
  const text = `${c?.chassis_model || ''} ${c?.name || ''}`
  return KNOWN_MODEL_CODES.find(code => text.includes(code))
}
const getBodiesForChassis = (c) => {
  const modelCode = getModelCodeFromChassis(c)
  if (!modelCode) return c.common_bodies || []
  return Object.keys(UPFIT_MATRIX).filter((bt) => (UPFIT_MATRIX[bt].chassis || []).includes(modelCode))
}

// Header Component
function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  const navigation = [
    { name: 'Catalog', href: '/' },
    { name: 'Order Management', href: '/ordermanagement' },
    { name: 'Documentation', href: '/documentation' },
  ]

  // Function to scroll to top when navigating
  const handleNavClick = () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return (
    <header className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="inline-block" onClick={handleNavClick}>
            <img src="/SHAED Logo.png" alt="SHAED Portal" className="h-12 md:h-14 lg:h-16 w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={handleNavClick}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.href
                    ? 'text-white'
                    : 'text-black hover:text-black'
                }`}
                style={location.pathname === item.href ? { backgroundColor: '#000000' } : {}}
                onMouseEnter={(e) => {
                  if (location.pathname !== item.href) {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (location.pathname !== item.href) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(47, 199, 116, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => {
                    setIsMenuOpen(false)
                    handleNavClick()
                  }}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${
                    location.pathname === item.href
                      ? 'text-white'
                      : 'text-black hover:text-black'
                  }`}
                  style={location.pathname === item.href ? { backgroundColor: '#000000' } : {}}
                  onMouseEnter={(e) => {
                    if (location.pathname !== item.href) {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== item.href) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

// Vehicle Card Component
function VehicleCard({ item }) {
  const navigate = useNavigate()
  
  // Extract series from chassis model to pass to configurator
  const getSeriesFromVehicle = () => {
    const chassisModel = item.vehicle?.chassis_model || ''
    return getModelCodeFromChassis({ chassis_model: chassisModel, name: '' })
  }
  
  const handleConfigure = () => {
    const series = getSeriesFromVehicle()
    const params = new URLSearchParams()
    if (series) {
      params.set('series', series)
    }
    navigate(`/configurator/chassis-selection?${params.toString()}`)
  }
  
  return (
    <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{item.vehicle?.chassis_model}</CardTitle>
            <CardDescription>
              {item.vehicle?.model_year} • {item.vehicle?.chassis_class}
              {item.body && (
                <>
                  <br />
                  <span className="text-sm text-gray-600">
                    Body Type: {item.body?.body_type} - {item.body?.vocation}
                  </span>
                </>
              )}
            </CardDescription>
          </div>
          {item.featured && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              <Star className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div>
              <span className="font-medium">Engine:</span>
              <br />
              {item.vehicle?.engine}
            </div>
            <div>
              <span className="font-medium">Drivetrain:</span>
              <br />
              {item.vehicle?.drivetrain}
            </div>
          </div>
          
          {item.body && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Body Manufacturer:</span>
                <UpfitterLogo manufacturer={item.body?.manufacturer} size="sm" />
              </div>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-3 border-t gap-3">
            <div>
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                ${item.total_price?.toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">
                Available in {item.lead_time_days} days
              </div>
            </div>
            <Button size="sm" className="w-full sm:w-auto" onClick={handleConfigure}>Configure</Button>
          </div>
          
          <div className="flex items-center text-sm text-gray-500">
            <MapPin className="h-4 w-4 mr-1" />
            {item.location}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Chassis Catalog for Marketplace
const CHASSIS_CATALOG = [
  { id: 'f350', name: 'Chassis Cab F-350 XL (2025)', chassis_model: 'Chassis Cab F-350 XL', chassis_class: 'Class 3', gvwr: '≈ 12,000–14,000 lbs', common_bodies: ['Service Body', 'Flatbed', 'Dump Body', 'Contractor Body'], description: 'Popular for municipal fleets, trades, and lighter vocational upfits.', imageKey: 'F-350' },
  { id: 'f450', name: 'Chassis Cab F-450 XL (2025)', chassis_model: 'Chassis Cab F-450 XL', chassis_class: 'Class 4', gvwr: '≈ 14,000–16,500 lbs', common_bodies: ['Service Body', 'Dump Body', 'Contractor Body', 'Dry Freight Body', 'Ambulance'], description: 'More payload/towing than F-350 while staying maneuverable.', imageKey: 'F-450' },
  { id: 'f550', name: 'Chassis Cab F-550 XL (2025)', chassis_model: 'Chassis Cab F-550 XL', chassis_class: 'Class 5', gvwr: '≈ 17,500–19,500 lbs', common_bodies: ['Dump', 'Tow & Recovery', 'Bucket', 'Dry Freight Body', 'Refrigerated Body'], description: 'Workhorse for utilities, construction, and municipalities.', imageKey: 'F-550' },
  { id: 'f600', name: 'Chassis Cab F-600 XL (2025)', chassis_model: 'Chassis Cab F-600 XL', chassis_class: 'Class 6', gvwr: '≈ 22,000 lbs', common_bodies: ['Dump Body', 'Contractor Body', 'Dry Freight Body', 'Refrigerated Body', 'Service Body'], description: 'Bridges gap between Super Duty and true Medium Duty.', imageKey: 'F-600' },
  { id: 'f650', name: 'F-650 SD Straight Frame (2025)', chassis_model: 'F-650 SD Straight Frame', chassis_class: 'Class 6/7', gvwr: '≈ 25,600–29,000 lbs', common_bodies: ['Dry Freight Body', 'Refrigerated Body', 'Dump Body', 'Tow & Recovery', 'Flatbed'], description: 'For heavier regional delivery, construction, and municipal operations.', imageKey: 'F-650' },
  { id: 'f750', name: 'F-750 SD Straight Frame (2025)', chassis_model: 'F-750 SD Straight Frame', chassis_class: 'Class 7', gvwr: 'Up to 37,000 lbs', common_bodies: ['Refrigerated Body', 'Dump Body', 'Ambulance', 'Bucket', 'Tow & Recovery'], description: 'Heavy vocational use and long-haul vocational fleets.', imageKey: 'F-750' },
  { id: 'e350', name: 'E-Series Cutaway E-350 (2025)', chassis_model: 'E-Series Cutaway E-350', chassis_class: 'Class 3', gvwr: '10,050–12,700 lbs', common_bodies: ['Dry Freight Body', 'Refrigerated Body', 'Service Body', 'Ambulance'], description: 'Versatile cutaway platform for box and utility bodies.', imageKey: 'E-350' },
  { id: 'e450', name: 'E-Series Cutaway E-450 (2025)', chassis_model: 'E-Series Cutaway E-450', chassis_class: 'Class 4', gvwr: 'Up to 14,500 lbs', common_bodies: ['Dry Freight Body', 'Refrigerated Body', 'Service Body', 'Ambulance'], description: 'Higher GVWR cutaway ideal for delivery and service applications.', imageKey: 'E-450' }
]

function ChassisCard({ chassis }) {
  const navigate = useNavigate()
  const [imgIdx, setImgIdx] = useState(0)
  // Map of available images per chassis, sourced from the Vehicle Images folder
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
  }
  const gallerySources = IMAGE_MAP[chassis.imageKey] || [
    `/vehicle-images/${chassis.imageKey}.avif`,
    `/vehicle-images/${chassis.imageKey}.png`,
    `/vehicle-images/${chassis.imageKey}.jpg`,
    `/vehicle-images/${chassis.imageKey}.webp`
  ]
  // Sort images so files without a trailing number come first, then 2,3,4...
  const sortImagesByFilename = (sources) => {
    const extractOrder = (path) => {
      const filename = path.split('/').pop() || ''
      const match = filename.match(/(?:^|[^0-9])(\d+)(?=\.[^.]+$)/)
      return match ? parseInt(match[1], 10) : null
    }
    return sources.slice().sort((a, b) => {
      const aNum = extractOrder(a)
      const bNum = extractOrder(b)
      if (aNum == null && bNum != null) return -1
      if (aNum != null && bNum == null) return 1
      if (aNum == null && bNum == null) return a.localeCompare(b)
      if (aNum !== bNum) return aNum - bNum
      return a.localeCompare(b)
    })
  }
  // Dedupe images by variant (base image or trailing number), ignoring file extensions
  const dedupeByVariant = (sources) => {
    const seen = new Set()
    const result = []
    const makeKey = (path) => {
      const filename = (path.split('/').pop() || '').replace(/\.[^.]+$/, '')
      const match = filename.match(/(\d+)\s*$/)
      const variant = match ? `num:${parseInt(match[1], 10)}` : 'base'
      return `${chassis.imageKey}:${variant}`
    }
    for (const src of sources) {
      const key = makeKey(src)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(src)
      }
    }
    return result
  }
  const orderedGallerySources = dedupeByVariant(sortImagesByFilename(Array.from(new Set(gallerySources))))
  const handleConfigure = () => {
    // Start the new configurator flow with selected chassis prefilled
    const params = new URLSearchParams()
    params.set('series', chassis.imageKey)
    navigate(`/configurator/chassis-selection?${params.toString()}`)
  }
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg">{chassis.name}</CardTitle>
        <CardDescription>
          {chassis.chassis_class} • GVWR {chassis.gvwr}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col h-full">
        <div className="space-y-4">
          <AspectRatio ratio={16/9} className="mb-2">
            <div className="w-full h-full overflow-x-auto flex snap-x snap-mandatory rounded">
              {orderedGallerySources.map((src, idx) => (
                <img
                  key={src}
                  src={src}
                  alt={`${chassis.name} ${idx + 1}`}
                  className="w-full h-full object-cover rounded snap-start shrink-0"
                  onError={(e) => {
                    // Hide broken images from the gallery
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ))}
            </div>
          </AspectRatio>
          <div className="mb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  Recommended Body Types
                  <ChevronDown className="w-4 h-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {getBodiesForChassis(chassis).map((bt) => (
                  <DropdownMenuItem key={bt}>
                    <Circle className="w-3 h-3" />
                    {bt}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-auto pt-2">
          <div className="text-sm text-gray-500 mb-2 min-h-[48px]">{chassis.description}</div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleConfigure}>Configure</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Marketplace Component
function Marketplace() {
  const [searchTerm, setSearchTerm] = useState('')
  const [chassisClassFilter, setChassisClassFilter] = useState('all')
  const [vocationFilter, setVocationFilter] = useState('all')
  const [bodyTypeFilter, setBodyTypeFilter] = useState('all')

  const BODY_VOCATIONS = {
    'Service Body': ['Trades', 'Municipal'],
    'Flatbed': ['Construction', 'Agriculture'],
    'Dump Body': ['Construction', 'Municipal', 'Landscaping'],
    'Dry Freight Body': ['Delivery', 'Logistics'],
    'Refrigerated Body': ['Food & Beverage', 'Medical'],
    'Tow & Recovery': ['Towing'],
    'Ambulance': ['Emergency'],
    'Bucket': ['Utilities'],
    'Contractor Body': ['Construction', 'Trades'],
    'Box w/ Lift Gate': ['Delivery', 'Logistics']
  }

  // Use the same body type names as the configurator
  const KNOWN_MODEL_CODES = ['F-350', 'F-450', 'F-550', 'F-600', 'F-650', 'F-750', 'E-350', 'E-450']
  const getModelCodeFromChassis = (c) => {
    const text = `${c?.chassis_model || ''} ${c?.name || ''}`
    return KNOWN_MODEL_CODES.find(code => text.includes(code))
  }
  const getBodiesForChassis = (c) => {
    const modelCode = getModelCodeFromChassis(c)
    if (!modelCode) return c.common_bodies || []
    return Object.keys(UPFIT_MATRIX).filter((bt) => (UPFIT_MATRIX[bt].chassis || []).includes(modelCode))
  }

  const VOCATION_OPTIONS = [
    'Construction',
    'Trades',
    'Municipal',
    'Utilities',
    'Delivery',
    'Logistics',
    'Food & Beverage',
    'Medical',
    'Emergency',
    'Towing',
    'Agriculture',
    'Landscaping',
  ]

  const bodyMatchesVocation = (bodyName, vocation) => {
    if (vocation === 'all') return true
    const vocs = BODY_VOCATIONS[bodyName] || []
    return vocs.includes(vocation)
  }

  // Body type options mirror the chips shown on cards
  const BODY_TYPE_OPTIONS = Object.keys(UPFIT_MATRIX)

  const filteredCatalog = CHASSIS_CATALOG.filter((c) => {
    const matchesClass = chassisClassFilter === 'all' || c.chassis_class === chassisClassFilter
    const query = searchTerm.trim().toLowerCase()
    const matchesQuery = !query || c.name.toLowerCase().includes(query) || c.chassis_model.toLowerCase().includes(query)
    const commonBodies = getBodiesForChassis(c)
    const matchesVocation = vocationFilter === 'all' || commonBodies.some(bt => bodyMatchesVocation(bt, vocationFilter))
    const matchesBodyType = bodyTypeFilter === 'all' || commonBodies.some(bt => bt === bodyTypeFilter)
    return matchesClass && matchesQuery && matchesVocation && matchesBodyType
  })

  return (
    <>
      {/* Full-bleed Hero */}
      <Hero
        rotatingWords={["Customers", "Dealers", "Upfitters", "Fleets"]}
        ctaPrimary={{ label: "Explore Catalog", href: "/" }}
        ctaSecondary={{ label: "Order Management", href: "/ordermanagement" }}
        showSearch={true}
      />

      {/* Main content container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div id="catalog" className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search by chassis model or class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 sm:gap-4 mb-8 justify-center">
          <Select value={chassisClassFilter} onValueChange={setChassisClassFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              <SelectItem value="Class 3">Class 3</SelectItem>
              <SelectItem value="Class 4">Class 4</SelectItem>
              <SelectItem value="Class 5">Class 5</SelectItem>
              <SelectItem value="Class 6">Class 6</SelectItem>
              <SelectItem value="Class 6/7">Class 6/7</SelectItem>
              <SelectItem value="Class 7">Class 7</SelectItem>
            </SelectContent>
          </Select>

          <Select value={vocationFilter} onValueChange={setVocationFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="All Vocations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vocations</SelectItem>
              {VOCATION_OPTIONS.map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={bodyTypeFilter} onValueChange={setBodyTypeFilter}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="All Body Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Body Types</SelectItem>
              {BODY_TYPE_OPTIONS.map(bt => (
                <SelectItem key={bt} value={bt}>{bt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chassis Catalog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCatalog.map((ch) => (
            <ChassisCard key={ch.id} chassis={ch} />
          ))}
        </div>

        {filteredCatalog.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No chassis found matching your criteria.</p>
          </div>
        )}
      </div>
    </>
  )
}

// Dealer Portal Component (Temporarily disabled)
function DealerPortal() { return <OrdersPage /> }

// Configurator Component - Redirects to new flow starting with chassis selection
function Configurator() {
  const location = useLocation()
  const navigate = useNavigate()
  const vehicle = location.state?.vehicle
  
  // Redirect to new configurator flow
  useEffect(() => {
    // If coming from marketplace with a vehicle selection, 
    // start the new flow with chassis selection
    navigate('/configurator/chassis-selection')
  }, [navigate])

  return null
}


// Global Footer
function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center gap-1 text-gray-500">
          <span>Powered by</span>
          <img src="/SHAED Logo.png" alt="SHAED" className="h-6 w-auto" />
        </div>
      </div>
    </footer>
  )
}

// ScrollToTop component to scroll to top on route changes
function ScrollToTop() {
  const location = useLocation()
  
  useEffect(() => {
    // Scroll to top when route changes
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])
  
  return null
}

// Main App Component
function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <ScrollToTop />
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Marketplace />} />
            <Route path="/ordermanagement" element={<OrdersPage />} />
            <Route path="/ordermanagement/:id" element={<OrderDetailPage />} />
            <Route path="/dealer" element={<Navigate to="/ordermanagement" replace />} />
            <Route path="/orders" element={<Navigate to="/ordermanagement" replace />} />
            <Route path="/configure" element={<Configurator />} />
            <Route path="/configurator/chassis-selection" element={<ConfiguratorChassisSelection />} />
            <Route path="/configurator/body-type" element={<ConfiguratorBodyType />} />
            <Route path="/configurator/chassis-options" element={<ConfiguratorChassis />} />
            <Route path="/configurator/body-specs" element={<ConfiguratorBodySpecs />} />
            <Route path="/configurator/upfitter" element={<ConfiguratorUpfitter />} />
            <Route path="/configurator/pricing" element={<ConfiguratorPricing />} />
            <Route path="/configurator/review" element={<ConfiguratorReview />} />
            <Route path="/documentation" element={<DocumentationPage />} />
            <Route path="/documentation/deal-jacket/:id" element={<DocumentationPage />} />
          </Routes>
        </main>
        <Footer />
        <Toaster />
      </div>
    </Router>
  )
}

export default App

