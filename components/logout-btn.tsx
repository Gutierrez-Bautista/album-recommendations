'use client'

import { authClient } from "@/lib/auth-client";

export default function LogoutButton () {
  return (
    <button className="bg-(--app-primary) px-6 py-2 rounded-full cursor-pointer hover:bg-(--app-primary-hover)" onClick={() => {
      const res = authClient.signOut({ callbackURL: '/login' }) 
      res.then(data => {
        window.location.replace(data.data?.url || '/')
      })
    }}>sign out</button>
  )
}