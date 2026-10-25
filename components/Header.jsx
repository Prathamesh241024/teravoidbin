'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe, SITE } from '@/lib/supabase'
const cls = 'block w-full rounded-xl bg-indigo-100 px-4 py-3 text-left font-semibold text-indigo-900 dark:bg-slate-800 dark:text-indigo-200'
export default function Header() {
  const [open, setOpen] = useState(false), [me, setMe] = useState(null), router = useRouter()
  useEffect(() => {
    getMe().then(m => { setMe(m); if (m) supabase.rpc('award_xp', { k: 'daily' }).then(() => {}) })
    const { data: s } = supabase.auth.onAuthStateChange(() => getMe().then(setMe))
    return () => s.subscription.unsubscribe()
  }, [])
  const theme = () => {
    const d = document.documentElement
    d.classList.toggle('dark'); localStorage.theme = d.classList.contains('dark') ? 'dark' : 'light'
  }
  const out = async () => { await supabase.auth.signOut(); setOpen(false); router.push('/') }
  const L = ({ href, children }) => <Link href={href} onClick={() => setOpen(false)} className={cls}>{children}</Link>
  return (
    <header className="sticky top-0 z-10 bg-white/90 shadow backdrop-blur dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-3xl font-extrabold text-indigo-900 dark:text-indigo-300">{SITE}</Link>
        <div className="flex gap-2">
          <button onClick={theme} className="btn" aria-label="Toggle dark mode">🌓</button>
          <button onClick={() => setOpen(!open)} className="btn" aria-label="Menu">{open ? '✕' : '☰'}</button>
        </div>
      </div>
      {open && (
        <nav className="mx-auto max-w-5xl space-y-2 px-4 pb-4">
          <L href="/">🏠 Home</L>
          {me?.admin && <L href="/admin">🛠 Admin upload</L>}
          {me?.admin && <L href="/admin/chapters">➕ Add chapters</L>}
          {me && <L href="/profile">🙂 My profile</L>}
          {me && <L href="/friends">👥 Friends & chat</L>}
          {me && <L href="/chats">💬 Messages</L>}
          {me && <L href="/leaderboard">🏆 Leaderboard</L>}
          {me ? <button onClick={out} className={cls}>🚪 Log out</button> : <L href="/login">👤 Log in / Sign up</L>}
        </nav>
      )}
    </header>
  )
}
