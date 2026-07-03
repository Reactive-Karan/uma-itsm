import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { RuleForm } from '../../new/RuleForm'

export const metadata = { title: 'Edit Routing Rule' }

interface PageProps {
  readonly params: Promise<{ id: string }>
}

export default async function EditRoutingRulePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rule }, { data: regions }, { data: deptUsers }] = await Promise.all([
    supabase
      .from('routing_rules')
      .select('id, region_id, request_type, sub_type, primary_assignee_id, backup_assignee_id, is_active')
      .eq('id', id)
      .single(),
    supabase.from('regions').select('id, name, code').eq('is_active', true).order('name'),
    supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'dept_user')
      .eq('is_active', true)
      .order('full_name'),
  ])

  if (!rule) notFound()

  return (
    <RuleForm
      regions={regions ?? []}
      deptUsers={deptUsers ?? []}
      existing={rule}
    />
  )
}
