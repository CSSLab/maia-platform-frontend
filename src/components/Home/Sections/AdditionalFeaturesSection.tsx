import Link from 'next/link'
import { useContext, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'

import { ModalContext } from 'src/contexts'
import { PlayType } from 'src/types'
import { StarIcon, TuringIcon } from 'src/components/Icons/icons'

const animationVariants = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  },
  item: {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.3 },
    },
  },
  fadeIn: (delay = 0) => ({
    initial: { opacity: 0, y: -10 },
    animate: (inView: boolean) =>
      inView ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 },
    transition: { duration: 0.3, delay },
  }),
}

interface AdditionalFeaturesSectionProps {
  id: string
}

type FeatureActionType =
  | { type: 'link'; href: string; label: string }
  | { type: 'button'; onClick: () => void; label: string }

interface Feature {
  icon: ReactNode
  title: string
  description: string
  action: FeatureActionType
  iconBgColor: string
  iconTextColor: string
}

const FeatureCard = ({
  feature,
  variants,
}: {
  feature: Feature
  variants: {
    hidden?: { y?: number; opacity?: number }
    visible?: {
      y?: number
      opacity?: number
      transition?: { duration: number }
    }
  }
}) => {
  const { icon, title, description, action, iconBgColor, iconTextColor } =
    feature

  return (
    <motion.div
      className="flex flex-col overflow-hidden rounded-lg bg-background-2 shadow-lg transition-transform duration-200"
      variants={variants}
    >
      <div className="flex flex-col p-5">
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${iconBgColor} p-2`}
        >
          <div className={`h-7 w-7 ${iconTextColor}`}>{icon}</div>
        </div>
        <h3 className="mb-3 text-xl font-bold">{title}</h3>
        <p className="text-primary/80 mb-5 flex-grow">{description}</p>
      </div>
      {action.type === 'link' ? (
        <motion.div className="mt-auto">
          <Link
            href={action.href}
            className="bg-human-4/80 mt-auto inline-flex w-full items-center justify-center px-5 py-3 font-medium transition duration-200 hover:bg-human-4"
          >
            {action.label}
          </Link>
        </motion.div>
      ) : (
        <motion.button
          onClick={action.onClick}
          className="bg-human-4/80 mt-auto inline-flex w-full items-center justify-center px-5 py-3 font-medium transition duration-200 hover:bg-human-4"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  )
}

const SectionHeader = () => {
  return (
    <div className="mb-8 max-w-3xl text-left md:mb-14">
      <div className="bg-human-3/10 mb-2 inline-block rounded-full px-4 py-1 text-sm font-medium text-human-3">
        More Features
      </div>
      <h2 className="mb-3 text-2xl font-bold md:mb-4 md:text-3xl md:text-4xl lg:text-5xl">
        Explore other ways to use Maia
      </h2>
      <p className="text-primary/80 max-w-2xl text-base md:text-lg">
        Maia offers a range of innovative tools to help you understand human
        chess and improve your skills
      </p>
    </div>
  )
}

export const AdditionalFeaturesSection = ({
  id,
}: AdditionalFeaturesSectionProps) => {
  const { setPlaySetupModalProps } = useContext(ModalContext)
  const [ref, inView] = useInView({
    triggerOnce: false,
    threshold: 0.2,
  })

  const startHandBrainGame = () => {
    setPlaySetupModalProps({ playType: 'handAndBrain' as PlayType })
  }

  const features: Feature[] = [
    {
      icon: <StarIcon />,
      title: 'Openings Practice',
      description:
        "Drill chess openings against Maia models calibrated to specific rating levels, allowing you to practice against opponents similar to those you'll face.",
      action: { type: 'link', href: '/openings', label: 'Practice Openings' },
      iconBgColor: 'bg-human-3/10',
      iconTextColor: 'text-human-3',
    },
    {
      icon: <TuringIcon />,
      title: 'Hand & Brain',
      description:
        'Team up with Maia in this collaborative chess variant. You can be the "Hand" making moves while Maia is the "Brain" selecting pieces, or vice versa.',
      action: {
        type: 'button',
        onClick: startHandBrainGame,
        label: 'Play Hand & Brain',
      },
      iconBgColor: 'bg-engine-3/10',
      iconTextColor: 'text-engine-3',
    },
    {
      icon: <TuringIcon />,
      title: 'Bot or Not',
      description:
        'Test your ability to distinguish between human and AI chess play. This Turing Test for chess is a fun way to see if you understand the differences between human and engine moves.',
      action: { type: 'link', href: '/turing', label: 'Try Bot or Not' },
      iconBgColor: 'bg-human-4/10',
      iconTextColor: 'text-human-4',
    },
  ]

  return (
    <section
      id={id}
      className="relative w-full flex-col items-center overflow-hidden bg-background-1 py-10 md:py-16"
      ref={ref}
    >
      <div className="mx-auto flex w-full max-w-[95%] flex-col px-2 md:max-w-[90%] md:px-4">
        <SectionHeader />
        <motion.div
          className="grid gap-4 md:grid-cols-3 md:gap-6"
          variants={animationVariants.container}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
        >
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              feature={feature}
              variants={animationVariants.item}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
