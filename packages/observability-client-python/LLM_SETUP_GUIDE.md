# LLM Setup Guide: observability-client (Python)

Use this guide to help set up the `observability-client` package in a Python project.

## Package Information

- **Package Name**: `observability-client`
- **Type**: Python observability/tracking library
- **Default Service URL**: `http://localhost:8006` (local Docker)
- **Main Exports**: `init_observability`, `track_event`, `track_service_error`, `ObservabilityMiddleware` (FastAPI/Flask/Django), `@track_event`, `@track_error`

## Setup Steps

### Step 1: Install the Package

```bash
# Basic installation
pip install observability-client

# For FastAPI projects
pip install "observability-client[fastapi]"

# For Flask projects
pip install "observability-client[flask]"

# For Django projects
pip install "observability-client[django]"
```

### Step 2: Initialize in Main Entry Point

**Global Initialization (Recommended):**
Call `init_observability` at the start of your application startup.

```python
from observability_client import init_observability
import os

# Initialize ONCE at startup
init_observability(
    service_url=os.environ.get("OBSERVABILITY_SERVICE_URL", "http://localhost:8006"),
    service_name="my-python-service",
    dev_mode=os.environ.get("OBSERVABILITY_DEV_MODE") == "true",
)
```

### Step 3: Configure Middleware (Web Frameworks)

#### FastAPI
```python
from fastapi import FastAPI
from observability_client.middleware.fastapi import ObservabilityMiddleware

app = FastAPI()

# Add middleware at the TOP level
app.add_middleware(
    ObservabilityMiddleware,
    track_requests=True,
    track_errors=True
)
```

#### Flask
```python
from flask import Flask
from observability_client.middleware.flask import ObservabilityMiddleware

app = Flask(__name__)

# Initialize middleware
ObservabilityMiddleware(
    app,
    track_requests=True,
    track_errors=True
)
```

#### Django
```python
# settings.py
MIDDLEWARE = [
    # ... security middleware ...
    'observability_client.middleware.django.ObservabilityMiddleware',
    # ... other middleware ...
]
```

### Step 4: Environment Variables

Create `.env` file or export variables:

```bash
# Observability service URL (default: http://localhost:8006)
OBSERVABILITY_SERVICE_URL=http://localhost:8006

# Enable detailed logging (optional)
OBSERVABILITY_DEV_MODE=true

# Service name (optional, defaults to 'python-service')
OBSERVABILITY_SERVICE_NAME=my-app
```

### Step 5: Usage Examples

**Decorators (Easiest Way):**
```python
from observability_client.decorators import track_event, track_error

# Auto-track successful execution
@track_event(
    "item_created",
    category="business_logic",
    # Extract metadata from return value or args
    extract_metadata=lambda result, **kwargs: {"id": result.get("id")}
)
async def create_item(item_data):
    return db.save(item_data)

# Auto-track exceptions
@track_error(
    extract_metadata=lambda **kwargs: {"critical": True}
)
async def risky_operation():
    # ...
```

**Manual Tracking:**
```python
from observability_client import track_event, track_service_error

# Track an event
await track_event(
    event_type="user_login",
    user_id="user_123",
    metadata={"method": "oauth"}
)

# Track an error manually
try:
    process_data()
except Exception as e:
    await track_service_error(
        error_type=type(e).__name__,
        error_message=str(e),
        request_path="/api/data"
    )
    raise  # Re-raise if needed
```

## Key Points for LLM

1. **Async by Default**: The client is designed for async/await. `track_event` and `track_service_error` are async functions.
2. **Middleware handles most things**: Middleware automatically tracks request duration, paths, status codes, and unhandled exceptions.
3. **Service URL**: Defaults to `http://localhost:8006`.
4. **Graceful Degradation**: If the service is down, the client will retry locally and then drop events. It will NOT crash the main application.
5. **Decorators**: Use `@track_event` and `@track_error` to keep business logic clean.
6. **Initialization**: Should happen once at app startup.
7. **Queuing**: Events are queued in memory and sent in background tasks (or thread pool).

## Troubleshooting Checklist

- [ ] Package installed with correct extras (e.g., `observability-client[fastapi]`)
- [ ] `init_observability` called at startup
- [ ] Middleware added to framework
- [ ] Service URL reachable (`curl http://localhost:8006/health`)
- [ ] If using Docker, ensure `localhost` refers to the host or correct service name
- [ ] Check logs if `dev_mode=True` is enabled
