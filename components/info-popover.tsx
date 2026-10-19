'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import * as Popover from 'radix-ui/popover'

type Props = {
  label: ReactNode
  contentLabel: string
  children: ReactNode
  className?: string
}

export function InfoPopover({
  label,
  contentLabel,
  children,
  className
}: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={"inline-flex items-center gap-2 text-left cursor-help " + className}
        >
          {label}

          <Image
            src="/info.svg"
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
            className="opacity-70"
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          aria-label={contentLabel}
          side="top"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-w-64 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white/80 shadow-xl outline-none"
        >
          {children}

          <Popover.Arrow className="fill-zinc-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}