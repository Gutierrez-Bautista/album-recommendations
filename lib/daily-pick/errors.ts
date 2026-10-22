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

export class MissingDailyPickStartDateError extends Error {
  constructor() {
    super('DAILY_PICK_START_DATE must be configured with a valid YYYY-MM-DD date')
    this.name = 'MissingDailyPickStartDateError'
  }
}

export class InvalidDailyPickStartDateError extends Error {
  constructor(public readonly startDate: string) {
    super(`Invalid DAILY_PICK_START_DATE: ${startDate}. Expected a valid YYYY-MM-DD date`)
    this.name = 'InvalidDailyPickStartDateError'
  }
}

export class DailyPickTargetBeforeStartDateError extends Error {
  constructor(
    public readonly targetDate: string,
    public readonly startDate: string,
  ) {
    super(`Daily pick target ${targetDate} precedes the configured start date ${startDate}`)
    this.name = 'DailyPickTargetBeforeStartDateError'
  }
}

export class IncompatibleDailyPickHistoryError extends Error {
  constructor(
    public readonly startDate: string,
    public readonly earliestPickDate: string,
  ) {
    super(`Daily pick history starts on ${earliestPickDate}, before the configured start date ${startDate}`)
    this.name = 'IncompatibleDailyPickHistoryError'
  }
}
