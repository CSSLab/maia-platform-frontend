import { memo } from 'react'
import { motion } from 'framer-motion'

interface Props<T extends string> {
  tabs: readonly { id: T; name: string }[]
  selected: T
  onSelect: (id: T) => void
  // framer-motion layoutId of the underline that slides to the selected tab
  layoutId: string
  tabClassName?: string
}

const UnderlineTabsInner = <T extends string>({
  tabs,
  selected,
  onSelect,
  layoutId,
  tabClassName = '',
}: Props<T>) => (
  <div className="flex flex-row border-b border-glass-border">
    {tabs.map((tab) => {
      const isSelected = tab.id === selected
      return (
        <div
          key={tab.id}
          tabIndex={0}
          role="button"
          onKeyPress={(e) => {
            if (e.key === 'Enter') onSelect(tab.id)
          }}
          onClick={() => onSelect(tab.id)}
          className={`relative flex cursor-pointer select-none flex-row px-3 py-1.5 transition duration-200 ${tabClassName} ${isSelected ? 'bg-white/5' : 'hover:bg-white hover:bg-opacity-[0.02]'}`}
        >
          <p
            className={`text-xs transition duration-200 2xl:text-sm ${isSelected ? 'text-primary' : 'text-secondary'}`}
          >
            {tab.name}
          </p>
          {isSelected ? (
            <motion.div
              layoutId={layoutId}
              className="absolute bottom-0 left-0 h-[1px] w-full bg-white"
            />
          ) : null}
        </div>
      )
    })}
  </div>
)

/**
 * A row of tabs with an underline that slides to the selected one. Memoized:
 * every render of a layout-animated element makes framer-motion measure the
 * page (a forced layout), and on the analysis page the tabs' parents
 * re-render on every engine update. Pass stable `tabs` and `onSelect`.
 */
export const UnderlineTabs = memo(
  UnderlineTabsInner,
) as typeof UnderlineTabsInner
