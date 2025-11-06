import { Button } from '@/components/ui/button'

export function StickyActions({
  onBack,
  onContinue,
  backLabel = 'Back',
  continueLabel = 'Continue',
  disableBack = false,
  disableContinue = false,
  showBack = true,
  showContinue = true,
  className = ''
}) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          {showBack ? (
            <Button
              variant="outline"
              onClick={onBack}
              disabled={disableBack}
              className="flex items-center gap-2 flex-1 sm:flex-initial text-sm sm:text-base"
            >
              {backLabel}
            </Button>
          ) : (
            <div />
          )}
          
          {showContinue && (
            <Button
              onClick={onContinue}
              disabled={disableContinue}
              className="flex items-center gap-2 flex-1 sm:flex-initial text-sm sm:text-base"
            >
              {continueLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
