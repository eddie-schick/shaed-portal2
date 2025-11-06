import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, name: 'Chassis', path: '/configurator/chassis-selection' },
  { id: 2, name: 'Body Type', path: '/configurator/body-type' },
  { id: 3, name: 'Chassis Options', path: '/configurator/chassis-options' },
  { id: 4, name: 'Body Specs', path: '/configurator/body-specs' },
  { id: 5, name: 'Upfitter', path: '/configurator/upfitter' },
  { id: 6, name: 'Pricing', path: '/configurator/pricing' },
  { id: 7, name: 'Review', path: '/configurator/review' }
]

export function Stepper({ currentStep, completedSteps = [] }) {
  return (
    <div className="w-full py-4 px-4 bg-white border-b">
      <div className="max-w-7xl mx-auto">
        {/* Desktop Stepper */}
        <div className="hidden lg:flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id)
            const isCurrent = currentStep === step.id
            const isPast = step.id < currentStep
            
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border",
                        {
                          "bg-black text-white border-black": isCurrent,
                          "bg-gray-100 text-gray-700 border-gray-300": isPast || isCompleted,
                          "bg-gray-100 text-gray-600 border-gray-300": !isCurrent && !isCompleted && !isPast
                        }
                      )}
                    >
                      {step.id}
                    </div>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        {
                          "text-black": isCurrent,
                          "text-gray-900": isPast || isCompleted,
                          "text-gray-500": !isCurrent && !isCompleted && !isPast
                        }
                      )}
                    >
                      {step.name}
                    </p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="flex-1 mx-4 min-w-8">
                    <div
                      className={cn(
                        "h-[2px] rounded-full transition-colors",
                        {
                          "bg-black": isPast,
                          "bg-gray-300": !isPast
                        }
                      )}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Mobile Stepper */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">
              Step {currentStep} of {STEPS.length}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {STEPS[currentStep - 1]?.name}
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-black h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function StepperMobile({ currentStep, totalSteps = 7 }) {
  const stepName = STEPS[currentStep - 1]?.name || ''
  
  return (
    <div className="lg:hidden bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm font-medium text-gray-900">
          {stepName}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-black h-2 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  )
}
