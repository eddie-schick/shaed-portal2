import React from 'react'

// Import all upfitter logos with proper handling of special characters
import KnapheideImg from '../assets/Knapheide.png'
import RoyalImg from '../assets/RoyalTruckBody.jpg'
import ReadingImg from '../assets/ReadingTruckLogo.png'
import MorganImg from '../assets/MorganTruckBody.webp'
import RugbyImg from '../assets/RugbyManufacturing.png'
import JerrDanImg from '../assets/Jerr-Dan.png'
import AltecImg from '../assets/Altec.png'
import WheeledCoachImg from '../assets/WheeledCoach.png'
import RockportImg from '../assets/Rockport.webp'
import DowneasterImg from '../assets/Downeaster.jpg'
import SHImg from '../assets/SHTruckBodies.jpg'
import DuramagImg from '../assets/Duramag.png'
import ScelziImg from '../assets/Scelzi.jpg'
import CompleteImg from '../assets/CompleteTruckBodies.png'
import VersaliftImg from '../assets/Versalift.webp'
import HortonImg from '../assets/HortonEmergencyVehicles.png'
import ChevronImg from '../assets/Chevron.jpg'
import MillerImg from '../assets/MillerIndustries.webp'
import DynamicImg from '../assets/DynamicTowing.png'
import GreatDaneImg from '../assets/GreatDaneJohnson.png'
import GodwinImg from '../assets/GodwinGroup.jpg'
import TerexImg from '../assets/TerexUtilities.jpg'
import BrandonImg from '../assets/BrandonManufacturing(viaTruckCorp).jpg'
import PJImg from '../assets/PJΓÇÖsTruckBodies.webp'
import WabashImg from '../assets/Supreme(Wabash).webp'
import DurALiftImg from '../assets/Dur-A-Lift.png'
import AEVImg from '../assets/AEV(AmericanEmergencyVehicles).png'

// For files with special characters, we'll use dynamic imports or fallback to text
const logoMap = {
  'Knapheide': KnapheideImg,
  'Knapheide Manufacturing': KnapheideImg,
  'Royal': RoyalImg,
  'Royal Truck Body': RoyalImg,
  'Reading': ReadingImg,
  'Reading Truck': ReadingImg,
  'Morgan': MorganImg,
  'Morgan Truck Body': MorganImg,
  'Rugby': RugbyImg,
  'Rugby Manufacturing': RugbyImg,
  'Jerr-Dan': JerrDanImg,
  'Jerr-Dan Corporation': JerrDanImg,
  'Altec': AltecImg,
  'Altec Industries': AltecImg,
  'Wheeled Coach': WheeledCoachImg,
  'Rockport': RockportImg,
  'Downeaster': DowneasterImg,
  'SH Truck Bodies': SHImg,
  'Duramag': DuramagImg,
  'Scelzi': ScelziImg,
  'Complete Truck Bodies': CompleteImg,
  'Versalift': VersaliftImg,
  'Horton Emergency Vehicles': HortonImg,
  'Chevron': ChevronImg,
  'Miller Industries': MillerImg,
  'Dynamic Towing': DynamicImg,
  'Great Dane Johnson': GreatDaneImg,
  'Godwin Group': GodwinImg,
  'Terex Utilities': TerexImg,
  'Brandon Manufacturing': BrandonImg,
  "PJ's Truck Bodies": PJImg,
  'Wabash': WabashImg,
  'Dur-A-Lift': DurALiftImg,
  'AEV': AEVImg,
  'Braun Industries': BrandonImg // Using Brandon as fallback for Braun
}

const UpfitterLogo = ({ manufacturer, className = '', size = 'md' }) => {
  const logoSrc = logoMap[manufacturer] || (manufacturer && logoMap[manufacturer.split(' ')[0]])
  
  const sizeClasses = {
    sm: 'h-6 w-auto',
    md: 'h-8 w-auto',
    lg: 'h-12 w-auto',
    xl: 'h-16 w-auto'
  }
  
  if (!logoSrc) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-200 rounded flex items-center justify-center ${className}`}>
        <span className="text-xs text-gray-600 font-medium px-2">
          {manufacturer && manufacturer.split(' ')[0] || 'Logo'}
        </span>
      </div>
    )
  }
  
  return (
    <img
      src={logoSrc}
      alt={`${manufacturer} logo`}
      className={`${sizeClasses[size]} object-contain ${className}`}
      onError={(e) => {
        e.target.style.display = 'none'
        if (e.target.nextSibling) {
          e.target.nextSibling.style.display = 'flex'
        }
      }}
    />
  )
}

export default UpfitterLogo

