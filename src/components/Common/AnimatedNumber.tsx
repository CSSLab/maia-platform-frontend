import { useEffect, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  duration?: number
  formatValue?: (value: number) => string
  className?: string
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 1.5,
  formatValue = (val) => Math.round(val).toLocaleString(),
  className = '',
}) => {
  const springValue = useSpring(value, {
    stiffness: 150,
    damping: 30,
    duration,
    // The number is shown rounded, so the spring can stop within 0.5 of it
    // (framer-motion's default at this scale). At 0.001 a count of tens of
    // millions kept animating, and redrawing the page, for seconds after
    // its display had stopped changing.
    restDelta: 0.5,
  })

  const displayValue = useTransform(springValue, (val) => formatValue(val))

  useEffect(() => {
    springValue.set(value)
  }, [springValue, value])

  return <motion.span className={className}>{displayValue}</motion.span>
}
