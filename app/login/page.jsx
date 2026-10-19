'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
export default function Login() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [mode, setMode] = useState('in'), [msg, setMsg] = useState(''), router = useRouter()
  const go = async e => {
    e.preventDefault()
    const creds = { email, password: pw }
    const { data, error } = mode === 'in' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds)
    if (error) return setMsg(error.message)
    if (mode === 'up' && !data.session) return setMsg('Check your email to confirm your account, then log in.')
    router.push('/')
  }
  return (
    <form onSubmit={go} className="card mx-auto mt-10 max-w-sm space-y-3">
      <h1 className="text-2xl font-bold">{mode === 'in' ? 'Log in' : 'Sign up'}</h1>
      <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="Password (6+ characters)" minLength={6} value={pw} onChange={e => setPw(e.target.value)} required />
      <button className="btn w-full">{mode === 'in' ? 'Log in' : 'Create account'}</button>
      {msg && <p className="text-sm text-red-500">{msg}</p>}
      <button type="button" className="text-sm underline" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'No account? Sign up' : 'Have an account? Log in'}
      </button>
    </form>
  )
}
