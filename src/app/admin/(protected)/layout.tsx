import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getAdminSession } from '@/features/auth/session'
import { signOutAction } from '@/features/auth/actions'
import { getStatusCounts } from '@/features/inbox/queries'
import { getLeadStatusCounts } from '@/features/freelance/queries'
import { getReviewStatusCounts } from '@/features/reviews/queries'
import { getAdminProfileSummary } from '@/features/cms/queries'
import { Button } from '@/components/ui/button'
import AdminShell from './AdminShell'
import { SIDEBAR_COOKIE, isSidebarCollapsed } from './sidebar-state'

// Protected dashboard shell. The server-side guard here (plus RLS in the
// database) is the security boundary; middleware only keeps tokens fresh.
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAdmin } = await getAdminSession()

  // Anonymous -> login.
  if (!user) redirect('/admin/login')

  // Authenticated but not an administrator -> explicit unauthorized state.
  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
          <h1 className="mb-2 text-xl font-bold text-foreground">Not authorized</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            You are signed in as <span className="font-medium">{user.email}</span>, but this
            account is not an administrator.
          </p>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full">
              <LogOut size={16} />
              Sign out
            </Button>
          </form>
        </div>
      </main>
    )
  }

  // Real "new" counts for the nav badges (admin RLS context). Resolved here so
  // every admin page keeps a consistent, up-to-date sidebar.
  const [messageCounts, leadCounts, reviewCounts, profile, cookieStore] = await Promise.all([
    getStatusCounts(),
    getLeadStatusCounts(),
    getReviewStatusCounts(),
    getAdminProfileSummary(),
    cookies(),
  ])

  return (
    <AdminShell
      email={user.email ?? 'Admin'}
      profile={profile}
      counts={{ newMessages: messageCounts.new, newLeads: leadCounts.new, pendingReviews: reviewCounts.pending }}
      defaultCollapsed={isSidebarCollapsed(cookieStore.get(SIDEBAR_COOKIE)?.value)}
    >
      {children}
    </AdminShell>
  )
}
