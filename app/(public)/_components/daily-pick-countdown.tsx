'use client'

import { useEffect, useState } from 'react'
import { watchLocalClock } from './daily-pick-dates'

type Props = {
  onDateChange: (date: string) => void
}

export function DailyPickCountdown({ onDateChange }: Props) {
  // The server cannot know the browser's local date or time zone.
  const [remaining, setRemaining] = useState('--:--:--')

  useEffect(() => watchLocalClock(setRemaining, onDateChange), [onDateChange])

  return (
    <p className="flex shrink-0 flex-col gap-1 text-sm text-zinc-400 sm:text-right">
      <span>Next album in</span>
      <span className="font-mono text-xl font-medium tabular-nums text-zinc-200">
        {remaining}
      </span>
    </p>
  )
}
