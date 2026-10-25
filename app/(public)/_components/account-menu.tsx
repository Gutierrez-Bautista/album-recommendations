'use client'

import { useState } from 'react'
import * as Avatar from 'radix-ui/avatar'
import * as DropdownMenu from 'radix-ui/dropdown-menu'
import { useSignOut } from '@/components/logout-btn'
import { useDeleteAccount } from '@/components/delete-account-btn'

const itemClassName = 'cursor-pointer rounded px-3 py-2 text-sm outline-none transition-colors data-highlighted:bg-white/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--app-primary-light) data-disabled:cursor-not-allowed data-disabled:opacity-50'

export function AccountMenu({ image }: { image: string | null }) {
  const [open, setOpen] = useState(false)
  const [activeAction, setActiveAction] = useState<'sign-out' | 'delete-account' | null>(null)
  // Action state stays mounted when Radix removes its portal on dismissal.
  const signOut = useSignOut()
  const deletion = useDeleteAccount()
  const pending = signOut.pending || deletion.pending
  const error = activeAction === 'sign-out' ? signOut.error
    : activeAction === 'delete-account' ? deletion.error : null

  return (
    <div className="relative shrink-0">
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label="Account menu" className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/20 transition-colors hover:border-(--app-primary-light) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--app-primary-light)">
            <Avatar.Root className="flex size-full items-center justify-center overflow-hidden rounded-full bg-zinc-800">
              {/* Radix loads the profile image in the browser, independent of Next image optimization. */}
              <Avatar.Image src={image?.trim() || undefined} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
              <Avatar.Fallback className="flex size-full items-center justify-center text-zinc-300">
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                </svg>
              </Avatar.Fallback>
            </Avatar.Root>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={10} collisionPadding={12} className="z-50 w-56 max-w-[calc(100vw-1.5rem)] max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 p-1.5 text-zinc-100 shadow-xl">
            <DropdownMenu.Item
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault()
                setActiveAction('sign-out')
                void signOut.signOut()
              }}
              className={itemClassName}
            >
              {signOut.pending ? 'Signing out…' : 'Sign out'}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-white/10" />
            <DropdownMenu.Item
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault()
                setActiveAction('delete-account')
                void deletion.deleteAccount()
              }}
              className={`${itemClassName} text-(--danger)`}
            >
              {deletion.pending ? 'Deleting account…' : 'Delete account'}
            </DropdownMenu.Item>
            {error && <p role="alert" className="mt-1 border-t border-white/10 px-3 py-2 text-sm text-red-300 wrap-anywhere">{error}</p>}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {!open && (error || pending) && (
        <div className="absolute top-full right-0 z-50 mt-3 w-64 max-w-[calc(100vw-1.5rem)] rounded-lg border border-white/10 bg-zinc-900 p-3 text-sm shadow-xl">
          {error ? <p role="alert" className="text-red-300 wrap-anywhere">{error}</p>
            : <p role="status" className="text-zinc-300">{deletion.pending ? 'Deleting account…' : 'Signing out…'}</p>}
        </div>
      )}
    </div>
  )
}
