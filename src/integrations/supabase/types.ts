export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_submissions: {
        Row: {
          body: string
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          final_decision: string | null
          id: string
          release_at: string | null
          status: string
          type: string
          user_id: string
          user_notified_at: string | null
        }
        Insert: {
          body: string
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          final_decision?: string | null
          id?: string
          release_at?: string | null
          status?: string
          type?: string
          user_id: string
          user_notified_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          final_decision?: string | null
          id?: string
          release_at?: string | null
          status?: string
          type?: string
          user_id?: string
          user_notified_at?: string | null
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          account_email: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          daily_limit: number
          exhausted_until: string | null
          id: string
          sent_count: number
          sent_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          daily_limit?: number
          exhausted_until?: string | null
          id?: string
          sent_count?: number
          sent_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          daily_limit?: number
          exhausted_until?: string | null
          id?: string
          sent_count?: number
          sent_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_delivery_history: {
        Row: {
          body_hash: string
          campaign_id: string | null
          gmail_profile_email: string | null
          id: string
          recipient_email: string
          sent_at: string
          subject: string
          user_id: string
        }
        Insert: {
          body_hash: string
          campaign_id?: string | null
          gmail_profile_email?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          subject: string
          user_id: string
        }
        Update: {
          body_hash?: string
          campaign_id?: string | null
          gmail_profile_email?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_delivery_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          attempts: number
          campaign_id: string
          created_at: string
          email: string
          id: string
          last_error: string | null
          message_body: string | null
          message_subject: string | null
          next_attempt_at: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          campaign_id: string
          created_at?: string
          email: string
          id?: string
          last_error?: string | null
          message_body?: string | null
          message_subject?: string | null
          next_attempt_at?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          campaign_id?: string
          created_at?: string
          email?: string
          id?: string
          last_error?: string | null
          message_body?: string | null
          message_subject?: string | null
          next_attempt_at?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          approved_at: string | null
          body: string
          completed_at: string | null
          created_at: string
          delay_seconds: number
          failed_count: number
          id: string
          last_error: string | null
          name: string
          next_run_at: string
          paused_at: string | null
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          subject: string
          total_recipients: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          body: string
          completed_at?: string | null
          created_at?: string
          delay_seconds?: number
          failed_count?: number
          id?: string
          last_error?: string | null
          name: string
          next_run_at?: string
          paused_at?: string | null
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject: string
          total_recipients?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          body?: string
          completed_at?: string | null
          created_at?: string
          delay_seconds?: number
          failed_count?: number
          id?: string
          last_error?: string | null
          name?: string
          next_run_at?: string
          paused_at?: string | null
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          subject?: string
          total_recipients?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_message_hidden: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_hidden_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string | null
          connection_id: string
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          edited_at: string | null
          id: string
          image_path: string | null
          kind: string
          read_at: string | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          connection_id: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          id?: string
          image_path?: string | null
          kind?: string
          read_at?: string | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          connection_id?: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          id?: string
          image_path?: string | null
          kind?: string
          read_at?: string | null
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_profiles: {
        Row: {
          created_at: string
          display_name: string
          eligible: boolean
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name: string
          eligible?: boolean
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          eligible?: boolean
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      connection_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      gmail_account_penalties: {
        Row: {
          banned: boolean
          created_at: string
          email_key: string
          flag_count_total: number
          flags_this_month: number
          last_flagged_at: string | null
          month_start: string
          monthly_cap: number | null
          suspension_days: number | null
          suspension_until: string | null
          updated_at: string
        }
        Insert: {
          banned?: boolean
          created_at?: string
          email_key: string
          flag_count_total?: number
          flags_this_month?: number
          last_flagged_at?: string | null
          month_start?: string
          monthly_cap?: number | null
          suspension_days?: number | null
          suspension_until?: string | null
          updated_at?: string
        }
        Update: {
          banned?: boolean
          created_at?: string
          email_key?: string
          flag_count_total?: number
          flags_this_month?: number
          last_flagged_at?: string | null
          month_start?: string
          monthly_cap?: number | null
          suspension_days?: number | null
          suspension_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gmail_connect_attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          email: string | null
          id: string
          message: string | null
          redirect_uri: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email?: string | null
          id: string
          message?: string | null
          redirect_uri?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          redirect_uri?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_identity_usage: {
        Row: {
          created_at: string
          daily_limit: number
          email_key: string
          exhausted_until: string | null
          sent_count: number
          sent_date: string
          window_started_at: string
        }
        Insert: {
          created_at?: string
          daily_limit?: number
          email_key: string
          exhausted_until?: string | null
          sent_count?: number
          sent_date?: string
          window_started_at?: string
        }
        Update: {
          created_at?: string
          daily_limit?: number
          email_key?: string
          exhausted_until?: string | null
          sent_count?: number
          sent_date?: string
          window_started_at?: string
        }
        Relationships: []
      }
      gmail_profiles: {
        Row: {
          account_email: string
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          email_key: string
          gateway_identity: string | null
          id: string
          position: number
          slot: number
          user_id: string
        }
        Insert: {
          account_email: string
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          email_key: string
          gateway_identity?: string | null
          id?: string
          position?: number
          slot?: number
          user_id: string
        }
        Update: {
          account_email?: string
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          email_key?: string
          gateway_identity?: string | null
          id?: string
          position?: number
          slot?: number
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          activated_at: string | null
          amount_kobo: number
          created_at: string
          plan: string
          reference: string
          status: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          amount_kobo: number
          created_at?: string
          plan: string
          reference: string
          status?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          amount_kobo?: number
          created_at?: string
          plan?: string
          reference?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      rex_conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rex_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "rex_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      rex_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rex_events: {
        Row: {
          created_at: string
          detail: string
          id: string
          kind: string
          resolved_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail: string
          id?: string
          kind: string
          resolved_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          kind?: string
          resolved_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      rex_memory_settings: {
        Row: {
          remember_context: boolean
          save_history: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          remember_context?: boolean
          save_history?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          remember_context?: boolean
          save_history?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rex_settings: {
        Row: {
          config: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      send_events: {
        Row: {
          id: string
          mode: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          mode: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          mode?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_seats: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_token: string
          max_gmail_profiles: number
          member_email: string
          member_user_id: string | null
          owner_user_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token: string
          max_gmail_profiles?: number
          member_email: string
          member_user_id?: string | null
          owner_user_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_token?: string
          max_gmail_profiles?: number
          member_email?: string
          member_user_id?: string | null
          owner_user_id?: string
          status?: string
        }
        Relationships: []
      }
      user_billing: {
        Row: {
          created_at: string
          plan: string
          plan_started_at: string | null
          promo_started_at: string
          registered_at: string
          subscribed_until: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          plan?: string
          plan_started_at?: string | null
          promo_started_at?: string
          registered_at?: string
          subscribed_until?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          plan?: string
          plan_started_at?: string | null
          promo_started_at?: string
          registered_at?: string
          subscribed_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen: string
          user_id: string
        }
        Insert: {
          last_seen?: string
          user_id: string
        }
        Update: {
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_chat_message_everyone: {
        Args: { _id: string }
        Returns: undefined
      }
      edit_chat_message: {
        Args: { _body: string; _id: string }
        Returns: undefined
      }
      hide_chat_message: { Args: { _id: string }; Returns: undefined }
      is_chat_eligible: { Args: never; Returns: boolean }
      is_connection_member: { Args: { _cid: string }; Returns: boolean }
      mark_chat_delivered: { Args: never; Returns: undefined }
      mark_chat_read: { Args: { _cid: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
