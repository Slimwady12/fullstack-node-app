# Phase 2 Quick Test Reference Card

## 🚀 Quick Start
```bash
npm run dev
# Open: http://localhost:3000
```

## 🔑 Test Accounts

### SuperAdmin
- **Phone:** 1234567890
- **Password:** admin123
- **Redirect:** /superadmin

### Regular User
- **Phone:** Check database.json → users[0].phone
- **Password:** password123 (or check .env)
- **Redirect:** /user

---

## ✅ Critical Path Tests (5 min check)

| # | Test | Expected | Status |
|---|------|----------|--------|
| 1 | Login as SuperAdmin | Redirect to /superadmin | ☐ |
| 2 | Login as User | Redirect to /user | ☐ |
| 3 | User Dashboard | Loads with stats & actions | ☐ |
| 4 | Chat - Send Message | AI responds | ☐ |
| 5 | Create Document | Status = PENDING | ☐ |
| 6 | Post Job | Status = OPEN | ☐ |
| 7 | Mobile View | Bottom nav visible | ☐ |
| 8 | Switch Language | All text changes | ☐ |

---

## 🎯 Feature Test Shortcuts

### Chat
```
/user/chat
- Type: "I need a contract" (triggers wizard)
- Upload attachment
- Check Sessions tab
- Check History tab
```

### Documents
```
/user/documents/new
- Select template
- Fill wizard fields
- Submit → check PENDING status

/user/documents/:id
- Check detail page
- Cancel (if PENDING)
```

### Jobs
```
/user/jobs/post
- Title: "Legal Consultation"
- Category: Contract
- Budget: 500
- Submit → check OPEN status
```

### Lawyers
```
/user/lawyers
- Click heart (save)
- Click again (unsave)
- View profile
```

### Messages
```
/user/messages
- Start new conversation
- Send message with attachment
- Check unread badge
```

### Settings
```
/user/settings
- Update name/email
- Switch language
- Export data
- Logout
```

### SuperAdmin
```
/superadmin/documents
- View PENDING documents
- Mark as reviewed
- Assign lawyer

/superadmin/disputes
- View disputes
- Resolve/Dismiss
```

---

## 🔍 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Server won't start | `npm install` then `npm run dev` |
| Page blank/white | Check console for errors |
| Login fails | Verify phone/password in database.json |
| Chat not responding | Check server logs for AI errors |
| Mobile nav missing | Resize browser to <768px |

---

## 📊 Test Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Pass |
| ❌ | Fail |
| ⚠️ | Warning (non-critical) |
| ☐ | Not tested yet |
| N/A | Not applicable |

---

## 🐛 Bug Report Template

```markdown
**Bug:** [Short description]
**Severity:** Critical / High / Medium / Low
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected:** 
**Actual:** 
**Screenshot:** (if applicable)
**Browser:** 
```

---

## 📝 Notes Section

_Use this space for quick notes during testing_

- 
- 
- 

---

**Test Date:** ____________  
**Tested By:** ____________  
**Overall Status:** ☐ PASS ☐ FAIL
