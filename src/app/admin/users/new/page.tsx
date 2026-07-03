import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProvisionUserForm } from './ProvisionUserForm'

export const metadata = { title: 'Provision User — User Management' }

export default async function ProvisionUserPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: regions }, { data: departments }] = await Promise.all([
    supabase.from('regions').select('id, name, code').eq('is_active', true).order('name'),
    supabase.from('departments').select('id, name, code').order('name'),
  ])

  return (
    <ProvisionUserForm
      regions={regions ?? []}
      departments={departments ?? []}
    />
  )
}
