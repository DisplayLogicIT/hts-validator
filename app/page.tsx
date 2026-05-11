import Link from 'next/link'
import { SignedIn, SignedOut } from '@clerk/nextjs'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">HTS Validator</h1>
        <p className="text-lg opacity-70">
          Cross-reference Pentagon part numbers against the official USITC
          Harmonized Tariff Schedule. Drop a spreadsheet, get a validated
          report.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <SignedOut>
            <Link
              href="/sign-in"
              className="px-5 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="px-5 py-2 rounded-md border border-gray-300 dark:border-gray-700"
            >
              Create account
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="px-5 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black"
            >
              Open dashboard
            </Link>
          </SignedIn>
        </div>
      </div>
    </main>
  )
}
