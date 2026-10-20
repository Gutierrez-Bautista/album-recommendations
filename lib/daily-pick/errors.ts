export class EmptyActiveCatalogError extends Error {
  constructor() {
    super('Cannot select a daily album from an empty active catalog')
    this.name = 'EmptyActiveCatalogError'
  }
}

export class InvalidPickDateError extends Error {
  constructor(public readonly pickDate: string) {
    super(`Invalid daily pick date: ${pickDate}. Expected a valid YYYY-MM-DD date`)
    this.name = 'InvalidPickDateError'
  }
}

export class OutOfOrderDailyPickError extends Error {
  constructor(
    public readonly pickDate: string,
    public readonly latestPickDate: string,
  ) {
    super(`Cannot generate a daily pick for ${pickDate}: a later pick exists for ${latestPickDate}`)
    this.name = 'OutOfOrderDailyPickError'
  }
}
