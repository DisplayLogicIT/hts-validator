import { currentUser } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'
import { pingSupabase } from '@/lib/supabase/server'
import { LookupForm } from '@/components/lookup-form'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await currentUser()
  const health = await pingSupabase()

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight">HTS Validator</h1>
        <UserButton afterSignOutUrl="/" />
      </header>

      <section className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold mb-1">
            Welcome, {user?.firstName ?? user?.username ?? 'there'}
          </h2>
          <p className="opacity-70 text-sm">
            Enter a Pentagon part number or description to get its USITC Harmonized Tariff Schedule classification.
          </p>
        </div>

        <div>
          <h3 className="font-medium mb-3">HTS Lookup</h3>
          <LookupForm />
        </div>

        <details className="text-xs opacity-50">
          <summary className="cursor-pointer select-none">System status</summary>
          <ul className="mt-2 space-y-1 pl-2">
            <li>
              Clerk:{' '}
              <span className="font-mono text-green-600 dark:text-green-400">ok</span>
              {' '}({user?.id})
            </li>
            <li>
              Supabase:{' '}
              {health.ok ? (
                <span className="font-mono text-green-600 dark:text-green-400">reachable</span>
              ) : (
                <span className="font-mono text-red-600 dark:text-red-400">error — {health.error}</span>
              )}
            </li>
          </ul>
        </details>
      </section>
    </main>
  )
}
