"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./homepage.module.css";

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.unobserve(node); }
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`${styles.reveal} ${visible ? styles.visible : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}
