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
			window.scrollTo({ top: top - offset, behavior: "auto" });
			// After positioning, focus the search field if present so it's ready
			const searchEl = document.querySelector('input[placeholder^="Search by chassis model"]');
			try { searchEl?.focus?.({ preventScroll: true }); } catch {}
			try { window.history.replaceState(null, "", "#catalog"); } catch {}
			return;
		}
		// Fallback to a catalog anchor if present
		const el = document.getElementById("catalog");
		if (el) {
			el.scrollIntoView({ behavior: "auto", block: "start" });
			try { window.history.replaceState(null, "", "#catalog"); } catch {}
			return;
		}
		// Final fallback: ensure page scrolls further down
		window.scrollTo({ top: window.scrollY + 1, behavior: "auto" });
	};

	return (
		<section ref={sectionRef} className="relative isolate w-full max-w-full overflow-hidden" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
			{/* Figure (full-bleed image) with subtle top white gradient overlay and content at the top */}
			<figure className="relative w-full max-w-full overflow-hidden">
				<picture className="block w-full max-w-full">
					<source srcSet="/hero.webp" type="image/webp" />
					<img
						src="/hero.webp"
						alt="Commercial vehicles hero"
						className="h-[70svh] w-full max-w-full object-contain object-center md:h-[78svh] md:object-cover"
						fetchpriority="high"
						decoding="async"
						style={{ maxWidth: '100%', width: '100%' }}
					/>
				</picture>
				{/* Removed gradient overlay to keep original image colors */}
				{/* Overlay content at the top of the image */}
				<div className="absolute inset-x-0 top-0">
					<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 text-center">
						<h1 className={cn(
							"text-white font-semibold tracking-tight",
							"text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
						)}>
							<span>SHAED x </span>
							<span className="inline-block align-baseline">
								<span aria-live="polite" aria-atomic="true" ref={liveRef} className="sr-only" />
							<span
								className={cn(
									"inline-block text-white",
									reducedMotion ? "opacity-100" : visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
									reducedMotion ? "" : "transition-all duration-300 ease-out will-change-transform"
								)}
								key={index}
							>
								{rotatingWords[index]}
							</span>
							</span>
						</h1>

						<div className="mt-4 sm:mt-5 mx-auto max-w-3xl">
							<p className="text-white/90 text-lg sm:text-xl leading-relaxed">
								Find vocational-ready chassis and upfits in one place.
							</p>
							<p className="mt-1 text-white/85 text-base sm:text-lg leading-relaxed">
							Simplify commercial vehicle orders: configure, price, track, and centralize documentation.
							</p>
						</div>
					</div>
				</div>

				{/* Buttons overlay positioned ~25% up from bottom */}
				<div className="absolute inset-x-0 bottom-[12%]">
					<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
						<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-center">
							<Button asChild size="lg" variant="outline" className="w-full sm:w-auto min-w-40 bg-white text-gray-900 hover:bg-white/90">
								<a href="#catalog" onClick={handleExploreClick} aria-label="Explore Catalog">Explore Catalog</a>
							</Button>
							<Button asChild size="lg" variant="outline" className="w-full sm:w-auto min-w-40 bg-white text-gray-900 hover:bg-white/90">
								<Link to="/ordermanagement" aria-label="Go to Order Management">Order Management</Link>
							</Button>
							<Button asChild size="lg" variant="outline" className="w-full sm:w-auto min-w-40 bg-white text-gray-900 hover:bg-white/90">
								<Link to="/documentation" aria-label="Go to Documentation">Documentation</Link>
							</Button>
						</div>
					</div>
				</div>
			</figure>
		</section>
	);
}


