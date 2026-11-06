import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, FolderKanban, PenLine, Target } from 'lucide-react'
import { getAdminSession } from '@/features/auth/session'
import LoginForm from './LoginForm'
import '../(protected)/studio.css'

export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } }

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, isAdmin } = await getAdminSession()
  if (user && isAdmin) redirect('/admin/dashboard')
  const { error } = await searchParams
  return <main className="admin-studio admin-login">
    <section className="admin-login-story" aria-label="Portfolio studio">
      <div className="admin-login-brand"><span>KM</span> Portfolio studio</div>
      <div className="admin-login-copy"><p>YOUR NEXT CHAPTER STARTS HERE</p><h1>Great work.<br />Beautifully<br /><span>managed.</span></h1><p>A home for your projects, stories, and the opportunities that come next.</p><div className="admin-login-features"><span><FolderKanban size={17} /> Curate your work</span><span><PenLine size={17} /> Share your ideas</span><span><Target size={17} /> Build connections</span></div></div>
      <div className="admin-login-art" aria-hidden="true"><span /><span /><span /><ArrowUpRight /></div>
      <p className="admin-login-note">A little structure. A lot of possibility.</p>
    </section>
    <section className="admin-login-form">
      <Link href="/" className="admin-login-back"><ArrowLeft size={15} /> Back to portfolio</Link>
      <div className="admin-login-form-inner"><span className="admin-eyebrow">YOUR CREATIVE WORKSPACE</span><h2>Welcome back.</h2><p>Sign in to make your next move.</p>
        {error === 'unauthorized' && <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">This account is not authorized to access the dashboard.</p>}
        <LoginForm />
        <div className="admin-login-access">Private workspace · Administrator access only</div>
      </div>
      <span className="admin-login-bottom">Portfolio studio / Content & connections</span>
    </section>
  </main>
}
