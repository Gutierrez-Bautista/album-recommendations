export class EmptyActiveCatalogError extends Error {
  constructor() {
    super('Cannot select a daily album from an empty active catalog')
    this.name = 'EmptyActiveCatalogError'
  }
}
