'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
export default function Friends() {
  const [me, setMe] = useState(null), [q, setQ] = useState(''), [found, setFound] = useState([]), [rels, setRels] = useState([]), [people, setPeople] = useState({}), [msg, setMsg] = useState(''), router = useRouter()
  const load = async uid => {
    const { data } = await supabase.from('friendships').select('*')
    const rows = data || []
    setRels(rows)
    const ids = [...new Set(rows.map(r => (r.requester === uid ? r.addressee : r.requester)))]
    if (ids.length) {
      const { data: p } = await supabase.from('public_profiles').select('*').in('id', ids)
      setPeople(Object.fromEntries((p || []).map(x => [x.id, x])))
    }
  }
  useEffect(() => { getMe().then(m => { if (!m) return router.push('/login'); setMe(m); load(m.user.id) }) }, [])
  const search = async e => {
    e.preventDefault()
    const t = q.replace(/[^A-Za-z0-9_]/g, '')
    if (t.length < 2) return setMsg('Type at least 2 characters')
    setMsg('')
    const { data } = await supabase.from('public_profiles').select('*').ilike('username', `%${t}%`).neq('id', me.user.id).limit(10)
    setFound(data || [])
    if (!data?.length) setMsg('No one found')
  }
  if (!me) return null
  const other = r => (r.requester === me.user.id ? r.addressee : r.requester)
  const relWith = id => rels.find(r => other(r) === id)
  const add = async id => {
    const { error } = await supabase.from('friendships').insert({ addressee: id })
    if (error) return setMsg(error.message)
    load(me.user.id)
  }
  const accept = async r => { await supabase.from('friendships').update({ status: 'accepted' }).eq('id', r.id); load(me.user.id) }
  const remove = async r => { await supabase.from('friendships').delete().eq('id', r.id); load(me.user.id) }
  const incoming = rels.filter(r => r.status === 'pending' && r.addressee === me.user.id)
  const friends = rels.filter(r => r.status === 'accepted')
  const Row = ({ id, children }) => {
    const p = people[id] || found.find(x => x.id === id)
    return (
      <div className="card flex items-center gap-3">
        <Avatar path={p?.avatar_path} name={p?.username} />
        <b className="min-w-0 flex-1 truncate">{p?.username || 'Reader'}</b>
        {children}
      </div>
    )
  }
  return (
    <div className="space-y-4 pt-6">
      <form onSubmit={search} className="card space-y-2">
        <h1 className="text-2xl font-bold">Find friends</h1>
        <div className="flex gap-2">
          <input className="input" placeholder="Search a username…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn">Search</button>
        </div>
        <p className="text-sm opacity-70">Others find you by your username. <Link href="/profile" className="underline">Set yours</Link></p>
        {msg && <p className="text-sm text-red-500">{msg}</p>}
      </form>
      {found.map(u => {
        const r = relWith(u.id)
        return (
          <Row key={u.id} id={u.id}>
            {!r ? <button className="btn" onClick={() => add(u.id)}>Add friend</button>
              : r.status === 'accepted' ? <Link className="btn" href={`/chat/${u.id}`}>💬 Chat</Link>
              : r.addressee === me.user.id ? <button className="btn" onClick={() => accept(r)}>Accept</button>
              : <span className="text-sm opacity-70">Requested</span>}
          </Row>
        )
      })}
      {incoming.length > 0 && <h2 className="text-lg font-bold">Friend requests</h2>}
      {incoming.map(r => (
        <Row key={r.id} id={other(r)}>
          <button className="btn" onClick={() => accept(r)}>Accept</button>
          <button className="text-red-500" onClick={() => remove(r)}>✕</button>
        </Row>
      ))}
      <h2 className="text-lg font-bold">My friends ({friends.length})</h2>
      {friends.map(r => (
        <Row key={r.id} id={other(r)}>
          <Link className="btn" href={`/chat/${other(r)}`}>💬 Chat</Link>
          <button className="text-red-500" onClick={() => confirm('Remove friend?') && remove(r)}>✕</button>
        </Row>
      ))}
      {!friends.length && <p className="text-sm opacity-60">No friends yet. Search a username above.</p>}
    </div>
  )
}
