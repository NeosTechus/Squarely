"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  /** Target number to count up to. */
  to: number;
  /** Text rendered before the number, e.g. "$" or "<". */
  prefix?: string;
  /** Text rendered after the number, e.g. "min" or "+". */
  suffix?: string;
  /** Animation duration in milliseconds. */
  duration?: number;
  /** Decimal places to render. */
  decimals?: number;
  className?: string;
  /**
   * If provided, the component renders this string verbatim and skips the
   * counting animation entirely (non-numeric fallback).
   */
  fallback?: string;
}

export default function CountUp({
  to,
  prefix = "",
  suffix = "",
  duration = 1200,
  decimals = 0,
  className,
  fallback,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (fallback != null) return;
    const el = ref.current;
    if (!el) return;

    // SSR / unsupported environment guard — render the final value.
    if (
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      setValue(to);
      return;
    }

    // Respect reduced-motion: jump straight to the target.
    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setValue(to);
      return;
    }

    let raf = 0;
    let started = false;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(to * eased);
        if (t < 1) raf = requestAnimationFrame(tick);
        else setValue(to);
      };
      raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started) {
            started = true;
            run();
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [to, duration, fallback]);

  if (fallback != null) {
    return <span className={className}>{fallback}</span>;
  }

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
