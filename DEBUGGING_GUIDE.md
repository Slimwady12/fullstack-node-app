# Debugging Guide

## Environment Setup

### Local Development

1. **Create `.env` file** in the root directory:
   ```env
   PORT=3000
   OPENAI_API_KEY=your_openai_key_here
   VITE_API_URL=http://localhost:3000
   ```

2. **Start both frontend and backend**:
   ```bash
   npm run dev
   ```

### Production Deployment

#### Frontend (Vercel)
- Set `VITE_API_URL` environment variable in Vercel dashboard to your backend URL
- Example: `VITE_API_URL=https://your-backend.onrender.com`

#### Backend (Render)
- Set `PORT` and `OPENAI_API_KEY` environment variables in Render dashboard
- The backend will automatically listen on the port provided by Render

## Debug Logging

The application now includes comprehensive debug logging. Open your browser's Developer Console (F12) to see detailed logs.

### API Debug Logs (`src/services/db.ts`)

All database operations are logged with:
- Request URLs and parameters
- Response status and data
- Error details with stack traces
- Retry attempts for transactions

Example log output:
```
[API_DEBUG 2025-01-28T12:34:56.789Z] ℹ️ Reading database { url: 'http://localhost:3000/api/db/read', params: { t: 1738065296789 } }
[API_DEBUG 2025-01-28T12:34:56.890Z] ✅ Database read successful { status: 200, hasData: true, success: true }
```

### Chat Page Debug Logs (`src/pages/user/ChatPage.tsx`)

Chat operations are logged with:
- File upload progress
- Message sending/receiving
- Stream events
- Error details

Example log output:
```
[CHAT_DEBUG 2025-01-28T12:34:56.789Z] ℹ️ Sending general message { inputLength: 25, attachmentCount: 0, userId: 'abc123' }
[CHAT_DEBUG 2025-01-28T12:34:57.890Z] ℹ️ Starting chat stream { url: 'http://localhost:3000/api/chat/stream', chatId: 'xyz789' }
```

## Common Issues & Solutions

### 1. 404 Errors on API Endpoints

**Symptom**: Console shows `Failed to load resource: the server responded with a status of 404 ()`

**Causes**:
- Backend server is not running
- `VITE_API_URL` is not set or incorrect
- CORS issues between frontend and backend

**Solutions**:
1. Check if backend is running: `curl http://localhost:3000/api/db/read`
2. Verify `.env` file has correct `VITE_API_URL`
3. Restart frontend after changing `.env`: `npm run dev`
4. Check browser console for detailed error logs

### 2. Network Unreachable Errors

**Symptom**: Error shows `Cannot connect to backend server`

**Debug Steps**:
1. Look for `[API_DEBUG] ❌ Network error - cannot reach server` in console
2. Check the logged URL matches your backend
3. Test backend directly: `curl <logged_url>`
4. Verify no firewall blocking the connection

### 3. Transaction Conflicts

**Symptom**: Multiple retry attempts logged

**Normal Behavior**: The system automatically retries up to 5 times with exponential backoff when concurrent modifications occur.

**If Persistent**:
- Check for multiple users editing same data
- Review transaction logic in `src/services/db.ts`

### 4. Build Errors on Vercel

**Common Issues**:

a) **PostCSS/Tailwind not found**:
   ```
   Error: Loading PostCSS Plugin failed: Cannot find module 'tailwindcss'
   ```
   **Solution**: Ensure `tailwindcss`, `postcss`, and `autoprefixer` are in `dependencies` (not `devDependencies`)

b) **vite command not found**:
   ```
   sh: line 1: vite: command not found
   ```
   **Solution**: Ensure `vite` and `@vitejs/plugin-react` are in `dependencies`

c) **TypeScript errors**:
   ```
   error TS6305: Output file has not been built from source file
   ```
   **Solution**: Remove `vite.config.ts` from `tsconfig.json` include array, use `vite build` directly

## Error Boundary

The app includes a React Error Boundary that:
- Catches unhandled React errors
- Displays user-friendly error messages
- Shows technical details for debugging
- Provides "Try Again" and "Reload Page" buttons

When an error occurs, you'll see:
- Error message
- Component stack trace (click to expand)
- Recovery options

## Testing API Connectivity

### Manual Testing

1. **Test backend health**:
   ```bash
   curl http://localhost:3000/api/db/read?t=$(date +%s)
   ```

2. **Test with custom backend URL**:
   ```bash
   curl https://your-backend-url.com/api/db/read?t=$(date +%s)
   ```

### Browser Console Testing

Open DevTools Console and run:
```javascript
// Test API connectivity
fetch('http://localhost:3000/api/db/read?t=' + Date.now())
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## Environment Variable Reference

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `PORT` | Backend server port | `3000` | Yes (backend) |
| `OPENAI_API_KEY` | OpenAI API key | - | Yes (for AI features) |
| `VITE_API_URL` | Backend URL for frontend | `/api` (relative) | No (optional) |

## Production Checklist

Before deploying:

- [ ] Set `VITE_API_URL` in Vercel to production backend URL
- [ ] Set `OPENAI_API_KEY` in both Vercel and Render
- [ ] Test API connectivity from frontend to backend
- [ ] Verify CORS is configured correctly
- [ ] Check all environment variables are set
- [ ] Test in incognito mode to avoid cached data
- [ ] Monitor logs in both Vercel and Render dashboards

## Getting Help

When reporting issues, include:
1. Full error message from console
2. `[API_DEBUG]` or `[CHAT_DEBUG]` logs
3. Your environment setup (local/production)
4. Browser and OS version
5. Network tab screenshot showing failed requests
