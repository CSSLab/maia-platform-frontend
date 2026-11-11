/**
 * Where the engines' files in public/ (Stockfish, ONNX Runtime and the Maia
 * worker) are fetched from: a folder named after their contents, which
 * browsers keep for a year (see next.config.js). Without the version (in
 * tests), straight from public/.
 */
const version = process.env.NEXT_PUBLIC_ENGINE_FILES_VERSION

export const ENGINE_FILES_BASE = version ? `/v/${version}` : ''
