export type ModuleStatus = 'developed' | 'pending'

export interface AppModule {
  module_key: string
  route_path: string
  display_name: string
  icon_class?: string
  sort_order?: number
  status: ModuleStatus
  pending_badge_text?: string
  pending_popup_title?: string
  pending_popup_body?: string
  is_visible?: boolean
}

