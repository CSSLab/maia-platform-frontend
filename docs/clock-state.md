# Clock state for electronic boards and clocks

During a game on the play pages (`/play/maia`, `/play/hb`), Maia Chess publishes
the game's clocks so that a tool which drives a physical board or clock
(for example ChessConnect) can follow them without reading the page's
markup.

## Reading it

```js
// The current state, or undefined when no game is open
window.__MaiaClockState

// Sent on every change; detail is the new state, or null when the game is left
window.addEventListener('maia:clockstate', (event) => {
  const state = event.detail
})
```

Both live in the page's own JavaScript world: a browser extension reads
them from a script it runs in the page (the main world).

## Fields

| Field                                  | Type                                                   | Meaning                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `version`                              | `1`                                                    | Bumped only if a field changes meaning or is removed. New fields may be added.                                            |
| `whiteRemainingMs`, `blackRemainingMs` | number                                                 | Each side's remaining time at `remainingAtMs`.                                                                            |
| `whiteInitialMs`, `blackInitialMs`     | number                                                 | The starting time. `0` in unlimited games.                                                                                |
| `incrementMs`                          | number                                                 | Added to a side's clock after each of its moves.                                                                          |
| `remainingAtMs`                        | number                                                 | Epoch milliseconds (`Date.now()`) at which the remaining times held.                                                      |
| `turnColor`                            | `'white'` \| `'black'` \| `null`                       | Whose turn it is; `null` once the game is over.                                                                           |
| `activeColor`                          | `'white'` \| `'black'` \| `null`                       | The clock that is counting down. `null` in unlimited games, until both sides have made a move, and once the game is over. |
| `lifecycle`                            | `'not_started'` \| `'ongoing'` \| `'finished'`         | `ongoing` from the first move.                                                                                            |
| `result`                               | `'white_wins'` \| `'black_wins'` \| `'draw'` \| `null` | Set once the game is over.                                                                                                |

The state is only published when something changes (a move, a take-back,
added time, the end of the game), not every tick. The running clock's time
now is:

```js
const running =
  state.activeColor === 'white'
    ? state.whiteRemainingMs
    : state.blackRemainingMs
const now = Math.max(running - (Date.now() - state.remainingAtMs), 0)
```

The object is frozen; a new one replaces it on each change.
