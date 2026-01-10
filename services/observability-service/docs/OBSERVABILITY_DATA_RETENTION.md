# Observability Data Retention & Cleanup

## Overview

The observability database can grow very large over time as user events accumulate. This document describes the data retention and cleanup mechanisms implemented to manage database size.

## Features

### 1. Automatic Cleanup (Default: Enabled)

The observability service automatically deletes events older than the retention period on a scheduled basis.

**Configuration:**
- **Retention Period**: `EVENT_RETENTION_DAYS` (default: 90 days)
- **Cleanup Interval**: `CLEANUP_INTERVAL_HOURS` (default: 24 hours / daily)
- **Auto-cleanup**: `ENABLE_AUTO_CLEANUP` (default: true)

**How it works:**
- A background task runs every 24 hours (configurable)
- Deletes all events older than the retention period
- Logs the number of deleted events
- Runs automatically when the service starts

### 2. Manual Cleanup

You can manually trigger cleanup via the API:

```bash
# Dry run - see how many events would be deleted
curl -X POST "http://localhost:8006/cleanup?dry_run=true"

# Cleanup with default retention (90 days)
curl -X POST "http://localhost:8006/cleanup"

# Cleanup with custom retention period (e.g., 30 days)
curl -X POST "http://localhost:8006/cleanup?days=30"
```

### 3. Database Statistics

Check database size and cleanup status:

```bash
curl http://localhost:8006/stats
```

Response includes:
- Total events and sessions
- Oldest/newest event timestamps
- Events by category
- Number of events older than retention period
- Estimated database size
- Cleanup configuration

## Configuration

### Environment Variables

Set these in `docker-compose.yml` or as environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `EVENT_RETENTION_DAYS` | `90` | Number of days to retain events |
| `CLEANUP_INTERVAL_HOURS` | `24` | Hours between cleanup runs |
| `ENABLE_AUTO_CLEANUP` | `true` | Enable/disable automatic cleanup |

### Example Configuration

**Keep events for 30 days, cleanup every 12 hours:**
```yaml
environment:
  - EVENT_RETENTION_DAYS=30
  - CLEANUP_INTERVAL_HOURS=12
  - ENABLE_AUTO_CLEANUP=true
```

**Disable automatic cleanup (manual only):**
```yaml
environment:
  - ENABLE_AUTO_CLEANUP=false
```

## Retention Strategy Recommendations

### Development Environment
- **Retention**: 7-14 days
- **Reason**: Lower volume, faster cleanup for testing

### Production Environment
- **Retention**: 90-180 days
- **Reason**: Balance between data availability and storage costs
- **Consider**: Export important events before cleanup

### High-Volume Production
- **Retention**: 30-60 days
- **Reason**: Reduce storage costs
- **Consider**: 
  - Archive old data to cold storage (S3, etc.)
  - Aggregate important metrics before deletion
  - Use data warehouse for long-term analytics

## Database Size Estimation

Approximate storage per event: **~500 bytes**

**Examples:**
- 1 million events ≈ 500 MB
- 10 million events ≈ 5 GB
- 100 million events ≈ 50 GB

**With 90-day retention:**
- 1,000 events/day → ~45 MB after 90 days
- 10,000 events/day → ~450 MB after 90 days
- 100,000 events/day → ~4.5 GB after 90 days

## Monitoring

### Check Current Status

```bash
# Get statistics
curl http://localhost:8006/stats | jq

# Check how many events would be deleted
curl -X POST "http://localhost:8006/cleanup?dry_run=true" | jq
```

### Monitor Cleanup Logs

```bash
# View observability service logs
docker-compose logs -f observability-service

# Look for cleanup messages:
# "Auto-cleanup: Deleted X events older than Y days"
```

## Manual Database Queries

### Check events older than retention

```sql
-- Connect to database
psql -h localhost -p 5437 -U eval_user -d observability_db

-- Count events older than 90 days
SELECT COUNT(*) 
FROM user_events 
WHERE timestamp < NOW() - INTERVAL '90 days';

-- See oldest events
SELECT timestamp, event_type, COUNT(*) 
FROM user_events 
GROUP BY timestamp, event_type 
ORDER BY timestamp ASC 
LIMIT 10;

-- Check database size
SELECT 
    pg_size_pretty(pg_total_relation_size('user_events')) as table_size,
    COUNT(*) as total_events
FROM user_events;
```

## Best Practices

1. **Monitor Database Size**: Regularly check `/stats` endpoint
2. **Adjust Retention**: Start with 90 days, adjust based on:
   - Storage capacity
   - Analytics needs
   - Compliance requirements
3. **Export Important Data**: Before cleanup, export events needed for:
   - Compliance/audit
   - Long-term analytics
   - ML training data
4. **Test Cleanup**: Use `dry_run=true` before manual cleanup
5. **Set Alerts**: Monitor for:
   - Database size approaching limits
   - Cleanup failures
   - Unusual event volumes

## Exporting Data Before Cleanup

If you need to preserve data before cleanup:

```python
# Example: Export events to CSV
import csv
from datetime import datetime
import requests

# Get events to be deleted
cutoff_date = datetime.utcnow() - timedelta(days=90)
events = requests.get(
    f"http://localhost:8006/events",
    params={"start_date": cutoff_date.isoformat()}
).json()

# Export to CSV
with open('exported_events.csv', 'w') as f:
    writer = csv.DictWriter(f, fieldnames=['id', 'user_id', 'event_type', 'timestamp', 'event_metadata'])
    writer.writeheader()
    for event in events:
        writer.writerow(event)
```

## Troubleshooting

### Cleanup Not Running

1. Check if auto-cleanup is enabled:
   ```bash
   curl http://localhost:8006/stats | jq .auto_cleanup_enabled
   ```

2. Check service logs:
   ```bash
   docker-compose logs observability-service | grep cleanup
   ```

3. Manually trigger cleanup:
   ```bash
   curl -X POST "http://localhost:8006/cleanup"
   ```

### Database Still Growing

1. Verify cleanup is running (check logs)
2. Check retention period is appropriate
3. Consider reducing retention period
4. Check for unusually high event volume

### Performance Issues

1. Add indexes (already present on `timestamp`, `user_id`, `session_id`)
2. Consider partitioning by date (advanced)
3. Archive old data instead of deleting
4. Increase cleanup frequency

## API Endpoints

### POST `/cleanup`
Manually trigger cleanup.

**Parameters:**
- `days` (optional): Retention period in days (default: from config)
- `dry_run` (optional): If true, only count without deleting

**Response:**
```json
{
  "status": "success",
  "deleted_count": 1234,
  "cutoff_date": "2024-01-01T00:00:00",
  "retention_days": 90
}
```

### GET `/stats`
Get database statistics and cleanup status.

**Response:**
```json
{
  "total_events": 50000,
  "total_sessions": 1000,
  "oldest_event": "2024-01-01T00:00:00",
  "newest_event": "2024-04-01T00:00:00",
  "events_by_category": {
    "navigation": 20000,
    "authentication": 5000
  },
  "retention_days": 90,
  "events_older_than_retention": 1000,
  "estimated_size_mb": 25.0,
  "auto_cleanup_enabled": true,
  "cleanup_interval_hours": 24
}
```

