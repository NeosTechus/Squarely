"use client";

import { useEffect, useState } from "react";

/** Thin brand-gradient bar pinned to the top that fills as the page scrolls. */
export default function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const top = window.scrollY || el.scrollTop || 0;
      setPct(max > 0 ? Math.min(100, (top / max) * 100) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-[70] h-1 bg-slate-900/5">
      <div
        className="h-full rounded-r-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 shadow-[0_0_10px_rgba(51,163,255,0.65)] transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
