import React from 'react'
import { motion } from 'framer-motion'
import { SoundSettings } from './SoundSettings'
import { ChessboardSettings } from './ChessboardSettings'
import { MaiaModelSettings } from './MaiaModelSettings'

export const SettingsPage: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.2,
        staggerChildren: 0.05,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 4 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: [0.25, 0.46, 0.45, 0.94],
        type: 'tween',
      },
    },
    exit: {
      opacity: 0,
      y: -4,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94],
        type: 'tween',
      },
    },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: 'transform, opacity' }}
      className="relative mx-auto flex w-full flex-col gap-4 px-4 py-8 md:w-[90%] md:gap-6 md:px-0"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-white/90">
            settings
          </span>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
        </div>
        <p className="text-white/70">
          Customize your Maia Chess experience. Settings are saved locally in
          your browser.
        </p>
      </motion.div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-4 lg:gap-6">
        {/* Left column: Sound + Model */}
        <div className="flex flex-col gap-4 md:gap-6">
          <motion.div variants={itemVariants}>
            <SoundSettings />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MaiaModelSettings />
          </motion.div>
        </div>

        {/* Right column: Chessboard */}
        <motion.div variants={itemVariants} className="min-h-full">
          <ChessboardSettings />
        </motion.div>
      </div>
    </motion.div>
  )
}
