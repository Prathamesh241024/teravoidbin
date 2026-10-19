import { createClient } from '@supabase/supabase-js'
export const SITE = 'MyLib' // change to your site name
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
export async function getMe() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  return { user: session.user, admin: data?.role === 'admin' }
}
export async function download(item) {
  const { data, error } = await supabase.storage.from('library').createSignedUrl(item.file_path, 60, { download: true })
  if (error) return alert(error.message)
  location.href = data.signedUrl
}
