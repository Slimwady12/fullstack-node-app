# TESTING CHECKLIST — PHASE 1

## Pre-Test Setup
- [ ] Install dependencies: `npm install`
- [ ] Create `.env` file with `OPENAI_API_KEY=your_key_here` (or leave empty for simulation mode)
- [ ] Ensure port 3000 and 5173 are available
- [ ] Start dev server: `npm run dev`
- [ ] Verify server starts on port 3000 (console: `[server] Server running on port 3000`)
- [ ] Verify database.json created at project root
- [ ] Verify client starts on port 5173

---

## 1. Database Initialization & Structure
- [ ] `database.json` auto-created with all collections: users, aiChats, lawyers, templates, automations, documents, jobs, disputes, conversations, notifications, auditLogs, systemConfig
- [ ] `systemConfig` contains: ai (openaiApiKey, defaultModel, simulationMode, masterPrompt), suggestionRules (ratingThreshold, specializationMatchWeight, onlinePriority, responseTimeWeight, maxSuggestions), featureFlags (enableChat, enableJobs, enableLawyerSearch)
- [ ] `systemConfig.ai.simulationMode` defaults to `false` (or `true` if no API key)
- [ ] All collections initialized as empty arrays except systemConfig (object)
- [ ] Console logs show `[jsonDb] Initializing database...` and `[jsonDb] Database initialized successfully`

---

## 2. Auth — SuperAdmin Login
- [ ] Navigate to `/auth/login`
- [ ] Enter phone: `1234567890`
- [ ] Verify: No OTP required, direct redirect to `/superadmin`
- [ ] Verify session stored in localStorage key `legal_platform_session`
- [ ] Verify session contains: userId, phone, name, roles: ['admin'], activeRole: 'admin', joinedAt
- [ ] Verify SuperAdmin dashboard loads with welcome message
- [ ] Verify role badge shows "ADMIN"
- [ ] Refresh page — verify session persists (permanent session)

---

## 3. Auth — New User Login
- [ ] Navigate to `/auth/login`
- [ ] Enter phone: `+998901234567` (any valid Uzbek format)
- [ ] Verify: Redirected to `/auth/otp?phone=...`
- [ ] Verify OTP page shows phone number formatted
- [ ] Enter OTP: `123456`
- [ ] Verify: Redirected to `/auth/name?phone=...`
- [ ] Enter name: `Test User` (min 3 chars)
- [ ] Verify: Redirected to `/user` dashboard
- [ ] Verify session stored with roles: ['user']
- [ ] Verify user created in database.json under users collection
- [ ] Verify user has: id, phone, name, roles: ['user'], joinedAt, savedLawyers: [], profile, notifications, privacy

---

## 4. Auth — Existing User Login
- [ ] After creating user above, logout
- [ ] Login again with same phone `+998901234567`
- [ ] Enter OTP: `123456`
- [ ] Verify: Skips name page, redirects directly to `/user`
- [ ] Verify existing user data loaded correctly

---

## 5. Auth — Invalid OTP
- [ ] Login with new phone, enter OTP: `000000`
- [ ] Verify: Error message "Invalid code. Please try again."
- [ ] Verify: Stays on OTP page
- [ ] Enter correct OTP: `123456`
- [ ] Verify: Proceeds to name page

---

## 6. SuperAdmin Dashboard
- [ ] Database connected indicator shows active
- [ ] OpenAI connected indicator shows status (active if API key configured, pending if not)
- [ ] Stats cards show: Templates 0, Lawyers 0, Users (count), Pending Reviews 0
- [ ] Recent Activity section shows audit logs from auth actions
- [ ] Quick Actions buttons visible: [New Template], [System Config]
- [ ] Click [New Template] → navigate to template builder
- [ ] Click [System Config] → navigate to system config

---

## 7. System Configuration
- [ ] Navigate to `/superadmin/system`
- [ ] Verify all sections load: OpenAI, Master Prompt, Suggestion Rules, Feature Flags, Danger Zone
- [ ] **API Key**: Enter test key, click Save → verify saved (check database.json)
- [ ] **Default Model**: Select GPT-4o → Save → verify in DB
- [ ] **Simulation Mode**: Toggle on → Save → verify in DB
- [ ] **Master Prompt**: Edit prompt → Save → verify in DB
- [ ] **Master Prompt Validation**: Clear prompt → Save → verify error "This field is required"
- [ ] **Master Prompt Validation**: Enter 2001+ chars → verify error shown
- [ ] **Suggestion Rules**: Modify all values → Save → verify in DB
- [ ] **Weights Sum**: Set specializationWeight=0.7, responseTimeWeight=0.5 → verify error "Sum must not exceed 1.0"
- [ ] **Feature Flags**: Toggle all off → Save → verify in DB
- [ ] **Unsaved Changes Indicator**: Modify any field → verify "Unsaved changes" shown
- [ ] **Save Button**: Verify disabled when no changes, enabled when dirty

---

## 8. Reset Data (Danger Zone)
- [ ] Create some test data: a user, a document, a job
- [ ] Navigate to System Config → Danger Zone
- [ ] Click [Reset Data] → verify confirm modal appears with warning
- [ ] Read collections to be cleared list
- [ ] Click [Cancel] → verify modal closes, data preserved
- [ ] Click [Reset Data] again → Click [Reset All Data]
- [ ] Verify: users, documents, jobs, conversations, disputes, notifications, automations, aiChats cleared to []
- [ ] Verify: templates, lawyers, systemConfig, auditLogs preserved
- [ ] Verify audit log entry created: action='DATA_RESET', details.clearedCollections listed
- [ ] Verify success toast shown

---

## 9. Template Builder — Create
- [ ] Navigate to `/superadmin/templates/new`
- [ ] **Step 1 (Basic Info)**:
  - [ ] Enter name: "Employment Contract"
  - [ ] Enter description: "Standard employment contract template"
  - [ ] Enter category: "Employment"
  - [ ] Select risk level: GREEN
  - [ ] Enter jurisdiction: "Uzbekistan"
  - [ ] Select status: DRAFT
  - [ ] Verify: All required fields validated, cannot proceed without filling
  - [ ] Click Next
- [ ] **Step 2 (Template & Fields)**:
  - [ ] Click [Add Field] → verify field added with default values
  - [ ] Add 3 fields:
    - [ ] Field 1: key="employee_name", label="Employee Full Name", type=text, required=true, pii=true
    - [ ] Field 2: key="start_date", label="Start Date", type=date, required=true
    - [ ] Field 3: key="salary", label="Monthly Salary", type=number, required=true
  - [ ] Verify: Field keys validated (alphanumeric + underscore only)
  - [ ] Verify: Duplicate key detection works
  - [ ] Verify: Reorder fields with up/down buttons
  - [ ] Verify: Remove field works
  - [ ] Click Next
- [ ] **Step 3 (AI Orchestration)**:
  - [ ] Verify: model, language, temperature, systemPrompt, maxTurns editable
  - [ ] Add trigger keyword: "contract"
  - [ ] Verify trigger signal auto-generated: `AUTOMATION:{templateId}`
  - [ ] Verify signal format validation (must match `AUTOMATION:{id}`)
  - [ ] Configure field questions for each field
  - [ ] Click [Auto-generate] for a field → verify AI suggestion populated (or fallback if simulation)
  - [ ] Click Next
- [ ] **Step 4 (Signature & Review)**:
  - [ ] Toggle "Requires Lawyer Review" → on
  - [ ] Toggle "Signature Required" → on
  - [ ] Select signature fields
  - [ ] Click Next
- [ ] **Step 5 (Test Flow)**:
  - [ ] Verify [Start Test Flow] button visible
  - [ ] Click [Test Flow] → verify test modal opens
- [ ] **Save Draft**: Click [Save Draft] → verify success toast
- [ ] Verify: Template saved in database.json with version 1
- [ ] Verify: Audit log created: action='TEMPLATE_CREATED'
- [ ] **Publish**: Edit template → change status to ACTIVE → Click [Publish]
- [ ] Verify: Version incremented to 2
- [ ] Verify: Status changed to ACTIVE
- [ ] Verify: Audit log: action='TEMPLATE_UPDATED'

---

## 10. Template Builder — Edit Existing
- [ ] Navigate to template builder with existing template ID
- [ ] Verify: All fields pre-populated from database
- [ ] Modify a field → Save
- [ ] Verify: Version incremented
- [ ] Verify: Updated data in database.json

---

## 11. File Upload
- [ ] In template builder Step 2, click [Upload PDF]
- [ ] Upload a non-PDF file → verify error "Only PDF files are allowed"
- [ ] Upload a file >5MB → verify error "File must be less than 5MB"
- [ ] Upload valid PDF → verify filename stored in pdfFile field
- [ ] Verify preview link works: `/uploads/{filename}`
- [ ] Verify upload endpoint returns: { filename, originalName, size, mimetype, url }

---

## 12. Lawyer Management — Add
- [ ] Navigate to `/superadmin/lawyers`
- [ ] Click [Add Lawyer]
- [ ] Fill in:
  - [ ] Name: "John Doe"
  - [ ] Phone: "+998901111111"
  - [ ] Toggle Verified: on
  - [ ] Select specializations: "Employment Law", "Contract Law"
  - [ ] Select languages: "uz", "ru"
  - [ ] Price: 500000
  - [ ] Response Time: "2 hours"
  - [ ] Toggle Online: on
  - [ ] Bio: "Experienced employment lawyer..."
  - [ ] License: number="L-12345", issuedAt=today, expiresAt=next year
- [ ] Add education entry
- [ ] Add experience entry
- [ ] Save → verify success
- [ ] Verify: Lawyer saved in database.json with rating=0, reviewCount=0
- [ ] Verify: Audit log: action='LAWYER_CREATED'

---

## 13. Lawyer Management — Edit & Reviews
- [ ] Navigate to lawyers list → click Edit on created lawyer
- [ ] Verify: All data pre-populated
- [ ] Add Fake Review:
  - [ ] Click [Add Fake Review] → verify modal opens
  - [ ] Name: "Jane Smith", Rating: 4.5, Comment: "Great service!", Case Type: "Employment"
  - [ ] Save → verify review added
  - [ ] Verify: Rating recalculated (should be 4.5)
  - [ ] Verify: reviewCount = 1
  - [ ] Verify: Review has userId: null, isFake: true
- [ ] Add second fake review: Rating 3.5
- [ ] Verify: Rating recalculated to average (4.0)
- [ ] Verify: reviewCount = 2
- [ ] Edit first review: Change rating to 5.0
- [ ] Verify: Rating recalculated
- [ ] Delete second review
- [ ] Verify: Rating recalculated to 5.0
- [ ] Verify: reviewCount = 1
- [ ] Save lawyer → verify all changes persisted

---

## 14. Lawyer Management — List & Search
- [ ] Navigate to `/superadmin/lawyers`
- [ ] Verify: Created lawyer visible in list
- [ ] Search by name → verify filtered
- [ ] Search by specialization → verify filtered
- [ ] Filter by Verified → verify works
- [ ] Filter by Online → verify works
- [ ] Filter by Rating min → verify works
- [ ] Clear filters → verify all lawyers shown
- [ ] Click Edit → verify navigation

---

## 15. Middleman — Trigger Detection
- [ ] Create a template with triggerKeyword: ["contract"]
- [ ] Ensure template is ACTIVE
- [ ] Call `POST /api/middleman/chat` with message containing "contract"
- [ ] Verify response: { action: 'START_AUTOMATION', templateId, templateName, matchedKeyword: 'contract' }

---

## 16. Middleman — Extraction & Suggestions
- [ ] Call middleman with templateId and message
- [ ] Verify: AI response returned
- [ ] Verify: Field extraction working
- [ ] Verify: Session state updated (extracted, remaining, currentField, progress)
- [ ] Verify: Lawyer suggestions returned when action='complete'
- [ ] Verify: Suggestions sorted by score descending
- [ ] Verify: Suggestion scoring follows formula:
  - [ ] specializationMatch + onlinePriority weighted correctly
  - [ ] Only verified lawyers with rating >= threshold included
  - [ ] Max suggestions limited by config
- [ ] Verify: Audit log created: action='MIDDLEMAN_CHAT', details include tokens, latency, model

---

## 17. Middleman — Simulation Mode
- [ ] Set systemConfig.ai.simulationMode = true
- [ ] Call middleman → verify mock response returned
- [ ] Verify: Response includes tokens (mock), latency, model with "simulated"
- [ ] Verify: No OpenAI API call made
- [ ] Set simulationMode = false → verify real API call made (or error if no key)

---

## 18. Audit Logs
- [ ] Perform various actions: create template, edit lawyer, reset data, middleman call
- [ ] Verify auditLogs collection populated
- [ ] Verify each entry has: id, userId, action, details (with tokens for AI calls), timestamp, activeRole
- [ ] Verify DATA_RESET audit log lists cleared collections
- [ ] Verify TEMPLATE_CREATED/UPDATED logs include templateId and version
- [ ] Verify LAWYER_CREATED/UPDATED logs include lawyer details

---

## 19. Realtime Sync
- [ ] Open two browser tabs
- [ ] Modify data in one tab (e.g., system config)
- [ ] Verify: Other tab reflects changes within 1 second
- [ ] Verify: lastSync timestamp updates
- [ ] Verify: No excessive API calls (debounce working)
- [ ] Disconnect network → verify error handling
- [ ] Reconnect → verify data sync resumes

---

## 20. Internationalization
- [ ] Navigate to any page with language selector
- [ ] Switch to 'uz' → verify all text in Uzbek
- [ ] Switch to 'ru' → verify all text in Russian
- [ ] Switch to 'en' → verify all text in English
- [ ] Verify: Language persists after page refresh (localStorage)
- [ ] Verify: No hardcoded English strings in UI (check login, OTP, dashboard)
- [ ] Verify: Translation keys fall back gracefully for missing keys

---

## 21. Permanent Session
- [ ] Login as user
- [ ] Close browser tab
- [ ] Reopen and navigate to `/user`
- [ ] Verify: Still logged in, session restored
- [ ] Clear localStorage → verify redirected to login
- [ ] Verify: No session expiry check (permanent)

---

## 22. Error Handling
- [ ] Invalid database.json → verify error logged, auto-recovery
- [ ] Missing systemConfig → verify auto-initialized
- [ ] Network error during transaction → verify retry logic
- [ ] OpenAI API error → verify structured error returned
- [ ] Validation error → verify inline error messages displayed
- [ ] 404 for non-existent resource → verify proper error page

---

## Pass Criteria
All items above must pass. Any failure indicates a bug that must be fixed before proceeding to Phase 2.

**Test Date:** ____________
**Tested By:** ____________
**Result:** ☐ PASS ☐ FAIL
**Notes:** ____________
