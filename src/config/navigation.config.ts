import type { UserRole } from '@/types/user.types'

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: string
}

export const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  requester: [
    { label: 'My Tickets', href: '/requester/dashboard', icon: 'LayoutDashboard' },
    { label: 'Submit a Ticket', href: '/requester/tickets/new', icon: 'PlusCircle' },
    { label: 'Notifications', href: '/requester/notifications', icon: 'Bell' },
  ],
  dept_user: [
    { label: 'My Queue', href: '/dept-user/dashboard', icon: 'LayoutDashboard' },
    { label: 'Department Tickets', href: '/dept-user/tickets', icon: 'Ticket' },
    { label: 'OOO Settings', href: '/dept-user/profile', icon: 'UserCheck' },
  ],
  manager: [
    { label: 'Department Overview', href: '/manager/dashboard', icon: 'LayoutDashboard' },
    { label: 'All Tickets', href: '/dept-user/tickets', icon: 'Ticket' },
    { label: 'Escalations', href: '/manager/escalations', icon: 'AlertTriangle' },
    { label: 'Team', href: '/manager/team', icon: 'Users' },
    { label: 'Reports', href: '/manager/reports', icon: 'BarChart2' },
  ],
  super_admin: [
    { label: 'Overview', href: '/admin/dashboard', icon: 'LayoutDashboard' },
    { label: 'All Tickets', href: '/admin/tickets', icon: 'Ticket' },
    { label: 'User Management', href: '/admin/users', icon: 'Users' },
    { label: 'Routing Rules', href: '/admin/routing', icon: 'GitBranch' },
    { label: 'SLA Configuration', href: '/admin/sla', icon: 'Clock' },
    { label: 'Audit Log', href: '/admin/audit', icon: 'ScrollText' },
  ],
}
