# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

**Service Ports:**
- Observability API: `http://localhost:8006` (FastAPI + OpenAPI docs at `/docs`)
- PostgreSQL: `localhost:5437` (maps to 5432 inside container)
- OTEL Collector: `localhost:4317` (gRPC) / `localhost:4318` (HTTP)
- Grafana: `http://localhost:3003` (optional)

**Key Commands:**
```bash
docker-compose up -d observability-service observability-db  # Start core services
cd frontend && npm run dev                                   # Run demo frontend
cd packages/observability-client && npm run dev              # Watch mode for client package
```

**Key Files:**
- `services/observability-service/main.py` - All API endpoints + background cleanup task
- `services/observability-service/models.py` - SQLAlchemy database schema
- `packages/observability-client/src/index.ts` - NPM package public API
- `packages/observability-client/src/core/client.ts` - Event queuing & retry logic

## Project Overview

This is an **observability service** designed to track user events, UI interactions, and errors across any application. The project consists of:

1. **Observability Service** (FastAPI backend) - REST API for collecting and storing observability data
2. **PostgreSQL Database** - Event storage with automatic cleanup and retention policies
3. **NPM Package** (`@ai-observability/client`) - Frontend client library with tracked React components, event queuing, and retry logic
4. **Demo Frontend** (React + Vite) - Example implementation showcasing the observability system
5. **OpenTelemetry Stack** (optional) - Distributed tracing with Tempo, Loki, Prometheus, and Grafana

The service is **application-agnostic** and can be integrated into any frontend or backend application via HTTP API calls.

### Key Design Principles

- **Graceful Degradation**: Frontend client queues events locally (localStorage) when service is unavailable
- **Automatic Retry**: Failed events retry with exponential backoff (max 3 attempts)
- **No Breaking**: All tracking functions fail silently to prevent disrupting the host application
- **Privacy First**: Input values are sanitized by default; sensitive data never tracked

## Development Commands

### Running the Full Stack

```bash
# Start core services only (observability service + database)
docker-compose up -d observability-service observability-db

# Start all services including optional telemetry stack
docker-compose up -d

# Check service health
curl http://localhost:8006/health

# View API documentation
open http://localhost:8006/docs
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev        # Start dev server on http://localhost:5173
npm run build      # Build for production
npm run lint       # Run ESLint
```

### Observability Client Package Development

```bash
cd packages/observability-client

# Build the package
npm run build

# Watch mode for development
npm run dev

# Link for local testing in other projects
npm run link       # Builds, removes React (prevents duplicate instance), and links

# In your consuming application
npm link @ai-observability/client
```

**Important**: After linking the package, always restart your dev server. The `npm run link` script automatically removes the package's local React to prevent "Invalid Hook Call" errors from duplicate React instances.

### Backend Service Development

```bash
cd services/observability-service

# Install dependencies
pip install -r requirements.txt

# Run locally (requires PostgreSQL running)
uvicorn main:app --reload --host 0.0.0.0 --port 8006

# Create database tables manually (only needed if not using Docker)
python create_tables.py

# Access PostgreSQL directly
docker-compose exec observability-db psql -U eval_user -d observability_db

# Or from host machine (note port mapping 5437 -> 5432)
psql -h localhost -p 5437 -U eval_user -d observability_db
```

### Testing & Verification

```bash
# Test event creation
curl -X POST http://localhost:8006/events \
  -H "Content-Type: application/json" \
  -d '{"event_type": "test", "event_metadata": {"test": true}}'

# Get statistics
curl http://localhost:8006/stats

# Query recent events
curl "http://localhost:8006/events?limit=10"

# Test cleanup (dry run)
curl -X POST "http://localhost:8006/cleanup?dry_run=true"

# View OpenAPI documentation
open http://localhost:8006/docs
```

## Architecture

### High-Level Data Flow

```
Frontend App → HTTP POST → Observability Service (FastAPI) → PostgreSQL
                     ↓
                OpenTelemetry Collector → Tempo/Loki/Prometheus
```

### Core Components

**Backend Service** (`services/observability-service/`):
- `main.py` - FastAPI application with all REST endpoints
- `models.py` - SQLAlchemy models (UserEvent, UIEvent, UIError, ServiceError, UserSession)
- `database.py` - Database connection and session management
- `otel_setup.py` - OpenTelemetry instrumentation setup

**Frontend Client Package** (`packages/observability-client/src/`):
- `core/` - Configuration, HTTP client, session management
- `tracking/` - Event tracking functions (events, UI events, errors)
- `components/` - Tracked React components (TrackedButton, TrackedInput, etc.)
- `hooks/` - React hooks for observability (useObservability, useAutoTracking)
- `utils/` - Utilities for OpenTelemetry, device info, user management

**Demo Frontend** (`frontend/src/`):
- `pages/` - Dashboard, EventsCopy (event viewer), ObservabilityDemo
- `components/` - TrackedButton, TrackedInput, TrackedCheckbox, TrackedSelect, ErrorBoundary
- `contexts/ObservabilityContext.tsx` - React context for observability state
- `utils/otel.ts` - OpenTelemetry setup for frontend

### Database Schema

The service uses PostgreSQL with five main tables (see `models.py`):

**user_events** - General user behavior events
- Indexes: `user_id`, `session_id`, `event_type`, `timestamp`, composite indexes for `(user_id, timestamp)` and `(session_id, timestamp)`
- JSON metadata field for flexible event data
- Request tracing: `request_id`, `service_name`, `ip_address`

**ui_events** - UI interaction events with rich context
- Indexes: `interaction_type`, `element_type`, `element_name`, `page_path`, `page_context`, composite indexes for common query patterns
- Captures: element details, page context, viewport dimensions, device type, time to interaction
- Optimized for high-volume analytics queries

**ui_errors** - Frontend JavaScript errors
- Indexes: `error_type`, `page_path`, user/session indexes
- Captures: error message, type, stack trace, source file, line/column numbers
- Page context for debugging

**service_errors** - Backend/API errors
- Indexes: `error_type`, `severity`, `service_name`, `endpoint`, `status_code`
- Captures: full request/response context, headers, body
- Auto-determined severity from HTTP status codes (500s=ERROR, 400s=WARNING, 404=INFO)
- Timeout tracking and error codes

**user_sessions** - Session tracking
- Primary key: session_id (string)
- Metrics: duration, page_views, events_count
- Device info: device_type, browser, os

**Port Mapping**: PostgreSQL runs on port 5432 inside Docker but is mapped to 5437 on the host to avoid conflicts with other databases.

### Event Lifecycle

1. **Client-Side Tracking**: Frontend calls tracking functions (`trackEvent`, `trackUIEvent`, etc.)
2. **Event Queue**: If service is unavailable, events are queued in localStorage (max 100 events, FIFO)
3. **Batching**: Client batches events (default: 10 events or 5 seconds) before sending
4. **HTTP POST**: Events sent to REST API endpoints (`/events`, `/ui-events`, `/errors/ui`, `/errors/services`)
5. **Retry Logic**: Failed requests retry with exponential backoff (max 3 attempts)
6. **Storage**: Stored in PostgreSQL with UTC timestamps
7. **Querying**: Retrieved via GET endpoints with filtering (user_id, session_id, date ranges)
8. **Cleanup**: Automatic background task runs every 24 hours to delete events older than retention period (default: 90 days)

**Event Queue Details** (`packages/observability-client/src/core/client.ts`):
- Uses localStorage with quota management (clears oldest 25% if quota exceeded)
- Each event has retry counter and timestamp
- Queue is persisted across page reloads
- Automatic retry when service becomes available again

### OpenTelemetry Integration

The service supports two modes of event tracking:

1. **Database + Telemetry**: Regular tracking stores in PostgreSQL AND sends spans to OpenTelemetry
2. **Telemetry Only**: Use `trackEventTelemetryOnly()` for events like page_view that only need OpenTelemetry/Loki logging (not database storage)

**Backend Instrumentation** (`otel_setup.py`):
- Auto-instruments FastAPI (request tracing, spans for all endpoints)
- Auto-instruments SQLAlchemy (database query tracing)
- Sends to OTEL Collector at `http://otel-collector:4317` (gRPC)
- OTEL Collector forwards to:
  - **Tempo** (port 3200) - Distributed traces
  - **Loki** (port 3100) - Log aggregation
  - **Prometheus** (port 9090) - Metrics
- Logs sent via `BatchLogRecordProcessor` with Python logging integration

**Frontend Instrumentation** (optional):
- Frontend can initialize OpenTelemetry web SDK to send traces directly
- Auto-instrumentation available for page loads, user interactions, fetch/XHR requests
- See `frontend/src/utils/otel.ts` for setup example

**Accessing the Stack**:
```bash
docker-compose up -d  # Start all services including Grafana
open http://localhost:3003  # Grafana (explore Loki logs, Tempo traces)
```

## Key Configuration

### Environment Variables

**Observability Service**:
- `DATABASE_URL` - PostgreSQL connection string
- `OTEL_COLLECTOR_URL` - OpenTelemetry Collector endpoint (default: http://localhost:4317)
- `EVENT_RETENTION_DAYS` - Days to retain events (default: 90)
- `CLEANUP_INTERVAL_HOURS` - Cleanup frequency (default: 24)
- `ENABLE_AUTO_CLEANUP` - Enable automatic cleanup (default: true)

**Frontend Applications**:
- Set `serviceUrl` in `initObservability()` config (default: http://localhost:8006)

### CORS Configuration

The service allows CORS from localhost ports 3000, 3001, 3002, and 5173 by default (see `main.py` lines 122-135).

**To add new origins:**
1. Edit `main.py` `CORSMiddleware` configuration
2. Add your origin to `allow_origins` list
3. Restart the service

**Example:**
```python
allow_origins=[
    "http://localhost:3000",
    "http://your-app.com",  # Add your production domain
]
```

## Common Development Patterns

### Adding New Event Types

1. If using existing tables, no schema changes needed - use `event_metadata` JSON field for custom data
2. For new tables, add model to `models.py` with appropriate indexes
3. Add corresponding Pydantic schemas in `main.py`
4. Create POST endpoint for creation and GET endpoint for querying
5. Update frontend client package with new tracking function

### Working with Tracked Components

The NPM package provides wrapped components that automatically track interactions:

- `TrackedButton` - Tracks clicks with element name and page context
- `TrackedInput` - Tracks changes (sanitizes values by default)
- `TrackedCheckbox` - Tracks checked state changes
- `TrackedSelect` - Tracks selection changes

All tracked components accept the same props as their native counterparts plus `eventMetadata` for additional context.

### Manual Event Tracking

```typescript
import { trackEvent, trackUIEvent, trackUIError } from '@ai-observability/client';

// General event
trackEvent({ event_type: 'feature_used', event_metadata: { feature: 'export' } });

// UI interaction
trackUIEvent({
  interaction_type: 'click',
  element_type: 'button',
  element_name: 'submit-form',
  page_path: window.location.pathname
});

// Error tracking
trackUIError({
  error_message: error.message,
  error_type: error.name,
  error_stack: error.stack
});
```

### Querying Events via API

All GET endpoints support filtering by:
- `user_id`, `session_id` - Filter by user or session
- `start_date`, `end_date` - ISO datetime range filtering
- `limit` - Maximum results (default: 100)
- Specific filters per endpoint (e.g., `event_type`, `interaction_type`, `page_path`, `severity`)

Analytics endpoints (`/analytics/summary`, `/ui-events/analytics`, `/errors/total`) provide aggregated statistics.

## Development Workflow

1. **Backend Changes**: Edit Python files in `services/observability-service/`, service auto-reloads with uvicorn --reload
2. **Frontend Package Changes**: Edit TypeScript in `packages/observability-client/src/`, run `npm run dev` for watch mode
3. **Demo App Changes**: Edit React components in `frontend/src/`, Vite HMR handles updates automatically
4. **Testing Integration**: Use demo frontend or link package to your application with `npm run link`
5. **Database Changes**: Modify `models.py`, restart service to auto-create tables (SQLAlchemy `Base.metadata.create_all()` on startup)

### Adding New API Endpoints

1. **Define Pydantic Models**: Add request/response schemas in `main.py` (e.g., `EventCreate`, `EventResponse`)
2. **Add SQLAlchemy Model** (if new table): Create model in `models.py` with indexes
3. **Create Endpoint**: Add FastAPI route in `main.py` with proper tags and documentation
4. **Add to Frontend Client** (optional): Create tracking function in `packages/observability-client/src/tracking/`
5. **Update Types**: Add TypeScript types in `packages/observability-client/src/types/index.ts`

### Background Task Architecture

The FastAPI app uses an `@asynccontextmanager` lifespan to manage startup/shutdown:
- **Startup**: Creates database tables, starts background cleanup task (`asyncio.create_task`)
- **Shutdown**: Cancels cleanup task gracefully
- **Cleanup Task**: Runs every `CLEANUP_INTERVAL_HOURS` (default 24h), deletes events older than `RETENTION_DAYS` (default 90)
- See `main.py` lines 72-91 for implementation

### Direct Database Access

```bash
# Connect to database
docker-compose exec observability-db psql -U eval_user -d observability_db

# From host (note port 5437)
psql -h localhost -p 5437 -U eval_user -d observability_db
# Password: eval_pass

# Example queries
SELECT COUNT(*) FROM user_events;
SELECT event_type, COUNT(*) FROM user_events GROUP BY event_type;
SELECT * FROM ui_events WHERE page_path = '/dashboard' ORDER BY timestamp DESC LIMIT 10;
SELECT * FROM service_errors WHERE severity = 'ERROR' ORDER BY timestamp DESC;
```

## Troubleshooting

### Common Issues

**"Invalid Hook Call" Error (Duplicate React)**
- Cause: Multiple React instances when using `npm link`
- Fix: Run `npm run link` (not just `npm link`) - it removes the package's local React automatically
- Verify: Check `packages/observability-client/node_modules` - should have no react folder

**CORS Errors**
- Symptom: Browser blocks requests, error in console
- Check: Service logs show the OPTIONS request
- Fix: Add your origin to `main.py` CORS configuration and restart service

**Service Unavailable / Connection Refused**
- Check: `docker-compose ps` - is `observability-service` running?
- Check: `curl http://localhost:8006/health` - does it respond?
- Fix: `docker-compose up -d observability-service observability-db`
- Note: Events queue locally when service is down, sent automatically when service recovers

**Database Connection Errors**
- Check: Is PostgreSQL container running? `docker-compose ps observability-db`
- Check: Can you connect? `psql -h localhost -p 5437 -U eval_user -d observability_db`
- Check: Environment variable `DATABASE_URL` in service container
- Fix: Ensure database is healthy before starting service (Docker healthcheck handles this)

**Events Not Appearing in Database**
- Check: `/stats` endpoint - are counts increasing?
- Check: Browser devtools network tab - are POST requests succeeding?
- Check: Service logs for errors - `docker-compose logs observability-service`
- Check: Is event queued in localStorage? Look for `observability_event_queue` key

**LocalStorage Quota Exceeded**
- Symptom: Events not queuing, console warning about quota
- Auto-fix: Client automatically clears oldest 25% of queued events
- Manual fix: Clear localStorage key `observability_event_queue`

**TypeScript Errors After Package Changes**
- Fix: Run `npm run build` in the package directory
- Fix: Restart dev server in consuming application
- Fix: Clear node_modules cache: `rm -rf node_modules/.cache`

## Important Notes

- **Session Management**: Sessions auto-generated and stored in localStorage, expire after 30 minutes of inactivity (see `packages/observability-client/src/core/session.ts`)
- **Auto-Instrumentation**: Frontend client can auto-track clicks, form submissions, and errors via `autoTrack` config (default: only pageViews and errors)
- **Performance**: UI events table has 6+ specialized indexes optimized for analytics queries by page, element, interaction type
- **Security**: Never track sensitive data - client sanitizes input values by default, never log passwords/tokens
- **Retention**: Old events auto-deleted every 24h (configurable), manual cleanup via `POST /cleanup?days=30`
- **Health Checks**: Service has `/health` endpoint + Docker healthcheck (every 10s, 5s timeout, 5 retries)
- **Error Severity**: Service errors auto-determine severity from HTTP status codes (500s=ERROR, 400s=WARNING, 404=INFO)
- **Database Connection Pool**: SQLAlchemy engine uses connection pooling with `pool_pre_ping=True` for reliability, `pool_recycle=300` (5min)
- **Batching**: Client batches up to 10 events or 5 seconds (whichever comes first) before sending to reduce HTTP requests
- **OpenAPI**: Full API documentation available at `http://localhost:8006/docs` (Swagger UI) and `/redoc` (ReDoc)
