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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      command_defaults: {
        Row: {
          id: number
          max_vent_pct: number
          min_vent_pct: number
          setpoint_temp: number
          temp_deviation: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          max_vent_pct: number
          min_vent_pct: number
          setpoint_temp: number
          temp_deviation: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          max_vent_pct?: number
          min_vent_pct?: number
          setpoint_temp?: number
          temp_deviation?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      command_presets: {
        Row: {
          channels: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
          stall_ty_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channels: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order?: number
          stall_ty_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channels?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
          stall_ty_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ctrl_thermo_command: {
        Row: {
          action: string
          applied_at: string | null
          channel: string | null
          channel_key: string | null
          controller_key: string | null
          created_at: string
          created_by: string
          ctrl_idx: number | null
          eqpmn_code: string | null
          eqpmn_no: string | null
          error_msg: string | null
          id: string
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number
          min_vent_pct: number
          module_uid: number
          note: string | null
          payload_json: Json | null
          sent_at: string | null
          setpoint_temp: number
          stall_no: string | null
          stall_ty_code: string | null
          status: string
          temp_deviation: number
          ttl_sec: number
          updated_at: string
        }
        Insert: {
          action?: string
          applied_at?: string | null
          channel?: string | null
          channel_key?: string | null
          controller_key?: string | null
          created_at?: string
          created_by: string
          ctrl_idx?: number | null
          eqpmn_code?: string | null
          eqpmn_no?: string | null
          error_msg?: string | null
          id?: string
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number
          min_vent_pct: number
          module_uid: number
          note?: string | null
          payload_json?: Json | null
          sent_at?: string | null
          setpoint_temp: number
          stall_no?: string | null
          stall_ty_code?: string | null
          status?: string
          temp_deviation: number
          ttl_sec?: number
          updated_at?: string
        }
        Update: {
          action?: string
          applied_at?: string | null
          channel?: string | null
          channel_key?: string | null
          controller_key?: string | null
          created_at?: string
          created_by?: string
          ctrl_idx?: number | null
          eqpmn_code?: string | null
          eqpmn_no?: string | null
          error_msg?: string | null
          id?: string
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number
          min_vent_pct?: number
          module_uid?: number
          note?: string | null
          payload_json?: Json | null
          sent_at?: string | null
          setpoint_temp?: number
          stall_no?: string | null
          stall_ty_code?: string | null
          status?: string
          temp_deviation?: number
          ttl_sec?: number
          updated_at?: string
        }
        Relationships: []
      }
      farm_location: {
        Row: {
          address_detail: string | null
          address_text: string
          farm_name: string | null
          geocode_source: string
          item_code: string
          lat: number
          lng: number
          lsind_regist_no: string
          sido: string
          sigungu: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_detail?: string | null
          address_text: string
          farm_name?: string | null
          geocode_source?: string
          item_code: string
          lat: number
          lng: number
          lsind_regist_no: string
          sido: string
          sigungu: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_detail?: string | null
          address_text?: string
          farm_name?: string | null
          geocode_source?: string
          item_code?: string
          lat?: number
          lng?: number
          lsind_regist_no?: string
          sido?: string
          sigungu?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      farm_module_alarm: {
        Row: {
          channel: string | null
          controller_key: string | null
          created_at: string
          decoded_json: Json | null
          eqpmn_no: string | null
          err_code: number
          err_label: string
          id: string
          item_code: string | null
          lsind_regist_no: string
          module_uid: number | null
          raw_id: number | null
          received_at: string
          stall_no: string | null
          stall_ty_code: string | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          topic: string | null
          updated_at: string
          wire_ver: number
        }
        Insert: {
          channel?: string | null
          controller_key?: string | null
          created_at?: string
          decoded_json?: Json | null
          eqpmn_no?: string | null
          err_code: number
          err_label: string
          id?: string
          item_code?: string | null
          lsind_regist_no: string
          module_uid?: number | null
          raw_id?: number | null
          received_at: string
          stall_no?: string | null
          stall_ty_code?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          topic?: string | null
          updated_at?: string
          wire_ver?: number
        }
        Update: {
          channel?: string | null
          controller_key?: string | null
          created_at?: string
          decoded_json?: Json | null
          eqpmn_no?: string | null
          err_code?: number
          err_label?: string
          id?: string
          item_code?: string | null
          lsind_regist_no?: string
          module_uid?: number | null
          raw_id?: number | null
          received_at?: string
          stall_no?: string | null
          stall_ty_code?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          topic?: string | null
          updated_at?: string
          wire_ver?: number
        }
        Relationships: [
          {
            foreignKeyName: "farm_module_alarm_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: true
            referencedRelation: "iot_room_state_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      health_command_checkpoint: {
        Row: {
          acknowledged_at: string
          acknowledged_by: string
          command_id: string
          note: string | null
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_by: string
          command_id: string
          note?: string | null
        }
        Update: {
          acknowledged_at?: string
          acknowledged_by?: string
          command_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_command_checkpoint_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: true
            referencedRelation: "ctrl_thermo_command"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_health_current: {
        Row: {
          c_active: boolean
          c_status: string
          checked_at: string
          command_last_age_sec: number | null
          command_last_sent_at: string | null
          created_at: string
          disk_used_percent: number | null
          instance_id: string
          mem_available_mb: number | null
          mqtt_listen: boolean
          mqtt_roundtrip: boolean
          mqtt_status: string
          note: string | null
          overall: string
          payload: Json
          raw_last_age_sec: number | null
          raw_last_received_at: string | null
          rs_active: boolean
          rs_status: string
          updated_at: string
        }
        Insert: {
          c_active?: boolean
          c_status: string
          checked_at?: string
          command_last_age_sec?: number | null
          command_last_sent_at?: string | null
          created_at?: string
          disk_used_percent?: number | null
          instance_id: string
          mem_available_mb?: number | null
          mqtt_listen?: boolean
          mqtt_roundtrip?: boolean
          mqtt_status: string
          note?: string | null
          overall: string
          payload?: Json
          raw_last_age_sec?: number | null
          raw_last_received_at?: string | null
          rs_active?: boolean
          rs_status: string
          updated_at?: string
        }
        Update: {
          c_active?: boolean
          c_status?: string
          checked_at?: string
          command_last_age_sec?: number | null
          command_last_sent_at?: string | null
          created_at?: string
          disk_used_percent?: number | null
          instance_id?: string
          mem_available_mb?: number | null
          mqtt_listen?: boolean
          mqtt_roundtrip?: boolean
          mqtt_status?: string
          note?: string | null
          overall?: string
          payload?: Json
          raw_last_age_sec?: number | null
          raw_last_received_at?: string | null
          rs_active?: boolean
          rs_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      instance_health_history: {
        Row: {
          c_status: string
          checked_at: string
          command_last_age_sec: number | null
          created_at: string
          disk_used_percent: number | null
          id: number
          instance_id: string
          mem_available_mb: number | null
          mqtt_status: string
          note: string | null
          overall: string
          payload: Json
          raw_last_age_sec: number | null
          rs_status: string
        }
        Insert: {
          c_status: string
          checked_at?: string
          command_last_age_sec?: number | null
          created_at?: string
          disk_used_percent?: number | null
          id?: number
          instance_id: string
          mem_available_mb?: number | null
          mqtt_status: string
          note?: string | null
          overall: string
          payload?: Json
          raw_last_age_sec?: number | null
          rs_status: string
        }
        Update: {
          c_status?: string
          checked_at?: string
          command_last_age_sec?: number | null
          created_at?: string
          disk_used_percent?: number | null
          id?: number
          instance_id?: string
          mem_available_mb?: number | null
          mqtt_status?: string
          note?: string | null
          overall?: string
          payload?: Json
          raw_last_age_sec?: number | null
          rs_status?: string
        }
        Relationships: []
      }
      iot_decode_config: {
        Row: {
          batch_limit: number
          clock_kst_farm_keys: string[]
          cron_secret: string
          id: number
          sparse_enabled: boolean
          sparse_eps_fan: number
          sparse_eps_temp: number
          sparse_farm_keys: string[]
          sparse_heartbeat_sec: number
          updated_at: string
        }
        Insert: {
          batch_limit?: number
          clock_kst_farm_keys?: string[]
          cron_secret: string
          id?: number
          sparse_enabled?: boolean
          sparse_eps_fan?: number
          sparse_eps_temp?: number
          sparse_farm_keys?: string[]
          sparse_heartbeat_sec?: number
          updated_at?: string
        }
        Update: {
          batch_limit?: number
          clock_kst_farm_keys?: string[]
          cron_secret?: string
          id?: number
          sparse_enabled?: boolean
          sparse_eps_fan?: number
          sparse_eps_temp?: number
          sparse_farm_keys?: string[]
          sparse_heartbeat_sec?: number
          updated_at?: string
        }
        Relationships: []
      }
      iot_decode_cursor: {
        Row: {
          id: number
          last_raw_id: number
          updated_at: string
        }
        Insert: {
          id?: number
          last_raw_id?: number
          updated_at?: string
        }
        Update: {
          id?: number
          last_raw_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      iot_decoded_last_value: {
        Row: {
          controller_key: string
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          item_code: string
          lsind_regist_no: string
          module_uid: number
          temp_c: number | null
          updated_at: string
        }
        Insert: {
          controller_key: string
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          item_code: string
          lsind_regist_no: string
          module_uid: number
          temp_c?: number | null
          updated_at?: string
        }
        Update: {
          controller_key?: string
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          item_code?: string
          lsind_regist_no?: string
          module_uid?: number
          temp_c?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      iot_room_state_decode_failed: {
        Row: {
          attempted_at: string
          error_code: string
          error_detail: string | null
          id: number
          raw_id: number
          wire_ver: number | null
        }
        Insert: {
          attempted_at?: string
          error_code: string
          error_detail?: string | null
          id?: never
          raw_id: number
          wire_ver?: number | null
        }
        Update: {
          attempted_at?: string
          error_code?: string
          error_detail?: string | null
          id?: never
          raw_id?: number
          wire_ver?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "iot_room_state_decode_failed_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: true
            referencedRelation: "iot_room_state_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      iot_room_state_decoded: {
        Row: {
          controller_key: string
          decode_error: string | null
          decode_source: string
          decode_status: string
          decoded_json: Json
          eqpmn_no: string
          fan_a_pct: number | null
          fan_b_pct: number | null
          fan_c_pct: number | null
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          fan_supply_pct: number | null
          history: boolean
          humidity_pct: number | null
          id: number
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct: number | null
          module_uid: number
          packet_mode: string
          raw_id: number
          received_at: string
          run_mode: number | null
          setpoint_temp: number | null
          stall_no: string
          stall_ty_code: string
          temp_c: number | null
          temp_deviation: number | null
          topic: string | null
          wire_ver: number
        }
        Insert: {
          controller_key: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct?: number | null
          module_uid: number
          packet_mode?: string
          raw_id: number
          received_at: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver: number
        }
        Update: {
          controller_key?: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json?: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at?: string
          mesure_dt?: string
          min_vent_pct?: number | null
          module_uid?: number
          packet_mode?: string
          raw_id?: number
          received_at?: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver?: number
        }
        Relationships: [
          {
            foreignKeyName: "iot_room_state_decoded_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: false
            referencedRelation: "iot_room_state_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      iot_room_state_decoded_p_2026_07: {
        Row: {
          controller_key: string
          decode_error: string | null
          decode_source: string
          decode_status: string
          decoded_json: Json
          eqpmn_no: string
          fan_a_pct: number | null
          fan_b_pct: number | null
          fan_c_pct: number | null
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          fan_supply_pct: number | null
          history: boolean
          humidity_pct: number | null
          id: number
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct: number | null
          module_uid: number
          packet_mode: string
          raw_id: number
          received_at: string
          run_mode: number | null
          setpoint_temp: number | null
          stall_no: string
          stall_ty_code: string
          temp_c: number | null
          temp_deviation: number | null
          topic: string | null
          wire_ver: number
        }
        Insert: {
          controller_key: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct?: number | null
          module_uid: number
          packet_mode?: string
          raw_id: number
          received_at: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver: number
        }
        Update: {
          controller_key?: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json?: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at?: string
          mesure_dt?: string
          min_vent_pct?: number | null
          module_uid?: number
          packet_mode?: string
          raw_id?: number
          received_at?: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver?: number
        }
        Relationships: []
      }
      iot_room_state_decoded_p_2026_08: {
        Row: {
          controller_key: string
          decode_error: string | null
          decode_source: string
          decode_status: string
          decoded_json: Json
          eqpmn_no: string
          fan_a_pct: number | null
          fan_b_pct: number | null
          fan_c_pct: number | null
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          fan_supply_pct: number | null
          history: boolean
          humidity_pct: number | null
          id: number
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct: number | null
          module_uid: number
          packet_mode: string
          raw_id: number
          received_at: string
          run_mode: number | null
          setpoint_temp: number | null
          stall_no: string
          stall_ty_code: string
          temp_c: number | null
          temp_deviation: number | null
          topic: string | null
          wire_ver: number
        }
        Insert: {
          controller_key: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct?: number | null
          module_uid: number
          packet_mode?: string
          raw_id: number
          received_at: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver: number
        }
        Update: {
          controller_key?: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json?: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at?: string
          mesure_dt?: string
          min_vent_pct?: number | null
          module_uid?: number
          packet_mode?: string
          raw_id?: number
          received_at?: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver?: number
        }
        Relationships: []
      }
      iot_room_state_decoded_p_2026_09: {
        Row: {
          controller_key: string
          decode_error: string | null
          decode_source: string
          decode_status: string
          decoded_json: Json
          eqpmn_no: string
          fan_a_pct: number | null
          fan_b_pct: number | null
          fan_c_pct: number | null
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          fan_supply_pct: number | null
          history: boolean
          humidity_pct: number | null
          id: number
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct: number | null
          module_uid: number
          packet_mode: string
          raw_id: number
          received_at: string
          run_mode: number | null
          setpoint_temp: number | null
          stall_no: string
          stall_ty_code: string
          temp_c: number | null
          temp_deviation: number | null
          topic: string | null
          wire_ver: number
        }
        Insert: {
          controller_key: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct?: number | null
          module_uid: number
          packet_mode?: string
          raw_id: number
          received_at: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver: number
        }
        Update: {
          controller_key?: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json?: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at?: string
          mesure_dt?: string
          min_vent_pct?: number | null
          module_uid?: number
          packet_mode?: string
          raw_id?: number
          received_at?: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver?: number
        }
        Relationships: []
      }
      iot_room_state_decoded_p_2026_10: {
        Row: {
          controller_key: string
          decode_error: string | null
          decode_source: string
          decode_status: string
          decoded_json: Json
          eqpmn_no: string
          fan_a_pct: number | null
          fan_b_pct: number | null
          fan_c_pct: number | null
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          fan_supply_pct: number | null
          history: boolean
          humidity_pct: number | null
          id: number
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct: number | null
          module_uid: number
          packet_mode: string
          raw_id: number
          received_at: string
          run_mode: number | null
          setpoint_temp: number | null
          stall_no: string
          stall_ty_code: string
          temp_c: number | null
          temp_deviation: number | null
          topic: string | null
          wire_ver: number
        }
        Insert: {
          controller_key: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct?: number | null
          module_uid: number
          packet_mode?: string
          raw_id: number
          received_at: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver: number
        }
        Update: {
          controller_key?: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json?: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at?: string
          mesure_dt?: string
          min_vent_pct?: number | null
          module_uid?: number
          packet_mode?: string
          raw_id?: number
          received_at?: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver?: number
        }
        Relationships: []
      }
      iot_room_state_decoded_p_2026_11: {
        Row: {
          controller_key: string
          decode_error: string | null
          decode_source: string
          decode_status: string
          decoded_json: Json
          eqpmn_no: string
          fan_a_pct: number | null
          fan_b_pct: number | null
          fan_c_pct: number | null
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          fan_supply_pct: number | null
          history: boolean
          humidity_pct: number | null
          id: number
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct: number | null
          module_uid: number
          packet_mode: string
          raw_id: number
          received_at: string
          run_mode: number | null
          setpoint_temp: number | null
          stall_no: string
          stall_ty_code: string
          temp_c: number | null
          temp_deviation: number | null
          topic: string | null
          wire_ver: number
        }
        Insert: {
          controller_key: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct?: number | null
          module_uid: number
          packet_mode?: string
          raw_id: number
          received_at: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver: number
        }
        Update: {
          controller_key?: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json?: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at?: string
          mesure_dt?: string
          min_vent_pct?: number | null
          module_uid?: number
          packet_mode?: string
          raw_id?: number
          received_at?: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver?: number
        }
        Relationships: []
      }
      iot_room_state_decoded_p_2026_12: {
        Row: {
          controller_key: string
          decode_error: string | null
          decode_source: string
          decode_status: string
          decoded_json: Json
          eqpmn_no: string
          fan_a_pct: number | null
          fan_b_pct: number | null
          fan_c_pct: number | null
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          fan_supply_pct: number | null
          history: boolean
          humidity_pct: number | null
          id: number
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct: number | null
          module_uid: number
          packet_mode: string
          raw_id: number
          received_at: string
          run_mode: number | null
          setpoint_temp: number | null
          stall_no: string
          stall_ty_code: string
          temp_c: number | null
          temp_deviation: number | null
          topic: string | null
          wire_ver: number
        }
        Insert: {
          controller_key: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct?: number | null
          module_uid: number
          packet_mode?: string
          raw_id: number
          received_at: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver: number
        }
        Update: {
          controller_key?: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json?: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at?: string
          mesure_dt?: string
          min_vent_pct?: number | null
          module_uid?: number
          packet_mode?: string
          raw_id?: number
          received_at?: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver?: number
        }
        Relationships: []
      }
      iot_room_state_decoded_p_default: {
        Row: {
          controller_key: string
          decode_error: string | null
          decode_source: string
          decode_status: string
          decoded_json: Json
          eqpmn_no: string
          fan_a_pct: number | null
          fan_b_pct: number | null
          fan_c_pct: number | null
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          fan_supply_pct: number | null
          history: boolean
          humidity_pct: number | null
          id: number
          item_code: string
          lsind_regist_no: string
          max_vent_pct: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct: number | null
          module_uid: number
          packet_mode: string
          raw_id: number
          received_at: string
          run_mode: number | null
          setpoint_temp: number | null
          stall_no: string
          stall_ty_code: string
          temp_c: number | null
          temp_deviation: number | null
          topic: string | null
          wire_ver: number
        }
        Insert: {
          controller_key: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at: string
          mesure_dt: string
          min_vent_pct?: number | null
          module_uid: number
          packet_mode?: string
          raw_id: number
          received_at: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver: number
        }
        Update: {
          controller_key?: string
          decode_error?: string | null
          decode_source?: string
          decode_status?: string
          decoded_json?: Json
          eqpmn_no?: string
          fan_a_pct?: number | null
          fan_b_pct?: number | null
          fan_c_pct?: number | null
          fan_exhaust_pct?: number | null
          fan_intake_pct?: number | null
          fan_supply_pct?: number | null
          history?: boolean
          humidity_pct?: number | null
          id?: number
          item_code?: string
          lsind_regist_no?: string
          max_vent_pct?: number | null
          mesure_at?: string
          mesure_dt?: string
          min_vent_pct?: number | null
          module_uid?: number
          packet_mode?: string
          raw_id?: number
          received_at?: string
          run_mode?: number | null
          setpoint_temp?: number | null
          stall_no?: string
          stall_ty_code?: string
          temp_c?: number | null
          temp_deviation?: number | null
          topic?: string | null
          wire_ver?: number
        }
        Relationships: []
      }
      iot_room_state_raw: {
        Row: {
          chunk_seq: number
          id: number
          item_code: string
          lsind_regist_no: string
          mode: string
          module_uid: number | null
          payload_bytea: string | null
          payload_format: string
          received_at: string
          saved_at: string
          topic: string
        }
        Insert: {
          chunk_seq?: number
          id?: never
          item_code?: string
          lsind_regist_no?: string
          mode?: string
          module_uid?: number | null
          payload_bytea?: string | null
          payload_format?: string
          received_at: string
          saved_at?: string
          topic: string
        }
        Update: {
          chunk_seq?: number
          id?: never
          item_code?: string
          lsind_regist_no?: string
          mode?: string
          module_uid?: number | null
          payload_bytea?: string | null
          payload_format?: string
          received_at?: string
          saved_at?: string
          topic?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          role: string
          ui_config: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          role: string
          ui_config?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          role?: string
          ui_config?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_outbox: {
        Row: {
          alarm_id: string
          attempts: number
          created_at: string
          fcm_token: string
          id: string
          last_error: string | null
          payload: Json
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alarm_id: string
          attempts?: number
          created_at?: string
          fcm_token: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alarm_id?: string
          attempts?: number
          created_at?: string
          fcm_token?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_outbox_alarm_id_fkey"
            columns: ["alarm_id"]
            isOneToOne: false
            referencedRelation: "farm_module_alarm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_alarm_id_fkey"
            columns: ["alarm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_module_alarm_active"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access: {
        Row: {
          can_command: boolean
          can_read: boolean
          created_at: string
          ctrl_idx: number | null
          eqpmn_no: string | null
          id: number
          item_code: string
          lsind_regist_no: string
          module_uid: number | null
          scope_type: string
          stall_no: string | null
          stall_ty_code: string | null
          user_id: string
        }
        Insert: {
          can_command?: boolean
          can_read?: boolean
          created_at?: string
          ctrl_idx?: number | null
          eqpmn_no?: string | null
          id?: never
          item_code: string
          lsind_regist_no: string
          module_uid?: number | null
          scope_type: string
          stall_no?: string | null
          stall_ty_code?: string | null
          user_id: string
        }
        Update: {
          can_command?: boolean
          can_read?: boolean
          created_at?: string
          ctrl_idx?: number | null
          eqpmn_no?: string | null
          id?: never
          item_code?: string
          lsind_regist_no?: string
          module_uid?: number | null
          scope_type?: string
          stall_no?: string | null
          stall_ty_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_push_device: {
        Row: {
          app_id: string | null
          created_at: string
          device_label: string | null
          fcm_token: string
          id: string
          last_seen_at: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_id?: string | null
          created_at?: string
          device_label?: string | null
          fcm_token: string
          id?: string
          last_seen_at?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_id?: string | null
          created_at?: string
          device_label?: string | null
          fcm_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_farm_module_alarm_active: {
        Row: {
          channel: string | null
          controller_key: string | null
          created_at: string | null
          eqpmn_no: string | null
          err_code: number | null
          err_label: string | null
          farm_name: string | null
          id: string | null
          item_code: string | null
          lsind_regist_no: string | null
          module_uid: number | null
          raw_id: number | null
          received_at: string | null
          stall_no: string | null
          stall_ty_code: string | null
          status: string | null
          topic: string | null
          wire_ver: number | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_module_alarm_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: true
            referencedRelation: "iot_room_state_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      v_iot_dashboard_list: {
        Row: {
          alarm_high_temp_c: number | null
          alarm_low_temp_c: number | null
          controller_key: string | null
          eqpmn_no: string | null
          fan_exhaust_pct: number | null
          fan_intake_pct: number | null
          fan_supply_pct: number | null
          humidity_pct: number | null
          id: number | null
          item_code: string | null
          lsind_regist_no: string | null
          max_vent_pct: number | null
          mesure_at: string | null
          mesure_dt: string | null
          min_vent_pct: number | null
          module_uid: number | null
          packet_mode: string | null
          raw_id: number | null
          received_at: string | null
          run_mode: number | null
          setpoint_temp: number | null
          stall_no: string | null
          stall_ty_code: string | null
          temp_c: number | null
          temp_deviation: number | null
          wire_ver: number | null
        }
        Relationships: [
          {
            foreignKeyName: "iot_room_state_decoded_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: false
            referencedRelation: "iot_room_state_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      v_iot_decoded_latest: {
        Row: {
          controller_key: string | null
          decoded_json: Json | null
          eqpmn_no: string | null
          humidity_pct: number | null
          id: number | null
          item_code: string | null
          lsind_regist_no: string | null
          mesure_at: string | null
          mesure_dt: string | null
          module_uid: number | null
          packet_mode: string | null
          raw_id: number | null
          received_at: string | null
          run_mode: number | null
          stall_no: string | null
          stall_ty_code: string | null
          temp_c: number | null
          wire_ver: number | null
        }
        Relationships: [
          {
            foreignKeyName: "iot_room_state_decoded_raw_id_fkey"
            columns: ["raw_id"]
            isOneToOne: false
            referencedRelation: "iot_room_state_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      v_iot_farm_overview: {
        Row: {
          avg_humidity_pct: number | null
          avg_temp_c: number | null
          controller_count: number | null
          item_code: string | null
          latest_received_at: string | null
          lsind_regist_no: string | null
          offline_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_stale_thermo_sent: { Args: { age_hours?: number }; Returns: Json }
      claim_new_commands: {
        Args: { p_limit?: number }
        Returns: {
          cmd_id: string
          cmd_json: Json
          created_at: string
          key12: string
          priority: number
          status: string
        }[]
      }
      cleanup_ctrl_thermo_hot: {
        Args: { batch_limit?: number; retention_days?: number }
        Returns: Json
      }
      cleanup_iot_archive_drop: {
        Args: { archive_soak_days?: number; retention_days?: number }
        Returns: Json
      }
      cleanup_iot_retention_30d: {
        Args: { raw_batch_limit?: number; retention_days?: number }
        Returns: Json
      }
      cleanup_ops_logs_7d: {
        Args: { batch_limit?: number; retention_days?: number }
        Returns: Json
      }
      ensure_iot_decoded_month_partitions: {
        Args: { months_ahead?: number }
        Returns: Json
      }
      extract_channel_a_thermo: { Args: { channels: Json }; Returns: Json }
      extract_channel_fan_pct: {
        Args: { channels: Json; eqpmn_code: string }
        Returns: number
      }
      extract_channel_thermo: {
        Args: { channels: Json; p_channel: string }
        Returns: Json
      }
      farm_trend_history: {
        Args: {
          p_bucket: string
          p_from: string
          p_item: string
          p_lsind: string
          p_to: string
        }
        Returns: {
          avg_fan_exhaust: number
          avg_fan_intake: number
          avg_fan_supply: number
          avg_humidity_pct: number
          avg_temp_c: number
          bucket_at: string
          sample_count: number
          stall_no: string
          stall_ty_code: string
        }[]
      }
      farm_trend_history_by_controller: {
        Args: {
          p_bucket: string
          p_from: string
          p_item: string
          p_lsind: string
          p_to: string
        }
        Returns: {
          a_max_vent_pct: number
          a_min_vent_pct: number
          a_setpoint_temp: number
          a_temp_deviation: number
          avg_fan_a: number
          avg_fan_b: number
          avg_fan_c: number
          avg_fan_exhaust: number
          avg_fan_intake: number
          avg_fan_supply: number
          avg_humidity_pct: number
          avg_temp_c: number
          b_max_vent_pct: number
          b_min_vent_pct: number
          b_setpoint_temp: number
          b_temp_deviation: number
          bucket_at: string
          c_max_vent_pct: number
          c_min_vent_pct: number
          c_setpoint_temp: number
          c_temp_deviation: number
          controller_key: string
          eqpmn_no: string
          sample_count: number
          stall_no: string
          stall_ty_code: string
        }[]
      }
      farm_trend_history_by_controller_json: {
        Args: {
          p_bucket: string
          p_from: string
          p_item: string
          p_lsind: string
          p_to: string
        }
        Returns: Json
      }
      farm_trend_history_json: {
        Args: {
          p_bucket: string
          p_from: string
          p_item: string
          p_lsind: string
          p_to: string
        }
        Returns: Json
      }
      farm_trend_uplink_coverage_json: {
        Args: {
          p_bucket: string
          p_from: string
          p_item: string
          p_lsind: string
          p_to: string
        }
        Returns: Json
      }
      is_admin: { Args: { p_user_id: string }; Returns: boolean }
      kst_now_str: { Args: never; Returns: string }
      list_push_recipients: {
        Args: { p_item_code: string; p_lsind_regist_no: string }
        Returns: {
          user_id: string
        }[]
      }
      parse_kst_timestamp: { Args: { txt: string }; Returns: string }
      rollback_command_to_new: {
        Args: { p_cmd_id: string }
        Returns: undefined
      }
      update_command_ack: {
        Args: {
          p_ack_detail: Json
          p_ack_result: string
          p_ack_ts: number
          p_acked_at: string
          p_cmd_id: string
          p_last_error?: string
          p_status: string
        }
        Returns: undefined
      }
      user_can_command_ctrl: {
        Args: {
          p_ctrl_idx: number
          p_item_code: string
          p_lsind_regist_no: string
          p_module_uid: number
          p_user_id: string
        }
        Returns: boolean
      }
      user_can_read_farm: {
        Args: {
          p_item_code: string
          p_lsind_regist_no: string
          p_user_id: string
        }
        Returns: boolean
      }
      valid_command_channels: { Args: { payload: Json }; Returns: boolean }
      valid_device_settings: { Args: { payload: Json }; Returns: boolean }
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
