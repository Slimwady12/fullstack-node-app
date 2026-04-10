# PHASE 1 MANUAL TESTING GUIDE

This guide will help you complete the manual browser-based tests for Phase 1.

## PREREQUISITES

✅ Server running on `http://localhost:3000`
✅ Client running on `http://localhost:5173`
✅ Browser opened at `http://localhost:5173`

---

## 1. SUPERADMIN DASHBOARD TEST

### Steps:
1. Open browser to `http://localhost:5173/auth/login`
2. Click the **"Login as SuperAdmin"** button (green button with shield icon)
3. You should be redirected to `/superadmin` dashboard

### Verify:
- [ ] Dashboard loads with welcome message
- [ ] Role badge shows "ADMIN" (top right or in header)
- [ ] Database connected indicator shows active
- [ ] OpenAI connected indicator shows status
- [ ] Stats cards show:
  - Templates: 1 (test template exists)
  - Lawyers: 1 (test lawyer exists)
  - Users: 2 (test user + admin)
  - Pending Reviews: 0
- [ ] Recent Activity section shows audit logs
- [ ] Quick Actions buttons visible:
  - [ ] [New Template] button
  - [ ] [System Config] button
- [ ] Click [New Template] → should navigate to template builder
- [ ] Navigate back, click [System Config] → should navigate to system config
- [ ] Refresh page (F5) → should stay logged in (session persists)

### Session Verification:
- [ ] Open DevTools (F12) → Application → Local Storage
- [ ] Find key: `legal_platform_session`
- [ ] Verify it contains:
  ```json
  {
    "userId": "superadmin-001",
    "phone": "+998123456789",
    "name": "Super Admin",
    "roles": ["admin"],
    "activeRole": "admin",
    "joinedAt": "2026-04-10T..."
  }
  ```

---

## 2. SYSTEM CONFIGURATION TEST

### Steps:
1. From SuperAdmin dashboard, click [System Config]
2. Or navigate directly to `http://localhost:5173/superadmin/system`

### Verify Each Section Loads:
- [ ] **OpenAI Section:**
  - [ ] API Key input visible
  - [ ] Default Model dropdown visible
  - [ ] Simulation Mode toggle visible
  
- [ ] **Master Prompt Section:**
  - [ ] Textarea with current master prompt
  - [ ] Character count displayed
  
- [ ] **Suggestion Rules Section:**
  - [ ] Rating Threshold input
  - [ ] Specialization Match Weight input
  - [ ] Online Priority toggle
  - [ ] Response Time Weight input
  - [ ] Max Suggestions input
  
- [ ] **Feature Flags Section:**
  - [ ] Enable Chat toggle
  - [ ] Enable Jobs toggle
  - [ ] Enable Lawyer Search toggle
  
- [ ] **Danger Zone Section:**
  - [ ] Reset Data button visible

### Test Saves:
1. **API Key Test:**
   - [ ] Enter test key: `test-key-123`
   - [ ] Click Save
   - [ ] Verify success toast shown
   - [ ] Open DevTools → Network tab → verify POST to `/api/db/write`
   - [ ] Check `http://localhost:3000/api/db/read` → verify `systemConfig.ai.openaiApiKey` = `test-key-123`

2. **Simulation Mode Test:**
   - [ ] Toggle Simulation Mode ON
   - [ ] Click Save
   - [ ] Verify saved in database

3. **Master Prompt Test:**
   - [ ] Edit the prompt (add some text)
   - [ ] Click Save
   - [ ] Verify saved

4. **Validation Tests:**
   - [ ] **Master Prompt Required:** Clear the prompt completely → Click Save → Should show error "This field is required"
   - [ ] **Master Prompt Max Length:** Enter 2001+ characters → Should show error about max length
   - [ ] **Weights Sum Validation:** 
     - Set `specializationWeight` = 0.7
     - Set `responseTimeWeight` = 0.5
     - Total = 1.2 (exceeds 1.0)
     - Click Save → Should show error "Sum must not exceed 1.0"

5. **Unsaved Changes Indicator:**
   - [ ] Modify any field (e.g., change Max Suggestions to 10)
   - [ ] Look for "Unsaved changes" text or indicator
   - [ ] Verify Save button becomes enabled
   - [ ] Save → Verify indicator disappears

---

## 3. RESET DATA TEST

### Setup:
First, create some test data:
1. Create a template (see Template Builder test below)
2. Create a user (use "Login as User (Dev)" button)
3. Create a job (if job creation UI exists)

### Steps:
1. Navigate to System Config → scroll to **Danger Zone**
2. Click **[Reset Data]** button

### Verify:
- [ ] Confirm modal appears with warning message
- [ ] Modal lists collections to be cleared
- [ ] Click **[Cancel]** → modal closes
- [ ] Verify data is still present (templates, users, jobs still exist)
- [ ] Click **[Reset Data]** again
- [ ] Click **[Reset All Data]** (confirm button)

### After Reset:
- [ ] Success toast shown
- [ ] Check database: `http://localhost:3000/api/db/read`
- [ ] Verify these are cleared to `[]`:
  - [ ] users (except test data if protected)
  - [ ] documents
  - [ ] jobs
  - [ ] conversations
  - [ ] disputes
  - [ ] notifications
  - [ ] automations
  - [ ] aiChats
- [ ] Verify these are **preserved**:
  - [ ] templates (or cleared? check implementation)
  - [ ] lawyers (or cleared?)
  - [ ] systemConfig
  - [ ] auditLogs (should have DATA_RESET entry)
- [ ] Check audit log for `DATA_RESET` action with `clearedCollections` listed

---

## 4. TEMPLATE BUILDER TEST

### Steps:
1. Navigate to `http://localhost:5173/superadmin/templates/new`
2. Or click [New Template] from SuperAdmin dashboard

### Step 1 - Basic Info:
- [ ] Enter name: "Employment Contract Test"
- [ ] Enter description: "Test employment contract template"
- [ ] Enter category: "Employment"
- [ ] Select risk level: GREEN
- [ ] Enter jurisdiction: "Uzbekistan"
- [ ] Select status: DRAFT
- [ ] Try clicking Next without filling required fields → Should show validation errors
- [ ] Fill all required fields → Click Next

### Step 2 - Template & Fields:
- [ ] Click **[Add Field]** button
- [ ] Add 3 fields:
  
  **Field 1:**
  - [ ] key: `employee_name`
  - [ ] label: `Employee Full Name`
  - [ ] type: text
  - [ ] required: ✓ (checked)
  - [ ] pii: ✓ (checked)
  
  **Field 2:**
  - [ ] key: `start_date`
  - [ ] label: `Start Date`
  - [ ] type: date
  - [ ] required: ✓
  
  **Field 3:**
  - [ ] key: `salary`
  - [ ] label: `Monthly Salary (UZS)`
  - [ ] type: number
  - [ ] required: ✓

- [ ] Try entering invalid field key (e.g., with spaces) → Should show validation error
- [ ] Try duplicate key → Should show duplicate error
- [ ] Use up/down arrows to reorder fields → Verify order changes
- [ ] Try removing a field → Verify it's removed
- [ ] Add the 3 fields back → Click Next

### Step 3 - AI Orchestration:
- [ ] Verify model selector shows available models
- [ ] Verify language selector visible
- [ ] Verify temperature slider/input visible
- [ ] Verify system prompt textarea visible
- [ ] Verify max turns input visible
- [ ] Add trigger keyword: `contract`
- [ ] Verify trigger signal auto-generated: `AUTOMATION:{templateId}`
- [ ] Verify signal format shown
- [ ] Configure field questions for each field
- [ ] Click **[Auto-generate]** for a field → Should show AI suggestion (or fallback if simulation mode)
- [ ] Click Next

### Step 4 - Signature & Review:
- [ ] Toggle **"Requires Lawyer Review"** → ON
- [ ] Toggle **"Signature Required"** → ON
- [ ] Select signature fields (e.g., `employee_name`)
- [ ] Click Next

### Step 5 - Test Flow:
- [ ] Verify **[Start Test Flow]** button visible
- [ ] Click **[Test Flow]** → Verify test modal opens
- [ ] Close test modal

### Save:
- [ ] Click **[Save Draft]** → Verify success toast
- [ ] Check database: `http://localhost:3000/api/db/read`
- [ ] Verify template saved in `templates` array with version 1
- [ ] Check audit logs → Verify `TEMPLATE_CREATED` entry

### Publish:
- [ ] Edit the template you just created
- [ ] Change status from DRAFT to ACTIVE
- [ ] Click **[Publish]** or Save
- [ ] Verify version incremented to 2
- [ ] Verify status changed to ACTIVE
- [ ] Check audit logs → Verify `TEMPLATE_UPDATED` entry

---

## 5. FILE UPLOAD TEST

### Steps:
1. In template builder, go to Step 2 (Template & Fields)
2. Click **[Upload PDF]** button or area

### Tests:
- [ ] **Invalid File Type:**
  - [ ] Try uploading a `.txt` or `.docx` file
  - [ ] Should show error: "Only PDF files are allowed" or similar

- [ ] **File Too Large:**
  - [ ] Try uploading a PDF > 5MB
  - [ ] Should show error: "File must be less than 5MB"

- [ ] **Valid PDF:**
  - [ ] Upload a small PDF file (< 5MB)
  - [ ] Should show success
  - [ ] Verify filename stored in template's `pdfFile` field
  - [ ] Verify preview link works: `http://localhost:3000/uploads/{filename}`

- [ ] **Check API Response:**
  - [ ] Open DevTools → Network tab
  - [ ] Find POST to `/api/upload`
  - [ ] Verify response contains:
    ```json
    {
      "success": true,
      "data": {
        "filename": "...",
        "originalName": "...",
        "size": 12345,
        "mimetype": "application/pdf",
        "url": "/uploads/..."
      }
    }
    ```

---

## 6. LAWYER MANAGEMENT TEST

### Add Lawyer:
1. Navigate to `http://localhost:5173/superadmin/lawyers`
2. Click **[Add Lawyer]** button

### Fill Form:
- [ ] Name: "Test Lawyer One"
- [ ] Phone: "+998901111111"
- [ ] Toggle Verified: ON
- [ ] Select specializations: "Employment Law", "Contract Law"
- [ ] Select languages: "uz", "ru"
- [ ] Price: 500000
- [ ] Response Time: "2 hours"
- [ ] Toggle Online: ON
- [ ] Bio: "Experienced employment lawyer with 10+ years practice"
- [ ] License:
  - [ ] Number: "L-99999"
  - [ ] Issued At: today's date
  - [ ] Expires At: next year
- [ ] Add education entry:
  - [ ] Institution: "Tashkent State University"
  - [ ] Degree: "Law Degree"
  - [ ] Year: 2015
- [ ] Add experience entry:
  - [ ] Company: "Legal Firm LLC"
  - [ ] Position: "Senior Lawyer"
  - [ ] From: 2015-01-01
  - [ ] To: (leave empty for current)
- [ ] Click **Save**

### Verify:
- [ ] Success toast shown
- [ ] Check database: `http://localhost:3000/api/db/read`
- [ ] Verify lawyer saved with:
  - [ ] `rating: 0` (new lawyer)
  - [ ] `reviewCount: 0`
  - [ ] All fields populated correctly
- [ ] Check audit logs → Verify `LAWYER_CREATED` entry

### Edit & Reviews:
1. Navigate to lawyers list
2. Click **Edit** on the lawyer you created

### Add Fake Reviews:
- [ ] Click **[Add Fake Review]** button → modal opens
- [ ] **Review 1:**
  - [ ] Name: "Jane Smith"
  - [ ] Rating: 4.5
  - [ ] Comment: "Great service! Very helpful and responsive."
  - [ ] Case Type: "Employment"
  - [ ] Save review
  - [ ] Verify rating recalculated to 4.5
  - [ ] Verify reviewCount = 1

- [ ] **Review 2:**
  - [ ] Add another fake review
  - [ ] Rating: 3.5
  - [ ] Comment: "Good but could be better"
  - [ ] Case Type: "Contract"
  - [ ] Save
  - [ ] Verify rating = 4.0 (average of 4.5 and 3.5)
  - [ ] Verify reviewCount = 2

### Edit Review:
- [ ] Edit first review → Change rating to 5.0
- [ ] Verify rating recalculated (should be ~4.25)

### Delete Review:
- [ ] Delete second review (3.5 rating)
- [ ] Verify rating = 5.0
- [ ] Verify reviewCount = 1

### Save Lawyer:
- [ ] Click **Save** on lawyer form
- [ ] Verify all changes persisted in database

---

## 7. LAWYER LIST & SEARCH TEST

### Steps:
1. Navigate to `http://localhost:5173/superadmin/lawyers`

### Verify:
- [ ] Created lawyers visible in list
- [ ] Search by name:
  - [ ] Enter "John" → Should filter to John Doe
  - [ ] Enter "Test" → Should filter to Test Lawyer One
- [ ] Search by specialization:
  - [ ] Enter "Employment" → Should show both lawyers
- [ ] Filter by Verified:
  - [ ] Toggle "Verified only" → Should show only verified lawyers
- [ ] Filter by Online:
  - [ ] Toggle "Online only" → Should show only online lawyers
- [ ] Filter by Rating min:
  - [ ] Set minimum rating to 4.0 → Should filter accordingly
- [ ] Clear all filters → Should show all lawyers
- [ ] Click Edit on a lawyer → Should navigate to edit page

---

## 8. NEW USER LOGIN TEST (BROWSER)

### Steps:
1. Open new incognito window or logout if logged in
2. Navigate to `http://localhost:5173/auth/login`
3. Click **"Login as User (Dev)"** button OR manually enter phone: `+998909998877`

### Verify:
- [ ] Redirected to `/auth/otp?phone=+998909998877`
- [ ] OTP page shows formatted phone number
- [ ] Enter OTP: `123456`
- [ ] Should redirect to `/auth/name?phone=...`
- [ ] Enter name: "New Test User" (min 3 chars)
- [ ] Should redirect to `/user` dashboard
- [ ] Verify session stored in localStorage
- [ ] Check database → Verify user created in `users` collection

### Existing User Login:
1. Logout from `/user` dashboard
2. Login again with same phone `+998909998877`
3. Enter OTP: `123456`
4. Verify: **Skips name page**, redirects directly to `/user`
5. Verify existing user data loaded correctly (name should be "New Test User")

### Invalid OTP Test:
1. Logout
2. Login with new phone `+998907776655`
3. Enter OTP: `000000` (invalid)
4. Verify: Error message "Invalid code. Please try again." or similar
5. Verify: Stays on OTP page
6. Enter correct OTP: `123456`
7. Verify: Proceeds to name page

---

## 9. PERMANENT SESSION TEST

### Steps:
1. Login as user (use "Login as User (Dev)")
2. Complete OTP and name entry
3. You should be on `/user` dashboard
4. **Close the browser tab** completely
5. **Reopen browser** and navigate to `http://localhost:5173/user`

### Verify:
- [ ] Still logged in (no redirect to login)
- [ ] Session restored from localStorage
- [ ] Dashboard loads with user data

### Clear Session Test:
1. Open DevTools (F12) → Application → Local Storage
2. Find key: `legal_platform_session`
3. Right-click → Delete
4. Refresh page (F5)

### Verify:
- [ ] Redirected to `/auth/login`
- [ ] No session found

---

## 10. INTERNATIONALIZATION TEST

### Steps:
1. Navigate to any page (e.g., `/user` dashboard)
2. Look for language selector (usually in header or settings)

### Test Each Language:
- [ ] **Switch to 'uz' (Uzbek):**
  - [ ] All text should be in Uzbek
  - [ ] Check: navigation, buttons, labels, messages
  - [ ] No English strings visible (except maybe technical terms)

- [ ] **Switch to 'ru' (Russian):**
  - [ ] All text should be in Russian
  - [ ] Verify same as above

- [ ] **Switch to 'en' (English):**
  - [ ] All text should be in English
  - [ ] Verify same as above

### Persistence Test:
1. Switch to 'uz'
2. Refresh page (F5)
3. Verify: Language is still Uzbek (stored in localStorage)

### Missing Keys Test:
- [ ] If any translation key is missing, should fall back gracefully (show key or English)
- [ ] Check browser console for missing translation warnings

---

## 11. REALTIME SYNC TEST

### Steps:
1. Open **two browser tabs** (Tab A and Tab B)
2. Login as SuperAdmin in both tabs
3. Navigate to System Config in both tabs

### Test Sync:
1. **In Tab A:**
   - [ ] Change a config value (e.g., Max Suggestions from 5 to 10)
   - [ ] Click Save
   - [ ] Wait for success toast

2. **In Tab B:**
   - [ ] Wait 1-2 seconds
   - [ ] Refresh page or check if auto-synced
   - [ ] Verify: Max Suggestions now shows 10
   - [ ] Verify: lastSync timestamp updated

### Debounce Test:
- [ ] Make multiple rapid changes in Tab A
- [ ] Should not trigger excessive API calls
- [ ] Check Network tab → verify debounced saves

### Disconnect Test:
- [ ] Open DevTools → Network tab
- [ ] Click "Offline" throttling option
- [ ] Try to save changes
- [ ] Verify: Error handling shown (toast or message)
- [ ] Click "Online" again
- [ ] Try to save → Should work normally

---

## 12. ERROR HANDLING TEST

### Tests:
1. **Invalid Database JSON:**
   - [ ] Manually edit `database.json` and add invalid JSON (e.g., remove a closing brace)
   - [ ] Try to access the app
   - [ ] Verify: Error logged, auto-recovery or clear error message

2. **Missing SystemConfig:**
   - [ ] Temporarily rename `systemConfig` in `database.json` to `systemConfig_backup`
   - [ ] Refresh app
   - [ ] Verify: Auto-initialized with defaults

3. **404 for Non-existent Resource:**
   - [ ] Navigate to `http://localhost:5173/nonexistent-page`
   - [ ] Verify: 404 page or error handling shown

4. **Validation Errors:**
   - [ ] Try to save template with missing required fields
   - [ ] Try to save lawyer with invalid phone
   - [ ] Verify: Inline error messages displayed

---

## FINAL CHECKLIST

After completing all manual tests:

- [ ] All critical paths work (login, template creation, lawyer management)
- [ ] No console errors in browser (check DevTools Console tab)
- [ ] Database state is consistent and valid
- [ ] Audit logs created for all major actions
- [ ] Session management working correctly
- [ ] All validations functioning as expected

---

## REPORTING ISSUES

If you find any issues during manual testing:

1. **Document the Issue:**
   - What page/feature?
   - What steps reproduce it?
   - What was expected vs actual behavior?
   - Screenshot if applicable

2. **Check Console:**
   - Browser console (F12 → Console)
   - Server console (where `npm run dev` is running)

3. **Check Database:**
   - Visit `http://localhost:3000/api/db/read`
   - Verify data state

4. **Update Test Report:**
   - Mark failed tests in `PHASE1-TEST-RESULTS.md`
   - Add notes about the issue

---

**Good luck with testing!** 🚀
