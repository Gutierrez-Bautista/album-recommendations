'use client'

import { setGuestLegalAcceptanceCookie } from "../actions"
import Link from "next/link"

export default function TermsModal () {
  return (
    <div className="absolute h-screen w-screen z-30 bg-green-200/15 flex justify-center items-center">
      <div className="bg-zinc-900 rounded-lg z-40 p-12 text-center">
        <h1 className='text-3xl font-bold'>Terms and privacy</h1>

        <p className='my-4 text-center text-zinc-300'>
          By selecting “Accept and continue”, you agree to the <Link href='/terms' target="_blank" className="underline text-(--app-primary-light) cursor-pointer">Terms and Conditions</Link> and acknowledge the <Link href='/privacy' target="_blank" className="underline text-(--app-primary-light) cursor-pointer">Privacy Policy</Link>.
        </p>

        <form action={setGuestLegalAcceptanceCookie}>
          <button
            className='px-6 py-2 rounded-full transition cursor-pointer hover:scale-105 bg-(--app-primary) hover:bg-(--app-primary-hover) text-white'
          >
            Accept and view today’s recommendation
          </button>
        </form>
      </div>
    </div>
  )
}