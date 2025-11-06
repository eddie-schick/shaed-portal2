# Ford Commercial Upfit Configurator

A comprehensive Ford Pro-style Commercial Upfit Configurator that enables dealers to build, price, and submit custom chassis + body configurations.

## Features

### 7-Step Configuration Process

1. **Select Body Type** - Choose from various commercial body types
2. **Select Body Manufacturer** - Pick from qualified manufacturers 
3. **Chassis/Vehicle Options** - Configure base chassis, cab, drivetrain, wheelbase, powertrain
4. **Body Specifications** - Customize body-specific features and accessories
5. **Upfitter/Installer** - Find and select qualified upfitters with location-based search
6. **Pricing & Incentives** - Review pricing, apply incentives, calculate financing
7. **Review & Submit** - Export quotes, share configurations, submit orders

### Key Capabilities

- **Compatibility Validation** - Ensures chassis/body combinations are valid
- **Dynamic Pricing** - Real-time price calculations with incentives
- **URL Persistence** - Shareable configuration links with query parameters
- **LocalStorage Backup** - Saves progress between sessions
- **Mobile Responsive** - Works on all devices with adaptive layouts
- **Export Options** - PDF quotes, email sharing, print-friendly views

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
ford_marketplace_frontend/
├── src/
│   ├── api/
│   │   └── routes.js           # Mock API endpoints
│   ├── components/
│   │   ├── ChassisForm.jsx     # Chassis configuration form
│   │   ├── BodySpecsForm.jsx   # Dynamic body specifications
│   │   ├── UpfitterPicker.jsx  # Upfitter search and selection
│   │   ├── PriceSummary.jsx    # Pricing and financing calculator
│   │   ├── ReviewSheet.jsx     # Final review and order submission
│   │   ├── Stepper.jsx         # Progress indicator
│   │   └── Layout/
│   │       └── StickyActions.jsx # Navigation footer
│   ├── data/
│   │   ├── chassis.json        # Chassis configurations and pricing
│   │   ├── bodies.json         # Body types and specifications
│   │   ├── options.json        # Accessories and options
│   │   ├── upfitters.json      # Upfitter directory
│   │   └── incentives.json     # Rebates and financing offers
│   ├── lib/
│   │   └── configurationStore.js # State management utilities
│   ├── pages/
│   │   ├── ConfiguratorChassis.jsx
│   │   ├── ConfiguratorBodySpecs.jsx
│   │   ├── ConfiguratorUpfitter.jsx
│   │   ├── ConfiguratorPricing.jsx
│   │   └── ConfiguratorReview.jsx
│   └── App.jsx                 # Main application with routing
```

## Configuration Data

### Modifying Seed Data

All configuration options are stored in JSON files under `/src/data/`:

#### chassis.json
- Series configurations (F-350 through F-750, Transit, E-Transit)
- Cab styles, drivetrains, wheelbases
- Powertrain options with pricing
- Compatibility rules

#### bodies.json
- Body type specifications and base pricing
- Available options per body type (lengths, materials, features)
- Labor hour estimates

#### options.json
- Common accessories with compatibility rules
- Chassis-specific options
- Pricing for all add-ons

#### upfitters.json
- Upfitter locations and contact info
- Certifications (QVM, eQVM, EV-ready)
- Specialties and lead times

#### incentives.json
- Federal, state, and manufacturer incentives
- Financing rates by credit tier
- Conditional rebates based on configuration

### Extending Compatibility Rules

Compatibility is enforced at multiple levels:

1. **Chassis-Body Compatibility** - Edit `UPFIT_MATRIX` in App.jsx:
```javascript
const UPFIT_MATRIX = {
  'Body Type': {
    chassis: ['F-350', 'F-450'], // Compatible series
    manufacturers: ['Manufacturer1', 'Manufacturer2']
  }
}
```

2. **Wheelbase-Body Length** - Update in chassis.json:
```javascript
"wheelbaseBodyLength": {
  "164": { "minLength": 10, "maxLength": 14 }
}
```

3. **Accessory Compatibility** - Set in options.json:
```javascript
"compatible": ["Dump Body", "Flatbed/Stake/Platform"]
// or
"compatible": "all"
```

## URL Parameters

The configurator supports deep linking with these query parameters:

- `bt` - Body type
- `bm` - Body manufacturer  
- `series` - Chassis series
- `cab` - Cab configuration
- `dr` - Drivetrain
- `wb` - Wheelbase
- `pt` - Powertrain ID
- `uf` - Upfitter ID
- `bs_*` - Body specification fields (prefixed)
- `acc` - Comma-separated accessory IDs

Example:
```
/configurator/chassis?bt=Dump+Body&bm=Rugby+Manufacturing&series=F-450&cab=Crew+Cab
```

## API Integration

The app uses mock APIs that can be replaced with real endpoints:

```javascript
// api/routes.js - Replace mock implementations with real API calls
export const getChassis = async (series) => {
  // Replace with: return fetch(`/api/chassis/${series}`)
}

export const submitOrder = async (orderData) => {
  // Replace with: return fetch('/api/orders', { method: 'POST', body: orderData })
}
```

### Order Management Integration

- The configurator can send a completed build to the Order Management backend via an intake endpoint.
- The Orders UI is available at `/dealer` (and `/orders`) and consumes the Order Management API for listing and details.

Configuration:

1. Set the API base for the Order Management backend in your environment:

```
VITE_ORDER_API_BASE=http://localhost:3000
```

2. Start the Order Management backend so that the following endpoints are available at the base above:
   - `POST /api/orders/intake` (Create new order from configurator)
   - `GET /api/orders` (List orders with filters)
   - `GET /api/orders/:id` (Order + status events)
   - `POST /api/orders/:id/transition` (Advance status)
   - `PATCH /api/orders/:id/etas` (Update ETAs)
   - `POST /api/listings/:id/publish` (Publish stock unit to Dealer Website channel)

Notes:
- If the backend runs on a different origin, the front-end will call it using `VITE_ORDER_API_BASE`.
- For dev on the same origin, leave `VITE_ORDER_API_BASE` empty.

## Customization

### Adding New Body Types

1. Add to `UPFIT_MATRIX` in App.jsx
2. Create specifications in bodies.json
3. Add case in BodySpecsForm.jsx `renderBodyFields()`
4. Update icon mapping in `BODY_TYPE_ICONS`

### Adding New Chassis Series

1. Add to chassis.json with trims and pricing
2. Update `CHASSIS_CATALOG` in App.jsx for marketplace
3. Add to compatibility mappings

### Modifying Pricing Logic

Edit `calculatePricing()` in configurationStore.js:
```javascript
// Adjust labor rate
laborPrice = (bodyData.laborHours || 10) * 150 // $150/hour

// Change tax rate
const taxes = subtotal * 0.0875 // 8.75%
```

## Development

### Running Locally

```bash
npm run dev
# Opens at http://localhost:5173
```

### Building for Production

```bash
npm run build
# Output in dist/ folder
```

### Testing Configurations

1. Start from marketplace (/) and select a chassis
2. Or use direct URL with parameters for testing specific configs
3. Check browser console for configuration state updates
4. LocalStorage key: `ford-configurator-state`

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Notes

- All prices are in USD
- Mock data uses placeholder values
- PDF export creates text file (implement real PDF library in production)
- Email functionality is stubbed (integrate email service in production)
- Geocoding uses mock coordinates for demo ZIPs

## License

Proprietary - Ford Commercial Vehicles
