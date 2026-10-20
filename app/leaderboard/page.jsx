'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
import { levelOf } from '@/lib/level'
import Avatar from '@/components/Avatar'
const MEDAL = ['🥇', '🥈', '🥉']
export default function Leaderboard() {
  const [me, setMe] = useState(null), [rows, setRows] = useState([]), [people, setPeople] = useState({}), [mine, setMine] = useState(null), router = useRouter()
  useEffect(() => {
    (async () => {
      const m = await getMe(); if (!m) return router.push('/login')
      setMe(m)
      const { data } = await supabase.from('user_xp').select('*').order('xp', { ascending: false }).limit(50)
      setRows(data || [])
      const ids = (data || []).map(r => r.user_id)
      if (ids.length) {
        const { data: p } = await supabase.from('public_profiles').select('*').in('id', ids)
        setPeople(Object.fromEntries((p || []).map(x => [x.id, x])))
      }
      const { data: x } = await supabase.from('user_xp').select('xp').eq('user_id', m.user.id).maybeSingle()
      const v = x?.xp || 0
      const { count } = await supabase.from('user_xp').select('*', { count: 'exact', head: true }).gt('xp', v)
      setMine({ xp: v, rank: (count || 0) + 1 })
    })()
  }, [])
  if (!me) return null
  return (
    <div className="space-y-3 pt-6">
      <h1 className="text-2xl font-bold">🏆 Leaderboard</h1>
      <p className="text-sm opacity-70">Earn XP: daily visit +10 · read a book +10 · comment +5</p>
      {mine && <div className="card text-sm">Your rank: <b>#{mine.rank}</b> · Level {levelOf(mine.xp)} · {mine.xp} XP</div>}
      {rows.map((r, i) => {
        const p = people[r.user_id]
        return (
          <Link key={r.user_id} href={`/u/${r.user_id}`} className={`card flex items-center gap-3 ${r.user_id === me.user.id ? 'ring-2 ring-indigo-500' : ''}`}>
            <span className="w-8 text-center text-lg font-bold">{MEDAL[i] || i + 1}</span>
            <Avatar path={p?.avatar_path} name={p?.username} />
            <b className="min-w-0 flex-1 truncate">{p?.username || 'Reader'}</b>
            <span className="text-right text-sm">Lv {levelOf(r.xp)}<br /><span className="opacity-60">{r.xp} XP</span></span>
          </Link>
        )
      })}
      {!rows.length && <p className="text-sm opacity-60">No one has earned XP yet. Read a book or post a comment!</p>}
    </div>
  )
}
