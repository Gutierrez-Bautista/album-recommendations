'use client'

import { authClient } from "@/lib/auth-client";

export default function LogoutButton () {
  return (
    <button className="bg-(--app-primary) px-6 py-2 rounded-full cursor-pointer hover:bg-(--app-primary-hover)" onClick={() => { authClient.signOut({ callbackURL: '/login' }) }}>sign out</button>
  )
}