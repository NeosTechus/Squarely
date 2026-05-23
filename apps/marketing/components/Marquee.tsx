"use client";

import type { ReactNode } from "react";

interface MarqueeProps {
  children: ReactNode;
  className?: string;
}

export default function Marquee({ children, className = "" }: MarqueeProps) {
  return (
    <div className={`overflow-hidden ${className}`.trim()}>
      <div className="flex w-max animate-marquee whitespace-nowrap hover:[animation-play-state:paused]">
        <div className="flex shrink-0">{children}</div>
        <div className="flex shrink-0" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
