# Observability Service

A standalone observability service for tracking user events, UI interactions, and errors. This service can be integrated into any application to collect behavioral data and analytics.

## Overview

The Observability Service provides:
- **User Event Tracking**: General user behavior events (page views, actions, etc.) - *Note: page_view events are tracked via OpenTelemetry/Loki only (not stored in database)*
- **UI Event Tracking**: Detailed UI interactions (clicks, form changes, etc.)
- **Error Tracking**: Frontend JavaScript errors and backend/API errors
- **Analytics API**: Query and analyze collected data
- **Data Retention**: Automatic cleanup of old events

All data is stored in PostgreSQL and can be queried via REST API or directly from the database.

## Quick Start

### Using Docker Compose

```bash
# Start the observability service and database
docker-compose up -d observability-service observability-db

# Check service health
curl http://localhost:8006/health

# View API documentation
open http://localhost:8006/docs
```

### Test the Service

```bash
# Create a test event
curl -X POST http://localhost:8006/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "test_event",
    "event_category": "test",
    "event_metadata": {"test": true}
  }'

# Get statistics
curl http://localhost:8006/stats

# Test UI event creation
curl -X POST http://localhost:8006/ui-events \
  -H "Content-Type: application/json" \
  -d '{
    "interaction_type": "click",
    "element_type": "button",
    "element_name": "test-button"
  }'
```

## Documentation

- **[Integration Guide](OBSERVABILITY_INTEGRATION_GUIDE.md)** - Complete guide for integrating the observability service into any application
- **[Tracked Components Guide](TRACKED_COMPONENTS_GUIDE.md)** - Quick reference for using tracked React components
- **[UI Events Table](services/observability-service/docs/UI_EVENTS_TABLE.md)** - Detailed documentation about UI events schema and analytics
- **[Technical Reference](services/observability-service/docs/OBSERVABILITY_TECHNICAL_REFERENCE.md)** - Technical details, migration guide, and removal instructions
- **[Troubleshooting](LOKI_TROUBLESHOOTING.md)** - Troubleshooting guide for Loki logs
- **[Event Debugging](DEBUG_EVENTS.md)** - Guide for debugging event tracking issues

## Architecture

```
┌─────────────────┐
│  Your App      │
│  (Frontend)    │ ──HTTP POST──┐
└─────────────────┘              │
                                 ▼
┌─────────────────┐      ┌──────────────────┐
│  Your App       │      │  Observability   │
│  (Backend)      │ ────▶│  Service         │
└─────────────────┘      │  (Port 8006)     │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  PostgreSQL      │
                         │  (observability_db)│
                         └──────────────────┘
```

## Integration

See **[OBSERVABILITY_INTEGRATION_GUIDE.md](./OBSERVABILITY_INTEGRATION_GUIDE.md)** for detailed integration instructions for:
- Frontend (React, Vue, Angular, etc.)
- Backend (Python/FastAPI, Node.js/Express, etc.)
- API reference
- Best practices

## Demo Frontend

A minimal demo frontend is included to demonstrate observability integration:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 to see the demo application.

## Services

### Core Services

- **observability-service**: Main service (port 8006)
- **observability-db**: PostgreSQL database (port 5437)

### Optional Services (for distributed tracing)

- **otel-collector**: OpenTelemetry Collector
- **tempo**: Distributed tracing backend
- **loki**: Log aggregation
- **prometheus**: Metrics collection
- **grafana**: Visualization dashboard
- **promtail**: Log collector

To start all services including optional ones:

```bash
docker-compose up -d
```

## API Endpoints

- `POST /events` - Create a user event
- `POST /ui-events` - Create a UI interaction event
- `POST /errors/ui` - Create a UI error
- `POST /errors/services` - Create a service/API error
- `GET /events` - Query user events
- `GET /ui-events` - Query UI events
- `GET /errors/ui` - Query UI errors
- `GET /errors/services` - Query service errors
- `GET /stats` - Get database statistics
- `GET /analytics/summary` - Get analytics summary
- `POST /cleanup` - Manually trigger cleanup

See http://localhost:8006/docs for full API documentation (Swagger UI).

## Configuration

### Environment Variables

**Observability Service:**
- `DATABASE_URL`: PostgreSQL connection string
- `EVENT_RETENTION_DAYS`: Days to keep events (default: 90)
- `CLEANUP_INTERVAL_HOURS`: Cleanup frequency (default: 24)
- `ENABLE_AUTO_CLEANUP`: Enable automatic cleanup (default: true)

**Your Application:**
- `OBSERVABILITY_SERVICE_URL`: URL of observability service (default: `http://localhost:8006`)

## Database Schema

The service uses PostgreSQL with the following tables:
- `user_events`: General user events
- `ui_events`: UI interaction events
- `ui_errors`: Frontend errors
- `service_errors`: Backend/API errors
- `user_sessions`: Session tracking

See `services/observability-service/models.py` for full schema.

## Querying Data

### Via API

```bash
# Get events for a user
curl "http://localhost:8006/events?user_id=123&limit=100"

# Get analytics summary
curl "http://localhost:8006/analytics/summary?start_date=2024-01-01"

# Get UI analytics
curl "http://localhost:8006/ui-events/analytics?page_path=/dashboard"
```

### Direct Database Access

```bash
# Connect to database
docker-compose exec observability-db psql -U eval_user -d observability_db

# Query events
SELECT * FROM user_events WHERE user_id = 123 ORDER BY timestamp DESC;
```

## Documentation

- **[OBSERVABILITY_INTEGRATION_GUIDE.md](./OBSERVABILITY_INTEGRATION_GUIDE.md)**: How to integrate into your applications
- **[services/observability-service/docs/](./services/observability-service/docs/)**: Detailed technical documentation

## Project Structure

```
.
├── frontend/                    # Demo frontend application
│   └── src/
│       ├── pages/
│       │   └── ObservabilityDemo.tsx  # Demo page
│       ├── components/
│       │   ├── ErrorBoundary.tsx
│       │   └── Layout.tsx
│       ├── contexts/
│       │   └── ObservabilityContext.tsx
│       └── utils/
│           └── otel.ts         # Observability utilities
├── services/
│   └── observability-service/  # Main service
│       ├── main.py             # FastAPI application
│       ├── models.py           # Database models
│       ├── database.py         # Database connection
│       └── docs/               # Technical documentation
├── config/                     # Configuration files (optional)
│   ├── otel-collector.yaml
│   ├── tempo-config.yaml
│   ├── loki-config.yaml
│   ├── prometheus.yml
│   └── grafana-datasources.yml
├── docker-compose.yml          # Service orchestration
└── README.md
```

## License

MIT
