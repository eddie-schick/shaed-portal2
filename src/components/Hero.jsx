import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/lib/utils";

function usePrefersReducedMotion() {
	const query = useMemo(() => (typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null), []);
	const [reduced, setReduced] = useState(() => (query ? query.matches : false));
	useEffect(() => {
		if (!query) return;
		const handle = () => setReduced(query.matches);
		try { query.addEventListener("change", handle); } catch {
			// Safari
			query.addListener(handle);
		}
		return () => {
			try { query.removeEventListener("change", handle); } catch {
				query.removeListener(handle);
			}
		};
	}, [query]);
	return reduced;
}

export default function Hero({
	rotatingWords = ["Customers", "Dealers", "Upfitters", "Fleets"],
	ctaPrimary = { label: "Explore Catalog", href: "/" },
	ctaSecondary = { label: "Order Management", href: "/ordermanagement" },
	showSearch = true,
}) {
	// reference props to avoid unused warnings while preserving API
	void ctaPrimary; void ctaSecondary; void showSearch;
	const reducedMotion = usePrefersReducedMotion();
	const [index, setIndex] = useState(0);
	const [visible, setVisible] = useState(true);
	const liveRef = useRef(null);
	const sectionRef = useRef(null);

	useEffect(() => {
		if (rotatingWords.length <= 1) return;
		if (reducedMotion) {
			const id = setInterval(() => setIndex((i) => (i + 1) % rotatingWords.length), 4000);
			return () => clearInterval(id);
		}
		let timeoutId;
		const cycle = () => {
			setVisible(false);
			timeoutId = setTimeout(() => {
				setIndex((i) => (i + 1) % rotatingWords.length);
				setVisible(true);
			}, 300); // duration should match animation class
		};
		const intervalId = setInterval(cycle, 3000);
		return () => {
			clearInterval(intervalId);
			clearTimeout(timeoutId);
		};
	}, [rotatingWords, reducedMotion]);

	useEffect(() => {
		if (liveRef.current) {
			liveRef.current.textContent = rotatingWords[index] || "";
		}
	}, [index, rotatingWords]);

	const handleExploreClick = (e) => {
		e?.preventDefault?.();
		// Jump to the very top of the section immediately under the hero (where catalog search lives)
		const next = sectionRef.current?.nextElementSibling;
		if (next) {
			const top = next.getBoundingClientRect().top + window.scrollY;
			// account for sticky header height if present
			const header = document.querySelector('header.sticky');
			const offset = header ? header.getBoundingClientRect().height : 0;
			window.scrollTo({ top: top - offset, behavior: "smooth" });
			try { window.history.replaceState(null, "", "#catalog"); } catch {}
			return;
		}
		// Fallback to a catalog anchor if present
		const el = document.getElementById("catalog");
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
			try { window.history.replaceState(null, "", "#catalog"); } catch {}
			return;
		}
		// Final fallback: ensure page scrolls further down
		window.scrollTo({ top: window.scrollY + 1, behavior: "smooth" });
	};

	return (
		<section ref={sectionRef} className="relative isolate w-full max-w-full overflow-hidden" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
			{/* Figure (full-bleed image) with optimized mobile layout */}
			<figure className="relative w-full max-w-full overflow-hidden">
				{/* Background image container with optimized mobile sizing */}
				<div className="relative w-full h-[60svh] sm:h-[65svh] md:h-[78svh] overflow-hidden">
					<picture className="absolute inset-0 block w-full h-full">
						<source srcSet="/hero.webp" type="image/webp" />
						<img
							src="/hero.webp"
							alt="Commercial vehicles hero"
							className="w-full h-full object-cover object-center"
							fetchpriority="high"
							decoding="async"
						/>
					</picture>
					{/* Subtle gradient overlay for better text readability on mobile */}
					<div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50 md:from-black/30 md:via-black/15 md:to-black/40" />
				</div>
				
				{/* Overlay content at the top of the image */}
				<div className="absolute inset-x-0 top-0">
					<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 md:pt-10 pb-4 text-center">
						<h1 className={cn(
							"text-white font-semibold tracking-tight drop-shadow-lg",
							"text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl"
						)}>
							<span>SHAED x </span>
							<span className="inline-block align-baseline">
								<span aria-live="polite" aria-atomic="true" ref={liveRef} className="sr-only" />
							<span
								className={cn(
									"inline-block text-white drop-shadow-lg",
									reducedMotion ? "opacity-100" : visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
									reducedMotion ? "" : "transition-all duration-300 ease-out will-change-transform"
								)}
								key={index}
							>
								{rotatingWords[index]}
							</span>
							</span>
						</h1>

						<div className="mt-3 sm:mt-4 md:mt-5 mx-auto max-w-3xl">
							<p className="text-white text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed drop-shadow-md font-medium">
								Find vocational-ready chassis and upfits in one place.
							</p>
							<p className="mt-1.5 sm:mt-2 text-white/95 text-xs sm:text-sm md:text-base lg:text-lg leading-relaxed drop-shadow-md">
							Simplify commercial vehicle orders: configure, price, track, and centralize documentation.
							</p>
						</div>
					</div>
				</div>

				{/* Buttons overlay positioned optimally for mobile */}
				<div className="absolute inset-x-0 bottom-0 pb-4 sm:pb-6 md:pb-8">
					<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
						<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 sm:justify-center">
							<Button asChild size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-40 bg-white text-gray-900 hover:bg-white/90 shadow-lg text-sm sm:text-base py-2.5 sm:py-3">
								<a href="#catalog" onClick={handleExploreClick} aria-label="Explore Catalog">Explore Catalog</a>
							</Button>
							<Button asChild size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-40 bg-white text-gray-900 hover:bg-white/90 shadow-lg text-sm sm:text-base py-2.5 sm:py-3">
								<Link to="/ordermanagement" aria-label="Go to Order Management">Order Management</Link>
							</Button>
							<Button asChild size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-40 bg-white text-gray-900 hover:bg-white/90 shadow-lg text-sm sm:text-base py-2.5 sm:py-3">
								<Link to="/documentation" aria-label="Go to Documentation">Documentation</Link>
							</Button>
						</div>
					</div>
				</div>
			</figure>
		</section>
	);
}


