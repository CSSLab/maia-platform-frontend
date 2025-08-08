declare module '*.tsv' {
  // In Next/Webpack, importing a non-code asset typically returns a public URL string.
  const url: string
  export default url
}
