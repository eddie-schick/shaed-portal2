// Configuration state management with URL and localStorage persistence

export const CONFIG_STORAGE_KEY = 'ford-configurator-state'

// Default configuration state
export const defaultConfiguration = {
  // Quantity of units in the quote/order
  units: 1,
  // Step 1-2 (existing)
  bodyType: 'Chassis Only',
  bodyManufacturer: null,
  
  // Step 3: Chassis
  chassis: {
    series: null,
    cab: null,
    drivetrain: null,
    wheelbase: null,
    gvwrPackage: null,
    suspensionPackage: null,
    powertrain: null
  },
  
  // Step 4: Body Specs
  bodySpecs: {},
  bodyAccessories: [],
  
  // Step 5: Upfitter
  upfitter: null,
  upfitterLocation: null,
  
  // Step 6: Pricing
  pricing: {
    chassisMSRP: 0,
    bodyPrice: 0,
    optionsPrice: 0,
    laborPrice: 0,
    freight: 0,
    subtotal: 0,
    incentives: [],
    totalIncentives: 0,
    taxes: 0,
    total: 0
  },
  financing: {
    apr: null,
    term: 60,
    downPayment: 0.2,
    monthlyPayment: 0
  },
  
  // Metadata
  createdAt: null,
  updatedAt: null,
  completedSteps: []
}

// Demo mode toggle: when enabled, all validations pass and redirects are relaxed
export const isDemoMode = () => {
  try {
    const fromStorage = localStorage.getItem('ford-config-demo')
    if (fromStorage !== null) {
      return fromStorage === '1' || fromStorage === 'true'
    }
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('demo')
    if (fromQuery !== null) {
      return fromQuery === '1' || fromQuery === 'true'
    }
  } catch (e) {
    // ignore
  }
  // Default to enabled for demo purposes
  return true
}

// Save configuration to localStorage
export const saveConfiguration = (config) => {
  const updatedConfig = {
    ...config,
    updatedAt: new Date().toISOString()
  }
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updatedConfig))
  return updatedConfig
}

// Load configuration from localStorage
export const loadConfiguration = () => {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (saved) {
      const config = JSON.parse(saved)
      return {
        ...defaultConfiguration,
        ...config
      }
    }
  } catch (error) {
    console.error('Error loading configuration:', error)
  }
  return {
    ...defaultConfiguration,
    createdAt: new Date().toISOString()
  }
}

// Clear configuration
export const clearConfiguration = () => {
  localStorage.removeItem(CONFIG_STORAGE_KEY)
  return {
    ...defaultConfiguration,
    createdAt: new Date().toISOString()
  }
}

// URL query parameter mapping
const queryParamMap = {
  bt: 'bodyType',
  bm: 'bodyManufacturer',
  series: 'chassis.series',
  cab: 'chassis.cab',
  dr: 'chassis.drivetrain',
  wb: 'chassis.wheelbase',
  gvwr: 'chassis.gvwrPackage',
  susp: 'chassis.suspensionPackage',
  pt: 'chassis.powertrain',
  // Only persist the upfitter id in URLs to avoid clobbering the full object
  uf: 'upfitter.id'
}

// Parse URL query parameters to configuration
export const parseQueryToConfig = (searchParams) => {
  const config = { ...defaultConfiguration }
  
  for (const [param, path] of Object.entries(queryParamMap)) {
    const value = searchParams.get(param)
    if (value) {
      setNestedValue(config, path, value)
    }
  }
  
  // Parse body specs (prefixed with bs_)
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('bs_')) {
      const specKey = key.substring(3)
      config.bodySpecs[specKey] = value
    }
  }
  
  // Parse accessories (comma-separated)
  const accessories = searchParams.get('acc')
  if (accessories) {
    config.bodyAccessories = accessories.split(',')
  }
  
  return config
}

// Convert configuration to URL query parameters
export const configToQuery = (config) => {
  const params = new URLSearchParams()
  
  // Add mapped parameters
  for (const [param, path] of Object.entries(queryParamMap)) {
    const value = getNestedValue(config, path)
    if (value) {
      params.set(param, value)
    }
  }
  
  // Add body specs
  for (const [key, value] of Object.entries(config.bodySpecs || {})) {
    if (value) {
      params.set(`bs_${key}`, value)
    }
  }
  
  // Add accessories
  if (config.bodyAccessories?.length > 0) {
    params.set('acc', config.bodyAccessories.join(','))
  }
  
  return params.toString()
}

// Helper to get nested value from object
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// Helper to set nested value in object
function setNestedValue(obj, path, value) {
  const keys = path.split('.')
  const lastKey = keys.pop()
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {}
    return current[key]
  }, obj)
  target[lastKey] = value
}

// Validate configuration at each step
export const validateStep = (step, config) => {
  if (isDemoMode()) return true
  switch (step) {
    case 1:
      return !!config.bodyType
    case 2:
      return !!config.bodyType && !!config.bodyManufacturer
    case 3:
      return !!(
        config.chassis.series &&
        config.chassis.cab &&
        config.chassis.drivetrain &&
        config.chassis.wheelbase &&
        config.chassis.powertrain
      )
    case 4:
      // Body specs validation depends on body type
      return Object.keys(config.bodySpecs).length > 0
    case 5:
      return !!config.upfitter
    case 6:
      return config.pricing.total > 0
    case 7:
      // All previous steps must be complete
      return config.completedSteps.includes(1) &&
             config.completedSteps.includes(2) &&
             config.completedSteps.includes(3) &&
             config.completedSteps.includes(4) &&
             config.completedSteps.includes(5) &&
             config.completedSteps.includes(6)
    default:
      return false
  }
}

// Calculate pricing based on configuration
export const calculatePricing = (config, chassisData, bodiesData, optionsData) => {
  let chassisMSRP = 0
  let bodyPrice = 0
  let optionsPrice = 0
  let laborPrice = 0
  
  // Get chassis price
  if (config.chassis.series) {
    const chassis = chassisData.find(c => c.series === config.chassis.series)
    // If full selection is present, use the precise powertrain price; otherwise use a base estimate
    if (config.chassis.powertrain) {
      const trim = chassis?.trims?.find(t => 
        t.cab === config.chassis.cab && 
        t.drivetrain === config.chassis.drivetrain
      )
      const powertrain = trim?.powertrains?.find(p => p.id === config.chassis.powertrain)
      chassisMSRP = powertrain?.basePrice || 0
    } else {
      // Base estimate from first trim/powertrain as a placeholder until user configures details
      const firstTrim = chassis?.trims?.[0]
      const firstPowertrain = firstTrim?.powertrains?.[0]
      chassisMSRP = firstPowertrain?.basePrice || 0
    }
  }
  
  // Get body price
  if (config.bodyType && bodiesData[config.bodyType]) {
    const bodyData = bodiesData[config.bodyType]
    const length = config.bodySpecs.length || config.bodySpecs.bedLength || config.bodySpecs.boxLength || config.bodySpecs.bodyLength || 12
    bodyPrice = bodyData.basePrice[length] || Object.values(bodyData.basePrice)[0] || 0
    laborPrice = (bodyData.laborHours || 10) * 150 // $150/hour labor rate
  }
  
  // Calculate options price
  if (config.bodyAccessories?.length > 0 && optionsData) {
    config.bodyAccessories.forEach(accId => {
      const accessory = optionsData.commonAccessories[accId]
      if (accessory) {
        optionsPrice += accessory.price || 0
      }
    })
  }
  
  const subtotal = chassisMSRP + bodyPrice + optionsPrice + laborPrice
  // Round taxes and totals to whole dollars
  const taxes = Math.round(subtotal * 0.0875) // 8.75% tax rate
  const total = subtotal + taxes
  
  return {
    chassisMSRP,
    bodyPrice,
    optionsPrice,
    laborPrice,
    freight: 0,
    subtotal,
    taxes,
    total,
    incentives: [],
    totalIncentives: 0
  }
}

// Calculate monthly payment
export const calculateMonthlyPayment = (principal, apr, months, downPaymentPercent = 0) => {
  const downPayment = principal * downPaymentPercent
  const loanAmount = principal - downPayment
  
  if (apr === 0) {
    return loanAmount / months
  }
  
  const monthlyRate = apr / 100 / 12
  const payment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                  (Math.pow(1 + monthlyRate, months) - 1)
  
  return payment
}
