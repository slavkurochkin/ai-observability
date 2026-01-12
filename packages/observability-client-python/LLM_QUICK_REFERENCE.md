# Quick Reference for LLM: observability-client (Python)

## Package Setup

**Package**: `observability-client`
**Install**: `pip install observability-client` (add `[fastapi]`, `[flask]`, or `[django]` as needed)
**Default Service**: `http://localhost:8006`
**Import**: `from observability_client import init_observability, track_event`

## Required Init Code

**Location**: Main app entry point (e.g., `main.py`, `app.py`, `wsgi.py`)

```python
from observability_client import init_observability
import os

# Init ONCE at startup
init_observability(
    service_url=os.environ.get("OBSERVABILITY_SERVICE_URL", "http://localhost:8006"),
    service_name="my-service",
    dev_mode=os.environ.get("OBSERVABILITY_DEV_MODE") == "true"
)
```

## Framework Middleware (Quick Copy-Paste)

### FastAPI
```python
from fastapi import FastAPI
from observability_client.middleware.fastapi import ObservabilityMiddleware

app = FastAPI()
app.add_middleware(ObservabilityMiddleware, track_requests=True, track_errors=True)
```

### Flask
```python
from flask import Flask
from observability_client.middleware.flask import ObservabilityMiddleware

app = Flask(__name__)
ObservabilityMiddleware(app, track_requests=True, track_errors=True)
```

### Django
```python
# settings.py -> MIDDLEWARE
'observability_client.middleware.django.ObservabilityMiddleware',
```

## Usage Patterns

**Decorator (Recommended for specific logic):**
```python
from observability_client.decorators import track_event, track_error

@track_event("process_started")
@track_error()
async def my_process(data):
    # automatic tracking of start, success, and error
    pass
```

**Manual Async Tracking:**
```python
from observability_client import track_event

# Must be awaited
await track_event(
    "custom_event",
    user_id="u123",
    metadata={"key": "value"}
)
```

**Manual Error Tracking:**
```python
from observability_client import track_service_error
import traceback

try:
    risky_func()
except Exception as e:
    await track_service_error(
        error_type=type(e).__name__,
        error_message=str(e),
        stack_trace=traceback.format_exc()
    )
```

## Key Rules

1. **Async**: `track_event` is async. Use `await` or `asyncio.create_task()` if fire-and-forget.
2. **Middleware**: Catches all unhandled exceptions automatically.
3. **Environment**: Set `OBSERVABILITY_SERVICE_URL` if not `localhost:8006`.
4. **Imports**: Base package is `observability_client`.
5. **Extras**: Install `observability-client[fastapi]` for FastAPI support.
