"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

type RevealProps = {
  children: ReactNode;
  /** Element/tag to render. Defaults to "div". */
  as?: ElementType;
  /** Extra classes appended after "reveal". */
  className?: string;
  /** Entrance delay in milliseconds. */
  delay?: number;
};

export default function Reveal({
  children,
  as = "div",
  className = "",
  delay = 0,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  // SSR-safe: render visible when IntersectionObserver is unavailable.
  const [visible, setVisible] = useState(
    typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref,
      className: `reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`,
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children,
  );
}
