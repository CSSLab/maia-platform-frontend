import type { ElementType } from 'react'

// chessground's elements, which its board and coordinate styles are written
// for.
const CgContainer = 'cg-container' as unknown as ElementType
const CgBoard = 'cg-board' as unknown as ElementType
const Coords = 'coords' as unknown as ElementType
const Coord = 'coord' as unknown as ElementType

const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8']
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

/**
 * An empty board as GameBoard draws it (the same elements, classes and
 * coordinates, white at the bottom), drawn with CSS alone so that it shows
 * before the page's JavaScript has run. Page shells put it where the board
 * will be.
 */
export const EmptyBoard: React.FC = () => (
  <div className="relative h-full w-full">
    <div style={{ height: '100%', width: '100%' }}>
      <div
        className="cg-wrap orientation-white"
        style={{ height: '100%', width: '100%', display: 'table' }}
      >
        <CgContainer>
          <CgBoard />
          <Coords className="ranks">
            {RANKS.map((rank) => (
              <Coord key={rank}>{rank}</Coord>
            ))}
          </Coords>
          <Coords className="files">
            {FILES.map((file) => (
              <Coord key={file}>{file}</Coord>
            ))}
          </Coords>
        </CgContainer>
      </div>
    </div>
  </div>
)
