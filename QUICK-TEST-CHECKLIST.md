# PHASE 1 - QUICK TEST CHECKLIST

## ✅ ALREADY TESTED (Automated)
- [x] Server starts on port 3000
- [x] Client starts on port 5173
- [x] Database has all 12 collections
- [x] System config structure correct
- [x] Database read/write API working
- [x] Middleman trigger detection working
- [x] Simulation mode active
- [x] Audit logs being created

---

## 🖥️ MANUAL BROWSER TESTS

### 1️⃣ SUPERADMIN LOGIN
- [ ] Click "Login as SuperAdmin" button
- [ ] Redirects to /superadmin (no OTP)
- [ ] Dashboard shows ADMIN badge
- [ ] Stats cards show correct counts
- [ ] Session in localStorage
- [ ] Refresh page → stays logged in

### 2️⃣ NEW USER LOGIN
- [ ] Click "Login as User (Dev)"
- [ ] Redirects to OTP page
- [ ] Phone formatted correctly
- [ ] Enter OTP: 123456
- [ ] Redirects to name page
- [ ] Enter name (min 3 chars)
- [ ] Redirects to /user dashboard
- [ ] User created in database

### 3️⃣ EXISTING USER LOGIN
- [ ] Logout, login again with same phone
- [ ] Enter OTP: 123456
- [ ] Skips name page → goes to /user
- [ ] Existing data loaded

### 4️⃣ INVALID OTP
- [ ] Enter OTP: 000000
- [ ] Shows error message
- [ ] Stays on OTP page
- [ ] Enter OTP: 123456
- [ ] Proceeds to name page

### 5️⃣ SYSTEM CONFIG
- [ ] Navigate to /superadmin/system
- [ ] All sections visible
- [ ] Edit API key → Save → verify
- [ ] Toggle simulation mode → Save
- [ ] Edit master prompt → Save
- [ ] Clear prompt → Save → error shown
- [ ] Set weights > 1.0 → error shown
- [ ] Modify field → "Unsaved changes" shown
- [ ] Save button disabled until changes made

### 6️⃣ RESET DATA
- [ ] Go to Danger Zone
- [ ] Click "Reset Data" → modal appears
- [ ] Click Cancel → data preserved
- [ ] Click "Reset Data" again
- [ ] Click "Reset All Data" → confirms
- [ ] Success toast shown
- [ ] Check DB: collections cleared
- [ ] Audit log has DATA_RESET entry

### 7️⃣ TEMPLATE BUILDER - CREATE
**Step 1:**
- [ ] Name: "Employment Contract"
- [ ] Description, category, jurisdiction
- [ ] Select risk level, status
- [ ] Try Next without filling → validation errors
- [ ] Fill all → Click Next

**Step 2:**
- [ ] Click "Add Field" 3 times
- [ ] Field 1: employee_name (text, required, pii)
- [ ] Field 2: start_date (date, required)
- [ ] Field 3: salary (number, required)
- [ ] Invalid key → error shown
- [ ] Duplicate key → error shown
- [ ] Reorder with up/down buttons
- [ ] Remove field works
- [ ] Click Next

**Step 3:**
- [ ] AI config fields visible
- [ ] Add trigger: "contract"
- [ ] Signal auto-generated
- [ ] Configure field questions
- [ ] Click "Auto-generate" → suggestion shown
- [ ] Click Next

**Step 4:**
- [ ] Toggle "Requires Lawyer Review" → ON
- [ ] Toggle "Signature Required" → ON
- [ ] Select signature fields
- [ ] Click Next

**Step 5:**
- [ ] "Start Test Flow" button visible
- [ ] Click → test modal opens
- [ ] Click "Save Draft" → success toast
- [ ] Check DB: template saved (version 1)
- [ ] Check audit: TEMPLATE_CREATED

**Publish:**
- [ ] Edit template
- [ ] Change status to ACTIVE
- [ ] Click Publish
- [ ] Version = 2
- [ ] Check audit: TEMPLATE_UPDATED

### 8️⃣ TEMPLATE BUILDER - EDIT
- [ ] Navigate to existing template
- [ ] All fields pre-populated
- [ ] Modify a field → Save
- [ ] Version incremented
- [ ] DB updated

### 9️⃣ FILE UPLOAD
- [ ] Go to template Step 2
- [ ] Upload .txt file → error "Only PDF allowed"
- [ ] Upload >5MB PDF → error "File too large"
- [ ] Upload valid PDF → success
- [ ] Filename in template.pdfFile
- [ ] Preview link works: /uploads/{filename}

### 🔟 LAWYER MANAGEMENT - ADD
- [ ] Go to /superadmin/lawyers
- [ ] Click "Add Lawyer"
- [ ] Fill all fields per checklist
- [ ] Add education entry
- [ ] Add experience entry
- [ ] Save → success toast
- [ ] Check DB: rating=0, reviewCount=0
- [ ] Check audit: LAWYER_CREATED

### 1️⃣1️⃣ LAWYER - EDIT & REVIEWS
- [ ] Edit created lawyer
- [ ] Data pre-populated
- [ ] Add fake review #1 (4.5 stars)
- [ ] Rating = 4.5, count = 1
- [ ] Add fake review #2 (3.5 stars)
- [ ] Rating = 4.0, count = 2
- [ ] Edit review #1 → 5.0 stars
- [ ] Rating recalculated
- [ ] Delete review #2
- [ ] Rating = 5.0, count = 1
- [ ] Save lawyer → DB updated

### 1️⃣2️⃣ LAWYER - LIST & SEARCH
- [ ] Lawyers visible in list
- [ ] Search by name → filtered
- [ ] Search by specialization → filtered
- [ ] Filter by Verified → works
- [ ] Filter by Online → works
- [ ] Filter by Rating → works
- [ ] Clear filters → all shown
- [ ] Click Edit → navigation works

### 1️⃣3️⃣ PERMANENT SESSION
- [ ] Login as user
- [ ] Close browser tab
- [ ] Reopen → go to /user
- [ ] Still logged in
- [ ] Clear localStorage (F12)
- [ ] Refresh → redirected to login

### 1️⃣4️⃣ INTERNATIONALIZATION
- [ ] Find language selector
- [ ] Switch to Uzbek → all text in uz
- [ ] Switch to Russian → all text in ru
- [ ] Switch to English → all text in en
- [ ] Refresh page → language persists
- [ ] No missing keys (check console)

### 1️⃣5️⃣ REALTIME SYNC
- [ ] Open 2 tabs, login both
- [ ] Tab A: change config → Save
- [ ] Tab B: changes appear (wait 1-2s)
- [ ] Rapid changes → no excessive API calls
- [ ] Go offline → error shown
- [ ] Go online → sync resumes

### 1️⃣6️⃣ ERROR HANDLING
- [ ] 404 page for non-existent route
- [ ] Validation errors shown inline
- [ ] Network error → retry/error message
- [ ] Console: no unexpected errors

---

## 🎯 TEST SUMMARY

**Total Manual Tests:** ~16 major flows  
**Estimated Time:** 90-120 minutes  
**Priority Order:** 1,2,3,4 → 5,6,7 → 8,9,10,11,12 → 13,14,15,16

---

## ✅ FINAL CHECK

After all manual tests:
- [ ] No browser console errors
- [ ] No server errors
- [ ] Database consistent
- [ ] All audit logs created
- [ ] Sessions working correctly
- [ ] All validations functioning

---

**Test Date:** ____________  
**Tested By:** ____________  
**Result:** ☐ PASS ☐ FAIL  
**Notes:** _______________________________________________
