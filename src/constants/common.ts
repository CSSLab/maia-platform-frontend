export const MAIA_MODELS = Array.from(
  { length: 21 },
  (_, i) => `maia_kdd_${600 + i * 100}`,
)

export const MAIA_RATINGS = MAIA_MODELS.map((m) =>
  parseInt(m.replace('maia_kdd_', '')),
)

export const MAIA_MODELS_WITH_NAMES = MAIA_MODELS.map((model) => ({
  id: model,
  name: model.replace('maia_kdd_', 'Maia '),
}))

export const MAIA3_OPPONENT_RATINGS = Array.from({ length: 21 }, (_, i) => {
  const rating = 600 + i * 100
  return { id: `maia_kdd_${rating}`, name: `Maia-3 ${rating}` }
})
