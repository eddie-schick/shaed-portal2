import React from 'react'

export function AnimatedHeader() {
  const words = [
    'Customers',
    'Upfitters',
    'Logistics',
    'Order Tracking',
    'Documentation',
    'Recommendations',
  ]

  return (
    <div className="mb-8">
      <section className="hero-band overflow-hidden">
        <div className="relative w-full min-h-[60vh] sm:min-h-[68vh] md:min-h-[75vh] flex items-center justify-center">
          <div className="hero-content text-center px-6 py-16 sm:py-24 max-w-4xl">
            <h1 className="font-bold text-gray-900 leading-tight text-[2.5rem] sm:text-5xl md:text-6xl text-center">
              <span className="block fade-in-up" style={{ color: '#2FC774' }}>SHAED</span>
              <span className="block text-[0.65em] leading-none my-1 sm:my-2 fade-in-up" style={{ animationDelay: '120ms', color: '#2FC774' }}>x</span>
              <span className="relative block h-[1.2em] mt-0 w-full">
                {words.map((word, index) => (
                  <span
                    key={word}
                    className="absolute inset-0 w-full opacity-0 rotate-word flex items-center justify-center"
                    style={{ animationDelay: `${index * 3}s`, color: '#2FC774' }}
                  >
                    {word}
                  </span>
                ))}
              </span>
            </h1>

            <p className="mt-10 sm:mt-14 md:mt-20 text-black/95 text-lg sm:text-xl fade-in-up" style={{ animationDelay: '360ms' }}>
              One platform. Every stage of commercial vehicle procurement.
            </p>

            <p className="mt-4 sm:mt-6 md:mt-8 text-black/85 max-w-3xl mx-auto text-sm sm:text-base md:text-lg fade-in-up" style={{ animationDelay: '480ms' }}>
              Seamlessly connecting customers through upfitting, logistics, and beyond. Real-time tracking, intelligent recommendations, and automated documentation in a unified ecosystem.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AnimatedHeader


