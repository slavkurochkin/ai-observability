# UI Events Table Documentation

## Overview

The `ui_events` table is a dedicated PostgreSQL table in the `observability_db` database designed specifically for tracking UI interactions with an optimized schema for analytics. This table complements the existing `user_events` table by providing structured fields for UI-specific analytics.

## Table Schema

```sql
CREATE TABLE ui_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    session_id VARCHAR(255),
    
    -- UI-specific fields
    interaction_type VARCHAR(50) NOT NULL,  -- click, change, focus, blur, submit
    element_type VARCHAR(50),                 -- button, input, checkbox, select, form
    element_name VARCHAR(255),               -- name/id of the element
    element_id VARCHAR(255),                 -- HTML id if available
    
    -- Context
    page_path VARCHAR(500),                  -- Current route/page
    page_context VARCHAR(255),               -- Component/page context
    route_name VARCHAR(255),                -- Named route if available
    
    -- Event details
    event_value TEXT,                        -- For inputs: value (sanitized), for checkboxes: checked state
    event_metadata JSONB,                     -- Additional flexible metadata
    
    -- Technical context
    timestamp TIMESTAMP DEFAULT NOW(),
    user_agent TEXT,
    viewport_width INTEGER,                  -- Screen width
    viewport_height INTEGER,                 -- Screen height
    device_type VARCHAR(50),                -- mobile, tablet, desktop
    
    -- Performance metrics (optional)
    time_to_interaction_ms INTEGER           -- Time from page load to interaction
);
```

## Indexes

The table includes optimized indexes for common query patterns:

```sql
CREATE INDEX idx_ui_events_user_timestamp ON ui_events(user_id, timestamp);
CREATE INDEX idx_ui_events_session_timestamp ON ui_events(session_id, timestamp);
CREATE INDEX idx_ui_events_page_element ON ui_events(page_path, element_type, element_name);
CREATE INDEX idx_ui_events_interaction_type ON ui_events(interaction_type, timestamp);
CREATE INDEX idx_ui_events_context ON ui_events(page_context, interaction_type);
```

## API Endpoints

### POST `/ui-events`

Create a UI interaction event.

**Request Body:**
```json
{
  "user_id": 123,
  "session_id": "session_xxx",
  "interaction_type": "click",
  "element_type": "button",
  "element_name": "create_evaluation",
  "element_id": "btn-create",
  "page_path": "/evaluations",
  "page_context": "evaluations_page",
  "route_name": "evaluations",
  "event_value": null,
  "event_metadata": {
    "additional": "data"
  },
  "user_agent": "Mozilla/5.0...",
  "viewport_width": 1920,
  "viewport_height": 1080,
  "device_type": "desktop",
  "time_to_interaction_ms": 1500
}
```

**Response:**
```json
{
  "id": 1,
  "user_id": 123,
  "interaction_type": "click",
  "element_type": "button",
  "element_name": "create_evaluation",
  "page_path": "/evaluations",
  "page_context": "evaluations_page",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET `/ui-events`

Query UI events with filters.

**Query Parameters:**
- `user_id` (optional): Filter by user ID
- `session_id` (optional): Filter by session ID
- `interaction_type` (optional): Filter by interaction type (click, change, focus, blur, submit)
- `element_type` (optional): Filter by element type (button, input, checkbox, select, form)
- `page_path` (optional): Filter by page path
- `page_context` (optional): Filter by page context
- `start_date` (optional): Start date for time range
- `end_date` (optional): End date for time range
- `limit` (optional, default: 100): Maximum number of results

**Example:**
```bash
GET /ui-events?interaction_type=click&element_type=button&page_path=/evaluations&limit=50
```

### GET `/ui-events/analytics`

Get aggregated UI event analytics.

**Query Parameters:**
- `start_date` (optional): Start date (default: 7 days ago)
- `end_date` (optional): End date (default: now)
- `page_path` (optional): Filter by specific page

**Response:**
```json
{
  "total_events": 1523,
  "unique_users": 45,
  "unique_sessions": 89,
  "interaction_types": {
    "click": 892,
    "change": 456,
    "focus": 123,
    "blur": 52
  },
  "top_buttons": [
    {"name": "create_evaluation", "count": 234},
    {"name": "delete_evaluation", "count": 89},
    {"name": "submit_form", "count": 67}
  ],
  "events_by_page": {
    "/evaluations": 567,
    "/dashboard": 234,
    "/settings": 123
  },
  "events_by_element_type": {
    "button": 892,
    "input": 456,
    "checkbox": 123,
    "select": 52
  },
  "start_date": "2024-01-08T10:30:00Z",
  "end_date": "2024-01-15T10:30:00Z"
}
```

## Frontend Integration

The tracked components automatically send events to both:
1. **General events endpoint** (`/events`) - Stored in `user_events` table
2. **UI events endpoint** (`/ui-events`) - Stored in `ui_events` table

This dual storage allows for:
- **General events**: Flexible, unstructured event tracking
- **UI events**: Optimized, structured UI analytics

### Example Usage

```tsx
import { TrackedButton } from '../components';

<TrackedButton
  trackContext="evaluations_page"
  buttonName="create_evaluation"
  onClick={handleClick}
>
  Create Evaluation
</TrackedButton>
```

This automatically sends to both tables with appropriate schema.

## Data Retention

UI events follow the same retention policy as user events:
- Default retention: 90 days (configurable via `EVENT_RETENTION_DAYS`)
- Auto-cleanup runs daily (configurable via `CLEANUP_INTERVAL_HOURS`)
- Both tables are cleaned up together

## Analytics Queries

### Most Clicked Buttons
```sql
SELECT 
    element_name,
    COUNT(*) as click_count
FROM ui_events
WHERE interaction_type = 'click'
  AND element_type = 'button'
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY element_name
ORDER BY click_count DESC
LIMIT 10;
```

### Form Abandonment Rate
```sql
SELECT 
    page_path,
    COUNT(DISTINCT session_id) as sessions_with_focus,
    COUNT(DISTINCT CASE 
        WHEN interaction_type = 'submit' THEN session_id 
    END) as sessions_with_submit
FROM ui_events
WHERE element_type = 'input'
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY page_path;
```

### User Journey
```sql
SELECT 
    session_id,
    page_path,
    interaction_type,
    element_name,
    timestamp
FROM ui_events
WHERE session_id = 'session_xxx'
ORDER BY timestamp;
```

### Device Type Distribution
```sql
SELECT 
    device_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users
FROM ui_events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY device_type;
```

### Page Performance
```sql
SELECT 
    page_path,
    AVG(time_to_interaction_ms) as avg_time_to_interaction,
    COUNT(*) as total_interactions
FROM ui_events
WHERE time_to_interaction_ms IS NOT NULL
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY page_path
ORDER BY avg_time_to_interaction DESC;
```

## Benefits Over General Events Table

1. **Structured Fields**: Dedicated columns for UI-specific data (element_type, interaction_type, etc.)
2. **Better Indexing**: Optimized indexes for UI analytics queries
3. **Faster Queries**: No need to parse JSON for common queries
4. **Type Safety**: Enforced schema ensures data consistency
5. **Analytics Ready**: Pre-aggregated fields for common analytics

## Migration from user_events

If you have existing UI events in `user_events`, you can migrate them:

```sql
INSERT INTO ui_events (
    user_id, session_id, interaction_type, element_type,
    element_name, page_path, page_context, event_metadata,
    timestamp, user_agent
)
SELECT 
    user_id,
    session_id,
    event_metadata->>'interaction_type' as interaction_type,
    event_metadata->>'element_type' as element_type,
    event_metadata->>'element_name' as element_name,
    event_metadata->>'page_path' as page_path,
    event_metadata->>'context' as page_context,
    event_metadata,
    timestamp,
    user_agent
FROM user_events
WHERE event_type LIKE 'button_click' 
   OR event_type LIKE 'input_%'
   OR event_type LIKE 'checkbox_%'
   OR event_type LIKE 'select_%';
```

## Monitoring

Check table statistics:
```bash
GET /stats
```

Response includes:
- `total_ui_events`: Total UI events in database
- `oldest_ui_event`: Oldest UI event timestamp
- `newest_ui_event`: Newest UI event timestamp
- `ui_events_older_than_retention`: Count of events ready for cleanup

