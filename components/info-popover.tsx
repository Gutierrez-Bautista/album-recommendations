'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import * as Popover from 'radix-ui/popover'

type Props = {
  label: ReactNode
  contentLabel: string
  children: ReactNode
  className?: string
  showIcon?: boolean
  triggerLabel?: string
}

export function InfoPopover({
  label,
  contentLabel,
  children,
  className = '',
  showIcon = true,
  triggerLabel,
}: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          className={"inline-flex items-center gap-2 text-left cursor-help " + className}
        >
          {label}

          {showIcon && <Image
            src="/info.svg"
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
            className="opacity-70"
          />}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          aria-label={contentLabel}
          side="top"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-w-[min(16rem,calc(100vw-1.5rem))] wrap-anywhere rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white/80 shadow-xl outline-none"
        >
          {children}

          <Popover.Arrow className="fill-zinc-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
