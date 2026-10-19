# AU Forms — Master Implementation for Avantika University

**AU Forms** is a production-minded web application engineered for **Avantika University, Ujjain, Madhya Pradesh, India**. It replaces reliance on Google Forms for event registrations, surveys, feedback questionnaires, student evaluations, and graded quizzes with a self-hosted, university-branded data collection platform.

---

## 1. System Architecture & Tech Stack

```
                          +--------------------------------------------------------+
                          |                   CLIENT (Port 5173)                   |
                          |  React 18 • Vite • TypeScript • Tailwind CSS           |
                          |  Radix UI / shadcn • Recharts • dnd-kit • Canvas Confetti |
                          +--------------------------------------------------------+
                                                     │  /api/ (Proxy)
                                                     ▼
                          +--------------------------------------------------------+
                          |                   SERVER (Port 4000)                   |
                          |  Fastify 5 • Node 22 • Better Auth • Drizzle ORM       |
                          |  Zod Validation • Nodemailer (Gmail SMTP 587 STARTTLS) |
                          +--------------------------------------------------------+
                                                     │  libsql:// wire protocol
                                                     ▼
                          +--------------------------------------------------------+
                          |                TURSO LIB-SQL DATABASE                  |
                          |  aws-ap-south-1.turso.io                               |
                          |  Tables: user, session, account, verification,         |
                          |          otp_verification, forms, form_sections,       |
                          |          form_elements, form_responses, form_answers   |
                          +--------------------------------------------------------+
```

### Frontend Stack
- **Framework & Build:** React 18, Vite 6, TypeScript (strict mode)
- **Styling & Tokens:** Tailwind CSS with Avantika University Coding Ninjas Brand System:
  - **Flamingo:** `#F16222` (primary brand accent)
  - **Alabaster:** `#FAFAFA` (light background & card surfaces)
  - **Dark Mode:** Deep charcoal neutrals with vibrant Flamingo accents
- **UI Components:** Radix UI accessible headless primitives
- **Visual Analytics:** Recharts (pie charts, bar distributions, histograms)
- **Drag-and-Drop:** `@dnd-kit/core` & `@dnd-kit/sortable`
- **Sharing & Mobile:** `qrcode.react` (dynamic QR code generation for mobile scans)

### Backend Stack
- **Runtime:** Node.js v22 LTS
- **Server:** Fastify v5 with `@fastify/cors`, `@fastify/cookie`, `@fastify/multipart`
- **Database & ORM:** Turso libSQL cloud database (`@libsql/client`), Drizzle ORM (`drizzle-orm` + `drizzle-kit`)
- **Authentication:** Better Auth with `@better-auth/drizzle-adapter` (SQLite/libSQL dialect)
- **Email Delivery:** Nodemailer with Gmail SMTP (`smtp.gmail.com`, port `587`, STARTTLS)

---

## 2. Mandatory Verification: Better Auth + Turso LibSQL Findings

In compliance with Phase 1 requirements, the Better Auth, Drizzle ORM, `@libsql/client`, and Turso integration was thoroughly verified:

| Verification Item | Result | Details |
|---|---|---|
| **Turso Network Connectivity** | **VERIFIED** | Connected to `libsql://au-forms-samyak2501.aws-ap-south-1.turso.io` via `@libsql/client` |
| **Drizzle Migration Sync** | **VERIFIED** | `drizzle-kit push` succeeded with code 0; applied 12 relational tables |
| **Better Auth Drizzle Adapter** | **VERIFIED** | `@better-auth/drizzle-adapter` configured with `provider: "sqlite"` |
| **User & Account Creation** | **VERIFIED** | `auth.api.signUpEmail` successfully writes to Turso `user` and `account` tables |
| **Password Verification** | **VERIFIED** | Password hashing & `auth.api.signInEmail` verified against Turso |
| **Session Persistence** | **VERIFIED** | Session token stored in Turso `session` table; verified via `auth.api.getSession` |
| **Session Revocation** | **VERIFIED** | `auth.api.signOut` invalidates session token in Turso immediately |
| **Schema Coexistence** | **VERIFIED** | Better Auth auth tables and AU Forms application tables (`forms`, `elements`, `responses`) coexist in the same database without conflicts |
| **Server Restart Persistence** | **VERIFIED** | Restarting the server does not erase data; all forms and sessions remain persisted |

---

## 3. College Email Signup & OTP Security Flow

AU Forms implements the exact requested 3-step security journey for Avantika University members:

1. **Step 1 — Email Domain Check:** User enters Name and College Email. Server normalizes the email and validates that the domain is `@avantika.edu.in`. Non-college emails are rejected immediately.
2. **Step 2 — 6-Digit Single-Use OTP:** 
   - Cryptographically generated 6-digit random code (`crypto.randomInt(100000, 1000000)`).
   - Code is hashed with SHA-256 before being stored in the database.
   - Branded HTML email with plain-text fallback sent from `samyak.jain1@avantika.edu.in`.
   - **5-minute expiry** with countdown timer in UI.
   - **Maximum 3 verification attempts** per code. If exceeded, the code is immediately invalidated.
   - **Rate limit cooldown** (45 seconds) prevents spamming.
   - Issuing a new code invalidates prior unverified codes.
3. **Step 3 — Password Creation & Session Issuance:**
   - On successful OTP verification, the server issues a single-use `tempToken` valid for 10 minutes.
   - User chooses an 8+ character password.
   - Server finalizes account creation via Better Auth, sets `emailVerified: true`, invalidates the `tempToken`, and issues an authenticated session cookie.

---

## 4. Google Forms Feature Parity Matrix

AU Forms achieves feature parity with Google Forms for core campus operations:

| Google Forms Capability | AU Forms Implementation Status | Description |
|---|---|---|
| **Short Answer** | **Implemented** | Single-line text with length, email, URL, regex validation |
| **Paragraph** | **Implemented** | Multi-line text for open-ended qualitative feedback |
| **Multiple Choice** | **Implemented** | Single selection with custom options and write-in "Other" |
| **Checkboxes** | **Implemented** | Multi-selection with count constraints (at least / at most N) |
| **Dropdown** | **Implemented** | Collapsible single selection menu |
| **Linear Scale** | **Implemented** | Configurable numeric scale (0/1 to 10) with custom endpoints |
| **Multiple Choice Grid** | **Implemented** | Matrix enforcing single choice per row across columns |
| **Checkbox Grid** | **Implemented** | Matrix allowing multiple selections per row across columns |
| **File Upload** | **Implemented** | Safe file input with file count and size limits (10MB default) |
| **Date** | **Implemented** | Native calendar picker |
| **Time** | **Implemented** | Time of day picker |
| **Title & Description Blocks (`Tt`)** | **Implemented** | Standalone informational headers and text between questions |
| **Image Blocks** | **Implemented** | Image blocks with public URLs, captions, and left/center/right alignment |
| **YouTube Video Embeds** | **Implemented** | YouTube videos embedded directly inside forms by URL |
| **Sections & Multi-page Forms** | **Implemented** | Page breaks with Previous/Next buttons and section headers |
| **Progress Bar** | **Implemented** | Real-time percentage completion tracker |
| **Conditional Branching** | **Implemented** | "Go to section based on answer": continue next, jump to section X, or submit |
| **Quizzing & Auto-Grading** | **Implemented** | Point values, answer keys, auto-scoring of objective questions, instant score breakdown |
| **Manual Grading** | **Implemented** | Score subjective/paragraph responses with points and custom feedback |
| **Respondent Autosave** | **Implemented** | Automatic `localStorage` draft saving; restores progress upon reload |
| **Schedule & Deadlines** | **Implemented** | Opening time, closing deadline, and response capacity limits |
| **Real-Time Analytics** | **Implemented** | Pie charts, bar graphs, score histograms rendered with Recharts |
| **CSV Export** | **Implemented** | Download tabular response data in spreadsheet-compatible CSV format |
| **QR Code Sharing** | **Implemented** | Dynamic QR code generation for scanning on mobile devices |

---

## 5. Local Setup & Execution Guide

### Prerequisites
- Node.js >= 20.x (v22.13.1 verified)
- npm >= 10.x

### Step 1: Clone & Configure Environment
Create `.env` in the root folder (or copy from `.env.example`):

```env
# Database (Turso / libSQL)
TURSO_DATABASE_URL="libsql://au-forms-samyak2501.aws-ap-south-1.turso.io"
TURSO_AUTH_TOKEN="<your_turso_auth_token>"

# Authentication (Better Auth)
BETTER_AUTH_SECRET="<generate_with_crypto_random_bytes_32>"
BETTER_AUTH_URL="http://localhost:4000"

# Server & Client Ports
PORT=4000
FRONTEND_URL="http://localhost:5173"

# SMTP Configuration (Gmail SMTP for avantika.edu.in)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="samyak.jain1@avantika.edu.in"
SMTP_PASSWORD="<your_gmail_app_password>"
EMAIL_FROM="AU Forms <samyak.jain1@avantika.edu.in>"
COLLEGE_EMAIL_DOMAIN="avantika.edu.in"
```

### Step 2: Install Dependencies
```bash
# In server directory
cd server
npm install

# In client directory
cd ../client
npm install
```

### Step 3: Run Database Migrations (Turso)
```bash
cd server
npm run db:push
```

### Step 4: Start the Applications Locally
In separate terminals:

```bash
# Terminal 1 — Start Fastify Backend (Port 4000)
cd server
npm run dev

# Terminal 2 — Start React + Vite Frontend (Port 5173)
cd client
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 6. Running Tests

To run the automated end-to-end integration test suite:

```bash
cd server
npx tsx test/e2e-workflow.test.ts
```

This tests:
1. Rejection of non-college domain email (`unauthorized@gmail.com`)
2. OTP request and SHA-256 database storage
3. Rejection of incorrect verification codes
4. Resolution of valid OTP and single-use `tempToken` issuance
5. Password creation and authenticated session cookie issuance
6. Form creation with Quiz mode
7. Saving 2-section layout with Multiple Choice, Checkboxes, and Linear Scale
8. Form publishing
9. Public form retrieval and answer key security sanitization
10. Anonymous respondent submission & objective auto-grading (10/10 pts)
11. Response persistence verification and CSV export
12. Form closure and submission rejection
13. Database record cleanup

---

## 7. Deferred Features & Known Limitations

- **Chromebook Locked Mode:** Requires Google Workspace for Education domain-level device management APIs.
- **Google Apps Script:** Native Google Apps Script execution is proprietary to Google Drive; replaced by AU Forms' native REST API.
- **Third-Party Payment Gateways:** Explicitly excluded from this initial release per prompt specification; architecture is structured to support a future payment plugin.
- **Cloud Object Storage (S3/GCS) for Massive File Uploads:** Current implementation supports local attachment metadata and up to 10MB payload handling. Production multi-gigabyte uploads will attach to S3/Cloudflare R2 pre-signed URLs in a subsequent deployment.
