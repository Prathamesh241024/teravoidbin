import { createClient } from '@supabase/supabase-js'
import Library from '@/components/Library'
export const revalidate = 60
export default async function Home() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data } = await sb.from('items').select('*').order('created_at', { ascending: false }).limit(60)
  return <Library initial={data || []} />
}
