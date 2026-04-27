// ============================================================
// MEDIA CONNECTOR LEAD ENGINE — Tipos TypeScript
// ============================================================

// --- AUTH / PERFIL ---
export interface Profile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  company?: string
  role: string
  created_at: string
  updated_at: string
}

// --- SETTINGS ---
export interface Settings {
  id: string
  user_id: string
  email_provider: 'resend' | 'sendgrid' | 'mailgun' | 'smtp'
  email_from_address?: string
  email_from_name?: string
  email_signature?: string
  email_daily_limit: number
  ai_model: string
  ai_temperature: number
  default_language: string
  default_tone: MessageTone
  scraping_provider: 'serpapi' | 'apify' | 'manual'
  created_at: string
  updated_at: string
}

export interface ApiIntegration {
  id: string
  user_id: string
  provider: 'openai' | 'resend' | 'serpapi' | 'hunter' | 'apify'
  api_key?: string
  is_active: boolean
  last_tested?: string
  test_status?: 'ok' | 'error'
  created_at: string
  updated_at: string
}

// --- CAMPAIGNS ---
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'finished'

export interface Campaign {
  id: string
  user_id: string
  name: string
  description?: string
  country?: string
  sector?: string
  language: string
  keywords?: string[]
  target_type?: string
  target_size?: string
  status: CampaignStatus
  total_leads: number
  contacted_leads: number
  replied_leads: number
  emails_sent: number
  created_at: string
  updated_at: string
}

export interface CreateCampaignInput {
  name: string
  description?: string
  country?: string
  sector?: string
  language?: string
  keywords?: string[]
  target_type?: string
  target_size?: string
  status?: CampaignStatus
}

// --- LEADS ---
export type LeadStatus =
  | 'new'
  | 'enriched'
  | 'pending_review'
  | 'approved'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'not_interested'
  | 'meeting_scheduled'
  | 'closed'
  | 'discarded'

export type LeadPriority = 'low' | 'medium' | 'high'
export type LeadSource = 'manual' | 'csv' | 'serpapi' | 'hunter' | 'apify'

export interface Lead {
  id: string
  user_id: string
  campaign_id?: string
  company_name: string
  website?: string
  domain?: string
  email?: string
  phone?: string
  country?: string
  city?: string
  sector?: string
  description?: string
  linkedin_url?: string
  source: LeadSource
  source_url?: string
  status: LeadStatus
  priority: LeadPriority
  score: number
  is_enriched: boolean
  enriched_at?: string
  next_contact_at?: string
  tags?: string[]
  created_at: string
  updated_at: string
  // Relations (cuando se hace join)
  campaign?: Campaign
  enrichment?: LeadEnrichment
}

export interface CreateLeadInput {
  campaign_id?: string
  company_name: string
  website?: string
  domain?: string
  email?: string
  phone?: string
  country?: string
  city?: string
  sector?: string
  description?: string
  linkedin_url?: string
  source?: LeadSource
  source_url?: string
  tags?: string[]
}

// --- ENRIQUECIMIENTO ---
export interface LeadEnrichment {
  id: string
  lead_id: string
  user_id: string
  company_summary?: string
  what_they_do?: string
  detected_needs?: string[]
  detected_problems?: string[]
  media_connector_fit?: string
  fit_score?: number
  priority_reason?: string
  auto_tags?: string[]
  scraped_title?: string
  scraped_description?: string
  scraped_content?: string
  raw_ai_response?: Record<string, unknown>
  model_used?: string
  tokens_used?: number
  created_at: string
  updated_at: string
}

// --- MENSAJES ---
export type MessageType =
  | 'initial_email'
  | 'followup_1'
  | 'followup_2'
  | 'linkedin_message'
  | 'internal_summary'

export type MessageTone =
  | 'cercano'
  | 'formal'
  | 'tecnico'
  | 'directo'
  | 'consultivo'

export interface Message {
  id: string
  lead_id: string
  user_id: string
  campaign_id?: string
  type: MessageType
  tone: MessageTone
  subject?: string
  body: string
  is_edited: boolean
  is_sent: boolean
  sent_at?: string
  model_used?: string
  created_at: string
  updated_at: string
}

export interface GenerateMessageInput {
  lead_id: string
  type: MessageType
  tone?: MessageTone
  additional_context?: string
}

// --- EMAILS ---
export type EmailStatus =
  | 'draft'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'replied'
  | 'bounced'
  | 'failed'

export interface Email {
  id: string
  lead_id: string
  user_id: string
  campaign_id?: string
  message_id?: string
  to_email: string
  to_name?: string
  from_email: string
  from_name?: string
  subject: string
  body: string
  status: EmailStatus
  provider: string
  provider_id?: string
  sent_at?: string
  opened_at?: string
  replied_at?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export interface SendEmailInput {
  lead_id: string
  message_id?: string
  to_email: string
  to_name?: string
  subject: string
  body: string
}

// --- NOTAS ---
export interface Note {
  id: string
  lead_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}

// --- TAREAS ---
export interface Task {
  id: string
  lead_id: string
  user_id: string
  campaign_id?: string
  title: string
  description?: string
  due_date?: string
  is_completed: boolean
  completed_at?: string
  priority: LeadPriority
  created_at: string
  updated_at: string
}

// --- ACTIVIDAD ---
export type ActivityType =
  | 'lead_created'
  | 'lead_updated'
  | 'status_changed'
  | 'enriched'
  | 'scored'
  | 'message_generated'
  | 'email_sent'
  | 'email_replied'
  | 'note_added'
  | 'task_created'
  | 'task_completed'
  | 'imported'

export interface ActivityLog {
  id: string
  lead_id: string
  user_id: string
  campaign_id?: string
  type: ActivityType
  title: string
  description?: string
  metadata?: Record<string, unknown>
  created_at: string
}

// --- IMPORTS ---
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Import {
  id: string
  user_id: string
  campaign_id?: string
  filename: string
  total_rows: number
  imported_rows: number
  skipped_rows: number
  error_rows: number
  status: ImportStatus
  errors?: Array<{ row: number; message: string }>
  column_mapping?: Record<string, string>
  created_at: string
  updated_at: string
}

// --- DASHBOARD STATS ---
export interface DashboardStats {
  total_leads: number
  new_leads: number
  contacted_leads: number
  replied_leads: number
  emails_sent: number
  reply_rate: number
  active_campaigns: number
  meetings_scheduled: number
}

// --- API RESPONSES ---
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// --- FILTERS ---
export interface LeadFilters {
  campaign_id?: string
  status?: LeadStatus
  priority?: LeadPriority
  search?: string
  min_score?: number
  max_score?: number
  page?: number
  per_page?: number
  sort_by?: keyof Lead
  sort_order?: 'asc' | 'desc'
}

// --- CSV IMPORT ---
export interface CsvRow {
  [key: string]: string
}

export type CsvColumnMap = {
  company_name?: string
  website?: string
  email?: string
  phone?: string
  country?: string
  city?: string
  sector?: string
  description?: string
  linkedin_url?: string
  [key: string]: string | undefined
}
