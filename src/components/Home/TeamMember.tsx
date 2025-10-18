import { motion } from 'framer-motion'
import { GithubIcon } from 'src/components/Common/Icons'
interface TeamMemberProps {
  image: string
  name: string
  website?: string
  institution: string
  role: string
  github?: string
  index?: number
}

export const TeamMember = ({
  image,
  name,
  website,
  institution,
  role,
  github,
  index = 0,
}: TeamMemberProps) => {
  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.3,
        delay: 0.1 + ((index * 0.05) % 0.5),
        ease: 'easeOut',
      }}
    >
      <img
        src={image}
        className="h-24 w-24 rounded-full md:h-40 md:w-40"
        alt={name}
      />
      <div className="flex flex-col">
        {website ? (
          <a
            target="_blank"
            rel="noreferrer"
            href={website}
            className="text-xs font-semibold text-human-2 transition duration-200 hover:text-human-3 md:text-xl"
          >
            {name}
          </a>
        ) : (
          <span className="text-xs text-primary md:text-xl">{name}</span>
        )}
        <p className="text-xxs text-primary md:text-base">{institution}</p>
        <div className="mt-1 flex flex-col gap-2">
          <p className="text-xxs font-medium text-primary md:text-sm">{role}</p>
          <div className="flex items-center justify-center gap-2">
            {website && (
              <a
                target="_blank"
                rel="noreferrer"
                href={website}
                className="opacity-80 transition-opacity duration-300 hover:opacity-100"
                aria-label={`Visit ${name}'s website`}
              >
                <span className="material-symbols-outlined text-sm leading-8 md:text-xl">
                  language
                </span>
              </a>
            )}
            {github && (
              <a
                target="_blank"
                rel="noreferrer"
                href={`https://github.com/${github}`}
                className="opacity-80 transition-opacity duration-300 *:h-3 *:w-3 *:fill-primary hover:opacity-100 *:md:h-4 *:md:w-4"
                aria-label={`Visit ${name}'s GitHub profile`}
              >
                {GithubIcon}
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
