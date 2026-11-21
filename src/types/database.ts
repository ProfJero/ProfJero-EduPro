
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
            "academic_terms": {
                  Row: {
                    "academic_year_id": string,"created_at": string,"ends_on": string,"id": string,"is_current": boolean,"name": string,"school_id": string,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"created_at"?: string,"ends_on": string,"id"?: string,"is_current"?: boolean,"name": string,"school_id": string,"starts_on": string
                  }
                  Update: {
                    "academic_year_id"?: string,"created_at"?: string,"ends_on"?: string,"id"?: string,"is_current"?: boolean,"name"?: string,"school_id"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "academic_terms_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "academic_terms_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"academic_years": {
                  Row: {
                    "created_at": string,"ends_on": string,"id": string,"is_current": boolean,"name": string,"school_id": string,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on": string,"id"?: string,"is_current"?: boolean,"name": string,"school_id": string,"starts_on": string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string,"id"?: string,"is_current"?: boolean,"name"?: string,"school_id"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "academic_years_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_conversations": {
                  Row: {
                    "context": NonNullable<Json>,"created_at": string,"id": string,"mode": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"mode"?: string,"title"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "context"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"mode"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_messages": {
                  Row: {
                    "citations": NonNullable<Json>,"content": string,"conversation_id": string,"created_at": string,"id": string,"role": string,"tokens_in": number | null,"tokens_out": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "citations"?: NonNullable<Json>,"content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"role": string,"tokens_in"?: number | null,"tokens_out"?: number | null
                  }
                  Update: {
                    "citations"?: NonNullable<Json>,"content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"role"?: string,"tokens_in"?: number | null,"tokens_out"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage": {
                  Row: {
                    "day": string,"requests": number,"tokens": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day"?: string,"requests"?: number,"tokens"?: number,"user_id": string
                  }
                  Update: {
                    "day"?: string,"requests"?: number,"tokens"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"announcements": {
                  Row: {
                    "author_id": string,"body": string,"class_id": string | null,"course_id": string | null,"created_at": string,"id": string,"is_pinned": boolean,"notified": boolean,"published_at": string,"school_id": string | null,"scope": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"class_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"notified"?: boolean,"published_at"?: string,"school_id"?: string | null,"scope": string,"title": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"class_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"notified"?: boolean,"published_at"?: string,"school_id"?: string | null,"scope"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"arena_attempts": {
                  Row: {
                    "accuracy": number | null,"challenge_id": string,"deadline_at": string,"finished_at": string | null,"id": string,"max_score": number | null,"payload": NonNullable<Json>,"result": NonNullable<Json>,"score": number | null,"secret": NonNullable<Json>,"started_at": string,"status": string,"time_ms": number | null,"user_id": string,"verified": boolean,"xp_awarded": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy"?: number | null,"challenge_id": string,"deadline_at": string,"finished_at"?: string | null,"id"?: string,"max_score"?: number | null,"payload"?: NonNullable<Json>,"result"?: NonNullable<Json>,"score"?: number | null,"secret"?: NonNullable<Json>,"started_at"?: string,"status"?: string,"time_ms"?: number | null,"user_id": string,"verified"?: boolean,"xp_awarded"?: number
                  }
                  Update: {
                    "accuracy"?: number | null,"challenge_id"?: string,"deadline_at"?: string,"finished_at"?: string | null,"id"?: string,"max_score"?: number | null,"payload"?: NonNullable<Json>,"result"?: NonNullable<Json>,"score"?: number | null,"secret"?: NonNullable<Json>,"started_at"?: string,"status"?: string,"time_ms"?: number | null,"user_id"?: string,"verified"?: boolean,"xp_awarded"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "arena_attempts_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "arena_challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"arena_challenges": {
                  Row: {
                    "class_id": string | null,"config": NonNullable<Json>,"created_at": string,"created_by": string | null,"description": string,"difficulty": string,"game": string,"id": string,"level": number,"school_id": string | null,"slug": string,"status": string,"subject": string | null,"time_limit_seconds": number,"title": string,"track": string,"xp_reward": number
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id"?: string | null,"config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"description"?: string,"difficulty"?: string,"game": string,"id"?: string,"level"?: number,"school_id"?: string | null,"slug": string,"status"?: string,"subject"?: string | null,"time_limit_seconds"?: number,"title": string,"track": string,"xp_reward"?: number
                  }
                  Update: {
                    "class_id"?: string | null,"config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"description"?: string,"difficulty"?: string,"game"?: string,"id"?: string,"level"?: number,"school_id"?: string | null,"slug"?: string,"status"?: string,"subject"?: string | null,"time_limit_seconds"?: number,"title"?: string,"track"?: string,"xp_reward"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "arena_challenges_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arena_challenges_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"arena_questions": {
                  Row: {
                    "answer": string,"challenge_id": string,"explanation": string | null,"id": string,"options": NonNullable<Json>,"position": number,"prompt": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": string,"challenge_id": string,"explanation"?: string | null,"id"?: string,"options"?: NonNullable<Json>,"position"?: number,"prompt": string
                  }
                  Update: {
                    "answer"?: string,"challenge_id"?: string,"explanation"?: string | null,"id"?: string,"options"?: NonNullable<Json>,"position"?: number,"prompt"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "arena_questions_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "arena_challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"assessment_attempts": {
                  Row: {
                    "assessment_id": string,"attempt_no": number,"auto_submitted": boolean,"deadline_at": string | null,"id": string,"question_order": (string)[],"started_at": string,"status": string,"submitted_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assessment_id": string,"attempt_no": number,"auto_submitted"?: boolean,"deadline_at"?: string | null,"id"?: string,"question_order"?: (string)[],"started_at"?: string,"status"?: string,"submitted_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "assessment_id"?: string,"attempt_no"?: number,"auto_submitted"?: boolean,"deadline_at"?: string | null,"id"?: string,"question_order"?: (string)[],"started_at"?: string,"status"?: string,"submitted_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_attempts_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    }
                  ]
                },"assessment_questions": {
                  Row: {
                    "assessment_id": string,"marks_override": number | null,"position": number,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assessment_id": string,"marks_override"?: number | null,"position"?: number,"question_id": string
                  }
                  Update: {
                    "assessment_id"?: string,"marks_override"?: number | null,"position"?: number,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_questions_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"assessment_results": {
                  Row: {
                    "assessment_id": string,"attempt_id": string,"graded_at": string,"max_score": number,"passed": boolean,"pending_manual": boolean,"percentage": number,"score": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assessment_id": string,"attempt_id": string,"graded_at"?: string,"max_score"?: number,"passed"?: boolean,"pending_manual"?: boolean,"percentage"?: number,"score"?: number,"user_id": string
                  }
                  Update: {
                    "assessment_id"?: string,"attempt_id"?: string,"graded_at"?: string,"max_score"?: number,"passed"?: boolean,"pending_manual"?: boolean,"percentage"?: number,"score"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_results_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_results_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: true
      referencedRelation: "assessment_attempts"
      referencedColumns: ["id"]
    }
                  ]
                },"assessments": {
                  Row: {
                    "class_id": string | null,"closes_at": string | null,"course_id": string | null,"created_at": string,"created_by": string,"duration_minutes": number | null,"id": string,"instructions": string,"kind": string,"max_attempts": number,"opens_at": string | null,"pass_mark_pct": number,"results_released": boolean,"results_visibility": Database["public"]['Enums']["results_visibility"],"show_correct_answers": boolean,"shuffle_options": boolean,"shuffle_questions": boolean,"status": Database["public"]['Enums']["content_status"],"title": string,"updated_at": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id"?: string | null,"closes_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by": string,"duration_minutes"?: number | null,"id"?: string,"instructions"?: string,"kind"?: string,"max_attempts"?: number,"opens_at"?: string | null,"pass_mark_pct"?: number,"results_released"?: boolean,"results_visibility"?: Database["public"]['Enums']["results_visibility"],"show_correct_answers"?: boolean,"shuffle_options"?: boolean,"shuffle_questions"?: boolean,"status"?: Database["public"]['Enums']["content_status"],"title": string,"updated_at"?: string,"weight"?: number
                  }
                  Update: {
                    "class_id"?: string | null,"closes_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by"?: string,"duration_minutes"?: number | null,"id"?: string,"instructions"?: string,"kind"?: string,"max_attempts"?: number,"opens_at"?: string | null,"pass_mark_pct"?: number,"results_released"?: boolean,"results_visibility"?: Database["public"]['Enums']["results_visibility"],"show_correct_answers"?: boolean,"shuffle_options"?: boolean,"shuffle_questions"?: boolean,"status"?: Database["public"]['Enums']["content_status"],"title"?: string,"updated_at"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"assignment_submissions": {
                  Row: {
                    "assignment_id": string,"created_at": string,"id": string,"is_late": boolean,"link_url": string | null,"revision": number,"status": string,"submitted_at": string | null,"text_response": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"created_at"?: string,"id"?: string,"is_late"?: boolean,"link_url"?: string | null,"revision"?: number,"status"?: string,"submitted_at"?: string | null,"text_response"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "assignment_id"?: string,"created_at"?: string,"id"?: string,"is_late"?: boolean,"link_url"?: string | null,"revision"?: number,"status"?: string,"submitted_at"?: string | null,"text_response"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignment_submissions_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    }
                  ]
                },"assignments": {
                  Row: {
                    "allow_late": boolean,"attachments": NonNullable<Json>,"class_id": string | null,"course_id": string | null,"created_at": string,"created_by": string,"due_at": string | null,"id": string,"instructions": string,"max_marks": number,"status": Database["public"]['Enums']["content_status"],"submission_types": (string)[],"title": string,"updated_at": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_late"?: boolean,"attachments"?: NonNullable<Json>,"class_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by": string,"due_at"?: string | null,"id"?: string,"instructions"?: string,"max_marks"?: number,"status"?: Database["public"]['Enums']["content_status"],"submission_types"?: (string)[],"title": string,"updated_at"?: string,"weight"?: number
                  }
                  Update: {
                    "allow_late"?: boolean,"attachments"?: NonNullable<Json>,"class_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by"?: string,"due_at"?: string | null,"id"?: string,"instructions"?: string,"max_marks"?: number,"status"?: Database["public"]['Enums']["content_status"],"submission_types"?: (string)[],"title"?: string,"updated_at"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"attempt_answers": {
                  Row: {
                    "attempt_id": string,"awarded_marks": number | null,"feedback": string | null,"graded_at": string | null,"graded_by": string | null,"is_correct": boolean | null,"needs_manual": boolean,"question_id": string,"response": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": string,"awarded_marks"?: number | null,"feedback"?: string | null,"graded_at"?: string | null,"graded_by"?: string | null,"is_correct"?: boolean | null,"needs_manual"?: boolean,"question_id": string,"response"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "attempt_id"?: string,"awarded_marks"?: number | null,"feedback"?: string | null,"graded_at"?: string | null,"graded_by"?: string | null,"is_correct"?: boolean | null,"needs_manual"?: boolean,"question_id"?: string,"response"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempt_answers_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "assessment_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempt_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"id": number,"school_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type": string,"id"?: never,"school_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"school_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"badges": {
                  Row: {
                    "code": string,"description": string,"icon": string,"name": string,"tier": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"description": string,"icon"?: string,"name": string,"tier"?: string
                  }
                  Update: {
                    "code"?: string,"description"?: string,"icon"?: string,"name"?: string,"tier"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bookmarks": {
                  Row: {
                    "created_at": string,"lesson_id": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"lesson_id": string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"lesson_id"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookmarks_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"icon": string,"id": string,"is_active": boolean,"name": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"is_active"?: boolean,"name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"certificate_templates": {
                  Row: {
                    "accent_color": string,"created_at": string,"footer_text": string | null,"id": string,"is_default": boolean,"name": string,"signatory_name": string | null,"signatory_title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accent_color"?: string,"created_at"?: string,"footer_text"?: string | null,"id"?: string,"is_default"?: boolean,"name": string,"signatory_name"?: string | null,"signatory_title"?: string | null
                  }
                  Update: {
                    "accent_color"?: string,"created_at"?: string,"footer_text"?: string | null,"id"?: string,"is_default"?: boolean,"name"?: string,"signatory_name"?: string | null,"signatory_title"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"certificates": {
                  Row: {
                    "completed_on": string,"course_id": string,"course_title": string,"id": string,"issued_at": string,"issuer_name": string,"learner_name": string,"revoked_reason": string | null,"serial": string,"status": string,"template_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_on": string,"course_id": string,"course_title": string,"id"?: string,"issued_at"?: string,"issuer_name": string,"learner_name": string,"revoked_reason"?: string | null,"serial": string,"status"?: string,"template_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "completed_on"?: string,"course_id"?: string,"course_title"?: string,"id"?: string,"issued_at"?: string,"issuer_name"?: string,"learner_name"?: string,"revoked_reason"?: string | null,"serial"?: string,"status"?: string,"template_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificates_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificates_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "certificate_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"class_attendance": {
                  Row: {
                    "attendance_date": string,"class_id": string,"created_at": string,"id": string,"marked_by": string | null,"note": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_date": string,"class_id": string,"created_at"?: string,"id"?: string,"marked_by"?: string | null,"note"?: string | null,"status": string,"user_id": string
                  }
                  Update: {
                    "attendance_date"?: string,"class_id"?: string,"created_at"?: string,"id"?: string,"marked_by"?: string | null,"note"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_attendance_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"class_courses": {
                  Row: {
                    "assigned_by": string | null,"class_id": string,"course_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"class_id": string,"course_id": string,"created_at"?: string
                  }
                  Update: {
                    "assigned_by"?: string | null,"class_id"?: string,"course_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_courses_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_courses_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"class_enrolments": {
                  Row: {
                    "class_id": string,"created_at": string,"joined_via": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"joined_via"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"joined_via"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_enrolments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"class_invitations": {
                  Row: {
                    "class_id": string,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_invitations_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"class_leaders": {
                  Row: {
                    "assigned_by": string | null,"class_id": string,"created_at": string,"permissions": (string)[],"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"class_id": string,"created_at"?: string,"permissions"?: (string)[],"title": string,"user_id": string
                  }
                  Update: {
                    "assigned_by"?: string | null,"class_id"?: string,"created_at"?: string,"permissions"?: (string)[],"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_leaders_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"class_teachers": {
                  Row: {
                    "class_id": string,"created_at": string,"is_class_teacher": boolean,"subject": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"is_class_teacher"?: boolean,"subject"?: string | null,"user_id": string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"is_class_teacher"?: boolean,"subject"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_teachers_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    }
                  ]
                },"classroom_messages": {
                  Row: {
                    "author_name": string,"body": string,"created_at": string,"deleted_at": string | null,"id": string,"is_accepted": boolean,"is_pinned": boolean,"is_resolved": boolean,"kind": string,"parent_id": string | null,"room_id": string,"room_type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_name"?: string,"body": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_accepted"?: boolean,"is_pinned"?: boolean,"is_resolved"?: boolean,"kind"?: string,"parent_id"?: string | null,"room_id": string,"room_type": string,"user_id": string
                  }
                  Update: {
                    "author_name"?: string,"body"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_accepted"?: boolean,"is_pinned"?: boolean,"is_resolved"?: boolean,"kind"?: string,"parent_id"?: string | null,"room_id"?: string,"room_type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classroom_messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "classroom_messages"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_messages": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"message": string,"name": string,"status": string,"topic": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"message": string,"name": string,"status"?: string,"topic"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"message"?: string,"name"?: string,"status"?: string,"topic"?: string
                  }
                  Relationships: [
                    
                  ]
                },"course_curriculum_links": {
                  Row: {
                    "course_id": string,"item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"item_id": string
                  }
                  Update: {
                    "course_id"?: string,"item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_curriculum_links_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_curriculum_links_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "curriculum_items"
      referencedColumns: ["id"]
    }
                  ]
                },"course_enrolments": {
                  Row: {
                    "class_id": string | null,"completed_at": string | null,"course_id": string,"enrolled_at": string,"enrolled_by": string | null,"id": string,"last_activity_at": string | null,"last_lesson_id": string | null,"progress_pct": number,"school_id": string | null,"source": Database["public"]['Enums']["enrolment_source"],"status": Database["public"]['Enums']["enrolment_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id"?: string | null,"completed_at"?: string | null,"course_id": string,"enrolled_at"?: string,"enrolled_by"?: string | null,"id"?: string,"last_activity_at"?: string | null,"last_lesson_id"?: string | null,"progress_pct"?: number,"school_id"?: string | null,"source"?: Database["public"]['Enums']["enrolment_source"],"status"?: Database["public"]['Enums']["enrolment_status"],"user_id": string
                  }
                  Update: {
                    "class_id"?: string | null,"completed_at"?: string | null,"course_id"?: string,"enrolled_at"?: string,"enrolled_by"?: string | null,"id"?: string,"last_activity_at"?: string | null,"last_lesson_id"?: string | null,"progress_pct"?: number,"school_id"?: string | null,"source"?: Database["public"]['Enums']["enrolment_source"],"status"?: Database["public"]['Enums']["enrolment_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_enrolments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_enrolments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_enrolments_last_lesson_id_fkey"
      columns: ["last_lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_enrolments_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"course_instructors": {
                  Row: {
                    "course_id": string,"created_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_instructors_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"course_modules": {
                  Row: {
                    "course_id": string,"created_at": string,"description": string | null,"id": string,"position": number,"status": Database["public"]['Enums']["content_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"position"?: number,"status"?: Database["public"]['Enums']["content_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"position"?: number,"status"?: Database["public"]['Enums']["content_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_modules_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"course_prerequisites": {
                  Row: {
                    "course_id": string,"prerequisite_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"prerequisite_id": string
                  }
                  Update: {
                    "course_id"?: string,"prerequisite_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_prerequisites_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_prerequisites_prerequisite_id_fkey"
      columns: ["prerequisite_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"course_resources": {
                  Row: {
                    "allow_offline": boolean,"bytes": number | null,"cloudinary_public_id": string | null,"course_id": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"kind": string,"lesson_id": string | null,"title": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_offline"?: boolean,"bytes"?: number | null,"cloudinary_public_id"?: string | null,"course_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"kind"?: string,"lesson_id"?: string | null,"title": string,"url": string
                  }
                  Update: {
                    "allow_offline"?: boolean,"bytes"?: number | null,"cloudinary_public_id"?: string | null,"course_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"kind"?: string,"lesson_id"?: string | null,"title"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "course_resources_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "course_resources_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "category_id": string | null,"certificate_enabled": boolean,"completion_lesson_pct": number,"completion_requires_assessments": boolean,"cover_url": string | null,"created_at": string,"description": string,"enrolment_method": Database["public"]['Enums']["enrolment_method"],"estimated_hours": number | null,"id": string,"is_premium": boolean,"language": string,"level": Database["public"]['Enums']["course_level"],"objectives": (string)[],"owner_id": string,"prerequisites_text": string | null,"published_at": string | null,"review_notes": string | null,"school_id": string | null,"short_description": string,"slug": string,"status": Database["public"]['Enums']["content_status"],"subject": string | null,"target_audience": string | null,"title": string,"updated_at": string,"visibility": Database["public"]['Enums']["course_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"certificate_enabled"?: boolean,"completion_lesson_pct"?: number,"completion_requires_assessments"?: boolean,"cover_url"?: string | null,"created_at"?: string,"description"?: string,"enrolment_method"?: Database["public"]['Enums']["enrolment_method"],"estimated_hours"?: number | null,"id"?: string,"is_premium"?: boolean,"language"?: string,"level"?: Database["public"]['Enums']["course_level"],"objectives"?: (string)[],"owner_id": string,"prerequisites_text"?: string | null,"published_at"?: string | null,"review_notes"?: string | null,"school_id"?: string | null,"short_description"?: string,"slug": string,"status"?: Database["public"]['Enums']["content_status"],"subject"?: string | null,"target_audience"?: string | null,"title": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["course_visibility"]
                  }
                  Update: {
                    "category_id"?: string | null,"certificate_enabled"?: boolean,"completion_lesson_pct"?: number,"completion_requires_assessments"?: boolean,"cover_url"?: string | null,"created_at"?: string,"description"?: string,"enrolment_method"?: Database["public"]['Enums']["enrolment_method"],"estimated_hours"?: number | null,"id"?: string,"is_premium"?: boolean,"language"?: string,"level"?: Database["public"]['Enums']["course_level"],"objectives"?: (string)[],"owner_id"?: string,"prerequisites_text"?: string | null,"published_at"?: string | null,"review_notes"?: string | null,"school_id"?: string | null,"short_description"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["content_status"],"subject"?: string | null,"target_audience"?: string | null,"title"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["course_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "courses_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"curriculum_frameworks": {
                  Row: {
                    "authority": string | null,"code": string,"country_code": string,"created_at": string,"description": string | null,"id": string,"level_band": string | null,"name": string,"source_url": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "authority"?: string | null,"code": string,"country_code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"level_band"?: string | null,"name": string,"source_url"?: string | null,"status"?: string
                  }
                  Update: {
                    "authority"?: string | null,"code"?: string,"country_code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"level_band"?: string | null,"name"?: string,"source_url"?: string | null,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"curriculum_items": {
                  Row: {
                    "code": string | null,"created_at": string,"description": string | null,"framework_id": string,"grade_level": string | null,"id": string,"kind": string,"parent_id": string | null,"position": number,"search": unknown,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"created_at"?: string,"description"?: string | null,"framework_id": string,"grade_level"?: string | null,"id"?: string,"kind": string,"parent_id"?: string | null,"position"?: number,"search"?: never,"status"?: string,"title": string
                  }
                  Update: {
                    "code"?: string | null,"created_at"?: string,"description"?: string | null,"framework_id"?: string,"grade_level"?: string | null,"id"?: string,"kind"?: string,"parent_id"?: string | null,"position"?: number,"search"?: never,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "curriculum_items_framework_id_fkey"
      columns: ["framework_id"]
isOneToOne: false
      referencedRelation: "curriculum_frameworks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "curriculum_items_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "curriculum_items"
      referencedColumns: ["id"]
    }
                  ]
                },"curriculum_resources": {
                  Row: {
                    "audience": string,"created_at": string,"grade": string | null,"id": string,"level": string,"page_url": string | null,"search": unknown,"source": string,"subject": string | null,"title": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"created_at"?: string,"grade"?: string | null,"id"?: string,"level": string,"page_url"?: string | null,"search"?: never,"source"?: string,"subject"?: string | null,"title": string,"url": string
                  }
                  Update: {
                    "audience"?: string,"created_at"?: string,"grade"?: string | null,"id"?: string,"level"?: string,"page_url"?: string | null,"search"?: never,"source"?: string,"subject"?: string | null,"title"?: string,"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"discussion_spaces": {
                  Row: {
                    "body": string | null,"class_id": string | null,"created_at": string,"created_by": string,"group_id": string | null,"id": string,"is_locked": boolean,"is_pinned": boolean,"last_activity_at": string,"message_count": number,"subject": string | null,"title": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"class_id"?: string | null,"created_at"?: string,"created_by": string,"group_id"?: string | null,"id"?: string,"is_locked"?: boolean,"is_pinned"?: boolean,"last_activity_at"?: string,"message_count"?: number,"subject"?: string | null,"title": string,"visibility"?: string
                  }
                  Update: {
                    "body"?: string | null,"class_id"?: string | null,"created_at"?: string,"created_by"?: string,"group_id"?: string | null,"id"?: string,"is_locked"?: boolean,"is_pinned"?: boolean,"last_activity_at"?: string,"message_count"?: number,"subject"?: string | null,"title"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "discussion_spaces_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "discussion_spaces_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "discussion_spaces_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "study_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"features": {
                  Row: {
                    "description": string | null,"key": string,"kind": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"key": string,"kind"?: string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"kind"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"guardian_links": {
                  Row: {
                    "created_at": string,"guardian_id": string,"id": string,"learner_id": string,"relationship": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"guardian_id": string,"id"?: string,"learner_id": string,"relationship"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"guardian_id"?: string,"id"?: string,"learner_id"?: string,"relationship"?: string | null,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"instructor_applications": {
                  Row: {
                    "created_at": string,"expertise": string,"id": string,"motivation": string,"portfolio_url": string | null,"review_notes": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expertise": string,"id"?: string,"motivation": string,"portfolio_url"?: string | null,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expertise"?: string,"id"?: string,"motivation"?: string,"portfolio_url"?: string | null,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"lab_activities": {
                  Row: {
                    "config": NonNullable<Json>,"created_at": string,"created_by": string | null,"id": string,"instructions": string,"lab": string,"level": string | null,"slug": string,"status": string,"subject": string | null,"summary": string | null,"title": string,"tool": string
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instructions"?: string,"lab": string,"level"?: string | null,"slug": string,"status"?: string,"subject"?: string | null,"summary"?: string | null,"title": string,"tool": string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instructions"?: string,"lab"?: string,"level"?: string | null,"slug"?: string,"status"?: string,"subject"?: string | null,"summary"?: string | null,"title"?: string,"tool"?: string
                  }
                  Relationships: [
                    
                  ]
                },"lab_progress": {
                  Row: {
                    "activity_id": string,"best_score": number | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"best_score"?: number | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "activity_id"?: string,"best_score"?: number | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_progress_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "lab_activities"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_projects": {
                  Row: {
                    "activity_id": string | null,"created_at": string,"files": NonNullable<Json>,"id": string,"is_public": boolean,"language": string,"owner_id": string,"share_slug": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"created_at"?: string,"files"?: NonNullable<Json>,"id"?: string,"is_public"?: boolean,"language": string,"owner_id": string,"share_slug"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "activity_id"?: string | null,"created_at"?: string,"files"?: NonNullable<Json>,"id"?: string,"is_public"?: boolean,"language"?: string,"owner_id"?: string,"share_slug"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_projects_activity_fk"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "lab_activities"
      referencedColumns: ["id"]
    }
                  ]
                },"learning_activity": {
                  Row: {
                    "course_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"kind": string,"lesson_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"kind": string,"lesson_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "course_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"kind"?: string,"lesson_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "learning_activity_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_activity_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"learning_path_courses": {
                  Row: {
                    "course_id": string,"path_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"path_id": string,"position"?: number
                  }
                  Update: {
                    "course_id"?: string,"path_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "learning_path_courses_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "learning_path_courses_path_id_fkey"
      columns: ["path_id"]
isOneToOne: false
      referencedRelation: "learning_paths"
      referencedColumns: ["id"]
    }
                  ]
                },"learning_paths": {
                  Row: {
                    "cover_url": string | null,"created_at": string,"created_by": string | null,"description": string,"id": string,"slug": string,"status": Database["public"]['Enums']["content_status"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"slug": string,"status"?: Database["public"]['Enums']["content_status"],"title": string
                  }
                  Update: {
                    "cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["content_status"],"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"lesson_blocks": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"id": string,"lesson_id": string,"position": number,"type": Database["public"]['Enums']["lesson_block_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"lesson_id": string,"position"?: number,"type": Database["public"]['Enums']["lesson_block_type"],"updated_at"?: string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"lesson_id"?: string,"position"?: number,"type"?: Database["public"]['Enums']["lesson_block_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_blocks_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_curriculum_links": {
                  Row: {
                    "item_id": string,"lesson_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "item_id": string,"lesson_id": string
                  }
                  Update: {
                    "item_id"?: string,"lesson_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_curriculum_links_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "curriculum_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_curriculum_links_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_progress": {
                  Row: {
                    "completed_at": string | null,"course_id": string,"first_opened_at": string,"last_opened_at": string,"lesson_id": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"course_id": string,"first_opened_at"?: string,"last_opened_at"?: string,"lesson_id": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"course_id"?: string,"first_opened_at"?: string,"last_opened_at"?: string,"lesson_id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_progress_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_progress_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_revisions": {
                  Row: {
                    "blocks": NonNullable<Json>,"created_at": string,"created_by": string | null,"id": string,"lesson_id": string,"note": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocks": NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"lesson_id": string,"note"?: string | null,"title": string
                  }
                  Update: {
                    "blocks"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"id"?: string,"lesson_id"?: string,"note"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_revisions_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "assignment_id": string | null,"completion_rule": Database["public"]['Enums']["lesson_completion_rule"],"course_id": string,"created_at": string,"created_by": string | null,"estimated_minutes": number | null,"id": string,"is_preview": boolean,"module_id": string,"position": number,"quiz_assessment_id": string | null,"status": Database["public"]['Enums']["content_status"],"summary": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id"?: string | null,"completion_rule"?: Database["public"]['Enums']["lesson_completion_rule"],"course_id": string,"created_at"?: string,"created_by"?: string | null,"estimated_minutes"?: number | null,"id"?: string,"is_preview"?: boolean,"module_id": string,"position"?: number,"quiz_assessment_id"?: string | null,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assignment_id"?: string | null,"completion_rule"?: Database["public"]['Enums']["lesson_completion_rule"],"course_id"?: string,"created_at"?: string,"created_by"?: string | null,"estimated_minutes"?: number | null,"id"?: string,"is_preview"?: boolean,"module_id"?: string,"position"?: number,"quiz_assessment_id"?: string | null,"status"?: Database["public"]['Enums']["content_status"],"summary"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_assignment_fk"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "course_modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_quiz_fk"
      columns: ["quiz_assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    }
                  ]
                },"live_session_attendance": {
                  Row: {
                    "joined_at": string | null,"marked_by": string | null,"session_id": string,"source": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string | null,"marked_by"?: string | null,"session_id": string,"source"?: string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string | null,"marked_by"?: string | null,"session_id"?: string,"source"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_session_attendance_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "live_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"live_sessions": {
                  Row: {
                    "agenda": string | null,"cancel_reason": string | null,"class_id": string | null,"course_id": string | null,"created_at": string,"description": string | null,"duration_minutes": number,"embed_in_app": boolean,"host_id": string,"id": string,"join_url": string,"provider": Database["public"]['Enums']["meeting_provider"],"provider_meeting_id": string | null,"provider_meta": NonNullable<Json>,"recording_url": string | null,"starts_at": string,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agenda"?: string | null,"cancel_reason"?: string | null,"class_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"embed_in_app"?: boolean,"host_id": string,"id"?: string,"join_url": string,"provider"?: Database["public"]['Enums']["meeting_provider"],"provider_meeting_id"?: string | null,"provider_meta"?: NonNullable<Json>,"recording_url"?: string | null,"starts_at": string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "agenda"?: string | null,"cancel_reason"?: string | null,"class_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"description"?: string | null,"duration_minutes"?: number,"embed_in_app"?: boolean,"host_id"?: string,"id"?: string,"join_url"?: string,"provider"?: Database["public"]['Enums']["meeting_provider"],"provider_meeting_id"?: string | null,"provider_meta"?: NonNullable<Json>,"recording_url"?: string | null,"starts_at"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_sessions_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_sessions_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"message_reactions": {
                  Row: {
                    "created_at": string,"kind": string,"message_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"kind"?: string,"message_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"kind"?: string,"message_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_reactions_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "classroom_messages"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"data": NonNullable<Json>,"id": string,"link": string | null,"read_at": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plan_features": {
                  Row: {
                    "enabled": boolean,"feature_key": string,"limit_value": number | null,"plan_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"feature_key": string,"limit_value"?: number | null,"plan_id": string
                  }
                  Update: {
                    "enabled"?: boolean,"feature_key"?: string,"limit_value"?: number | null,"plan_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_features_feature_key_fkey"
      columns: ["feature_key"]
isOneToOne: false
      referencedRelation: "features"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "plan_features_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"is_default": boolean,"name": string,"price_label": string | null,"scope": string,"sort_order": number,"tier": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"name": string,"price_label"?: string | null,"scope": string,"sort_order"?: number,"tier": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_default"?: boolean,"name"?: string,"price_label"?: string | null,"scope"?: string,"sort_order"?: number,"tier"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_settings": {
                  Row: {
                    "description": string | null,"is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"poll_options": {
                  Row: {
                    "id": string,"label": string,"poll_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"label": string,"poll_id": string,"position"?: number
                  }
                  Update: {
                    "id"?: string,"label"?: string,"poll_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_options_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_votes": {
                  Row: {
                    "created_at": string,"option_id": string,"poll_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"option_id": string,"poll_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"option_id"?: string,"poll_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_votes_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "poll_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    }
                  ]
                },"polls": {
                  Row: {
                    "anonymous": boolean,"closes_at": string | null,"created_at": string,"created_by": string,"description": string | null,"id": string,"is_closed": boolean,"multiple": boolean,"question": string,"room_id": string,"room_type": string,"show_results": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymous"?: boolean,"closes_at"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"id"?: string,"is_closed"?: boolean,"multiple"?: boolean,"question": string,"room_id": string,"room_type": string,"show_results"?: string
                  }
                  Update: {
                    "anonymous"?: boolean,"closes_at"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"is_closed"?: boolean,"multiple"?: boolean,"question"?: string,"room_id"?: string,"room_type"?: string,"show_results"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"country_code": string,"created_at": string,"display_name": string | null,"full_name": string,"headline": string | null,"id": string,"intended_role": string,"is_guest": boolean,"last_seen_at": string | null,"leaderboard_opt_out": boolean,"learner_stage": string | null,"locale": string,"marketing_opt_in": boolean,"onboarding_completed": boolean,"preferences": NonNullable<Json>,"status": Database["public"]['Enums']["account_status"],"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"country_code"?: string,"created_at"?: string,"display_name"?: string | null,"full_name"?: string,"headline"?: string | null,"id": string,"intended_role"?: string,"is_guest"?: boolean,"last_seen_at"?: string | null,"leaderboard_opt_out"?: boolean,"learner_stage"?: string | null,"locale"?: string,"marketing_opt_in"?: boolean,"onboarding_completed"?: boolean,"preferences"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["account_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"country_code"?: string,"created_at"?: string,"display_name"?: string | null,"full_name"?: string,"headline"?: string | null,"id"?: string,"intended_role"?: string,"is_guest"?: boolean,"last_seen_at"?: string | null,"leaderboard_opt_out"?: boolean,"learner_stage"?: string | null,"locale"?: string,"marketing_opt_in"?: boolean,"onboarding_completed"?: boolean,"preferences"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["account_status"],"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"provider_connections": {
                  Row: {
                    "account_email": string | null,"connected_at": string,"id": string,"provider": Database["public"]['Enums']["meeting_provider"],"scopes": (string)[],"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_email"?: string | null,"connected_at"?: string,"id"?: string,"provider": Database["public"]['Enums']["meeting_provider"],"scopes"?: (string)[],"status"?: string,"user_id": string
                  }
                  Update: {
                    "account_email"?: string | null,"connected_at"?: string,"id"?: string,"provider"?: Database["public"]['Enums']["meeting_provider"],"scopes"?: (string)[],"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pulse_checks": {
                  Row: {
                    "class_id": string | null,"closes_at": string | null,"course_id": string | null,"created_at": string,"created_by": string,"id": string,"kind": string,"lesson_id": string | null,"question": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id"?: string | null,"closes_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by": string,"id"?: string,"kind"?: string,"lesson_id"?: string | null,"question": string
                  }
                  Update: {
                    "class_id"?: string | null,"closes_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"kind"?: string,"lesson_id"?: string | null,"question"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pulse_checks_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pulse_checks_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pulse_checks_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"pulse_responses": {
                  Row: {
                    "check_id": string,"comment": string | null,"created_at": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "check_id": string,"comment"?: string | null,"created_at"?: string,"user_id": string,"value": number
                  }
                  Update: {
                    "check_id"?: string,"comment"?: string | null,"created_at"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pulse_responses_check_id_fkey"
      columns: ["check_id"]
isOneToOne: false
      referencedRelation: "pulse_checks"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_used_at": string | null,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_used_at"?: string | null,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_used_at"?: string | null,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"question_answer_keys": {
                  Row: {
                    "answer": NonNullable<Json>,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: NonNullable<Json>,"question_id": string
                  }
                  Update: {
                    "answer"?: NonNullable<Json>,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_answer_keys_question_id_fkey"
      columns: ["question_id"]
isOneToOne: true
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"question_banks": {
                  Row: {
                    "course_id": string | null,"created_at": string,"description": string | null,"id": string,"owner_id": string,"school_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"owner_id": string,"school_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"owner_id"?: string,"school_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_banks_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "question_banks_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"question_options": {
                  Row: {
                    "id": string,"label": string,"position": number,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"label": string,"position"?: number,"question_id": string
                  }
                  Update: {
                    "id"?: string,"label"?: string,"position"?: number,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_options_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "bank_id": string,"category": string | null,"created_at": string,"created_by": string | null,"data": NonNullable<Json>,"difficulty": string,"explanation": string | null,"id": string,"marks": number,"prompt": string,"tags": (string)[],"type": Database["public"]['Enums']["question_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bank_id": string,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"data"?: NonNullable<Json>,"difficulty"?: string,"explanation"?: string | null,"id"?: string,"marks"?: number,"prompt": string,"tags"?: (string)[],"type": Database["public"]['Enums']["question_type"],"updated_at"?: string
                  }
                  Update: {
                    "bank_id"?: string,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"data"?: NonNullable<Json>,"difficulty"?: string,"explanation"?: string | null,"id"?: string,"marks"?: number,"prompt"?: string,"tags"?: (string)[],"type"?: Database["public"]['Enums']["question_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_bank_id_fkey"
      columns: ["bank_id"]
isOneToOne: false
      referencedRelation: "question_banks"
      referencedColumns: ["id"]
    }
                  ]
                },"rubric_criteria": {
                  Row: {
                    "assignment_id": string,"description": string | null,"id": string,"max_points": number,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"description"?: string | null,"id"?: string,"max_points": number,"position"?: number,"title": string
                  }
                  Update: {
                    "assignment_id"?: string,"description"?: string | null,"id"?: string,"max_points"?: number,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rubric_criteria_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    }
                  ]
                },"school_classes": {
                  Row: {
                    "academic_year_id": string | null,"allow_guests": boolean,"color": string,"cover_url": string | null,"created_at": string,"description": string | null,"id": string,"is_archived": boolean,"join_code": string | null,"join_enabled": boolean,"join_requires_approval": boolean,"level": string | null,"name": string,"owner_id": string | null,"room_label": string | null,"school_id": string | null,"stream": string | null,"subject": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id"?: string | null,"allow_guests"?: boolean,"color"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_archived"?: boolean,"join_code"?: string | null,"join_enabled"?: boolean,"join_requires_approval"?: boolean,"level"?: string | null,"name": string,"owner_id"?: string | null,"room_label"?: string | null,"school_id"?: string | null,"stream"?: string | null,"subject"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string | null,"allow_guests"?: boolean,"color"?: string,"cover_url"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_archived"?: boolean,"join_code"?: string | null,"join_enabled"?: boolean,"join_requires_approval"?: boolean,"level"?: string | null,"name"?: string,"owner_id"?: string | null,"room_label"?: string | null,"school_id"?: string | null,"stream"?: string | null,"subject"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_classes_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "school_classes_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"school_invitations": {
                  Row: {
                    "accepted_by": string | null,"class_id": string | null,"created_at": string,"email": string,"expires_at": string,"full_name": string | null,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["school_role"],"school_id": string,"status": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_by"?: string | null,"class_id"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"full_name"?: string | null,"id"?: string,"invited_by"?: string | null,"role": Database["public"]['Enums']["school_role"],"school_id": string,"status"?: string,"token"?: string
                  }
                  Update: {
                    "accepted_by"?: string | null,"class_id"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"full_name"?: string | null,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["school_role"],"school_id"?: string,"status"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_invitations_class_fk"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "school_invitations_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"school_memberships": {
                  Row: {
                    "created_at": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["school_role"],"school_id": string,"status": Database["public"]['Enums']["membership_status"],"student_number": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"role": Database["public"]['Enums']["school_role"],"school_id": string,"status"?: Database["public"]['Enums']["membership_status"],"student_number"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["school_role"],"school_id"?: string,"status"?: Database["public"]['Enums']["membership_status"],"student_number"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "school_memberships_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"schools": {
                  Row: {
                    "address": string | null,"applicant_role": string | null,"application_notes": string | null,"applied_by": string | null,"city": string | null,"contact_email": string,"contact_phone": string | null,"country_code": string,"created_at": string,"estimated_learners": number | null,"id": string,"institution_type": string,"logo_url": string | null,"motto": string | null,"name": string,"region": string | null,"review_notes": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"slug": string,"status": Database["public"]['Enums']["school_status"],"timezone": string,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"applicant_role"?: string | null,"application_notes"?: string | null,"applied_by"?: string | null,"city"?: string | null,"contact_email": string,"contact_phone"?: string | null,"country_code"?: string,"created_at"?: string,"estimated_learners"?: number | null,"id"?: string,"institution_type"?: string,"logo_url"?: string | null,"motto"?: string | null,"name": string,"region"?: string | null,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["school_status"],"timezone"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"applicant_role"?: string | null,"application_notes"?: string | null,"applied_by"?: string | null,"city"?: string | null,"contact_email"?: string,"contact_phone"?: string | null,"country_code"?: string,"created_at"?: string,"estimated_learners"?: number | null,"id"?: string,"institution_type"?: string,"logo_url"?: string | null,"motto"?: string | null,"name"?: string,"region"?: string | null,"review_notes"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["school_status"],"timezone"?: string,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"study_group_members": {
                  Row: {
                    "group_id": string,"joined_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"joined_at"?: string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"joined_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "study_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"study_groups": {
                  Row: {
                    "class_id": string | null,"course_id": string | null,"created_at": string,"created_by": string,"description": string | null,"id": string,"max_members": number,"name": string,"topic": string | null,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"id"?: string,"max_members"?: number,"name": string,"topic"?: string | null,"visibility"?: string
                  }
                  Update: {
                    "class_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"max_members"?: number,"name"?: string,"topic"?: string | null,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_groups_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "school_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "study_groups_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"submission_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"submission_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"submission_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"submission_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submission_comments_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "assignment_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"submission_files": {
                  Row: {
                    "bytes": number | null,"created_at": string,"delivery_type": string,"filename": string,"format": string | null,"id": string,"public_id": string,"resource_type": string,"submission_id": string,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes"?: number | null,"created_at"?: string,"delivery_type"?: string,"filename": string,"format"?: string | null,"id"?: string,"public_id": string,"resource_type"?: string,"submission_id": string,"version"?: string | null
                  }
                  Update: {
                    "bytes"?: number | null,"created_at"?: string,"delivery_type"?: string,"filename"?: string,"format"?: string | null,"id"?: string,"public_id"?: string,"resource_type"?: string,"submission_id"?: string,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "submission_files_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "assignment_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"submission_grades": {
                  Row: {
                    "feedback": string | null,"graded_at": string,"graded_by": string,"released": boolean,"rubric_scores": NonNullable<Json>,"score": number,"submission_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "feedback"?: string | null,"graded_at"?: string,"graded_by": string,"released"?: boolean,"rubric_scores"?: NonNullable<Json>,"score": number,"submission_id": string
                  }
                  Update: {
                    "feedback"?: string | null,"graded_at"?: string,"graded_by"?: string,"released"?: boolean,"rubric_scores"?: NonNullable<Json>,"score"?: number,"submission_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submission_grades_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: true
      referencedRelation: "assignment_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"subscription_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"event": string,"id": number,"subscription_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"event": string,"id"?: never,"subscription_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"event"?: string,"id"?: never,"subscription_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_events_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "created_at": string,"ends_at": string | null,"granted_by": string | null,"id": string,"notes": string | null,"plan_id": string,"school_id": string | null,"source": string,"starts_at": string,"status": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at"?: string | null,"granted_by"?: string | null,"id"?: string,"notes"?: string | null,"plan_id": string,"school_id"?: string | null,"source"?: string,"starts_at"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string | null,"granted_by"?: string | null,"id"?: string,"notes"?: string | null,"plan_id"?: string,"school_id"?: string | null,"source"?: string,"starts_at"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"support_replies": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"id": string,"is_internal": boolean,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"id"?: string,"is_internal"?: boolean,"ticket_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"is_internal"?: boolean,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_replies_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "support_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"support_tickets": {
                  Row: {
                    "assigned_to": string | null,"category": string,"created_at": string,"description": string,"id": string,"priority": string,"resolved_at": string | null,"status": string,"subject": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"category"?: string,"created_at"?: string,"description": string,"id"?: string,"priority"?: string,"resolved_at"?: string | null,"status"?: string,"subject": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "assigned_to"?: string | null,"category"?: string,"created_at"?: string,"description"?: string,"id"?: string,"priority"?: string,"resolved_at"?: string | null,"status"?: string,"subject"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"teacher_resources": {
                  Row: {
                    "ai_generated": boolean,"body_md": string | null,"content": NonNullable<Json>,"course_id": string | null,"created_at": string,"curriculum_item_ids": (string)[],"grade_level": string | null,"id": string,"is_shared": boolean,"kind": string,"lesson_id": string | null,"owner_id": string,"school_id": string | null,"status": string,"subject": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_generated"?: boolean,"body_md"?: string | null,"content"?: NonNullable<Json>,"course_id"?: string | null,"created_at"?: string,"curriculum_item_ids"?: (string)[],"grade_level"?: string | null,"id"?: string,"is_shared"?: boolean,"kind": string,"lesson_id"?: string | null,"owner_id": string,"school_id"?: string | null,"status"?: string,"subject"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "ai_generated"?: boolean,"body_md"?: string | null,"content"?: NonNullable<Json>,"course_id"?: string | null,"created_at"?: string,"curriculum_item_ids"?: (string)[],"grade_level"?: string | null,"id"?: string,"is_shared"?: boolean,"kind"?: string,"lesson_id"?: string | null,"owner_id"?: string,"school_id"?: string | null,"status"?: string,"subject"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_resources_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_resources_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_resources_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"user_badges": {
                  Row: {
                    "awarded_at": string,"badge_code": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "awarded_at"?: string,"badge_code": string,"user_id": string
                  }
                  Update: {
                    "awarded_at"?: string,"badge_code"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_badges_badge_code_fkey"
      columns: ["badge_code"]
isOneToOne: false
      referencedRelation: "badges"
      referencedColumns: ["code"]
    }
                  ]
                },"user_progress": {
                  Row: {
                    "current_streak": number,"last_active_date": string | null,"level": number,"longest_streak": number,"updated_at": string,"user_id": string,"xp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "current_streak"?: number,"last_active_date"?: string | null,"level"?: number,"longest_streak"?: number,"updated_at"?: string,"user_id": string,"xp"?: number
                  }
                  Update: {
                    "current_streak"?: number,"last_active_date"?: string | null,"level"?: number,"longest_streak"?: number,"updated_at"?: string,"user_id"?: string,"xp"?: number
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"granted_by": string | null,"id": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted_by"?: string | null,"id"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted_by"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_answer":
{ Args: { "p_message": string }; Returns: undefined
                           },
"add_course_instructor":
{ Args: { "p_course": string,"p_email": string,"p_role"?: string }; Returns: undefined
                           },
"add_school_member":
{ Args: { "p_class"?: string,"p_email": string,"p_full_name": string,"p_role": Database["public"]['Enums']["school_role"],"p_school": string,"p_student_number"?: string }; Returns: string
                           },
"admin_import_curriculum":
{ Args: { "p_approve"?: boolean,"p_framework": string,"p_items": Json }; Returns: number
                           },
"admin_list_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_search"?: string }; Returns: {
              "created_at": string,"email": string,"email_confirmed": boolean,"full_name": string,"last_sign_in_at": string,"roles": (Database["public"]['Enums']["app_role"])[],"status": Database["public"]['Enums']["account_status"],"total_count": number,"user_id": string
            }[]
                           },
"admin_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"ai_consume":
{ Args: { "p_tokens"?: number }; Returns: Json
                           },
"ai_lesson_context":
{ Args: { "p_lesson": string }; Returns: Json
                           },
"arena_leaderboard":
{ Args: { "p_challenge"?: string,"p_limit"?: number,"p_period"?: string,"p_scope"?: string,"p_scope_id"?: string }; Returns: {
              "avatar_url": string,"is_me": boolean,"name": string,"rank": number,"score": number,"time_ms": number,"user_id": string
            }[]
                           },
"arena_start":
{ Args: { "p_challenge": string }; Returns: Json
                           },
"arena_submit":
{ Args: { "p_answers": Json,"p_attempt": string,"p_client"?: Json }; Returns: Json
                           },
"assessment_results_overview":
{ Args: { "p_assessment": string }; Returns: {
              "attempt_id": string,"attempt_no": number,"learner_name": string,"max_score": number,"passed": boolean,"pending_manual": boolean,"percentage": number,"score": number,"started_at": string,"status": string,"submitted_at": string,"user_id": string
            }[]
                           },
"assignment_submissions_overview":
{ Args: { "p_assignment": string }; Returns: {
              "file_count": number,"graded_at": string,"is_late": boolean,"learner_name": string,"score": number,"status": string,"submission_id": string,"submitted_at": string,"user_id": string
            }[]
                           },
"cast_vote":
{ Args: { "p_option_ids": (string)[],"p_poll": string }; Returns: undefined
                           },
"claim_certificate":
{ Args: { "p_course": string }; Returns: string
                           },
"class_join_requests":
{ Args: { "p_class": string }; Returns: {
              "is_guest": boolean,"name": string,"requested_at": string,"user_id": string
            }[]
                           },
"class_learning":
{ Args: { "p_class": string }; Returns: {
              "course_id": string,"cover_url": string,"lessons": number,"my_progress": number,"short_description": string,"status": string,"title": string,"visibility": string
            }[]
                           },
"class_preview":
{ Args: { "p_code": string }; Returns: Json
                           },
"class_progress":
{ Args: { "p_class": string }; Returns: {
              "attendance_rate": number,"avatar_url": string,"avg_progress": number,"last_activity_at": string,"name": string,"submissions": number,"user_id": string
            }[]
                           },
"complete_lesson":
{ Args: { "p_lesson": string }; Returns: Json
                           },
"course_analytics":
{ Args: { "p_course": string }; Returns: Json
                           },
"course_instructor_cards":
{ Args: { "p_course_ids": (string)[] }; Returns: {
              "avatar_url": string,"course_id": string,"headline": string,"name": string,"role": string,"user_id": string
            }[]
                           },
"course_public_stats":
{ Args: { "p_course": string }; Returns: Json
                           },
"course_team":
{ Args: { "p_course": string }; Returns: {
              "avatar_url": string,"is_owner": boolean,"name": string,"role": string,"user_id": string
            }[]
                           },
"create_poll":
{ Args: { "p_anonymous"?: boolean,"p_closes_at"?: string,"p_description"?: string,"p_multiple"?: boolean,"p_options": (string)[],"p_question": string,"p_room": string,"p_room_type": string,"p_show_results"?: string }; Returns: string
                           },
"curriculum_search":
{ Args: { "p_grade"?: string,"p_limit"?: number,"p_query": string,"p_subject"?: string }; Returns: {
              "code": string,"description": string,"framework": string,"grade_level": string,"id": string,"kind": string,"path": string,"rank": number,"title": string
            }[]
                           },
"duplicate_lesson":
{ Args: { "p_lesson": string }; Returns: string
                           },
"enrol_by_email":
{ Args: { "p_course": string,"p_emails": (string)[] }; Returns: Json
                           },
"enrol_in_course":
{ Args: { "p_course": string }; Returns: string
                           },
"enrol_users":
{ Args: { "p_course": string,"p_user_ids": (string)[] }; Returns: number
                           },
"get_attempt":
{ Args: { "p_attempt": string }; Returns: Json
                           },
"get_question":
{ Args: { "p_question": string }; Returns: Json
                           },
"grade_answer":
{ Args: { "p_attempt": string,"p_feedback": string,"p_marks": number,"p_question": string }; Returns: undefined
                           },
"gradebook":
{ Args: { "p_class"?: string,"p_course"?: string }; Returns: Json
                           },
"grant_subscription":
{ Args: { "p_ends_at": string,"p_notes"?: string,"p_plan_code": string,"p_school": string,"p_source"?: string,"p_user": string }; Returns: string
                           },
"import_students":
{ Args: { "p_class": string,"p_rows": Json,"p_school": string }; Returns: Json
                           },
"invite_to_class":
{ Args: { "p_class": string,"p_emails": (string)[] }; Returns: Json
                           },
"join_class_by_code":
{ Args: { "p_code": string }; Returns: Json
                           },
"join_live_session":
{ Args: { "p_session": string }; Returns: string
                           },
"join_study_group":
{ Args: { "p_group": string,"p_user"?: string }; Returns: undefined
                           },
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"media_permissions":
{ Args: { "p_course"?: string }; Returns: Json
                           },
"my_arena_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_calendar":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "context": string,"ends_at": string,"id": string,"kind": string,"link": string,"starts_at": string,"status": string,"title": string
            }[]
                           },
"my_class_invitations":
{ Args: Record<PropertyKey, never>; Returns: {
              "class_id": string,"class_name": string,"created_at": string,"id": string,"teacher": string
            }[]
                           },
"my_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_grades":
{ Args: Record<PropertyKey, never>; Returns: {
              "context": string,"graded_at": string,"item_id": string,"kind": string,"link": string,"max_score": number,"pct": number,"score": number,"title": string
            }[]
                           },
"my_invitations":
{ Args: Record<PropertyKey, never>; Returns: {
              "class_name": string,"expires_at": string,"id": string,"role": Database["public"]['Enums']["school_role"],"school_id": string,"school_name": string
            }[]
                           },
"my_students":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_url": string,"avg_progress": number,"contexts": (string)[],"last_activity_at": string,"name": string,"user_id": string
            }[]
                           },
"peer_helpers":
{ Args: { "p_room": string,"p_type": string }; Returns: {
              "accepted": number,"helpful": number,"name": string,"user_id": string
            }[]
                           },
"poll_results":
{ Args: { "p_poll": string }; Returns: Json
                           },
"provider_get_tokens":
{ Args: { "p_provider": string,"p_secret": string }; Returns: Json
                           },
"provider_store_tokens":
{ Args: { "p_access": string,"p_email": string,"p_expires_at": string,"p_provider": string,"p_refresh": string,"p_scopes": (string)[],"p_secret": string }; Returns: string
                           },
"pulse_summary":
{ Args: { "p_check": string }; Returns: Json
                           },
"push_prune":
{ Args: { "p_endpoints": (string)[],"p_secret": string }; Returns: number
                           },
"regenerate_join_code":
{ Args: { "p_class": string }; Returns: string
                           },
"release_results":
{ Args: { "p_assessment": string }; Returns: number
                           },
"reorder_lessons":
{ Args: { "p_ids": (string)[],"p_module": string }; Returns: undefined
                           },
"reorder_modules":
{ Args: { "p_course": string,"p_ids": (string)[] }; Returns: undefined
                           },
"respond_class_invitation":
{ Args: { "p_accept": boolean,"p_invitation": string }; Returns: string
                           },
"respond_invitation":
{ Args: { "p_accept": boolean,"p_invitation": string }; Returns: undefined
                           },
"restore_lesson_revision":
{ Args: { "p_revision": string }; Returns: undefined
                           },
"review_course":
{ Args: { "p_action": string,"p_course": string,"p_notes"?: string }; Returns: undefined
                           },
"review_instructor_application":
{ Args: { "p_application": string,"p_approve": boolean,"p_notes"?: string }; Returns: undefined
                           },
"review_join_request":
{ Args: { "p_approve": boolean,"p_class": string,"p_user": string }; Returns: undefined
                           },
"review_school":
{ Args: { "p_approve": boolean,"p_notes"?: string,"p_school": string }; Returns: undefined
                           },
"revoke_subscription":
{ Args: { "p_reason"?: string,"p_subscription": string }; Returns: undefined
                           },
"room_members":
{ Args: { "p_room": string,"p_type": string }; Returns: {
              "avatar_url": string,"member_role": string,"name": string,"user_id": string
            }[]
                           },
"save_answer":
{ Args: { "p_attempt": string,"p_question": string,"p_response": Json }; Returns: string
                           },
"save_lesson_content":
{ Args: { "p_blocks": Json,"p_lesson": string,"p_revision_note"?: string,"p_summary": string,"p_title": string }; Returns: string
                           },
"save_question":
{ Args: { "p": Json,"p_bank": string,"p_question": string }; Returns: string
                           },
"school_directory":
{ Args: { "p_search"?: string }; Returns: {
              "city": string,"country_code": string,"id": string,"institution_type": string,"logo_url": string,"motto": string,"name": string,"region": string,"slug": string
            }[]
                           },
"school_people":
{ Args: { "p_role"?: Database["public"]['Enums']["school_role"],"p_school": string }; Returns: {
              "avatar_url": string,"classes": (string)[],"email": string,"full_name": string,"joined_at": string,"membership_id": string,"role": Database["public"]['Enums']["school_role"],"status": Database["public"]['Enums']["membership_status"],"student_number": string,"user_id": string
            }[]
                           },
"school_report":
{ Args: { "p_school": string }; Returns: Json
                           },
"send_test_notification":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"session_role":
{ Args: { "p_session": string }; Returns: string
                           },
"set_school_status":
{ Args: { "p_notes"?: string,"p_school": string,"p_status": Database["public"]['Enums']["school_status"] }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_grant": boolean,"p_role": Database["public"]['Enums']["app_role"],"p_user": string }; Returns: undefined
                           },
"set_user_status":
{ Args: { "p_reason"?: string,"p_status": Database["public"]['Enums']["account_status"],"p_user": string }; Returns: undefined
                           },
"start_attempt":
{ Args: { "p_assessment": string }; Returns: string
                           },
"submit_attempt":
{ Args: { "p_attempt": string }; Returns: Json
                           },
"submit_course_for_review":
{ Args: { "p_course": string }; Returns: undefined
                           },
"teacher_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"touch_lesson":
{ Args: { "p_lesson": string }; Returns: undefined
                           },
"verify_certificate":
{ Args: { "p_serial": string }; Returns: Json
                           }
          }
          Enums: {
            "account_status": "active"|"suspended","app_role": "learner"|"teacher"|"school_admin"|"platform_admin"|"owner"|"guardian","content_status": "draft"|"in_review"|"published"|"unpublished"|"archived","course_level": "beginner"|"intermediate"|"advanced"|"all_levels","course_visibility": "public"|"unlisted"|"school"|"private"|"class","enrolment_method": "open"|"invite"|"closed","enrolment_source": "self"|"teacher"|"school"|"admin","enrolment_status": "active"|"completed"|"dropped","lesson_block_type": "heading"|"paragraph"|"image"|"video"|"audio"|"code"|"callout"|"activity"|"quiz"|"resource"|"link"|"table"|"steps"|"embed"|"divider"|"lab","lesson_completion_rule": "mark_complete"|"quiz_pass"|"assignment_submit","meeting_provider": "manual"|"google_meet"|"zoom"|"jitsi"|"teams"|"other","membership_status": "pending"|"invited"|"active"|"suspended"|"removed","question_type": "multiple_choice"|"multiple_select"|"true_false"|"fill_blank"|"short_answer"|"essay"|"matching"|"ordering"|"file_upload","results_visibility": "immediate"|"after_close"|"manual","school_role": "school_admin"|"teacher"|"student"|"guardian","school_status": "pending"|"approved"|"rejected"|"suspended"
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
            "account_status": ["active", "suspended"],"app_role": ["learner", "teacher", "school_admin", "platform_admin", "owner", "guardian"],"content_status": ["draft", "in_review", "published", "unpublished", "archived"],"course_level": ["beginner", "intermediate", "advanced", "all_levels"],"course_visibility": ["public", "unlisted", "school", "private", "class"],"enrolment_method": ["open", "invite", "closed"],"enrolment_source": ["self", "teacher", "school", "admin"],"enrolment_status": ["active", "completed", "dropped"],"lesson_block_type": ["heading", "paragraph", "image", "video", "audio", "code", "callout", "activity", "quiz", "resource", "link", "table", "steps", "embed", "divider", "lab"],"lesson_completion_rule": ["mark_complete", "quiz_pass", "assignment_submit"],"meeting_provider": ["manual", "google_meet", "zoom", "jitsi", "teams", "other"],"membership_status": ["pending", "invited", "active", "suspended", "removed"],"question_type": ["multiple_choice", "multiple_select", "true_false", "fill_blank", "short_answer", "essay", "matching", "ordering", "file_upload"],"results_visibility": ["immediate", "after_close", "manual"],"school_role": ["school_admin", "teacher", "student", "guardian"],"school_status": ["pending", "approved", "rejected", "suspended"]
          }
        }
} as const
