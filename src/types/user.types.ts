export type UserRole = 'requester' | 'dept_user' | 'manager' | 'super_admin'

export interface UserProfile {
  id: string
  auth_id: string
  email: string
  full_name: string
  role: UserRole
  region_id: string | null
  department_id: string | null
  is_ooo: boolean
  ooo_start_date: string | null
  ooo_end_date: string | null
  ooo_backup_user_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserSession {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
}

export const ROLE_LABELS: Record<UserRole, string> = {
  requester: 'Requester',
  dept_user: 'Department User',
  manager: 'Manager',
  super_admin: 'Super Admin',
}

export const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  requester: '/requester/dashboard',
  dept_user: '/dept-user/dashboard',
  manager: '/manager/dashboard',
  super_admin: '/admin/dashboard',
}

// Routes accessible to each role (and all higher roles)
export const ROUTE_ROLE_MAP: Record<string, UserRole[]> = {
  '/requester': ['requester', 'dept_user', 'manager', 'super_admin'],
  '/dept-user': ['dept_user', 'manager', 'super_admin'],
  '/manager': ['manager', 'super_admin'],
  '/admin': ['super_admin'],
}
