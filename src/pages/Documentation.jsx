import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom'
import { getOrders } from '@/lib/orderApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Upload, 
  FileText, 
  ArrowLeft, 
  Info,
  ChevronUp,
  ChevronDown,
  File,
  Sparkles,
  Download,
  Search
} from 'lucide-react'
import { toast } from 'sonner'

// Helper to read from localStorage
function readLocal(key, fallback) {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : fallback
  } catch {
    return fallback
  }
}

// Helper to write to localStorage
function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Failed to write to localStorage:', e)
  }
}

// Document categories and types based on screenshots
const DOCUMENT_CATEGORIES = {
  'Sales & Sales Support': {
    documents: [
      { id: 'customer-approved-spec-quote', name: 'Customer Approved Spec Quote', required: false, description: 'The specification quote that has been reviewed and approved by the customer. This document confirms the customer has agreed to the vehicle specifications and pricing.' },
      { id: 'customer-po', name: 'Customer PO', required: false, description: 'The purchase order issued by the customer for the vehicle order. This document authorizes the purchase and confirms the order details.' },
      { id: 'deal-recap', name: 'Deal Recap', required: true, description: 'A comprehensive summary document that outlines all the key details of the vehicle sale including pricing, specifications, and terms. This is a critical document for tracking the complete deal structure.' },
      { id: 'purchase-agreement', name: 'Purchase Agreement / Customer Invoice', required: true, description: 'The formal purchase agreement or invoice that establishes the legal terms of the sale between the dealer and customer. This document serves as the official contract for the transaction.' },
      { id: 'pni-order-confirmation', name: 'Dealer Order Confirmation', required: false, description: 'Confirmation document from the dealer acknowledging the order placement. This confirms that the dealer has received and processed the order request.' },
      { id: 'oem-price-order-confirmation', name: 'OEM Price Order Confirmation', required: false, description: 'Official confirmation from the original equipment manufacturer (OEM) that includes the final pricing and order details. This document verifies the order has been accepted by the manufacturer.' },
      { id: 'oem-factory-invoice', name: 'OEM Factory Invoice', required: true, description: 'The official invoice from the OEM factory showing the vehicle has been manufactured and invoiced. This document is required for payment processing and title transfer.' },
      { id: 'oem-sales-reporting-confirmation', name: 'OEM Sales Reporting Confirmation', required: true, description: 'Confirmation that the sale has been properly reported to the OEM for sales tracking and incentive purposes. This document ensures compliance with manufacturer reporting requirements.' },
      { id: 'vendor-po', name: 'Vendor PO', required: false, description: 'Purchase order issued to vendors for upfitting, parts, or services related to the vehicle order. This document authorizes vendor work and establishes pricing terms.' },
    ]
  },
  'General Documents': {
    documents: [
      { id: 'incentive-claim-paperwork', name: 'Incentive Claim Paperwork', required: false, description: 'Documentation required to claim manufacturer or dealer incentives for the vehicle sale. This includes forms and supporting materials needed to process incentive payments.' },
      { id: 'signed-incentive-agreement', name: 'Signed Incentive Agreement', required: false, description: 'The signed agreement outlining the terms and conditions of any incentives or rebates applied to the vehicle purchase. This document confirms both parties agree to the incentive terms.' },
      { id: 'supporting-emails', name: 'Supporting Emails', required: false, description: 'Email correspondence related to the vehicle order that provides additional context or documentation. These emails may contain approvals, confirmations, or important communications about the deal.' },
      { id: 'additional-documents-general', name: 'Additional Documents', required: false, description: 'Any other documents related to the vehicle order that do not fit into the standard categories. Use this for miscellaneous paperwork that may be relevant to the deal.' },
    ]
  },
  'Accounting': {
    documents: [
      { id: 'customer-payment-remittance', name: 'Customer Payment Remittance', required: true, description: 'Documentation showing that the customer has made payment for the vehicle. This includes payment confirmations, wire transfer receipts, or check images that verify payment has been received.' },
      { id: 'floorplan-payoff-confirmation', name: 'Floorplan Payoff Confirmation', required: true, description: 'Confirmation that the floorplan financing for the vehicle has been paid off. This document is required to clear the vehicle from floorplan and transfer ownership.' },
      { id: 'proof-of-processing', name: 'Proof of Processing', required: false, description: 'Documentation showing that financial transactions related to the vehicle sale have been processed. This may include bank statements or processing confirmations.' },
      { id: 'upfitting-invoice', name: 'Upfitting Invoice / Vendor Bills', required: false, description: 'Invoices from vendors for upfitting work, parts, or services performed on the vehicle. These documents are needed for accounting and cost tracking purposes.' },
      { id: 'additional-documents-accounting', name: 'Additional Documents', required: false, description: 'Any additional accounting-related documents for the vehicle order. Use this for miscellaneous financial paperwork that may be relevant to the transaction.' },
    ]
  },
  'Finance': {
    documents: [
      { id: 'installment-contract', name: 'Installment Contract', required: false, description: 'The financing contract that outlines the terms of the vehicle loan including payment schedule, interest rate, and loan duration. This document establishes the financing agreement between the customer and lender.' },
      { id: 'agreement-to-provide-insurance', name: 'Agreement to Provide Insurance', required: false, description: 'Document confirming that the customer agrees to maintain appropriate insurance coverage on the vehicle. This is typically required for financed vehicles to protect the lender\'s interest.' },
      { id: 'corporate-llc-resolution', name: 'Corporate or LLC Resolution to Sign', required: false, description: 'Corporate resolution document authorizing a specific individual to sign financing documents on behalf of a corporation or LLC. This document establishes signing authority for business entities.' },
      { id: 'notice-to-cosigner', name: 'Notice to Co-signer', required: false, description: 'Legal notice provided to any co-signers on the financing agreement. This document informs co-signers of their obligations and rights regarding the vehicle loan.' },
      { id: 'final-approval-barcode', name: 'Final Approval with Barcode', required: false, description: 'Final financing approval document that includes a barcode for tracking purposes. This document confirms the loan has been fully approved and is ready for funding.' },
      { id: 'third-party-guaranty', name: 'Third Party Guaranty', required: false, description: 'Document where a third party agrees to guarantee the vehicle loan. This provides additional security for the lender by having another party responsible for the debt if the primary borrower defaults.' },
      { id: 'credit-application', name: 'Credit Application', required: false, description: 'The customer\'s credit application containing financial information used to evaluate creditworthiness. This document includes income, employment, and credit history details.' },
      { id: 'credit-approval', name: 'Credit Approval', required: false, description: 'Document confirming that the customer has been approved for financing. This includes the approved loan amount, terms, and any conditions that must be met before funding.' },
      { id: 'additional-documents-finance', name: 'Additional Documents', required: false, description: 'Any additional finance-related documents for the vehicle order. Use this for miscellaneous financing paperwork that may be relevant to the loan process.' },
    ]
  },
  'Tax, Title & License (TTL)': {
    documents: [
      { id: 'notarized-mso-title', name: 'Notarized Manufacturer\'s Sale of Origin (MSO) / Title', required: true, description: 'The notarized Manufacturer\'s Statement of Origin or title document that establishes ownership of the vehicle. This is a critical document required for vehicle registration and title transfer.' },
      { id: 'copy-shipping-label-mso', name: 'Copy of Shipping Label for MSO', required: false, description: 'A copy of the shipping label used when sending the MSO or title document. This helps track the document during shipping and provides proof of mailing.' },
      { id: 'ttl-quote-request', name: 'TTL Quote Request', required: false, description: 'Request for a quote on tax, title, and license fees for the vehicle. This document initiates the process of calculating registration costs and fees.' },
    ]
  },
  'Registration': {
    documents: [
      { id: 'power-of-attorney', name: 'Power of Attorney', required: false, description: 'Legal document authorizing another party to handle vehicle registration on behalf of the owner. This is often used when the dealer or a third party processes registration paperwork.' },
      { id: 'lienholder-info', name: 'Lienholder Info', required: false, description: 'Information about the lienholder (lender) that will be listed on the vehicle title. This includes the lender\'s name, address, and account information for title processing.' },
      { id: 'state-inspections', name: 'State Inspections', required: false, description: 'Documentation showing that the vehicle has passed required state inspections. Some states require safety or emissions inspections before registration can be completed.' },
      { id: 'federal-id-number', name: 'Federal ID Number', required: false, description: 'The federal tax identification number (EIN) for business customers or SSN for individual customers. This is required for tax purposes and vehicle registration in some jurisdictions.' },
      { id: 'proof-of-insurance', name: 'Proof of Insurance', required: false, description: 'Documentation proving that the vehicle is covered by an active insurance policy. Most states require proof of insurance before vehicle registration can be completed.' },
      { id: 'photocopy-physical-plates', name: 'Photocopy of Physical Plates', required: false, description: 'A photocopy of the physical license plates if transferring plates from another vehicle. This document helps verify plate eligibility and transfer requirements.' },
      { id: 'registration-submission-paperwork', name: 'Registration Submission Paperwork', required: false, description: 'All paperwork submitted to the DMV or registration office for vehicle registration. This includes completed registration forms and supporting documentation.' },
      { id: 'copy-shipping-label-plates', name: 'Copy of Shipping Label for Plates', required: false, description: 'A copy of the shipping label used when sending license plates. This helps track the plates during shipping and provides proof of mailing.' },
      { id: 'odometer-statement', name: 'Odometer Statement', required: false, description: 'Document declaring the current odometer reading at the time of sale. This is required by federal law to prevent odometer fraud and must be completed for vehicles under 10 years old.' },
      { id: 'additional-documents-registration', name: 'Additional Documents', required: false, description: 'Any additional registration-related documents for the vehicle order. Use this for miscellaneous registration paperwork that may be relevant to the vehicle registration process.' },
    ]
  },
  'Logistics': {
    documents: [
      { id: 'logistics-quote-request', name: 'Logistics Quote Request', required: false, description: 'Request for a quote on vehicle transportation and logistics services. This document initiates the process of obtaining shipping costs and delivery options for the vehicle.' },
      { id: 'signed-bill-of-lading', name: 'Signed Bill of Lading', required: false, description: 'The signed bill of lading that serves as a receipt for the vehicle shipment and a contract between the shipper and carrier. This document confirms the vehicle has been received for transport and outlines delivery terms.' },
      { id: 'additional-documents-logistics', name: 'Additional Documents', required: false, description: 'Any additional logistics-related documents for the vehicle order. Use this for miscellaneous shipping and transportation paperwork that may be relevant to vehicle delivery.' },
    ]
  },
}

// PaperX Component
function PaperX() {
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const handleFiles = async (files) => {
    setIsProcessing(true)
    
    // Simulate AI processing
    for (const file of Array.from(files)) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Simulate AI classification
      const documentTypes = Object.values(DOCUMENT_CATEGORIES)
        .flatMap(cat => cat.documents)
        .map(doc => doc.name)
      
      const randomType = documentTypes[Math.floor(Math.random() * documentTypes.length)]
      const randomOrderId = `ord_${Math.random().toString(36).slice(2, 8)}`
      
      const processedFile = {
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        classifiedAs: randomType,
        assignedToOrder: randomOrderId,
        status: 'classified',
      }
      
      setUploadedFiles(prev => [...prev, processedFile])
      
      // Save to localStorage
      const allUploads = readLocal('paperxUploads', [])
      allUploads.push(processedFile)
      writeLocal('paperxUploads', allUploads)
      
      toast.success(`Document "${file.name}" classified as "${randomType}" and filed to order ${randomOrderId}`)
    }
    
    setIsProcessing(false)
  }

  // Load existing uploads
  useEffect(() => {
    const uploads = readLocal('paperxUploads', [])
    setUploadedFiles(uploads)
  }, [])

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            PaperX - AI Document Classification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs sm:text-sm text-gray-600">
            Upload any documents and our AI will automatically classify them by document type and file them to the appropriate deal.
          </p>
          
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 sm:p-6 md:p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 mx-auto mb-3 sm:mb-4 text-gray-400" />
            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 px-2">
              Drag and drop documents here, or click to browse
            </p>
            <p className="text-xs text-gray-500 mb-3 sm:mb-4">
              Supports PDF, Word, Excel, Images, and more
            </p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              onChange={handleFileInput}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
            />
            <Button
              variant="outline"
              size="sm"
              className="sm:size-default"
              onClick={() => document.getElementById('file-upload').click()}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Browse Files'}
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
            {/* Documents Processed */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col items-center justify-center text-center">
                  <p className="text-sm sm:text-base text-gray-600 mb-2">Documents Processed</p>
                  <p className="text-3xl sm:text-4xl font-bold">79,834</p>
                </div>
              </CardContent>
            </Card>

            {/* Files Uploaded */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col items-center justify-center text-center">
                  <p className="text-sm sm:text-base text-gray-600 mb-2">Files Uploaded</p>
                  <p className="text-3xl sm:text-4xl font-bold">11,039</p>
                </div>
              </CardContent>
            </Card>

            {/* Total Requests */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col items-center justify-center text-center">
                  <p className="text-sm sm:text-base text-gray-600 mb-2">Total Requests</p>
                  <p className="text-3xl sm:text-4xl font-bold">1,683</p>
                </div>
              </CardContent>
            </Card>

            {/* Success Rate */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col items-center justify-center text-center">
                  <p className="text-sm sm:text-base text-gray-600 mb-2">Success Rate</p>
                  <p className="text-3xl sm:text-4xl font-bold">{(100 - (112 / 79834) * 100).toFixed(2)}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 flex-shrink-0"></div>
              <span className="break-words">AI is analyzing and classifying your documents...</span>
            </div>
          )}

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Recently Processed Documents</h3>
              <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                {uploadedFiles.slice().reverse().map((file) => (
                  <Card key={file.id} className="p-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-xs sm:text-sm font-medium truncate">{file.name}</span>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1 pl-6 sm:pl-0">
                          <div className="break-words">Classified as: <span className="font-medium text-gray-700">{file.classifiedAs}</span></div>
                          <div>Filed to: <Link to={`/documentation/deal-jacket/${file.assignedToOrder}`} className="text-blue-600 hover:underline break-all" onClick={(e) => e.stopPropagation()}>{file.assignedToOrder}</Link></div>
                          <div>Uploaded: <span className="whitespace-nowrap">{new Date(file.uploadedAt).toLocaleString()}</span></div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0 self-start sm:self-auto">
                        {file.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Deal Jacket List Component
function DealJacketList() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    try {
      const data = await getOrders()
      setOrders(data.orders || [])
    } catch (err) {
      console.error('Failed to load orders:', err)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders
    const q = searchQuery.toLowerCase()
    return orders.filter(o => 
      o.id?.toLowerCase().includes(q) ||
      o.stockNumber?.toLowerCase().includes(q) ||
      o.buyerName?.toLowerCase().includes(q) ||
      o.vin?.toLowerCase().includes(q)
    )
  }, [orders, searchQuery])

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Input
          placeholder="Search orders by ID, stock number, buyer, or VIN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 w-full"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 text-sm sm:text-base">
            {searchQuery ? 'No orders found matching your search.' : 'No orders available.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredOrders.map((order) => (
            <Card 
              key={order.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/documentation/deal-jacket/${order.id}`)}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link 
                      to={`/documentation/deal-jacket/${order.id}`}
                      className="text-blue-600 hover:text-blue-700 font-semibold text-sm sm:text-base truncate flex-1 min-w-0 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {order.id}
                    </Link>
                    <Badge variant="secondary" className="flex-shrink-0 text-xs">Active</Badge>
                  </div>
                  {order.stockNumber && (
                    <div className="text-xs sm:text-sm text-gray-600 break-words">Stock #: {order.stockNumber}</div>
                  )}
                  {order.buyerName && (
                    <div className="text-xs sm:text-sm text-gray-600 break-words">Buyer: {order.buyerName}</div>
                  )}
                  {order.vin && (
                    <div className="text-xs sm:text-sm text-gray-600 break-all">VIN: {order.vin}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    Created: {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper function to format currency
const fmt = (n) => `$${Math.round(n || 0).toLocaleString()}`

// Helper function to format date
const fmtDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return dateStr
  }
}

// Helper function to format date and time
const fmtDateTime = (dateStr) => {
  if (!dateStr) return 'N/A'
  try {
    return new Date(dateStr).toLocaleString()
  } catch {
    return dateStr
  }
}

// Helper function to generate customer contact information
function getCustomerInfo(buyerName, orderId) {
  if (!buyerName) {
    return {
      name: 'N/A',
      contactPerson: 'N/A',
      email: 'N/A',
      phone: 'N/A',
      address: 'N/A',
      city: 'N/A',
      state: 'N/A',
      zip: 'N/A'
    }
  }
  
  // Generate consistent contact info based on buyer name
  const nameParts = buyerName.split(' ')
  const firstName = nameParts[0] || 'Contact'
  const emailDomain = buyerName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  
  // Generate consistent address based on order ID hash
  const addressNum = (orderId?.charCodeAt(orderId.length - 1) || 0) % 900 + 100
  const states = ['CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI']
  const stateIndex = (orderId?.charCodeAt(0) || 0) % states.length
  const cities = ['Los Angeles', 'Houston', 'Miami', 'New York', 'Chicago', 'Philadelphia', 'Columbus', 'Atlanta', 'Charlotte', 'Detroit']
  const city = cities[stateIndex]
  
  return {
    name: buyerName,
    contactPerson: firstName,
    email: `contact@${emailDomain}.com`,
    phone: `(555) ${123 + (orderId?.charCodeAt(0) || 0) % 900}-${4567 + (orderId?.charCodeAt(orderId.length - 1) || 0) % 9000}`,
    address: `${addressNum} Main Street`,
    city: city,
    state: states[stateIndex],
    zip: `${10000 + (orderId?.charCodeAt(0) || 0) % 90000}`
  }
}

// Helper function to generate dealer information
function getDealerInfo(dealerCode) {
  if (!dealerCode) {
    return {
      code: 'N/A',
      name: 'N/A',
      salesRep: 'N/A',
      email: 'N/A',
      phone: 'N/A',
      address: 'N/A'
    }
  }
  
  return {
    code: dealerCode,
    name: `Ford Commercial Vehicle Center ${dealerCode}`,
    salesRep: `Sales Rep ${dealerCode}`,
    email: `sales@${dealerCode.toLowerCase()}.com`,
    phone: `(555) ${234 + (dealerCode.charCodeAt(dealerCode.length - 1) || 0) % 900}-${5678 + (dealerCode.charCodeAt(0) || 0) % 9000}`,
    address: '123 Commercial Vehicle Way, Detroit, MI 48201'
  }
}

// Helper function to generate upfitter information
function getUpfitterInfo(upfitter) {
  if (!upfitter || !upfitter.name) {
    return {
      name: 'N/A',
      contact: 'N/A',
      email: 'N/A',
      phone: 'N/A',
      address: 'N/A'
    }
  }
  
  const nameParts = upfitter.name.split(' ')
  const firstName = nameParts[0] || 'Contact'
  const upfitterId = upfitter.id || upfitter.name.toLowerCase().replace(/\s+/g, '-')
  
  return {
    name: upfitter.name,
    contact: firstName,
    email: `contact@${upfitterId}.com`,
    phone: upfitter.phone || `(555) ${345 + (upfitterId.charCodeAt(0) || 0) % 900}-${6789 + (upfitterId.charCodeAt(upfitterId.length - 1) || 0) % 9000}`,
    address: upfitter.address || `${upfitter.name.split(' - ')[1] || 'Detroit, MI'}`
  }
}

// Function to generate document-specific content based on document type
function generateDocumentContent(documentId, documentName, order) {
  const build = order?.buildJson || {}
  const pricing = order?.pricingJson || {}
  const chassis = build?.chassis || {}
  const bodySpecs = build?.bodySpecs || {}
  const upfitter = build?.upfitter || {}
  
  // Get customer, dealer, and upfitter information
  const customer = getCustomerInfo(order?.buyerName, order?.id)
  const dealer = getDealerInfo(order?.dealerCode)
  const upfitterInfo = getUpfitterInfo(upfitter)
  
  // Format body specs entries
  const bodySpecEntries = Object.entries(bodySpecs)
    .filter(([k, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
      return `<div class="row"><span>${label}</span><span>${String(v)}</span></div>`
    }).join('')

  // Generate content based on document type
  let content = ''

  switch (documentId) {
    case 'customer-approved-spec-quote':
    case 'deal-recap':
      content = `
        <div class="card">
          <h2>Order Information</h2>
          <div class="row"><span>Deal #</span><span>${order?.id || 'N/A'}</span></div>
          <div class="row"><span>Stock #</span><span>${order?.stockNumber || 'N/A'}</span></div>
          <div class="row"><span>Order Date</span><span>${fmtDate(order?.createdAt)}</span></div>
          <div class="row"><span>Status</span><span>${order?.status || 'N/A'}</span></div>
        </div>

        <div class="card">
          <h2>Customer Information</h2>
          <div class="row"><span>Customer Name</span><span>${customer.name}</span></div>
          <div class="row"><span>Contact Person</span><span>${customer.contactPerson}</span></div>
          <div class="row"><span>Email</span><span>${customer.email}</span></div>
          <div class="row"><span>Phone</span><span>${customer.phone}</span></div>
          <div class="row"><span>Address</span><span>${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}</span></div>
        </div>

        <div class="card">
          <h2>Dealer Information</h2>
          <div class="row"><span>Dealer Name</span><span>${dealer.name}</span></div>
          <div class="row"><span>Sales Representative</span><span>${dealer.salesRep}</span></div>
          <div class="row"><span>Email</span><span>${dealer.email}</span></div>
          <div class="row"><span>Phone</span><span>${dealer.phone}</span></div>
        </div>

        <div class="card">
          <h2>Chassis Specifications</h2>
          <div class="row"><span>Series</span><span>${chassis?.series || '—'}</span></div>
          <div class="row"><span>Cab</span><span>${chassis?.cab || '—'}</span></div>
          <div class="row"><span>Drivetrain</span><span>${chassis?.drivetrain || '—'}</span></div>
          <div class="row"><span>Wheelbase</span><span>${chassis?.wheelbase ? chassis.wheelbase + '"' : '—'}</span></div>
          <div class="row"><span>Powertrain</span><span>${chassis?.powertrain || '—'}</span></div>
          <div class="row"><span>GVWR</span><span>${chassis?.gvwr || '—'}</span></div>
        </div>

        <div class="card">
          <h2>Body Specifications</h2>
          <div class="row"><span>Body Type</span><span>${build?.bodyType || '—'}</span></div>
          <div class="row"><span>Manufacturer</span><span>${build?.manufacturer || '—'}</span></div>
          ${bodySpecEntries || '<div class="muted">No body specifications available.</div>'}
        </div>

        <div class="card">
          <h2>Upfitter/Installer</h2>
          <div class="row"><span>Name</span><span>${upfitterInfo.name}</span></div>
          <div class="row"><span>Contact Person</span><span>${upfitterInfo.contact}</span></div>
          <div class="row"><span>Email</span><span>${upfitterInfo.email}</span></div>
          <div class="row"><span>Phone</span><span>${upfitterInfo.phone}</span></div>
          <div class="row"><span>Address</span><span>${upfitterInfo.address}</span></div>
        </div>

        <div class="card">
          <h2>Pricing Summary</h2>
          <div class="row"><span>Chassis MSRP</span><span class="amount">${fmt(pricing?.chassisMsrp || pricing?.chassisMSRP)}</span></div>
          <div class="row"><span>Body & Equipment</span><span class="amount">${fmt(pricing?.bodyPrice)}</span></div>
          ${pricing?.optionsPrice ? `<div class="row"><span>Options</span><span class="amount">${fmt(pricing.optionsPrice)}</span></div>` : ''}
          <div class="row"><span>Labor/Install</span><span class="amount">${fmt(pricing?.labor || pricing?.laborPrice)}</span></div>
          <div class="row"><span>Freight & Delivery</span><span class="amount">${fmt(pricing?.freight)}</span></div>
          ${pricing?.subtotal ? `<div class="row"><span>Subtotal</span><span class="amount">${fmt(pricing.subtotal)}</span></div>` : ''}
          ${pricing?.totalIncentives || (pricing?.incentives && pricing.incentives.length > 0) ? `<div class="row"><span>Incentives</span><span class="amount">-${fmt(pricing?.totalIncentives || 0)}</span></div>` : ''}
          <div class="row"><span>Taxes</span><span class="amount">${fmt(pricing?.taxes)}</span></div>
          <div class="row tot"><span>Total</span><span class="amount">${fmt(pricing?.total)}</span></div>
        </div>
      `
      break

    case 'customer-po':
    case 'purchase-agreement':
      content = `
        <div class="card">
          <h2>Purchase Order Information</h2>
          <div class="row"><span>PO Number</span><span>${order?.stockNumber || order?.id || 'N/A'}</span></div>
          <div class="row"><span>Deal #</span><span>${order?.id || 'N/A'}</span></div>
          <div class="row"><span>Order Date</span><span>${fmtDate(order?.createdAt)}</span></div>
          <div class="row"><span>Dealer Code</span><span>${order?.dealerCode || 'N/A'}</span></div>
        </div>

        <div class="card">
          <h2>Customer Information</h2>
          <div class="row"><span>Customer Name</span><span>${customer.name}</span></div>
          <div class="row"><span>Contact Person</span><span>${customer.contactPerson}</span></div>
          <div class="row"><span>Email</span><span>${customer.email}</span></div>
          <div class="row"><span>Phone</span><span>${customer.phone}</span></div>
          <div class="row"><span>Shipping Address</span><span>${customer.address}</span></div>
          <div class="row"><span>City, State ZIP</span><span>${customer.city}, ${customer.state} ${customer.zip}</span></div>
        </div>

        <div class="card">
          <h2>Dealer Information</h2>
          <div class="row"><span>Dealer Name</span><span>${dealer.name}</span></div>
          <div class="row"><span>Sales Representative</span><span>${dealer.salesRep}</span></div>
          <div class="row"><span>Email</span><span>${dealer.email}</span></div>
          <div class="row"><span>Phone</span><span>${dealer.phone}</span></div>
          <div class="row"><span>Address</span><span>${dealer.address}</span></div>
        </div>

        <div class="card">
          <h2>Vehicle Information</h2>
          <div class="row"><span>Make</span><span>Ford</span></div>
          <div class="row"><span>Model</span><span>${chassis?.series || 'N/A'}</span></div>
          <div class="row"><span>VIN</span><span>${order?.vin || 'Pending'}</span></div>
          <div class="row"><span>Stock #</span><span>${order?.stockNumber || 'N/A'}</span></div>
          <div class="row"><span>Cab</span><span>${chassis?.cab || '—'}</span></div>
          <div class="row"><span>Drivetrain</span><span>${chassis?.drivetrain || '—'}</span></div>
          <div class="row"><span>Wheelbase</span><span>${chassis?.wheelbase ? chassis.wheelbase + '"' : '—'}</span></div>
        </div>

        <div class="card">
          <h2>Pricing</h2>
          <div class="row"><span>Chassis MSRP</span><span class="amount">${fmt(pricing?.chassisMsrp || pricing?.chassisMSRP)}</span></div>
          <div class="row"><span>Body & Equipment</span><span class="amount">${fmt(pricing?.bodyPrice)}</span></div>
          ${pricing?.optionsPrice ? `<div class="row"><span>Options</span><span class="amount">${fmt(pricing.optionsPrice)}</span></div>` : ''}
          <div class="row"><span>Labor/Install</span><span class="amount">${fmt(pricing?.labor || pricing?.laborPrice)}</span></div>
          <div class="row"><span>Freight & Delivery</span><span class="amount">${fmt(pricing?.freight)}</span></div>
          ${pricing?.subtotal ? `<div class="row"><span>Subtotal</span><span class="amount">${fmt(pricing.subtotal)}</span></div>` : ''}
          ${pricing?.totalIncentives || (pricing?.incentives && pricing.incentives.length > 0) ? `<div class="row"><span>Incentives</span><span class="amount">-${fmt(pricing?.totalIncentives || 0)}</span></div>` : ''}
          <div class="row"><span>Taxes</span><span class="amount">${fmt(pricing?.taxes)}</span></div>
          <div class="row tot"><span>Total Amount</span><span class="amount">${fmt(pricing?.total)}</span></div>
        </div>
      `
      break

    case 'oem-factory-invoice':
      content = `
        <div class="card">
          <h2>Factory Invoice Information</h2>
          <div class="row"><span>Invoice Number</span><span>INV-${order?.id?.toUpperCase() || 'N/A'}</span></div>
          <div class="row"><span>Deal #</span><span>${order?.id || 'N/A'}</span></div>
          <div class="row"><span>Invoice Date</span><span>${fmtDate(order?.actualOemCompleted || order?.oemEta || order?.createdAt)}</span></div>
        </div>

        <div class="card">
          <h2>Dealer Information</h2>
          <div class="row"><span>Dealer Name</span><span>${dealer.name}</span></div>
          <div class="row"><span>Dealer Code</span><span>${dealer.code}</span></div>
          <div class="row"><span>Address</span><span>${dealer.address}</span></div>
          <div class="row"><span>Contact</span><span>${dealer.salesRep}</span></div>
          <div class="row"><span>Email</span><span>${dealer.email}</span></div>
          <div class="row"><span>Phone</span><span>${dealer.phone}</span></div>
        </div>

        <div class="card">
          <h2>Vehicle Information</h2>
          <div class="row"><span>VIN</span><span>${order?.vin || 'Pending'}</span></div>
          <div class="row"><span>Make</span><span>Ford</span></div>
          <div class="row"><span>Model</span><span>${chassis?.series || 'N/A'}</span></div>
          <div class="row"><span>Stock #</span><span>${order?.stockNumber || 'N/A'}</span></div>
          <div class="row"><span>Cab</span><span>${chassis?.cab || '—'}</span></div>
          <div class="row"><span>Drivetrain</span><span>${chassis?.drivetrain || '—'}</span></div>
        </div>

        <div class="card">
          <h2>Invoice Details</h2>
          <div class="row"><span>Chassis MSRP</span><span class="amount">${fmt(pricing?.chassisMsrp || pricing?.chassisMSRP)}</span></div>
          <div class="row"><span>Freight</span><span class="amount">${fmt(pricing?.freight)}</span></div>
          <div class="row tot"><span>Total Due</span><span class="amount">${fmt((pricing?.chassisMsrp || pricing?.chassisMSRP || 0) + (pricing?.freight || 0))}</span></div>
        </div>
      `
      break

    case 'oem-price-order-confirmation':
      content = `
        <div class="card">
          <h2>Order Confirmation</h2>
          <div class="row"><span>Confirmation #</span><span>${order?.id || 'N/A'}</span></div>
          <div class="row"><span>Deal #</span><span>${order?.id || 'N/A'}</span></div>
          <div class="row"><span>Order Date</span><span>${fmtDate(order?.createdAt)}</span></div>
          <div class="row"><span>Dealer Code</span><span>${order?.dealerCode || 'N/A'}</span></div>
        </div>

        <div class="card">
          <h2>Vehicle Configuration</h2>
          <div class="row"><span>Series</span><span>${chassis?.series || '—'}</span></div>
          <div class="row"><span>Cab</span><span>${chassis?.cab || '—'}</span></div>
          <div class="row"><span>Drivetrain</span><span>${chassis?.drivetrain || '—'}</span></div>
          <div class="row"><span>Wheelbase</span><span>${chassis?.wheelbase ? chassis.wheelbase + '"' : '—'}</span></div>
        </div>

        <div class="card">
          <h2>Pricing Confirmation</h2>
          <div class="row"><span>Chassis MSRP</span><span class="amount">${fmt(pricing?.chassisMsrp || pricing?.chassisMSRP)}</span></div>
          <div class="row"><span>Estimated Delivery</span><span>${fmtDate(order?.oemEta)}</span></div>
        </div>
      `
      break

    case 'customer-payment-remittance':
      content = `
        <div class="card">
          <h2>Payment Information</h2>
          <div class="row"><span>Deal #</span><span>${order?.id || 'N/A'}</span></div>
          <div class="row"><span>Payment Date</span><span>${fmtDate(order?.createdAt)}</span></div>
          <div class="row"><span>Amount Due</span><span class="amount">${fmt(pricing?.total)}</span></div>
        </div>

        <div class="card">
          <h2>Customer Information</h2>
          <div class="row"><span>Customer Name</span><span>${customer.name}</span></div>
          <div class="row"><span>Contact Person</span><span>${customer.contactPerson}</span></div>
          <div class="row"><span>Email</span><span>${customer.email}</span></div>
          <div class="row"><span>Phone</span><span>${customer.phone}</span></div>
          <div class="row"><span>Billing Address</span><span>${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}</span></div>
        </div>

        <div class="card">
          <h2>Payment Details</h2>
          <div class="row"><span>Invoice Total</span><span class="amount">${fmt(pricing?.total)}</span></div>
          <div class="row"><span>Payment Status</span><span>Received</span></div>
          <div class="row"><span>Payment Method</span><span>Wire Transfer</span></div>
          <div class="row"><span>Reference Number</span><span>PAY-${order?.id?.toUpperCase() || 'N/A'}</span></div>
        </div>
      `
      break

    case 'notarized-mso-title':
      content = `
        <div class="card">
          <h2>Title Information</h2>
          <div class="row"><span>VIN</span><span>${order?.vin || 'Pending'}</span></div>
          <div class="row"><span>Make</span><span>Ford</span></div>
          <div class="row"><span>Model</span><span>${chassis?.series || 'N/A'}</span></div>
          <div class="row"><span>Model Year</span><span>${new Date(order?.createdAt || Date.now()).getFullYear()}</span></div>
          <div class="row"><span>Stock #</span><span>${order?.stockNumber || 'N/A'}</span></div>
        </div>

        <div class="card">
          <h2>Owner Information</h2>
          <div class="row"><span>Owner Name</span><span>${customer.name}</span></div>
          <div class="row"><span>Deal #</span><span>${order?.id || 'N/A'}</span></div>
          <div class="row"><span>Address</span><span>${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}</span></div>
          <div class="row"><span>Phone</span><span>${customer.phone}</span></div>
        </div>
      `
      break

    default:
      // Generic document content
      content = `
        <div class="card">
          <h2>Order Information</h2>
          <div class="row"><span>Deal #</span><span>${order?.id || 'N/A'}</span></div>
          <div class="row"><span>Stock #</span><span>${order?.stockNumber || 'N/A'}</span></div>
          <div class="row"><span>Customer Name</span><span>${order?.buyerName || 'N/A'}</span></div>
          <div class="row"><span>Dealer Code</span><span>${order?.dealerCode || 'N/A'}</span></div>
          <div class="row"><span>Order Date</span><span>${fmtDate(order?.createdAt)}</span></div>
          <div class="row"><span>Status</span><span>${order?.status || 'N/A'}</span></div>
        </div>

        <div class="card">
          <h2>Vehicle Information</h2>
          <div class="row"><span>Make</span><span>Ford</span></div>
          <div class="row"><span>Model</span><span>${chassis?.series || 'N/A'}</span></div>
          <div class="row"><span>VIN</span><span>${order?.vin || 'Pending'}</span></div>
        </div>

        <div class="card">
          <h2>Document Details</h2>
          <div class="row"><span>Document Type</span><span>${documentName}</span></div>
          <div class="row"><span>Generated Date</span><span>${fmtDate(new Date().toISOString())}</span></div>
          <div class="row"><span>Reference Number</span><span>${order?.id || 'N/A'}</span></div>
        </div>
      `
  }

  return content
}

// Function to generate and download a PDF (matching configurator format)
async function generateDemoPDF(documentName, fileName, order, documentId) {
  // Fetch and convert logo to base64 data URL (same as configurator)
  let logoDataUrl = ''
  try {
    const logoUrl = '/SHAED Logo.png'
    const response = await fetch(logoUrl)
    if (response.ok) {
      const blob = await response.blob()
      const reader = new FileReader()
      logoDataUrl = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }
  } catch (error) {
    console.warn('Could not load SHAED logo:', error)
  }

  // Generate document-specific content
  const documentContent = generateDocumentContent(documentId, documentName, order || {})

  // Create HTML document matching configurator format
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${documentName}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color:#111827; }
        h1 { font-size: 22px; margin: 8px 0 8px 0; }
        h2 { font-size: 16px; margin: 16px 0 6px; }
        .row { display:flex; justify-content: space-between; margin: 4px 0; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 10px 0; }
        .tot { font-weight: 700; font-size: 18px; }
        .muted { color:#6b7280 }
        .header { display:flex; align-items:center; justify-content: space-between; gap:12px; }
        .logo { height:64px; width:auto; object-fit:contain; }
        .amount { min-width: 140px; text-align: right; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${documentName}</h1>
        ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="SHAED Logo" />` : ''}
      </div>
      <div class="muted">Date: ${new Date().toLocaleDateString()}</div>
      ${order?.id ? `<div class="muted">Deal #: ${order.id}</div>` : ''}

      ${documentContent}
      <script>
        window.onload = () => {
          window.print();
          setTimeout(() => window.close(), 500);
        };
      </script>
    </body>
  </html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  return { success: !!win, filename: fileName || `${documentName.replace(/\s+/g, '_')}.pdf` }
}

// Document Upload Card Component
function DocumentUploadCard({ document, orderId, onUpload, order }) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file) => {
    const fileData = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      documentId: document.id,
      documentName: document.name,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: new Date().toISOString(),
      orderId,
    }
    
    setUploadedFile(fileData)
    
    // Save to localStorage
    const allDocuments = readLocal('dealJacketDocuments', [])
    allDocuments.push(fileData)
    writeLocal('dealJacketDocuments', allDocuments)
    
    if (onUpload) onUpload(fileData)
    
    toast.success(`Document "${document.name}" uploaded successfully`)
  }

  const handleDownload = async (e) => {
    e.stopPropagation()
    if (uploadedFile) {
      try {
        await generateDemoPDF(uploadedFile.documentName, uploadedFile.fileName, order, uploadedFile.documentId)
        toast.success(`Generating PDF for ${uploadedFile.documentName}`)
      } catch (error) {
        console.error('Error generating PDF:', error)
        toast.error('Failed to generate PDF')
      }
    }
  }

  // Load existing upload for this document
  useEffect(() => {
    const allDocuments = readLocal('dealJacketDocuments', [])
    const existing = allDocuments.find(
      doc => doc.orderId === orderId && doc.documentId === document.id
    )
    if (existing) {
      setUploadedFile(existing)
    }
  }, [orderId, document.id])

  const isRequired = document.required
  const hasFile = uploadedFile !== null

  return (
    <Card className="border-gray-200">
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              {document.description ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex-shrink-0 mt-0.5 cursor-pointer hover:text-gray-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="h-4 w-4 text-gray-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3 text-sm" onClick={(e) => e.stopPropagation()}>
                    <p className="text-gray-700 leading-relaxed">{document.description}</p>
                  </PopoverContent>
                </Popover>
              ) : (
                <Info className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
              )}
              <span className="text-xs sm:text-sm font-medium break-words flex-1">{document.name}</span>
            </div>
            <div className="flex items-center gap-1.5 pl-6">
              {isRequired && (
                <Badge variant="destructive" className="text-xs whitespace-nowrap">Required</Badge>
              )}
              {hasFile && (
                <Badge variant="default" className="text-xs bg-green-600 whitespace-nowrap">Uploaded</Badge>
              )}
            </div>
          </div>
          
          <div
            className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors ${
              isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            } ${!hasFile ? 'cursor-pointer' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!hasFile) {
                const input = document.getElementById(`file-input-${document.id}`)
                if (input) input.click()
              }
            }}
          >
            <File className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-gray-400" />
            {!hasFile ? (
              <>
                <p className="text-xs text-gray-600 mb-1">Drag and drop or <span className="text-blue-600 underline">browse</span></p>
                <input
                  type="file"
                  id={`file-input-${document.id}`}
                  className="hidden"
                  onChange={handleFileInput}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                />
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 mb-1">Drag and drop or <span className="text-blue-600 underline">browse</span></p>
                <div className="mt-2 text-xs text-green-700 font-medium break-words px-2">
                  {uploadedFile.fileName}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleDownload}
                >
                  <Download className="h-3 w-3 mr-1.5" />
                  Download
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Document Category Section Component
function DocumentCategorySection({ category, documents, orderId, onUpload, searchQuery = '', order = null }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Filter documents based on search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents
    const q = searchQuery.toLowerCase()
    return documents.filter(doc => 
      doc.name.toLowerCase().includes(q) ||
      category.toLowerCase().includes(q)
    )
  }, [documents, searchQuery, category])
  
  const requiredCount = filteredDocuments.filter(d => d.required).length
  const uploadedCount = filteredDocuments.filter(d => {
    const allDocuments = readLocal('dealJacketDocuments', [])
    return allDocuments.some(doc => doc.orderId === orderId && doc.documentId === d.id)
  }).length
  
  // Don't render the section if no documents match the search
  if (filteredDocuments.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader 
        className="pb-3 sm:pb-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base truncate">{category}</CardTitle>
          <div className="flex items-center">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredDocuments.map((doc) => (
              <DocumentUploadCard
                key={doc.id}
                document={doc}
                orderId={orderId}
                onUpload={onUpload}
                order={order}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Deal Jacket Detail Component
function DealJacketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isDealInfoExpanded, setIsDealInfoExpanded] = useState(false) // Default to collapsed

  useEffect(() => {
    loadOrder()
    loadDocuments()
    ensureDemoDocuments()
  }, [id])

  async function loadOrder() {
    setLoading(true)
    try {
      const orders = readLocal('orders', [])
      const foundOrder = orders.find(o => o.id === id)
      if (foundOrder) {
        setOrder(foundOrder)
      } else {
        toast.error('Order not found')
        navigate('/documentation?tab=deal-jacket')
      }
    } catch (err) {
      console.error('Failed to load order:', err)
      toast.error('Failed to load order')
      navigate('/documentation?tab=deal-jacket')
    } finally {
      setLoading(false)
    }
  }

  function loadDocuments() {
    const allDocuments = readLocal('dealJacketDocuments', [])
    const orderDocuments = allDocuments.filter(doc => doc.orderId === id)
    setDocuments(orderDocuments)
  }

  function ensureDemoDocuments() {
    if (!id) return
    
    const allDocuments = readLocal('dealJacketDocuments', [])
    const orderDocuments = allDocuments.filter(doc => doc.orderId === id)
    
    // If no documents exist for this order, create demo documents
    if (orderDocuments.length === 0) {
      const demoDocuments = []
      
      // Get a subset of documents to mark as uploaded (about 30-40% of required docs)
      const allRequiredDocs = Object.values(DOCUMENT_CATEGORIES)
        .flatMap(cat => cat.documents.filter(d => d.required))
      
      // Select some required documents to have uploaded
      const uploadedRequiredDocs = allRequiredDocs.slice(0, Math.floor(allRequiredDocs.length * 0.35))
      
      // Also add some optional documents
      const allOptionalDocs = Object.values(DOCUMENT_CATEGORIES)
        .flatMap(cat => cat.documents.filter(d => !d.required))
        .slice(0, Math.floor(Object.values(DOCUMENT_CATEGORIES).flatMap(cat => cat.documents).length * 0.2))
      
      const docsToUpload = [...uploadedRequiredDocs, ...allOptionalDocs]
      
      docsToUpload.forEach((doc, index) => {
        const docData = {
          id: `doc_${id}_${doc.id}_${Date.now()}_${index}`,
          documentId: doc.id,
          documentName: doc.name,
          fileName: `${doc.name.replace(/\s+/g, '_')}_${id}.pdf`,
          fileSize: Math.floor(Math.random() * 5000000) + 100000, // 100KB to 5MB
          fileType: 'application/pdf',
          uploadedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // Random date within last 7 days
          orderId: id,
        }
        demoDocuments.push(docData)
      })
      
      // Save demo documents
      const updated = [...allDocuments, ...demoDocuments]
      writeLocal('dealJacketDocuments', updated)
      
      // Reload documents
      loadDocuments()
    }
  }

  const handleDocumentUpload = () => {
    loadDocuments()
  }

  if (loading) {
    return <div className="text-center py-8">Loading deal jacket...</div>
  }

  if (!order) {
    return null
  }

  // Get salesperson name (mock data)
  const salesperson = order.dealerCode ? `Sales Rep ${order.dealerCode}` : 'N/A'

  // Calculate document progress
  const allRequiredDocs = Object.values(DOCUMENT_CATEGORIES)
    .flatMap(cat => cat.documents.filter(d => d.required))
  const uploadedRequiredDocs = allRequiredDocs.filter(doc => 
    documents.some(d => d.documentId === doc.id)
  )
  const progressPercentage = allRequiredDocs.length > 0 
    ? (uploadedRequiredDocs.length / allRequiredDocs.length) * 100 
    : 0
  const missingCount = allRequiredDocs.length - uploadedRequiredDocs.length

  return (
    <div className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Panel - Fixed Deal Information with Back Arrow */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          {/* Spacer for grid layout on desktop */}
          <div className="hidden lg:block h-[600px]"></div>
          
          {/* Fixed left panel - Desktop */}
          <div className="hidden lg:block lg:fixed lg:top-28 lg:left-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:w-[calc((min(80rem,100vw)-4rem)/3-1.5rem)] lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:z-10">
            {/* Back Arrow */}
            <div className="mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/documentation?tab=deal-jacket')}
                className="text-xs sm:text-sm -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1 sm:mr-0" />
                <span className="sm:hidden">Back</span>
              </Button>
            </div>
            
            {/* Deal Information Card */}
            <Card className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-base sm:text-lg">Deal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Deal #</div>
                  {order.id ? (
                    <Link to={`/ordermanagement/${order.id}`} className="text-sm font-medium text-blue-600 underline hover:text-blue-700">
                      {order.id}
                    </Link>
                  ) : (
                    <div className="text-sm font-medium">N/A</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Customer PO #</div>
                  <div className="text-sm font-medium">{order.stockNumber || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Customer Name</div>
                  <div className="text-sm font-medium">{order.buyerName || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Stock #</div>
                  <div className="text-sm font-medium">{order.stockNumber || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">VIN #</div>
                  <div className="text-sm font-medium">{order.vin || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Make</div>
                  <div className="text-sm font-medium">Ford</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Model</div>
                  <div className="text-sm font-medium">{order.buildJson?.chassis?.series || 'Medium Truck'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Model Year</div>
                  <div className="text-sm font-medium">{new Date(order.createdAt || Date.now()).getFullYear()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Salesperson</div>
                  <div className="text-sm font-medium">{salesperson}</div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Mobile version - Back button only */}
          <div className="lg:hidden">
            <div className="flex items-center mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/documentation?tab=deal-jacket')}
                className="text-xs sm:text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-1 sm:mr-0" />
                <span className="sm:hidden">Back</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel - Document Summary and Upload Sections */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-1 lg:order-2">
          {/* Search Documents */}
          <Card className="mt-4 sm:mt-6">
            <CardContent className="p-4 sm:p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search documents by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Document Summary */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Document Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 text-xs sm:text-sm mb-2">
                  <span className="text-gray-600">Required Documents</span>
                  <span className="font-medium">
                    {uploadedRequiredDocs.length} of {allRequiredDocs.length} uploaded
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2 sm:h-3" />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs sm:text-sm text-red-600 font-medium">{missingCount} Missing</span>
                  <Info className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile: Collapsible Deal Information Card - Above Sales & Sales Support */}
          <div className="lg:hidden">
            <Card>
              <CardHeader 
                className="pb-3 sm:pb-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setIsDealInfoExpanded(!isDealInfoExpanded)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg">Deal Information</CardTitle>
                  <div className="flex items-center">
                    {isDealInfoExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </CardHeader>
              {isDealInfoExpanded && (
                <CardContent className="space-y-3 sm:space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Deal #</div>
                    {order.id ? (
                      <Link to={`/ordermanagement/${order.id}`} className="text-sm font-medium text-blue-600 underline hover:text-blue-700">
                        {order.id}
                      </Link>
                    ) : (
                      <div className="text-sm font-medium">N/A</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Customer PO #</div>
                    <div className="text-sm font-medium">{order.stockNumber || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Customer Name</div>
                    <div className="text-sm font-medium">{order.buyerName || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Stock #</div>
                    <div className="text-sm font-medium">{order.stockNumber || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">VIN #</div>
                    <div className="text-sm font-medium">{order.vin || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Make</div>
                    <div className="text-sm font-medium">Ford</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Model</div>
                    <div className="text-sm font-medium">{order.buildJson?.chassis?.series || 'Medium Truck'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Model Year</div>
                    <div className="text-sm font-medium">{new Date(order.createdAt || Date.now()).getFullYear()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Salesperson</div>
                    <div className="text-sm font-medium">{salesperson}</div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Document Categories */}
          {Object.entries(DOCUMENT_CATEGORIES).map(([category, { documents }]) => (
            <DocumentCategorySection
              key={category}
              category={category}
              documents={documents}
              orderId={id}
              onUpload={handleDocumentUpload}
              searchQuery={searchQuery}
              order={order}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Main Documentation Page Component
export function DocumentationPage() {
  const location = useLocation()
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('paperx')

  useEffect(() => {
    // Check if we're on a deal jacket detail page
    if (id || location.pathname.includes('/deal-jacket/')) {
      setActiveTab('deal-jacket')
    } else {
      // Check URL params for tab
      const params = new URLSearchParams(location.search)
      const tab = params.get('tab')
      if (tab === 'deal-jacket' || tab === 'paperx') {
        setActiveTab(tab)
      }
    }
  }, [location, id])

  // If we're on a detail page, show the detail component
  if (id || location.pathname.includes('/deal-jacket/')) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8">
        <DealJacketDetail />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="paperx" className="text-xs sm:text-sm">PaperX</TabsTrigger>
          <TabsTrigger value="deal-jacket" className="text-xs sm:text-sm">Deal Jacket</TabsTrigger>
        </TabsList>

        <TabsContent value="paperx" className="mt-4 sm:mt-6">
          <PaperX />
        </TabsContent>

        <TabsContent value="deal-jacket" className="mt-4 sm:mt-6">
          <DealJacketList />
        </TabsContent>
      </Tabs>
    </div>
  )
}

