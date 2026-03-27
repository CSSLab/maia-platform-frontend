export const MAIA_MODELS = [
  'maia_kdd_1100',
  'maia_kdd_1200',
  'maia_kdd_1300',
  'maia_kdd_1400',
  'maia_kdd_1500',
  'maia_kdd_1600',
  'maia_kdd_1700',
  'maia_kdd_1800',
  'maia_kdd_1900',
]

export const MAIA_MODELS_WITH_NAMES = MAIA_MODELS.map((model) => ({
  id: model,
  name: model.replace('maia_kdd_', 'Maia '),
}))

export const MAIA3_OPPONENT_RATINGS = Array.from({ length: 21 }, (_, i) => {
  const rating = 600 + i * 100
  return { id: `maia_kdd_${rating}`, name: `Maia-3 ${rating}` }
})
