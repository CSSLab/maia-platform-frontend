import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  duration?: number
  formatValue?: (value: number) => string
  className?: string
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 0.5,
  formatValue = (val) => Math.round(val).toLocaleString(),
  className = '',
}) => {
  const motionValue = useMotionValue(value)
  const displayValue = useTransform(motionValue, (val) => formatValue(val))

  // A short count-up of fixed length. A spring counting to tens of millions
  // took ~3 s to settle, re-laying out its text on every frame of it.
  useEffect(() => {
    const controls = animate(motionValue, value, { duration, ease: 'easeOut' })
    return () => controls.stop()
  }, [motionValue, value, duration])

  return <motion.span className={className}>{displayValue}</motion.span>
}
