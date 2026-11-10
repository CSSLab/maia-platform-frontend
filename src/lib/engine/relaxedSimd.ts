// i8x16.relaxed_swizzle, the probe from wasm-feature-detect. The relaxed-SIMD
// build searches ~30% more positions a second; Chrome and Firefox have it.
export const hasRelaxedSimd = () =>
  typeof WebAssembly !== 'undefined' &&
  WebAssembly.validate(
    new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 15,
      1, 13, 0, 65, 1, 253, 15, 65, 2, 253, 15, 253, 128, 2, 11,
    ]),
  )
