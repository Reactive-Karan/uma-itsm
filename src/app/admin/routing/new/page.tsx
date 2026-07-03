import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RuleForm } from './RuleForm'

export const metadata = { title: 'Add Routing Rule' }

export default async function AddRoutingRulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: regions }, { data: deptUsers }] = await Promise.all([
    supabase.from('regions').select('id, name, code').eq('is_active', true).order('name'),
    supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'dept_user')
      .eq('is_active', true)
      .order('full_name'),
  ])

  return (
    <RuleForm
      regions={regions ?? []}
      deptUsers={deptUsers ?? []}
    />
  )
}
