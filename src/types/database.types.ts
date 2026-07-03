// Manually crafted types for Sprint 1 + Sprint 2.
// In production: run `supabase gen types typescript --project-id <id>` to auto-generate.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'requester' | 'dept_user' | 'manager' | 'super_admin'
export type RequestType = 'it_service' | 'data_service'
export type SubType = 'hardware' | 'software' | 'analysis' | 'discrepancy' | 'issues'
export type Priority = 'high' | 'medium' | 'low'
export type TicketStatus =
  | 'new'
  | 'acknowledged'
  | 'in_progress'
  | 'pending_requester'
  | 'escalated'
  | 'resolved'
  | 'closed'
export type NotificationStatus = 'pending' | 'sent' | 'failed'
export type EscalationReason =
  | 'ack_sla_miss'
  | 'res_sla_miss'
  | 'manager_inaction'
  | 'loop_detected'

export interface Database {
  public: {
    Tables: {
      regions: {
        Row: { id: string; name: string; code: string; timezone: string; is_active: boolean; created_at: string }
        Insert: { id?: string; name: string; code: string; timezone: string; is_active?: boolean; created_at?: string }
        Update: { id?: string; name?: string; code?: string; timezone?: string; is_active?: boolean }
        Relationships: []
      }
      departments: {
        Row: { id: string; name: string; code: string; created_at: string }
        Insert: { id?: string; name: string; code: string; created_at?: string }
        Update: { id?: string; name?: string; code?: string }
        Relationships: []
      }
      users: {
        Row: {
          id: string; auth_id: string; email: string; full_name: string
          role: UserRole; region_id: string | null; department_id: string | null
          is_ooo: boolean; ooo_start_date: string | null; ooo_end_date: string | null
          ooo_backup_user_id: string | null; is_active: boolean
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; auth_id: string; email: string; full_name: string
          role?: UserRole; region_id?: string | null; department_id?: string | null
          is_ooo?: boolean; ooo_start_date?: string | null; ooo_end_date?: string | null
          ooo_backup_user_id?: string | null; is_active?: boolean
          created_at?: string; updated_at?: string
        }
        Update: {
          email?: string; full_name?: string; role?: UserRole
          region_id?: string | null; department_id?: string | null
          is_ooo?: boolean; ooo_start_date?: string | null; ooo_end_date?: string | null
          ooo_backup_user_id?: string | null; is_active?: boolean
        }
        Relationships: [
          { foreignKeyName: 'users_region_fk'; columns: ['region_id']; isOneToOne: false; referencedRelation: 'regions'; referencedColumns: ['id'] },
          { foreignKeyName: 'users_dept_fk'; columns: ['department_id']; isOneToOne: false; referencedRelation: 'departments'; referencedColumns: ['id'] }
        ]
      }
      routing_rules: {
        Row: {
          id: string; region_id: string; request_type: RequestType; sub_type: SubType
          primary_assignee_id: string; backup_assignee_id: string | null
          is_active: boolean; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; region_id: string; request_type: RequestType; sub_type: SubType
          primary_assignee_id: string; backup_assignee_id?: string | null
          is_active?: boolean; created_at?: string; updated_at?: string
        }
        Update: {
          primary_assignee_id?: string; backup_assignee_id?: string | null; is_active?: boolean
        }
        Relationships: [
          { foreignKeyName: 'routing_region_fk'; columns: ['region_id']; isOneToOne: false; referencedRelation: 'regions'; referencedColumns: ['id'] }
        ]
      }
      tickets: {
        Row: {
          id: string; ticket_number: string
          requester_id: string; assignee_id: string | null
          region_id: string; department_id: string | null
          title: string; description: string
          request_type: RequestType; sub_type: SubType; priority: Priority
          status: TicketStatus; escalation_count: number
          sla_ack_deadline: string | null; sla_res_deadline: string | null
          sla_paused_at: string | null; sla_paused_minutes: number
          resolution_note: string | null; resolved_at: string | null; closed_at: string | null
          last_escalated_at: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; ticket_number?: string
          requester_id: string; assignee_id?: string | null
          region_id: string; department_id?: string | null
          title: string; description: string
          request_type: RequestType; sub_type: SubType; priority: Priority
          status?: TicketStatus; escalation_count?: number
          sla_ack_deadline?: string | null; sla_res_deadline?: string | null
          sla_paused_at?: string | null; sla_paused_minutes?: number
          resolution_note?: string | null; resolved_at?: string | null; closed_at?: string | null
          last_escalated_at?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          assignee_id?: string | null; department_id?: string | null
          title?: string; description?: string; priority?: Priority
          status?: TicketStatus; escalation_count?: number
          sla_ack_deadline?: string | null; sla_res_deadline?: string | null
          sla_paused_at?: string | null; sla_paused_minutes?: number
          resolution_note?: string | null; resolved_at?: string | null; closed_at?: string | null
          last_escalated_at?: string | null
        }
        Relationships: [
          { foreignKeyName: 'tickets_requester_fk'; columns: ['requester_id']; isOneToOne: false; referencedRelation: 'users'; referencedColumns: ['id'] },
          { foreignKeyName: 'tickets_region_fk'; columns: ['region_id']; isOneToOne: false; referencedRelation: 'regions'; referencedColumns: ['id'] }
        ]
      }
      ticket_status_history: {
        Row: {
          id: string; ticket_id: string; from_status: TicketStatus | null
          to_status: TicketStatus; changed_by: string; reason: string | null; created_at: string
        }
        Insert: {
          id?: string; ticket_id: string; from_status?: TicketStatus | null
          to_status: TicketStatus; changed_by: string; reason?: string | null; created_at?: string
        }
        Update: Record<string, never>
        Relationships: [
          { foreignKeyName: 'tsh_ticket_fk'; columns: ['ticket_id']; isOneToOne: false; referencedRelation: 'tickets'; referencedColumns: ['id'] }
        ]
      }
      ticket_comments: {
        Row: {
          id: string; ticket_id: string; author_id: string
          body: string; is_internal: boolean; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; ticket_id: string; author_id: string
          body: string; is_internal?: boolean; created_at?: string; updated_at?: string
        }
        Update: { body?: string }
        Relationships: [
          { foreignKeyName: 'comments_ticket_fk'; columns: ['ticket_id']; isOneToOne: false; referencedRelation: 'tickets'; referencedColumns: ['id'] }
        ]
      }
      ticket_attachments: {
        Row: {
          id: string; ticket_id: string; uploaded_by: string
          file_name: string; file_size_bytes: number; mime_type: string
          storage_path: string; created_at: string
        }
        Insert: {
          id?: string; ticket_id: string; uploaded_by: string
          file_name: string; file_size_bytes: number; mime_type: string
          storage_path: string; created_at?: string
        }
        Update: Record<string, never>
        Relationships: [
          { foreignKeyName: 'attachments_ticket_fk'; columns: ['ticket_id']; isOneToOne: false; referencedRelation: 'tickets'; referencedColumns: ['id'] }
        ]
      }
      business_hours: {
        Row: {
          id: string; region_id: string
          work_mon: boolean; work_tue: boolean; work_wed: boolean; work_thu: boolean
          work_fri: boolean; work_sat: boolean; work_sun: boolean
          start_time: string; end_time: string; updated_at: string
        }
        Insert: {
          id?: string; region_id: string
          work_mon?: boolean; work_tue?: boolean; work_wed?: boolean; work_thu?: boolean
          work_fri?: boolean; work_sat?: boolean; work_sun?: boolean
          start_time?: string; end_time?: string; updated_at?: string
        }
        Update: {
          work_mon?: boolean; work_tue?: boolean; work_wed?: boolean; work_thu?: boolean
          work_fri?: boolean; work_sat?: boolean; work_sun?: boolean
          start_time?: string; end_time?: string
        }
        Relationships: [
          { foreignKeyName: 'biz_hours_region_fk'; columns: ['region_id']; isOneToOne: true; referencedRelation: 'regions'; referencedColumns: ['id'] }
        ]
      }
      holidays: {
        Row: { id: string; region_id: string; holiday_date: string; label: string; created_at: string }
        Insert: { id?: string; region_id: string; holiday_date: string; label: string; created_at?: string }
        Update: { label?: string }
        Relationships: [
          { foreignKeyName: 'holidays_region_fk'; columns: ['region_id']; isOneToOne: false; referencedRelation: 'regions'; referencedColumns: ['id'] }
        ]
      }
      audit_log: {
        Row: {
          id: string; event_type: string
          actor_id: string | null; actor_name: string; actor_role: string
          entity_type: string; entity_id: string; entity_ref: string
          payload: import('./database.types').Json; ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string; event_type: string
          actor_id?: string | null; actor_name?: string; actor_role?: string
          entity_type: string; entity_id: string; entity_ref?: string
          payload?: import('./database.types').Json; ip_address?: string | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: [
          { foreignKeyName: 'audit_actor_fk'; columns: ['actor_id']; isOneToOne: false; referencedRelation: 'users'; referencedColumns: ['id'] }
        ]
      }
      cron_runs: {
        Row: { job_name: string; last_run: string; last_count: number }
        Insert: { job_name: string; last_run?: string; last_count?: number }
        Update: { last_run?: string; last_count?: number }
        Relationships: []
      }
      escalation_events: {
        Row: {
          id: string; ticket_id: string
          escalated_from: string | null; escalated_to: string | null
          escalation_type: string; miss_duration_minutes: number | null; created_at: string
        }
        Insert: {
          id?: string; ticket_id: string
          escalated_from?: string | null; escalated_to?: string | null
          escalation_type: string; miss_duration_minutes?: number | null; created_at?: string
        }
        Update: Record<string, never>
        Relationships: [
          { foreignKeyName: 'esc_ticket_fk'; columns: ['ticket_id']; isOneToOne: false; referencedRelation: 'tickets'; referencedColumns: ['id'] }
        ]
      }
      notifications: {
        Row: {
          id: string; notification_type: string
          recipient_id: string | null; recipient_email: string
          ticket_id: string | null; subject: string; body_html: string
          status: NotificationStatus; attempt_count: number
          sent_at: string | null; error_message: string | null
          read_at: string | null; created_at: string
        }
        Insert: {
          id?: string; notification_type: string
          recipient_id?: string | null; recipient_email: string
          ticket_id?: string | null; subject: string; body_html?: string
          status?: NotificationStatus; attempt_count?: number
          sent_at?: string | null; error_message?: string | null
          read_at?: string | null; created_at?: string
        }
        Update: { status?: NotificationStatus; attempt_count?: number; sent_at?: string | null; error_message?: string | null; read_at?: string | null }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      fn_current_user_role: { Args: Record<PropertyKey, never>; Returns: UserRole }
      fn_current_user_id: { Args: Record<PropertyKey, never>; Returns: string }
      fn_current_department_id: { Args: Record<PropertyKey, never>; Returns: string | null }
      fn_find_similar_tickets: {
        Args: { query_text: string; p_region_id: string; max_results?: number }
        Returns: Array<{ ticket_id: string; ticket_number: string; title: string; status: TicketStatus; rank: number }>
      }
    }
    Enums: {
      user_role: UserRole; request_type: RequestType; sub_type: SubType
      priority: Priority; ticket_status: TicketStatus
      notification_status: NotificationStatus; escalation_reason: EscalationReason
    }
    CompositeTypes: { [_ in never]: never }
  }
}

// Convenience type alias
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
