import { useEffect, useRef } from 'react'

// Where e-board tools such as ChessConnect put their connect button: a
// `#chessconnect-div` in the header, on every page. It is one element for
// the whole visit, moved between the desktop and phone headers, so a button
// put in it stays when the layout changes. It takes no space while empty.
export const CONNECT_BUTTON_SLOT_ID = 'chessconnect-div'

let slot: HTMLDivElement | null = null

const getSlot = () => {
  if (!slot) {
    slot = document.createElement('div')
    slot.id = CONNECT_BUTTON_SLOT_ID
    slot.className = 'flex items-center empty:hidden'
  }
  return slot
}

export const ConnectButtonSlot = () => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.appendChild(getSlot())
  }, [])

  // `contents`: the host adds no box of its own, so an empty slot leaves no
  // gap between the header's buttons.
  return <div ref={ref} className="contents" />
}
