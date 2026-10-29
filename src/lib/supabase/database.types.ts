
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activities": {
                  Row: {
                    "average_cadence": number | null,"average_heartrate": number | null,"average_watts": number | null,"commute": boolean,"created_at": string,"deleted_at": string | null,"distance_m": number,"elevation_m": number,"id": string,"is_ride": boolean | null,"max_heartrate": number | null,"max_watts": number | null,"moving_time_s": number,"name": string,"polyline": string | null,"raw": NonNullable<Json>,"sport_type": string,"start_at": string,"start_local": string,"strava_id": number,"streams_points": number | null,"streams_sha256": string | null,"trainer": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "average_cadence"?: number | null,"average_heartrate"?: number | null,"average_watts"?: number | null,"commute"?: boolean,"created_at"?: string,"deleted_at"?: string | null,"distance_m": number,"elevation_m": number,"id"?: string,"is_ride"?: never,"max_heartrate"?: number | null,"max_watts"?: number | null,"moving_time_s": number,"name": string,"polyline"?: string | null,"raw": NonNullable<Json>,"sport_type": string,"start_at": string,"start_local": string,"strava_id": number,"streams_points"?: number | null,"streams_sha256"?: string | null,"trainer"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "average_cadence"?: number | null,"average_heartrate"?: number | null,"average_watts"?: number | null,"commute"?: boolean,"created_at"?: string,"deleted_at"?: string | null,"distance_m"?: number,"elevation_m"?: number,"id"?: string,"is_ride"?: never,"max_heartrate"?: number | null,"max_watts"?: number | null,"moving_time_s"?: number,"name"?: string,"polyline"?: string | null,"raw"?: NonNullable<Json>,"sport_type"?: string,"start_at"?: string,"start_local"?: string,"strava_id"?: number,"streams_points"?: number | null,"streams_sha256"?: string | null,"trainer"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"baseline_entries": {
                  Row: {
                    "created_at": string,"effective_date": string,"ftp_w": number | null,"id": string,"lthr": number | null,"max_hr": number | null,"note": string | null,"resting_hr": number | null,"source": string,"source_activity_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"effective_date": string,"ftp_w"?: number | null,"id"?: string,"lthr"?: number | null,"max_hr"?: number | null,"note"?: string | null,"resting_hr"?: number | null,"source": string,"source_activity_id"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"effective_date"?: string,"ftp_w"?: number | null,"id"?: string,"lthr"?: number | null,"max_hr"?: number | null,"note"?: string | null,"resting_hr"?: number | null,"source"?: string,"source_activity_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "baseline_entries_source_activity_id_fkey"
      columns: ["source_activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    }
                  ]
                },"imports": {
                  Row: {
                    "activity_count": number,"deleted_earlier_count": number,"error_message": string | null,"errors": NonNullable<Json>,"file_name": string,"id": string,"imported_at": string,"new_count": number,"not_a_ride_count": number,"skipped_count": number,"status": string,"unchanged_count": number,"updated_count": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_count"?: number,"deleted_earlier_count"?: number,"error_message"?: string | null,"errors"?: NonNullable<Json>,"file_name": string,"id"?: string,"imported_at"?: string,"new_count"?: number,"not_a_ride_count"?: number,"skipped_count"?: number,"status": string,"unchanged_count"?: number,"updated_count"?: number,"user_id"?: string
                  }
                  Update: {
                    "activity_count"?: number,"deleted_earlier_count"?: number,"error_message"?: string | null,"errors"?: NonNullable<Json>,"file_name"?: string,"id"?: string,"imported_at"?: string,"new_count"?: number,"not_a_ride_count"?: number,"skipped_count"?: number,"status"?: string,"unchanged_count"?: number,"updated_count"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plan_changes": {
                  Row: {
                    "changes": NonNullable<Json>,"created_at": string,"id": string,"plan_id": string,"reason": string,"undone_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changes": NonNullable<Json>,"created_at"?: string,"id"?: string,"plan_id": string,"reason": string,"undone_at"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "changes"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"plan_id"?: string,"reason"?: string,"undone_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_changes_plan_fkey"
      columns: ["plan_id","user_id"]
isOneToOne: false
      referencedRelation: "training_plans"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"planned_sessions": {
                  Row: {
                    "activity_id": string | null,"created_at": string,"day_order": number,"duration_min": number,"id": string,"indoor": boolean | null,"kind": string,"match_source": string | null,"moved_from": string | null,"phase": string,"plan_id": string,"planned_load": number,"quality_min": number,"reason": string,"session_date": string,"status": string,"steps": NonNullable<Json>,"title": string,"updated_at": string,"user_id": string,"week_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"created_at"?: string,"day_order"?: number,"duration_min": number,"id"?: string,"indoor"?: boolean | null,"kind": string,"match_source"?: string | null,"moved_from"?: string | null,"phase": string,"plan_id": string,"planned_load"?: number,"quality_min"?: number,"reason"?: string,"session_date": string,"status"?: string,"steps"?: NonNullable<Json>,"title": string,"updated_at"?: string,"user_id"?: string,"week_number": number
                  }
                  Update: {
                    "activity_id"?: string | null,"created_at"?: string,"day_order"?: number,"duration_min"?: number,"id"?: string,"indoor"?: boolean | null,"kind"?: string,"match_source"?: string | null,"moved_from"?: string | null,"phase"?: string,"plan_id"?: string,"planned_load"?: number,"quality_min"?: number,"reason"?: string,"session_date"?: string,"status"?: string,"steps"?: NonNullable<Json>,"title"?: string,"updated_at"?: string,"user_id"?: string,"week_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_sessions_activity_fkey"
      columns: ["activity_id","user_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "planned_sessions_plan_fkey"
      columns: ["plan_id","user_id"]
isOneToOne: false
      referencedRelation: "training_plans"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "available_days": (number)[] | null,"birth_year": number | null,"created_at": string,"display_name": string | null,"event_date": string | null,"event_name": string | null,"goal": string | null,"id": string,"last_seen_version": string | null,"level": string | null,"level_answers": Json | null,"riding_environment": string | null,"training_purposes": (string)[] | null,"updated_at": string,"weekly_hours": number | null,"weight_reminder_day": number,"weight_reminder_enabled": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "available_days"?: (number)[] | null,"birth_year"?: number | null,"created_at"?: string,"display_name"?: string | null,"event_date"?: string | null,"event_name"?: string | null,"goal"?: string | null,"id": string,"last_seen_version"?: string | null,"level"?: string | null,"level_answers"?: Json | null,"riding_environment"?: string | null,"training_purposes"?: (string)[] | null,"updated_at"?: string,"weekly_hours"?: number | null,"weight_reminder_day"?: number,"weight_reminder_enabled"?: boolean
                  }
                  Update: {
                    "available_days"?: (number)[] | null,"birth_year"?: number | null,"created_at"?: string,"display_name"?: string | null,"event_date"?: string | null,"event_name"?: string | null,"goal"?: string | null,"id"?: string,"last_seen_version"?: string | null,"level"?: string | null,"level_answers"?: Json | null,"riding_environment"?: string | null,"training_purposes"?: (string)[] | null,"updated_at"?: string,"weekly_hours"?: number | null,"weight_reminder_day"?: number,"weight_reminder_enabled"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"test_sessions": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"kind": string,"notes": string | null,"position": number,"result_avg_power_w": number | null,"result_ftp_w": number | null,"scheduled_on": string | null,"updated_at": string,"user_id": string,"week_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"notes"?: string | null,"position": number,"result_avg_power_w"?: number | null,"result_ftp_w"?: number | null,"scheduled_on"?: string | null,"updated_at"?: string,"user_id"?: string,"week_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"notes"?: string | null,"position"?: number,"result_avg_power_w"?: number | null,"result_ftp_w"?: number | null,"scheduled_on"?: string | null,"updated_at"?: string,"user_id"?: string,"week_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "test_sessions_week_fkey"
      columns: ["week_id","user_id"]
isOneToOne: false
      referencedRelation: "test_weeks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"test_weeks": {
                  Row: {
                    "created_at": string,"id": string,"protocol": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"protocol": string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"protocol"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"training_plans": {
                  Row: {
                    "created_at": string,"engine_version": string,"ftp_w": number,"id": string,"input_fingerprint": string,"intake": NonNullable<Json>,"start_date": string,"status": string,"undone_fingerprint": string | null,"updated_at": string,"user_id": string,"weeks": number,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"engine_version": string,"ftp_w": number,"id"?: string,"input_fingerprint": string,"intake": NonNullable<Json>,"start_date": string,"status"?: string,"undone_fingerprint"?: string | null,"updated_at"?: string,"user_id"?: string,"weeks"?: number,"weight_kg"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"engine_version"?: string,"ftp_w"?: number,"id"?: string,"input_fingerprint"?: string,"intake"?: NonNullable<Json>,"start_date"?: string,"status"?: string,"undone_fingerprint"?: string | null,"updated_at"?: string,"user_id"?: string,"weeks"?: number,"weight_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"weight_entries": {
                  Row: {
                    "created_at": string,"entry_date": string,"id": string,"note": string | null,"updated_at": string,"user_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entry_date": string,"id"?: string,"note"?: string | null,"updated_at"?: string,"user_id"?: string,"weight_kg": number
                  }
                  Update: {
                    "created_at"?: string,"entry_date"?: string,"id"?: string,"note"?: string | null,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    
                  ]
                },"weight_goals": {
                  Row: {
                    "created_at": string,"id": string,"start_date": string,"start_weight_kg": number,"status": string,"target_date": string,"target_weight_kg": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"start_date"?: string,"start_weight_kg": number,"status"?: string,"target_date": string,"target_weight_kg": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"start_date"?: string,"start_weight_kg"?: number,"status"?: string,"target_date"?: string,"target_weight_kg"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "current_baseline": {
                  Row: {
                    "ftp_effective_date": string | null,"ftp_w": number | null,"lthr": number | null,"lthr_effective_date": string | null,"max_hr": number | null,"max_hr_effective_date": string | null,"resting_hr": number | null,"resting_hr_effective_date": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "import_activities":
{ Args: { "activities": Json,"file_name": string,"skipped"?: Json }; Returns: {
              "activity_count": number,
"deleted_earlier_count": number,
"error_message": string | null,
"errors": NonNullable<Json>,
"file_name": string,
"id": string,
"imported_at": string,
"new_count": number,
"not_a_ride_count": number,
"skipped_count": number,
"status": string,
"unchanged_count": number,
"updated_count": number,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "imports"
        isOneToOne: true
        isSetofReturn: false
      } },
"log_not_imported":
{ Args: { "file_name": string,"reason": string }; Returns: {
              "activity_count": number,
"deleted_earlier_count": number,
"error_message": string | null,
"errors": NonNullable<Json>,
"file_name": string,
"id": string,
"imported_at": string,
"new_count": number,
"not_a_ride_count": number,
"skipped_count": number,
"status": string,
"unchanged_count": number,
"updated_count": number,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "imports"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
