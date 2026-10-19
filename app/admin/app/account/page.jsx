'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
export default function Account() {
  const [pw, setPw] = useState(''), [msg, setMsg] = useState(''), router = useRouter()
  useEffect(() => { getMe().then(m => { if (!m) router.push('/login') }) }, [])
  const save = async e => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pw })
    setMsg(error ? error.message : 'Password changed')
    if (!error) setPw('')
  }
  return (
    <form onSubmit={save} className="card mx-auto mt-10 max-w-sm space-y-3">
      <h1 className="text-2xl font-bold">Change password</h1>
      <input className="input" type="password" placeholder="New password (6+ characters)" minLength={6} value={pw} onChange={e => setPw(e.target.value)} required />
      <button className="btn w-full">Save password</button>
      <p className="text-sm">{msg}</p>
    </form>
  )
}
