import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ==========================================
// 1. BETTER AUTH REQUIRED TABLES
// ==========================================

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"), // user, organizer, admin
  department: text("department"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ==========================================
// 2. COLLEGE EMAIL OTP VERIFICATION TABLE
// ==========================================

export const otpVerification = sqliteTable(
  "otp_verification",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    otpHash: text("otp_hash").notNull(),
    purpose: text("purpose").notNull().default("signup"), // 'signup' | 'password_reset'
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    tempToken: text("temp_token"), // used to authorize password setting after verification
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    emailIdx: index("otp_email_idx").on(table.email),
    tokenIdx: index("otp_token_idx").on(table.tempToken),
  })
);

// ==========================================
// 3. AU FORMS CORE ENTITIES
// ==========================================

export const forms = sqliteTable(
  "forms",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(), // short unguessable slug (e.g. 10 chars)
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Form"),
    description: text("description").default(""),
    status: text("status").notNull().default("draft"), // 'draft' | 'published' | 'closed' | 'archived'

    // Form appearance & theme tokens
    themeSettings: text("theme_settings").notNull().default(
      JSON.stringify({
        primaryColor: "#F16222",
        backgroundColor: "#FAFAFA",
        headerImage: null,
        fontFamily: "Inter",
      })
    ),

    // Form logic & submission controls
    formSettings: text("form_settings").notNull().default(
      JSON.stringify({
        collectEmail: false,
        requireCollegeLogin: false,
        limitOneResponse: false,
        shuffleQuestions: false,
        showProgressBar: true,
        allowEditResponse: false,
        allowViewSummary: false,
        confirmationMessage: "Your response has been recorded. Thank you!",
        submitAnotherLink: true,
      })
    ),

    // Quizzing & grading configuration
    isQuiz: integer("is_quiz", { mode: "boolean" }).notNull().default(false),
    quizSettings: text("quiz_settings").default(
      JSON.stringify({
        immediateRelease: true,
        showMissedQuestions: true,
        showCorrectAnswers: true,
        showPoints: true,
      })
    ),

    // Temporal and capacity limits
    opensAt: integer("opens_at", { mode: "timestamp" }),
    closesAt: integer("closes_at", { mode: "timestamp" }),
    maxResponses: integer("max_responses"),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    ownerIdx: index("forms_owner_idx").on(table.ownerId),
    publicIdx: index("forms_public_idx").on(table.publicId),
    statusIdx: index("forms_status_idx").on(table.status),
  })
);

// Form Sections (for multi-page forms, pagination & conditional navigation)
export const formSections = sqliteTable(
  "form_sections",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    title: text("title").notNull().default("Section"),
    description: text("description").default(""),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    formIdx: index("sections_form_idx").on(table.formId),
    orderIdx: index("sections_order_idx").on(table.formId, table.orderIndex),
  })
);

// Questions and Content Blocks (Title, Image, Video, 11 Question Types)
export const formElements = sqliteTable(
  "form_elements",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    sectionId: text("section_id")
      .notNull()
      .references(() => formSections.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    
    // Element Type: short_answer, paragraph, multiple_choice, checkboxes, dropdown,
    // linear_scale, mc_grid, checkbox_grid, file_upload, date, time, title_desc, image, video
    type: text("type").notNull(),
    title: text("title").notNull().default(""),
    description: text("description").default(""),
    isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
    points: integer("points").default(0),

    // Options for choice/grid questions (JSON string)
    // Structure: [{ id, text, image, rowHeaders, colHeaders, ... }]
    options: text("options").default("[]"),

    // Linear scale settings (JSON: { min: 1, max: 5, minLabel: 'Poor', maxLabel: 'Excellent' })
    scaleSettings: text("scale_settings"),

    // Validation rules (JSON: { type: 'number'|'text'|'checkbox', rule: 'greater_than', val: 5, customError: '' })
    validation: text("validation"),

    // Conditional Branching (JSON: { optionId: 'section_id' | 'submit' | 'next' })
    branchingLogic: text("branching_logic"),

    // Media properties (for image/video blocks or question inline media)
    mediaUrl: text("media_url"),
    mediaMeta: text("media_meta"), // alignment, caption, youtube video ID

    // Quiz Answer Key (JSON: { correctAnswers: string[], feedbackCorrect: string, feedbackIncorrect: string, youtubeFeedbackUrl: string })
    quizAnswerKey: text("quiz_answer_key"),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    formIdx: index("elements_form_idx").on(table.formId),
    sectionIdx: index("elements_section_idx").on(table.sectionId),
    orderIdx: index("elements_order_idx").on(table.formId, table.orderIndex),
  })
);

// Form Responses
export const formResponses = sqliteTable(
  "form_responses",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    respondentId: text("respondent_id").references(() => user.id, { onDelete: "set null" }),
    respondentEmail: text("respondent_email"),
    submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull(),
    totalScore: integer("total_score"),
    maxScore: integer("max_score"),
    status: text("status").notNull().default("completed"), // 'completed' | 'draft'
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
  },
  (table) => ({
    formIdx: index("responses_form_idx").on(table.formId),
    respondentIdx: index("responses_respondent_idx").on(table.respondentId),
    dateIdx: index("responses_date_idx").on(table.formId, table.submittedAt),
  })
);

// Form Response Answers
export const formAnswers = sqliteTable(
  "form_answers",
  {
    id: text("id").primaryKey(),
    responseId: text("response_id")
      .notNull()
      .references(() => formResponses.id, { onDelete: "cascade" }),
    elementId: text("element_id")
      .notNull()
      .references(() => formElements.id, { onDelete: "cascade" }),
    // Stringified answer: plain text, option id, array of checked ids, or grid mapping JSON
    answerValue: text("answer_value"),
    // Quiz grading result
    isCorrect: integer("is_correct", { mode: "boolean" }),
    scoreAwarded: integer("score_awarded").default(0),
    feedback: text("feedback"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    responseIdx: index("answers_response_idx").on(table.responseId),
    elementIdx: index("answers_element_idx").on(table.elementId),
  })
);

// Form Collaborators
export const formCollaborators = sqliteTable(
  "form_collaborators",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor"), // 'editor' | 'viewer'
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    formUserIdx: index("collab_form_user_idx").on(table.formId, table.userId),
  })
);

// Audit logs
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: text("metadata"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    actionIdx: index("audit_action_idx").on(table.action),
    timestampIdx: index("audit_timestamp_idx").on(table.timestamp),
  })
);
