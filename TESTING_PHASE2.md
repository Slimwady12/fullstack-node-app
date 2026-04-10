# TESTING CHECKLIST — PHASE 2

## Pre-Test Setup
- [ ] Complete all Phase 1 tests successfully
- [ ] Ensure all Phase 1 data (templates, lawyers, system config) is in place
- [ ] Verify all Phase 2 files deployed: user pages, job pages, messages, settings, disputes
- [ ] Start dev server: `npm run dev`
- [ ] Verify no console errors on load

---

## 1. Auth Redirect — Role-Based
- [ ] Login as SuperAdmin (phone: 1234567890) → verify redirect to `/superadmin`
- [ ] Login as regular user → verify redirect to `/user`
- [ ] Login as user with both 'user' and 'admin' roles → verify redirect based on activeRole
- [ ] Attempt to access `/superadmin` as regular user → verify redirect to `/user`
- [ ] Attempt to access `/user` as admin-only user → verify redirect to `/superadmin`
- [ ] Access `/auth/login` while authenticated → verify redirect to appropriate home

---

## 2. Schema Backfill
- [ ] Remove `aiChats` collection from database.json
- [ ] Restart server
- [ ] Verify: `aiChats` auto-created as `[]`
- [ ] Add user without `savedLawyers` field
- [ ] Restart server
- [ ] Verify: `savedLawyers` added as `[]`
- [ ] Add lawyer review without `userId` field
- [ ] Restart server
- [ ] Verify: `userId: null` set for that review
- [ ] Add automation without `templateVersion`
- [ ] Restart server
- [ ] Verify: `templateVersion: 1` set
- [ ] Add document without `templateVersion`
- [ ] Restart server
- [ ] Verify: `templateVersion: 1` set

---

## 3. User Dashboard
- [ ] Login as user → verify dashboard loads
- [ ] Verify welcome card shows: "Welcome back, {userName}"
- [ ] Verify quick stats: Documents count, Jobs count
- [ ] Verify quick actions: [New Document], [Post Job], [Chat with AI]
- [ ] Click [New Document] → navigate to `/user/documents/new`
- [ ] Click [Post Job] → navigate to `/user/jobs/post`
- [ ] Click [Chat with AI] → navigate to `/user/chat`
- [ ] Verify pending documents section (if any)
- [ ] Verify active jobs section (if any)
- [ ] Verify recommended lawyers (top 3 verified by rating)
- [ ] Verify popular templates (active templates grid)
- [ ] Verify empty states for each section
- [ ] Verify error states (simulate network error)
- [ ] Verify loading skeleton while data loads

---

## 4. Chat — General Mode
- [ ] Navigate to `/user/chat`
- [ ] Verify empty state with quick suggestion buttons
- [ ] Click suggestion → verify input populated
- [ ] Type message → verify send enabled
- [ ] Send message → verify user bubble appears
- [ ] Verify AI typing indicator shown
- [ ] Verify AI response bubble appears
- [ ] Verify timestamp shown on messages
- [ ] Send multiple messages → verify thread persists
- [ ] Verify chat saved to aiChats collection
- [ ] Verify chat title auto-generated from first message

---

## 5. Chat — Keyword Trigger
- [ ] Ensure active template has triggerKeyword: ["contract"]
- [ ] In general chat, type: "I need a contract"
- [ ] Verify: Wizard mode activated
- [ ] Verify: Wizard header shows template name
- [ ] Verify: Progress bar shown
- [ ] Verify: Field checklist displayed
- [ ] Verify: Input hint shows AI question for current field
- [ ] Continue filling fields → verify extraction works
- [ ] Verify: Progress updates
- [ ] Verify: Suggested lawyers shown on completion

---

## 6. Chat — Signal Trigger
- [ ] Ensure template has triggerSignal: "AUTOMATION:{templateId}"
- [ ] In general chat, type message that triggers AI signal
- [ ] Verify: Response contains AUTOMATION signal
- [ ] Verify: Wizard mode activated
- [ ] Verify: Session persisted in automations collection

---

## 7. Chat — Sessions Tab
- [ ] Navigate to Sessions tab
- [ ] Verify: Active sessions listed with progress, status, template name
- [ ] Click [Resume] on incomplete session → verify chat loads with wizard mode
- [ ] Verify: Session state restored (extracted fields, remaining, progress)
- [ ] Click [Delete] → verify session removed
- [ ] Verify: Empty state shown when no sessions

---

## 8. Chat — History Tab
- [ ] Navigate to History tab
- [ ] Verify: General chats listed with title, last message preview, date
- [ ] Click [Resume] → verify chat loaded in general mode
- [ ] Click [Delete] → verify chat removed from history
- [ ] Verify: Empty state shown when no history

---

## 9. Chat — Attachments
- [ ] In chat, click [Attach] button
- [ ] Upload image → verify preview chip shown
- [ ] Upload PDF → verify preview chip shown
- [ ] Remove attachment → verify chip removed
- [ ] Send message with attachments → verify sent
- [ ] Verify attachments shown in message bubble
- [ ] Verify attachment links work

---

## 10. Chat — Lawyer Suggestions
- [ ] Complete wizard flow → verify suggestions appear
- [ ] Verify suggestion cards show: name, rating, score, specializations
- [ ] Click [View Profile] → verify navigation to lawyer profile
- [ ] Click [Dismiss] → verify suggestions hidden
- [ ] Verify horizontal scroll on mobile

---

## 11. Document Wizard — Template Version
- [ ] Navigate to `/user/documents/wizard?templateId=...`
- [ ] Verify: Template loaded, intro step shown with risk warning
- [ ] Verify: Risk banner color-coded (GREEN/YELLOW/RED)
- [ ] Verify: Disclaimer "AI-generated, review recommended"
- [ ] Click [Start] → verify field steps shown
- [ ] Fill fields → verify validation (required, regex, type)
- [ ] Verify: Auto-save draft to localStorage
- [ ] Refresh page → verify draft restored
- [ ] Complete all fields → verify preview step
- [ ] Verify: All field values shown in preview
- [ ] Verify: [Edit] buttons per field navigate back
- [ ] Check confirmation checkbox → click [Submit Document]
- [ ] Verify: Document created with `templateVersion` matching template.version
- [ ] Verify: Status = PENDING
- [ ] Verify: Audit trail entry created
- [ ] Verify: Navigate to document detail page

---

## 12. Document Wizard — Validation
- [ ] Submit without filling required fields → verify errors shown
- [ ] Enter invalid regex value → verify error
- [ ] Enter invalid date → verify error
- [ ] Enter non-numeric for number field → verify error
- [ ] Verify: Cannot proceed to next step with validation errors

---

## 13. Document Detail
- [ ] Navigate to `/user/documents/:id`
- [ ] Verify: Template name, status badge, createdAt shown
- [ ] Verify: Status banner color-coded
- [ ] Verify: Fields preview with PII fields masked
- [ ] Verify: Audit trail timeline
- [ ] For PENDING status:
  - [ ] Verify [Cancel] button visible
  - [ ] Click [Cancel] → confirm modal → verify cancelled
  - [ ] Verify status changed to CANCELLED
- [ ] For REVIEWED status:
  - [ ] Verify review info shown (lawyer, notes, date)
  - [ ] Verify [Rate Lawyer] button visible
  - [ ] Click [Rate Lawyer] → navigate to lawyer profile

---

## 14. SuperAdmin — Document Review Injection
- [ ] Navigate to `/superadmin/documents`
- [ ] Verify: Document list shown with status, user, template
- [ ] Click on PENDING document → verify detail expanded
- [ ] Verify: Fields preview, audit trail shown
- [ ] Click [Mark Reviewed] → verify modal opens
- [ ] Select lawyer → enter notes → submit
- [ ] Verify: Document status changed to REVIEWED
- [ ] Verify: Review info set (lawyerId, notes, reviewedAt)
- [ ] Verify: Audit trail entry added
- [ ] Verify: User receives notification
- [ ] Login as user → verify notification shown

---

## 15. SuperAdmin — Document Review Notification
- [ ] After admin reviews document
- [ ] Login as document owner
- [ ] Verify: Notification bell shows unread count
- [ ] Click notification → verify details shown
- [ ] Navigate to document → verify review info visible

---

## 16. User — Rate Lawyer (canReview Logic)
- [ ] Create document, have admin review it with a lawyer
- [ ] Login as document owner
- [ ] Navigate to lawyer profile of reviewing lawyer
- [ ] Verify: [Rate Lawyer] button visible (canReview = true)
- [ ] Verify: canReview checks:
  - [ ] Document exists with review.lawyerId = lawyer.id AND status = REVIEWED
  - [ ] OR Job exists with assignedLawyerId = lawyer.id AND status = COMPLETED
- [ ] If user already reviewed → verify [Rate Lawyer] hidden (duplicate prevention)

---

## 17. Review Submission
- [ ] Click [Rate Lawyer] → verify review modal opens
- [ ] Select rating (1-5 stars) → verify visual feedback
- [ ] Enter comment (optional)
- [ ] Enter case type (optional)
- [ ] Submit → verify success toast
- [ ] Verify: Review added to lawyer.reviews with userId, isFake=false
- [ ] Verify: Lawyer rating recalculated
- [ ] Verify: reviewCount updated
- [ ] Verify: Notification sent to lawyer
- [ ] Verify: Audit log created

---

## 18. Review — Duplicate 409
- [ ] Attempt to review same lawyer twice
- [ ] Verify: Error message "You have already reviewed this lawyer"
- [ ] Verify: Modal stays open with error
- [ ] Verify: No duplicate review in database

---

## 19. Jobs — Post Job
- [ ] Navigate to `/user/jobs/post`
- [ ] Fill form: title, category, description, budget, urgency
- [ ] Attach files → verify upload
- [ ] Submit → verify success
- [ ] Verify: Job created with status=OPEN, responses=[], assignedLawyerId=null
- [ ] Verify: Audit log: action='JOB_CREATED'
- [ ] Verify: Navigate to job detail page

---

## 20. Jobs — Post Validation
- [ ] Submit without title → verify error
- [ ] Submit with title < 3 chars → verify error
- [ ] Submit without category → verify error
- [ ] Submit without description → verify error
- [ ] Submit with budget <= 0 → verify error
- [ ] Verify: All errors shown inline

---

## 21. Jobs — Accept Response
- [ ] As lawyer (or admin inject fake response):
  - [ ] POST /api/jobs/:id/response with lawyerId, coverNote, price
- [ ] Login as job owner
- [ ] Navigate to job detail
- [ ] Verify: Response shown with lawyer name, coverNote, price
- [ ] Click [Accept] → verify confirm modal
- [ ] Confirm → verify job status changed to IN_PROGRESS
- [ ] Verify: assignedLawyerId set
- [ ] Verify: Lawyer receives notification
- [ ] Verify: Audit log created

---

## 22. Jobs — Complete Job
- [ ] Navigate to IN_PROGRESS job
- [ ] Click [Mark Complete] → verify success
- [ ] Verify: Status changed to COMPLETED
- [ ] Verify: Audit log: action='JOB_COMPLETED'

---

## 23. Jobs — Dispute
- [ ] Navigate to IN_PROGRESS job
- [ ] Click [Dispute] → verify modal opens
- [ ] Enter reason and details → submit
- [ ] Verify: Dispute created with status=UNDER_REVIEW
- [ ] Verify: SuperAdmin notified
- [ ] Verify: Audit log created
- [ ] Verify: Job status updated if applicable

---

## 24. SuperAdmin — Dispute Resolution
- [ ] Navigate to `/superadmin/disputes`
- [ ] Verify: Disputes listed with job title, user, lawyer, reason, status
- [ ] Click to expand dispute → verify details shown
- [ ] Verify attachments accessible
- [ ] **Resolve**: Enter resolution → click [Resolve] → verify dispute resolved
- [ ] **Dismiss**: Enter resolution → click [Dismiss] → verify dispute dismissed
- [ ] **Cancel Job**: Enter resolution → click [Cancel Job] → verify job cancelled
- [ ] Verify: Both parties notified
- [ ] Verify: Audit log created for each action

---

## 25. Lawyers — Save Toggle
- [ ] Navigate to `/user/lawyers`
- [ ] Click heart icon on lawyer → verify saved
- [ ] Verify: user.savedLawyers updated in database
- [ ] Click heart icon again → verify unsaved
- [ ] Verify: Optimistic update (UI updates immediately)
- [ ] Verify: Heart filled when saved, outline when not
- [ ] Navigate away and back → verify state persisted

---

## 26. Lawyer Profile
- [ ] Navigate to `/user/lawyers/:id`
- [ ] Verify: Header with avatar, name, verified badge, rating
- [ ] Verify: Stats cards (price, response time, cases, specializations)
- [ ] Verify: [Contact] and [Rate Lawyer] buttons
- [ ] Navigate tabs: About, Experience, Education, Reviews
- [ ] Verify: All sections display correctly
- [ ] Verify: Reviews show fake badge for demo reviews
- [ ] Verify: Mobile sticky action bar with [Contact] and [Rate]

---

## 27. Messages — Send Message
- [ ] Navigate to `/user/messages/new?lawyerId=...` from lawyer profile
- [ ] Verify: Chat opens with lawyer header
- [ ] Type message → send → verify sent
- [ ] Verify: Message persisted in conversations collection
- [ ] Verify: unreadCount.lawyerId incremented
- [ ] Login as lawyer (or second user) → verify conversation appears
- [ ] Verify: Unread badge shown
- [ ] Open conversation → verify messages loaded
- [ ] Verify: unreadCount reset on open

---

## 28. Messages — Read & Unread
- [ ] Send message as user
- [ ] Verify: Unread count shown on lawyer side
- [ ] Open conversation as lawyer → verify unread count cleared
- [ ] POST /api/conversations/:id/read called
- [ ] Verify: unreadCount[role] = 0
- [ ] Verify: Badge removed from list

---

## 29. Messages — Attachments
- [ ] In conversation, click [Attach]
- [ ] Upload image → verify preview
- [ ] Send with attachment → verify shown in bubble
- [ ] Click attachment → verify opens/ downloads
- [ ] Verify: Multiple attachments supported

---

## 30. Messages — Conversation List
- [ ] Navigate to `/user/messages`
- [ ] Verify: Conversations listed with lawyer name, last message preview
- [ ] Verify: Unread count badge on conversations with unread messages
- [ ] Verify: Sorted by updatedAt (most recent first)
- [ ] Click conversation → verify chat opens
- [ ] Verify: Search filters conversations

---

## 31. Settings — Profile Update
- [ ] Navigate to `/user/settings`
- [ ] Update name → save → verify updated in DB
- [ ] Update email → save → verify updated in DB
- [ ] Toggle notifications → save → verify updated in DB
- [ ] Set quiet hours → save → verify updated in DB
- [ ] Toggle privacy settings → save → verify updated in DB
- [ ] Verify: Success toast shown
- [ ] Verify: Audit log: action='PROFILE_UPDATED'

---

## 32. Settings — Language
- [ ] Navigate to Settings
- [ ] Switch language to 'uz' → verify all text in Uzbek
- [ ] Switch to 'ru' → verify all text in Russian
- [ ] Switch to 'en' → verify all text in English
- [ ] Verify: Language persists after refresh

---

## 33. Settings — Role Switcher
- [ ] If user has multiple roles, verify role switcher visible
- [ ] Click role → verify activeRole updated
- [ ] Verify: Session updated in localStorage
- [ ] Verify: UI reflects new role (badges, permissions)

---

## 34. Settings — Export Data
- [ ] Click [Download JSON]
- [ ] Verify: File downloaded with user data
- [ ] Verify: Export includes: profile, documents, jobs, chats, notifications
- [ ] Verify: JSON format valid

---

## 35. Settings — Delete Account (Cascade)
- [ ] Click [Delete Account] → verify confirm modal
- [ ] Read warning message
- [ ] Click [Cancel] → verify modal closes, data preserved
- [ ] Click [Delete Account] → confirm → verify DELETE /api/users/:id called
- [ ] Verify: User removed from users collection
- [ ] Verify: All documents deleted (cascade)
- [ ] Verify: All jobs deleted (cascade)
- [ ] Verify: All chats deleted (cascade)
- [ ] Verify: All conversations deleted (cascade)
- [ ] Verify: All notifications deleted (cascade)
- [ ] Verify: All disputes deleted (cascade)
- [ ] Verify: User reviews removed from lawyers
- [ ] Verify: Lawyer ratings recalculated after review removal
- [ ] Verify: Session cleared
- [ ] Verify: Redirected to `/auth/login`
- [ ] Verify: Audit log: action='USER_DELETED' with cascadedCollections listed

---

## 36. Settings — Logout
- [ ] Click [Logout] → verify session cleared
- [ ] Verify: Redirected to `/auth/login`
- [ ] Verify: Cannot access protected routes

---

## 37. Template Builder — Version Increment
- [ ] Create template → verify version = 1
- [ ] Edit and save → verify version = 2
- [ ] Edit and publish → verify version = 3, status = ACTIVE
- [ ] Verify: Each save increments version
- [ ] Verify: Audit logs show version history

---

## 38. Mobile — Bottom Navigation
- [ ] Open on mobile device or mobile viewport
- [ ] Verify: Bottom nav visible with 5 items (Dashboard, Chat, Documents, Lawyers, Jobs)
- [ ] Verify: Active item highlighted
- [ ] Verify: Touch targets ≥44px
- [ ] Verify: Safe-area padding on bottom edge
- [ ] Verify: No horizontal scroll
- [ ] Verify: Bottom nav hidden on desktop (md+)

---

## 39. Mobile — Touch Targets
- [ ] Verify: All buttons, inputs, links have min-height/min-width ≥44px
- [ ] Verify: Bottom nav items ≥56px height
- [ ] Verify: Chat input area accessible
- [ ] Verify: Modal buttons accessible
- [ ] Verify: Toggle switches accessible

---

## 40. Mobile — Responsive Layouts
- [ ] Verify: All pages stack vertically on mobile
- [ ] Verify: Cards full-width on mobile
- [ ] Verify: Grids collapse to 1-2 columns
- [ ] Verify: Sticky action bars work with safe-area
- [ ] Verify: No horizontal scroll on any page
- [ ] Verify: Drawer navigation works on mobile
- [ ] Verify: Header controls accessible

---

## 41. Internationalization — All Pages
- [ ] Switch to 'uz' → verify ALL visible text in Uzbek
- [ ] Switch to 'ru' → verify ALL visible text in Russian
- [ ] Switch to 'en' → verify ALL visible text in English
- [ ] Check each page: Login, OTP, Name, Dashboard, Chat, Documents, Lawyers, Jobs, Messages, Settings, SuperAdmin pages
- [ ] Verify: No hardcoded English strings anywhere
- [ ] Verify: Translation keys fall back to key name if missing
- [ ] Verify: Interpolation works (e.g., "Welcome, {name}")

---

## 42. Session — Permanent
- [ ] Login → close browser → reopen
- [ ] Verify: Still logged in
- [ ] Verify: Session restored from localStorage
- [ ] Verify: No session expiry (no time-based check)
- [ ] Clear localStorage → verify redirected to login

---

## 43. Audit — All Mutations
- [ ] Create document → verify audit log
- [ ] Cancel document → verify audit log
- [ ] Create job → verify audit log
- [ ] Accept job → verify audit log
- [ ] Complete job → verify audit log
- [ ] Create dispute → verify audit log
- [ ] Resolve dispute → verify audit log
- [ ] Submit review → verify audit log
- [ ] Send message → verify conversation updated
- [ ] Update profile → verify audit log
- [ ] Delete account → verify audit log with cascade details
- [ ] System config update → verify audit log
- [ ] Template create/update → verify audit log
- [ ] Lawyer create/update → verify audit log
- [ ] Reset data → verify audit log with cleared collections

---

## 44. NO Payments/Credits/Subscriptions
- [ ] Verify: No payment UI anywhere
- [ ] Verify: No credit/balance system
- [ ] Verify: No subscription plans
- [ ] Verify: All features accessible without payment
- [ ] Verify: No payment-related endpoints called

---

## 45. Realtime Sync — Phase 2
- [ ] Open two tabs as same user
- [ ] Send message in one tab → verify appears in other
- [ ] Post job in one tab → verify appears in other
- [ ] Update settings in one tab → verify reflected in other
- [ ] Verify: Sync works across user and superadmin panels
- [ ] Verify: No excessive polling (debounce working)
- [ ] Verify: Error recovery after network interruption

---

## Pass Criteria
All items above must pass. Any failure indicates a bug that must be fixed before production deployment.

**Test Date:** ____________
**Tested By:** ____________
**Result:** ☐ PASS ☐ FAIL
**Notes:** ____________
