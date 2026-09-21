"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";

export default function AnimatedNumber({ value }: { value: number }) {
  const reducedMotion = useReducedMotion();
  const count = useMotionValue(0);
  const rounded = useTransform(count, latest => Math.round(latest).toLocaleString());

  useEffect(() => {
    if (reducedMotion) { count.set(value); return; }
    const controls = animate(count, value, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [count, value, reducedMotion]);

  return <span className="tabular-nums">
    <span className="sr-only">{value.toLocaleString()}</span>
    {reducedMotion ? <span aria-hidden="true">{value.toLocaleString()}</span> : <motion.span aria-hidden="true">{rounded}</motion.span>}
  </span>;
}
