import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  EcoOpening,
  EcoOpeningVariation,
  EcoSection,
  PopularOpening,
} from 'src/types'

interface EcoTreeViewProps {
  sections: EcoSection[]
  popularOpenings: PopularOpening[]
  onOpeningClick: (opening: EcoOpening, variation?: EcoOpeningVariation) => void
  onQuickAdd: (opening: EcoOpening, variation?: EcoOpeningVariation) => void
  isSelected: (opening: EcoOpening, variation?: EcoOpeningVariation) => boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  previewOpening?: EcoOpening | null
  previewVariation?: EcoOpeningVariation | null
}

const TreeNode: React.FC<{
  level: number
  hasChildren: boolean
  isExpanded: boolean
  isLast: boolean
  parentLines: boolean[]
  onToggle?: () => void
  children: React.ReactNode
}> = ({
  level,
  hasChildren,
  isExpanded,
  isLast,
  parentLines,
  onToggle,
  children,
}) => {
  const nodeHeight = 24 // Height of each node for proper line alignment
  const lineOffset = Math.floor(nodeHeight / 2) // Center the lines vertically

  return (
    <div className="relative" style={{ height: nodeHeight }}>
      {/* Tree lines */}
      <div className="absolute left-0 top-0 flex h-full">
        {/* Parent connection lines */}
        {parentLines.map((showLine, index) => (
          <div key={index} className="relative w-5 flex-shrink-0">
            {showLine && (
              <div className="absolute bottom-0 left-2 top-0 w-px bg-secondary/20" />
            )}
          </div>
        ))}

        {/* Current level connector */}
        <div className="relative w-5 flex-shrink-0">
          {/* Horizontal line - centered vertically */}
          {level > 0 && (
            <div
              className="absolute left-2 h-px w-3 bg-secondary/20"
              style={{ top: `${lineOffset}px` }}
            />
          )}

          {/* Vertical line continuing down */}
          {!isLast && level > 0 && (
            <div
              className="absolute left-2 w-px bg-secondary/20"
              style={{
                top: `${lineOffset}px`,
                height: `${nodeHeight - lineOffset}px`,
              }}
            />
          )}

          {/* Vertical line from top to center (connecting to parent) */}
          {level > 0 && (
            <div
              className="absolute left-2 top-0 w-px bg-secondary/20"
              style={{ height: `${lineOffset}px` }}
            />
          )}
        </div>
      </div>

      {/* Node content */}
      <div
        className="relative flex h-full items-center"
        style={{ marginLeft: `${(level + 1) * 20}px` }}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={onToggle}
            className="mr-1 flex h-3 w-3 flex-shrink-0 items-center justify-center rounded text-xs text-secondary/70 hover:bg-secondary/10 hover:text-primary"
          >
            {isExpanded ? '−' : '+'}
          </button>
        ) : (
          // Placeholder to keep alignment consistent for leaf nodes
          <span className="mr-1 h-3 w-3 flex-shrink-0" />
        )}

        {/* Node content */}
        <div className="h-full min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

const EcoTreeView: React.FC<EcoTreeViewProps> = ({
  sections,
  popularOpenings,
  onOpeningClick,
  onQuickAdd,
  isSelected,
  searchTerm,
  setSearchTerm,
  previewOpening,
  previewVariation,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  )
  const [expandedOpenings, setExpandedOpenings] = useState<Set<string>>(
    new Set(),
  )
  const [expandedDecades, setExpandedDecades] = useState<Set<string>>(new Set())
  const [showPopular, setShowPopular] = useState(true)

  // Helper function to check if an opening is currently being previewed
  const isBeingPreviewed = (
    opening: EcoOpening,
    variation?: EcoOpeningVariation,
  ) => {
    if (!previewOpening) return false
    const matchesOpening = previewOpening.id === opening.id
    const matchesVariation = variation
      ? previewVariation?.id === variation.id
      : !previewVariation
    return matchesOpening && matchesVariation
  }

  const toggleSection = (sectionCode: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionCode)) {
      newExpanded.delete(sectionCode)
    } else {
      newExpanded.add(sectionCode)
    }
    setExpandedSections(newExpanded)
  }

  const toggleOpening = (openingId: string) => {
    const newExpanded = new Set(expandedOpenings)
    if (newExpanded.has(openingId)) {
      newExpanded.delete(openingId)
    } else {
      newExpanded.add(openingId)
    }
    setExpandedOpenings(newExpanded)
  }

  const toggleDecade = (sectionCode: string, groupCode: string) => {
    const key = `${sectionCode}:${groupCode}`
    const next = new Set(expandedDecades)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpandedDecades(next)
  }

  const filteredSections = useMemo(() => {
    if (!searchTerm) return sections

    const searchLower = searchTerm.toLowerCase()

    return sections
      .map((section) => {
        const matchingOpenings = section.openings
          .map((opening) => {
            const openingMatches =
              opening.name.toLowerCase().includes(searchLower) ||
              opening.eco.toLowerCase().includes(searchLower) ||
              opening.pgn.toLowerCase().includes(searchLower)

            const matchingVariations = opening.variations.filter(
              (variation) =>
                variation.name.toLowerCase().includes(searchLower) ||
                variation.pgn.toLowerCase().includes(searchLower),
            )

            // Include opening if it matches or has matching variations
            if (openingMatches || matchingVariations.length > 0) {
              return {
                ...opening,
                // Only show matching variations when searching
                variations: matchingVariations,
              }
            }
            return null
          })
          .filter(Boolean) as EcoOpening[]

        return {
          ...section,
          openings: matchingOpenings,
        }
      })
      .filter((section) => section.openings.length > 0)
  }, [sections, searchTerm])

  // Auto-expand sections and openings when searching
  const autoExpandedSections = useMemo(() => {
    if (!searchTerm) return expandedSections

    const newExpanded = new Set(expandedSections)
    filteredSections.forEach((section) => {
      newExpanded.add(section.code)
    })
    return newExpanded
  }, [expandedSections, filteredSections, searchTerm])

  const autoExpandedOpenings = useMemo(() => {
    if (!searchTerm) return expandedOpenings

    const newExpanded = new Set(expandedOpenings)
    filteredSections.forEach((section) => {
      section.openings.forEach((opening) => {
        // Auto-expand openings that have matching variations
        if (opening.variations.length > 0) {
          newExpanded.add(opening.id)
        }
      })
    })
    return newExpanded
  }, [expandedOpenings, filteredSections, searchTerm])

  const filteredPopularOpenings = useMemo(() => {
    if (!searchTerm) return popularOpenings

    return popularOpenings.filter(
      (popular) =>
        popular.opening.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        popular.opening.pgn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        popular.variation?.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        popular.variation?.pgn
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()),
    )
  }, [popularOpenings, searchTerm])

  const autoExpandedDecades = useMemo(() => {
    if (!searchTerm) return expandedDecades
    const next = new Set(expandedDecades)
    filteredSections.forEach((section) => {
      const decadeKeys = new Set<string>()
      section.openings.forEach((op) => decadeKeys.add(op.eco.slice(0, 2)))
      decadeKeys.forEach((g) => next.add(`${section.code}:${g}`))
    })
    return next
  }, [expandedDecades, filteredSections, searchTerm])

  // Local helper to build nested variation nodes from comma-separated names
  const buildVariationTree = (
    variations: EcoOpeningVariation[],
  ): { name: string; variation?: EcoOpeningVariation; children: any[] }[] => {
    const root = new Map<string, any>()
    const getOrCreate = (container: Map<string, any>, name: string) => {
      let node = container.get(name)
      if (!node) {
        node = { name, children: [] as any[] }
        container.set(name, node)
      }
      return node
    }
    variations.forEach((v) => {
      const parts = v.name
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      let current: any = null
      let container: any = root
      parts.forEach((part, idx) => {
        if (current) {
          // descend into current.children as a map
          if (!current._map) current._map = new Map<string, any>()
          container = current._map
        }
        const node = getOrCreate(container, part)
        if (idx === parts.length - 1) node.variation = v
        current = node
      })
    })
    // Convert maps to arrays recursively
    const toArray = (map: Map<string, any>): any[] => {
      const arr = Array.from(map.values())
      arr.forEach((n) => {
        n.children = n._map ? toArray(n._map) : []
        delete n._map
      })
      arr.sort((a, b) => a.name.localeCompare(b.name))
      return arr
    }
    return toArray(root)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Search Bar */}
      <div className="border-b border-white/10 p-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-secondary">
            search
          </span>
          <input
            type="text"
            placeholder="Search ECO codes, openings, variations, or PGN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded bg-background-2 py-2 pl-10 pr-4 text-sm text-primary placeholder-secondary focus:outline-none focus:ring-1 focus:ring-human-4"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>
      <div className="red-scrollbar flex-1 overflow-y-auto py-4">
        {/* Popular Openings Section */}
        {!searchTerm && (
          <div>
            <TreeNode
              level={0}
              hasChildren={filteredPopularOpenings.length > 0}
              isExpanded={showPopular}
              isLast={false}
              parentLines={[]}
              onToggle={() => setShowPopular(!showPopular)}
            >
              <div
                className="flex flex-1 cursor-pointer items-center justify-between rounded px-1 py-0.5 hover:bg-human-2/10"
                onClick={() => setShowPopular(!showPopular)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex w-5 justify-center">
                    <span className="material-symbols-outlined text-sm text-human-4">
                      star
                    </span>
                  </span>
                  <span className="text-sm font-medium text-primary">
                    Popular Openings
                  </span>
                </div>
                <span className="text-xs text-secondary">
                  ({filteredPopularOpenings.length})
                </span>
              </div>
            </TreeNode>

            <AnimatePresence>
              {showPopular && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {filteredPopularOpenings.map((popular, index) => {
                    const opening = popular.opening
                    const variation = popular.variation
                    const selected = isSelected(opening, variation)
                    const previewed = isBeingPreviewed(opening, variation)
                    const isLastPopular =
                      index === filteredPopularOpenings.length - 1

                    return (
                      <TreeNode
                        key={`popular-${opening.id}-${variation?.id || 'main'}`}
                        level={1}
                        hasChildren={false}
                        isExpanded={false}
                        isLast={isLastPopular}
                        parentLines={[true]}
                      >
                        <div
                          className={`group flex h-full flex-1 cursor-pointer items-center rounded px-1 transition-colors ${
                            selected
                              ? 'bg-human-2/20'
                              : previewed
                                ? 'bg-human-2/10'
                                : 'hover:bg-human-2/10'
                          }`}
                          onClick={() => onOpeningClick(opening, variation)}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="flex-shrink-0 font-mono text-xs font-medium text-secondary">
                              {opening.eco}
                            </span>
                            <span className="flex-shrink-0 text-sm text-primary">
                              {opening.name}
                            </span>
                            {variation && (
                              <span className="flex-shrink-0 text-xs text-secondary">
                                • {variation.name}
                              </span>
                            )}
                            <span className="ml-auto truncate font-mono text-xxs text-secondary/70">
                              {variation ? variation.pgn : opening.pgn}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onQuickAdd(opening, variation)
                            }}
                            className={`ml-1 flex-shrink-0 rounded p-0.5 transition-colors ${
                              selected
                                ? 'text-human-3 hover:text-human-4'
                                : 'text-secondary/60 hover:text-secondary group-hover:text-secondary/80'
                            }`}
                            title={
                              selected ? 'Already selected' : 'Add opening'
                            }
                          >
                            <span className="material-symbols-outlined !text-sm">
                              {selected ? 'check' : 'add'}
                            </span>
                          </button>
                        </div>
                      </TreeNode>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ECO Sections Tree */}
        <div className="">
          {filteredSections.map((section, sectionIndex) => {
            const isLastSection = sectionIndex === filteredSections.length - 1
            const sectionExpanded = autoExpandedSections.has(section.code)

            return (
              <div key={section.code}>
                {/* ECO Section Root Node */}
                <TreeNode
                  level={0}
                  hasChildren={section.openings.length > 0}
                  isExpanded={sectionExpanded}
                  isLast={isLastSection}
                  parentLines={[]}
                  onToggle={() => toggleSection(section.code)}
                >
                  <div
                    className="flex flex-1 cursor-pointer items-center justify-between rounded px-1 py-0.5 hover:bg-human-2/10"
                    onClick={() => toggleSection(section.code)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-bold text-human-4">
                        {section.code}
                      </span>
                      <span className="text-sm font-medium text-primary">
                        {section.name}
                      </span>
                    </div>
                    <span className="text-xs text-secondary">
                      ({section.openings.length})
                    </span>
                  </div>
                </TreeNode>

                {/* Openings grouped by ECO decade (e.g., A0–A9) under this section */}
                <AnimatePresence>
                  {sectionExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {Array.from(
                        section.openings.reduce((m, op) => {
                          const groupCode = op.eco.slice(0, 2)
                          if (!m.has(groupCode))
                            m.set(groupCode, [] as EcoOpening[])
                          m.get(groupCode)!.push(op)
                          return m
                        }, new Map<string, EcoOpening[]>()),
                      )
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(
                          ([groupCode, groupOpenings], groupIdx, allGroups) => {
                            const isLastGroup =
                              groupIdx === allGroups.length - 1
                            return (
                              <div key={`${section.code}-${groupCode}`}>
                                {/* Decade Group Node */}
                                <TreeNode
                                  level={1}
                                  hasChildren={groupOpenings.length > 0}
                                  isExpanded={autoExpandedDecades.has(
                                    `${section.code}:${groupCode}`,
                                  )}
                                  isLast={isLastGroup}
                                  parentLines={[!isLastSection]}
                                  onToggle={() =>
                                    toggleDecade(section.code, groupCode)
                                  }
                                >
                                  <div
                                    className="flex flex-1 cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-human-2/10"
                                    onClick={() =>
                                      toggleDecade(section.code, groupCode)
                                    }
                                  >
                                    <span className="font-mono text-sm font-medium text-human-4">
                                      {groupCode}
                                    </span>
                                    <span className="text-xs text-secondary">
                                      ({groupOpenings.length})
                                    </span>
                                  </div>
                                </TreeNode>

                                {/* Openings within group */}
                                {autoExpandedDecades.has(
                                  `${section.code}:${groupCode}`,
                                ) &&
                                  groupOpenings
                                    .slice()
                                    .sort((a, b) => a.eco.localeCompare(b.eco))
                                    .map((opening, openingIndex) => {
                                      const isLastOpening =
                                        openingIndex ===
                                        groupOpenings.length - 1
                                      const openingExpanded =
                                        autoExpandedOpenings.has(opening.id)
                                      const hasVariations =
                                        opening.variations.length > 0
                                      const openingPreviewed =
                                        isBeingPreviewed(opening)

                                      return (
                                        <div key={opening.id}>
                                          {/* Opening Node */}
                                          <TreeNode
                                            level={2}
                                            hasChildren={hasVariations}
                                            isExpanded={openingExpanded}
                                            isLast={isLastOpening}
                                            parentLines={[
                                              !isLastSection,
                                              !isLastGroup,
                                            ]}
                                            onToggle={
                                              hasVariations
                                                ? () =>
                                                    toggleOpening(opening.id)
                                                : undefined
                                            }
                                          >
                                            <div
                                              className={`group flex h-full flex-1 cursor-pointer items-center rounded px-1 transition-colors ${
                                                isSelected(opening)
                                                  ? 'bg-human-2/20'
                                                  : openingPreviewed
                                                    ? 'bg-human-2/10'
                                                    : 'hover:bg-human-2/10'
                                              }`}
                                              onClick={() => {
                                                if (hasVariations) {
                                                  toggleOpening(opening.id)
                                                }
                                                onOpeningClick(opening)
                                              }}
                                            >
                                              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                <span className="flex-shrink-0 font-mono text-xs text-secondary">
                                                  {opening.eco}
                                                </span>
                                                <span className="flex-shrink-0 text-sm text-primary">
                                                  {opening.name}
                                                </span>
                                                <span className="ml-auto truncate font-mono text-xxs text-secondary/70">
                                                  {opening.pgn}
                                                </span>
                                              </div>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  onQuickAdd(opening)
                                                }}
                                                className={`ml-1 flex-shrink-0 rounded p-0.5 transition-colors ${
                                                  isSelected(opening)
                                                    ? 'text-human-3 hover:text-human-4'
                                                    : 'text-secondary/60 hover:text-secondary group-hover:text-secondary/80'
                                                }`}
                                                title={
                                                  isSelected(opening)
                                                    ? 'Already selected'
                                                    : 'Add opening'
                                                }
                                              >
                                                <span className="material-symbols-outlined !text-sm">
                                                  {isSelected(opening)
                                                    ? 'check'
                                                    : 'add'}
                                                </span>
                                              </button>
                                            </div>
                                          </TreeNode>

                                          {/* Opening Variations (nested) */}
                                          <AnimatePresence>
                                            {openingExpanded &&
                                              hasVariations && (
                                                <motion.div
                                                  initial={{
                                                    height: 0,
                                                    opacity: 0,
                                                  }}
                                                  animate={{
                                                    height: 'auto',
                                                    opacity: 1,
                                                  }}
                                                  exit={{
                                                    height: 0,
                                                    opacity: 0,
                                                  }}
                                                  transition={{ duration: 0.2 }}
                                                  className="overflow-hidden"
                                                >
                                                  {(() => {
                                                    const toNodes = (
                                                      level: number,
                                                      nodes: any[],
                                                      parentLines: boolean[],
                                                      parentPath: string[] = [],
                                                    ) =>
                                                      nodes.map(
                                                        (
                                                          node: any,
                                                          idx: number,
                                                        ) => {
                                                          const isLast =
                                                            idx ===
                                                            nodes.length - 1
                                                          const path = [
                                                            ...parentPath,
                                                            node.name,
                                                          ].join(' > ')
                                                          const key = `${opening.id}::${path}`
                                                          const hasChildren =
                                                            node.children &&
                                                            node.children
                                                              .length > 0
                                                          const nodeExpanded =
                                                            expandedOpenings.has(
                                                              key as any,
                                                            ) || false
                                                          const selected =
                                                            node.variation
                                                              ? isSelected(
                                                                  opening,
                                                                  node.variation,
                                                                )
                                                              : isSelected(
                                                                  opening,
                                                                )
                                                          const previewed =
                                                            node.variation
                                                              ? isBeingPreviewed(
                                                                  opening,
                                                                  node.variation,
                                                                )
                                                              : isBeingPreviewed(
                                                                  opening,
                                                                )
                                                          return (
                                                            <div key={key}>
                                                              <TreeNode
                                                                level={level}
                                                                hasChildren={
                                                                  hasChildren
                                                                }
                                                                isExpanded={
                                                                  nodeExpanded
                                                                }
                                                                isLast={isLast}
                                                                parentLines={
                                                                  parentLines
                                                                }
                                                                onToggle={
                                                                  hasChildren
                                                                    ? () =>
                                                                        toggleOpening(
                                                                          key,
                                                                        )
                                                                    : undefined
                                                                }
                                                              >
                                                                <div
                                                                  className={`group flex h-full flex-1 cursor-pointer items-center rounded px-1 transition-colors ${
                                                                    selected
                                                                      ? 'bg-human-2/20'
                                                                      : previewed
                                                                        ? 'bg-human-2/10'
                                                                        : 'hover:bg-human-2/10'
                                                                  }`}
                                                                  onClick={() => {
                                                                    if (
                                                                      hasChildren
                                                                    )
                                                                      toggleOpening(
                                                                        key,
                                                                      )
                                                                    if (
                                                                      node.variation
                                                                    )
                                                                      onOpeningClick(
                                                                        opening,
                                                                        node.variation,
                                                                      )
                                                                  }}
                                                                >
                                                                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                                    <span className="flex-shrink-0 font-mono text-xs text-secondary">
                                                                      {node
                                                                        .variation
                                                                        ?.eco ||
                                                                        opening.eco}
                                                                    </span>
                                                                    <span className="flex-shrink-0 text-sm text-primary">
                                                                      {
                                                                        node.name
                                                                      }
                                                                    </span>
                                                                    {node.variation && (
                                                                      <span className="ml-auto truncate font-mono text-xxs text-secondary/70">
                                                                        {
                                                                          node
                                                                            .variation
                                                                            .pgn
                                                                        }
                                                                      </span>
                                                                    )}
                                                                  </div>
                                                                  {node.variation && (
                                                                    <button
                                                                      onClick={(
                                                                        e,
                                                                      ) => {
                                                                        e.stopPropagation()
                                                                        onQuickAdd(
                                                                          opening,
                                                                          node.variation,
                                                                        )
                                                                      }}
                                                                      className={`ml-1 flex-shrink-0 rounded p-0.5 transition-colors ${
                                                                        selected
                                                                          ? 'text-human-3 hover:text-human-4'
                                                                          : 'text-secondary/60 hover:text-secondary group-hover:text-secondary/80'
                                                                      }`}
                                                                      title={
                                                                        selected
                                                                          ? 'Already selected'
                                                                          : 'Add variation'
                                                                      }
                                                                    >
                                                                      <span className="material-symbols-outlined !text-sm">
                                                                        {selected
                                                                          ? 'check'
                                                                          : 'add'}
                                                                      </span>
                                                                    </button>
                                                                  )}
                                                                </div>
                                                              </TreeNode>
                                                              {hasChildren && (
                                                                <AnimatePresence>
                                                                  {nodeExpanded && (
                                                                    <motion.div
                                                                      initial={{
                                                                        height: 0,
                                                                        opacity: 0,
                                                                      }}
                                                                      animate={{
                                                                        height:
                                                                          'auto',
                                                                        opacity: 1,
                                                                      }}
                                                                      exit={{
                                                                        height: 0,
                                                                        opacity: 0,
                                                                      }}
                                                                      transition={{
                                                                        duration: 0.2,
                                                                      }}
                                                                      className="overflow-hidden"
                                                                    >
                                                                      {toNodes(
                                                                        level +
                                                                          1,
                                                                        node.children,
                                                                        [
                                                                          ...parentLines,
                                                                          !isLast,
                                                                        ],
                                                                        [
                                                                          ...parentPath,
                                                                          node.name,
                                                                        ],
                                                                      )}
                                                                    </motion.div>
                                                                  )}
                                                                </AnimatePresence>
                                                              )}
                                                            </div>
                                                          )
                                                        },
                                                      )
                                                    const tree =
                                                      buildVariationTree(
                                                        opening.variations as any,
                                                      )
                                                    return toNodes(3, tree, [
                                                      !isLastSection,
                                                      !isLastGroup,
                                                      !isLastOpening,
                                                    ])
                                                  })()}
                                                </motion.div>
                                              )}
                                          </AnimatePresence>
                                        </div>
                                      )
                                    })}
                              </div>
                            )
                          },
                        )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {filteredSections.length === 0 && searchTerm && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-secondary/50">
              search_off
            </span>
            <p className="mt-2 text-sm text-secondary">
              No openings found for &ldquo;{searchTerm}&rdquo;
            </p>
            <p className="mt-1 text-xs text-secondary/70">
              Try searching for opening names, ECO codes, variations, or PGN
              moves
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default EcoTreeView
