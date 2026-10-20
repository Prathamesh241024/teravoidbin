'use client'
import { supabase } from '@/lib/supabase'
export default function Avatar({ path, name, size = 40 }) {
  const url = path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null
  return url
    ? <img src={url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
    : <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-indigo-200 font-bold text-indigo-900">{(name || '?')[0].toUpperCase()}</div>
}
