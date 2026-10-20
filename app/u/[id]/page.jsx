'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
export default function UserProfile({ params }) {
  const uid = params.id
  const [me, setMe] = useState(null), [p, setP] = useState(null), [stats, setStats] = useState(null), [rel, setRel] = useState(null), [msg, setMsg] = useState(''), [missing, setMissing] = useState(false), router = useRouter()
  const load = async () => {
    const { data } = await supabase.from('public_profiles').select('*').eq('id', uid).single()
    if (!data) return setMissing(true)
    setP(data)
    const { data: s } = await supabase.rpc('profile_stats', { uid })
    setStats(s)
    const { data: r } = await supabase.from('friendships').select('*').or(`requester.eq.${uid},addressee.eq.${uid}`)
    setRel((r || [])[0] || null)
  }
  useEffect(() => { getMe().then(m => { if (!m) return router.push('/login'); setMe(m); load() }) }, [uid])
  const add = async () => {
    const { error } = await supabase.from('friendships').insert({ addressee: uid })
    if (error && error.code !== '23505') return setMsg(error.message)
    load()
  }
  const accept = async () => { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', rel.id); load() }
  const remove = async () => { if (!confirm('Are you sure?')) return; await supabase.from('friendships').delete().eq('id', rel.id); load() }
  if (missing) return <p className="pt-8">User not found.</p>
  if (!p || !me) return <p className="pt-8">Loading…</p>
  const self = me.user.id === uid
  return (
    <div className="card mx-auto mt-8 max-w-sm space-y-4 text-center">
      <div className="flex justify-center"><Avatar path={p.avatar_path} name={p.username} size={112} /></div>
      <h1 className="text-2xl font-bold">{p.username || 'Reader'}</h1>
      <div className="flex justify-around">
        <div><div className="text-2xl font-bold">{stats?.friends ?? 0}</div><div className="text-sm opacity-70">Friends</div></div>
        <div><div className="text-sm font-semibold">{stats?.joined ? new Date(stats.joined).toLocaleDateString() : '—'}</div><div className="text-sm opacity-70">Joined</div></div>
      </div>
      <div className="flex items-center justify-center gap-2">
        {self ? <Link className="btn" href="/profile">Edit profile</Link>
          : !rel ? <button className="btn" onClick={add}>Add friend</button>
          : rel.status === 'accepted' ? <><Link className="btn" href={`/chat/${uid}`}>💬 Chat</Link><button className="underline" onClick={remove}>Remove</button></>
          : rel.addressee === me.user.id ? <><button className="btn" onClick={accept}>Accept</button><button className="btn" onClick={remove}>Decline</button></>
          : <span className="text-sm opacity-70">Requested</span>}
      </div>
      {msg && <p className="text-sm text-red-500">{msg}</p>}
    </div>
  )
}
