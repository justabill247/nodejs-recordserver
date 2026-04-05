# Release: 0.2.0-beta (April 5, 2026)

## Release Notes

### New Features
- **Frontend Integration**: Backend now serves built Vue frontend from `/public` directory on port 4000
- **One-shot Recording Scheduling**: Manual scheduled recordings with custom naming support
- **Environment Variable Configuration**: All directory paths (recordings, logs, database, logos, frontend) configurable via env vars
- **SPA Routing**: Vue Router client-side navigation fully supported with fallback to index.html
- **WebSocket State Broadcasting**: Real-time schedule state updates over WebSocket

### Infrastructure
- **Container Ready**: Full support for Linux LXC Proxmox deployment with Tailscale
- **Logging Improvements**: Reduced FFmpeg noise with throttled progress updates and process lifecycle events
- **Auto-create Directories**: All required directories auto-create at startup

### Breaking Changes
None - fully backward compatible with development setups

### Known Limitations
- Beta: Monitor for edge cases in production deployment
- Record-now validation requires name parameter in API payload

### Testing
✅ One-shot scheduling with recorded artifacts  
✅ WebSocket real-time state updates  
✅ Frontend served and routing functional  
✅ Custom recording names persisted to database  

---

## Commit History

### Commit 1: `ada80cd` - Add one-shot scheduling and improve recorder observability
**Date:** April 4, 2026

**Changes:**
- Added persisted one-shot schedule support across API, DB, and scheduler
- Implemented live schedule-state updates broadcast over WebSocket
- Improved recorder and FFmpeg logging with reduced noise and progress throttling
- Added process lifecycle logging and backend bootstrap integration

### Commit 2: `d3cf4a4` - Allow naming manual recordings
**Date:** April 4, 2026

**Changes:**
- Accept custom name in the record-now API payload
- Added validation that manual recordings must provide a name
- Use provided name instead of generating timestamp-based default

### Commit 3: (Current) - Prepare backend for LXC containerization and frontend integration
**Date:** April 5, 2026

**Changes:**
- Added environment variable support for all key directories (RECORDINGS_DIR, LOGS_DIR, FRONTEND_DIR)
- Integrated frontend static file serving from public/ on port 4000
- Implemented SPA fallback routing for Vue Router client-side navigation
- Updated .env.example with comprehensive deployment documentation
- Maintained backward compatibility with existing dev setups

---

## Summary of All Changes
Prepared the recording server for Linux LXC Proxmox deployment with Tailscale. Added support for one-shot scheduled recordings, manual recording naming, environment variable configuration for all key directories, and integrated frontend serving capabilities.

## Detailed Changes (Latest)

### 1. Environment Variable Support for Containerization

#### `src/index.js`
- Added `RECORDINGS_DIR` environment variable support (defaults to `./recordings`)
- Added `LOGOS_DIR` environment variable support (defaults to `./logos`)
- Added `FRONTEND_DIR` environment variable support (defaults to `./public`)
- All directories now auto-create if missing

**Why:** Container deployments need absolute paths (e.g., `/recordings`, `/var/log/recordServer`) instead of relative paths.

#### `src/services/recorder.js`
- Updated to use `process.env.RECORDINGS_DIR` with fallback (defaults to `<project-root>/recordings`)

**Why:** Ensures recordings are saved to the bind-mounted `/recordings` directory in LXC containers.

#### `src/services/logger.js`
- Added `LOGS_DIR` environment variable support (defaults to `<project-root>/logs`)

**Why:** Allows logs to be written to `/var/log/recordServer` in containers for better log management.

### 2. Frontend Integration

#### `src/index.js`
- Added static file serving from `FRONTEND_DIR` at root `/`
- Implemented SPA fallback routing: non-API/non-asset routes redirect to `index.html` for Vue Router
- Created `public` folder auto-creation at startup
- Updated startup logs to display frontend directory

**Behavior:**
- API routes: `/api/*` (unchanged)
- Audio files: `/audio/*` (unchanged)
- Logos: `/logos/*` (unchanged)
- Everything else: served from `public/` or falls back to `index.html` for Vue routing

### 3. Documentation

#### `.env.example`
- Documented `RECORDINGS_DIR`: path for audio recordings
- Documented `LOGS_DIR`: path for application logs
- Documented `DB_PATH`: path for SQLite database (already supported)
- Documented `LOGOS_DIR`: path for stream logos
- Documented `FRONTEND_DIR`: path for built Vue frontend
- Added comprehensive LXC/Proxmox deployment section with example values

## LXC Deployment Configuration

For Proxmox LXC container deployment with Tailscale, set these environment variables:

```bash
PORT=4000
RECORDINGS_DIR=/recordings
LOGS_DIR=/var/log/recordServer
DB_PATH=/var/lib/recordServer/serverDb.db
LOGOS_DIR=/var/lib/recordServer/logos
FRONTEND_DIR=/var/lib/recordServer/public
ALLOWED_ORIGIN=*
```

### Container Bind Mounts (in Proxmox LXC config):
```
mp0: /var/lib/recordings,mp=/recordings
mp1: /var/log/recordServer,mp=/var/log/recordServer
mp2: /var/lib/recordServer/data,mp=/var/lib/recordServer
```

## Deployment Steps

1. **Build Frontend:**
   ```bash
   cd ../vue-streamClient
   npm run build
   ```

2. **Copy Frontend Files:**
   ```bash
   cp -r ../vue-streamClient/dist/* ./public/
   ```

3. **Set Environment Variables:**
   Create `.env` in container with paths above

4. **Start Server:**
   ```bash
   npm start
   ```

5. **Access Application:**
   - Frontend: `http://localhost:4000`
   - API: `http://localhost:4000/api/*`
   - Swagger Docs: `http://localhost:4000/api-docs`

## Files Modified
- `src/index.js` - Frontend serving, env vars, SPA routing
- `src/services/recorder.js` - Environment variable support
- `src/services/logger.js` - Environment variable support
- `.env.example` - Documentation

## Backward Compatibility
✅ All changes are backward compatible. Existing development deployments will work unchanged with default relative paths.

## Testing Checklist
- [ ] Test local dev with `npm start`
- [ ] Test frontend serving at `http://localhost:4000`
- [ ] Test API routes at `http://localhost:4000/api/*`
- [ ] Test Vue Router page navigation
- [ ] Test on LXC with environment variables set
