import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loading } from './Loading'

interface DelayedLoadingProps {
  isLoading: boolean
  transparent?: boolean
  delay?: number
  message?: React.ReactNode
  children: React.ReactNode
}

export const DelayedLoading: React.FC<DelayedLoadingProps> = ({
  isLoading,
  transparent = false,
  delay = 1000,
  message,
  children,
}) => {
  const [showLoading, setShowLoading] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout

    if (isLoading) {
      timer = setTimeout(() => {
        setShowLoading(true)
      }, delay)
    } else {
      setShowLoading(false)
    }

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [isLoading, delay])

  return (
    <AnimatePresence mode="wait">
      {isLoading && showLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="my-auto"
        >
          <Loading transparent={transparent} message={message} />
        </motion.div>
      ) : !isLoading ? (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
