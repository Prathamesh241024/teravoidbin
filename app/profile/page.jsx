'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
const shrink = file => new Promise(res => {
  const img = new Image()
  img.onload = () => {
    const s = Math.min(img.width, img.height), c = document.createElement('canvas')
    c.width = c.height = 400
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 400, 400)
    c.toBlob(res, 'image/jpeg', 0.8)
  }
  img.src = URL.createObjectURL(file)
})
export default function Profile() {
  const [me, setMe] = useState(null), [name, setName] = useState(''), [path, setPath] = useState(null), [msg, setMsg] = useState(''), router = useRouter()
  useEffect(() => {
    (async () => {
      const m = await getMe(); if (!m) return router.push('/login')
      setMe(m)
      const { data } = await supabase.from('public_profiles').select('*').eq('id', m.user.id).single()
      setName(data?.username || ''); setPath(data?.avatar_path || null)
    })()
  }, [])
  const save = async e => {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ username: name.trim() || null }).eq('id', me.user.id)
    setMsg(!error ? 'Saved ✓' : error.code === '23505' ? 'That username is taken' : error.code === '23514' ? 'Use 3-20 letters, numbers or _' : error.message)
  }
  const photo = async file => {
    if (!file) return
    setMsg('Uploading…')
    const blob = await shrink(file), np = `${me.user.id}/${Date.now()}.jpg`
    const { error } = await supabase.storage.from('avatars').upload(np, blob, { contentType: 'image/jpeg' })
    if (error) return setMsg(error.message)
    if (path) await supabase.storage.from('avatars').remove([path])
    await supabase.from('profiles').update({ avatar_path: np }).eq('id', me.user.id)
    setPath(np); setMsg('Photo updated ✓')
  }
  if (!me) return null
  return (
    <form onSubmit={save} className="card mx-auto mt-8 max-w-sm space-y-4 text-center">
      <h1 className="text-2xl font-bold">My profile</h1>
      <div className="flex justify-center"><Avatar path={path} name={name} size={96} /></div>
      <label className="btn inline-block cursor-pointer">📷 Change photo
        <input type="file" accept="image/*" hidden onChange={e => photo(e.target.files[0])} />
      </label>
      <input className="input" placeholder="Username (3-20 letters, numbers, _)" value={name} onChange={e => setName(e.target.value)} />
      <button className="btn w-full">Save username</button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  )
}
