# Observability Client for Python

A Python client library for integrating with the AI Observability service. Track events, errors, and monitor your Python applications with minimal setup.

## Features

- **Easy Integration**: Simple installation and minimal configuration
- **Framework Support**: Built-in middleware for FastAPI, Flask, and Django
- **Async/Await**: Full async support for modern Python applications
- **Automatic Tracking**: Middleware for automatic request and error tracking
- **Decorators**: Track events and errors with simple decorators
- **Smart Defaults**: Auto-detect user IDs, session IDs from common patterns
- **Retry Logic**: Automatic retries with exponential backoff
- **Graceful Degradation**: Continues working even when service is unavailable
- **Dev Mode**: Detailed logging for development and debugging
- **Test Mode**: Mock tracking for unit tests

## Installation

```bash
# Basic installation
pip install observability-client

# With FastAPI support
pip install observability-client[fastapi]

# With Flask support
pip install observability-client[flask]

# With Django support
pip install observability-client[django]

# Install all extras
pip install observability-client[fastapi,flask,django]

# Development installation
pip install observability-client[dev]
```

## Quick Start

### Basic Usage

```python
from observability_client import init_observability, track_event

# Initialize (optional - uses sensible defaults)
init_observability(
    service_url="http://localhost:8006",  # Default
    service_name="my-python-service"
)

# Track events
await track_event(
    event_type="user_login",
    user_id=123,
    metadata={"method": "email"}
)
```

### FastAPI Integration

```python
from fastapi import FastAPI
from observability_client.middleware.fastapi import ObservabilityMiddleware

app = FastAPI()

# Add middleware for automatic tracking
app.add_middleware(ObservabilityMiddleware)

@app.get("/api/users")
async def get_users():
    return {"users": []}
```

### Flask Integration

```python
from flask import Flask
from observability_client.middleware.flask import ObservabilityMiddleware

app = Flask(__name__)

# Add middleware
ObservabilityMiddleware(app)

@app.route("/api/users")
def get_users():
    return {"users": []}
```

### Django Integration

```python
# In settings.py
MIDDLEWARE = [
    # ... other middleware
    'observability_client.middleware.django.ObservabilityMiddleware',
]
```

## API Reference

### Initialization

#### `init_observability()`

Initialize the observability client with configuration.

```python
from observability_client import init_observability

init_observability(
    service_url="http://localhost:8006",  # Observability service URL
    service_name="my-service",            # Your service name
    timeout=10.0,                         # Request timeout (seconds)
    max_retries=3,                        # Max retry attempts
    dev_mode=False,                       # Enable debug logging
    test_mode=False                       # Enable test mode
)
```

**Environment Variables:**
- `OBSERVABILITY_SERVICE_URL`: Service URL (default: http://localhost:8006)
- `OBSERVABILITY_SERVICE_NAME`: Service name (default: python-service)
- `OBSERVABILITY_DEV_MODE`: Enable dev mode (set to "true")

### Tracking Functions

#### `track_event()`

Track a user event.

```python
from observability_client import track_event

await track_event(
    event_type="button_click",         # Required
    user_id=123,                       # Optional
    session_id="session_abc",          # Optional
    metadata={"button": "submit"},     # Optional
    category="user_action"             # Optional, default: "user_action"
)
```

#### `track_service_error()`

Track a service error.

```python
from observability_client import track_service_error

try:
    risky_operation()
except Exception as e:
    await track_service_error(
        error_type=type(e).__name__,
        error_message=str(e),
        stack_trace=traceback.format_exc(),
        request_path="/api/endpoint",      # Optional
        request_method="POST",             # Optional
        user_id=123,                       # Optional
        session_id="session_abc",          # Optional
        metadata={"additional": "info"}    # Optional
    )
```

### Decorators

#### `@track_event`

Automatically track function calls as events.

```python
from observability_client.decorators import track_event

@track_event(
    "item_created",
    category="user_action",
    extract_metadata=lambda item, **kw: {"type": item.get("type")},
    extract_user_id=lambda user_id, **kw: user_id
)
async def create_item(item: dict, user_id: int):
    # Function implementation
    return item
```

#### `@track_error`

Automatically track exceptions.

```python
from observability_client.decorators import track_error

@track_error(
    extract_metadata=lambda **kw: {"operation": "critical"},
    reraise=True  # Re-raise exception after tracking
)
async def risky_operation(data: dict):
    # Function that might fail
    pass
```

### Middleware

All middleware automatically:
- Tracks requests with duration
- Tracks errors with stack traces
- Extracts user_id and session_id from common patterns
- Works asynchronously without blocking

#### FastAPI Middleware

```python
from fastapi import FastAPI
from observability_client.middleware.fastapi import ObservabilityMiddleware

app = FastAPI()
app.add_middleware(
    ObservabilityMiddleware,
    track_requests=True,  # Track all requests
    track_errors=True     # Track all errors
)
```

#### Flask Middleware

```python
from flask import Flask
from observability_client.middleware.flask import ObservabilityMiddleware

app = Flask(__name__)
middleware = ObservabilityMiddleware(
    app,
    track_requests=True,
    track_errors=True
)
```

#### Django Middleware

```python
# In settings.py
MIDDLEWARE = [
    'observability_client.middleware.django.ObservabilityMiddleware',
]

# Middleware automatically tracks all requests and errors
```

### Client API

For advanced usage, you can use the client directly:

```python
from observability_client import ObservabilityClient, ObservabilityConfig

# Create client with custom config
config = ObservabilityConfig(
    service_url="http://localhost:8006",
    service_name="my-service"
)

async with ObservabilityClient(config) as client:
    # Check service health
    is_healthy = await client.check_health()

    # Track events
    await client.track_event(
        event_type="custom_event",
        metadata={"key": "value"}
    )

    # Track errors
    await client.track_service_error(
        error_type="CustomError",
        error_message="Something went wrong"
    )
```

## Examples

### FastAPI Example

```python
from fastapi import FastAPI, HTTPException
from observability_client import init_observability, track_event
from observability_client.middleware.fastapi import ObservabilityMiddleware
from observability_client.decorators import track_event as track_event_decorator

# Initialize
init_observability(service_name="fastapi-app")

app = FastAPI()
app.add_middleware(ObservabilityMiddleware)

@track_event_decorator(
    "item_created",
    extract_metadata=lambda item, **kw: {"name": item.get("name")}
)
async def create_item_in_db(item: dict):
    # Database operation
    return {"id": 1, **item}

@app.post("/items")
async def create_item(item: dict):
    result = await create_item_in_db(item)
    return result
```

### Flask Example

```python
from flask import Flask, request
from observability_client import init_observability, track_event
from observability_client.middleware.flask import ObservabilityMiddleware
import asyncio

init_observability(service_name="flask-app")

app = Flask(__name__)
ObservabilityMiddleware(app)

@app.route("/items", methods=["POST"])
def create_item():
    data = request.get_json()

    # Track custom event
    asyncio.create_task(
        track_event(
            "item_created",
            metadata={"name": data.get("name")}
        )
    )

    return {"id": 1, **data}
```

### Django Example

```python
# In settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'observability_client.middleware.django.ObservabilityMiddleware',
    # ... other middleware
]

# In views.py
from django.http import JsonResponse
from observability_client import track_event
import asyncio

def create_item(request):
    # Track custom event
    asyncio.create_task(
        track_event(
            "item_created",
            user_id=request.user.id if request.user.is_authenticated else None,
            metadata={"source": "web"}
        )
    )

    return JsonResponse({"status": "created"})
```

### Error Tracking

```python
import traceback
from observability_client import track_service_error

try:
    # Risky operation
    result = process_payment(amount=100)
except Exception as e:
    await track_service_error(
        error_type=type(e).__name__,
        error_message=str(e),
        stack_trace=traceback.format_exc(),
        request_path="/api/payment",
        metadata={
            "amount": 100,
            "user_id": 123
        }
    )
    raise
```

### Context Extraction

The middleware automatically extracts context from requests:

```python
from observability_client.utils import get_request_context, extract_user_id

# In your request handler
context = get_request_context(request)
# Returns: {
#     "request_path": "/api/users",
#     "request_method": "GET",
#     "user_id": 123,  # Auto-detected
#     "session_id": "abc123"  # Auto-detected
# }

# Extract user ID from various sources
user_id = extract_user_id(request)
# Checks: request.user.id, request.state.user_id, session, cookies
```

## Configuration

### Using Environment Variables

```bash
export OBSERVABILITY_SERVICE_URL=http://localhost:8006
export OBSERVABILITY_SERVICE_NAME=my-service
export OBSERVABILITY_DEV_MODE=true
```

```python
from observability_client import init_observability

# Will use environment variables
init_observability()
```

### Using Configuration Object

```python
from observability_client import ObservabilityConfig, set_config

config = ObservabilityConfig(
    service_url="http://localhost:8006",
    service_name="my-service",
    timeout=15.0,
    max_retries=5,
    retry_backoff=2.0,
    dev_mode=True,
    test_mode=False
)

set_config(config)
```

## Testing

### Test Mode

Enable test mode to prevent actual API calls during testing:

```python
from observability_client import init_observability

init_observability(test_mode=True)

# All tracking calls will be mocked
await track_event("test_event")  # Returns mock response
```

### Pytest Example

```python
import pytest
from observability_client import init_observability, reset_client

@pytest.fixture(autouse=True)
def setup_test_observability():
    init_observability(test_mode=True)
    yield
    reset_client()

async def test_my_function():
    # Your test code
    # Observability calls will be mocked
    pass
```

## Development

### Running Tests

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run all tests
pytest

# Run with coverage
pytest --cov=observability_client --cov-report=html

# Run specific test file
pytest tests/test_client.py
```

### Code Quality

```bash
# Format code
black observability_client tests

# Lint code
ruff check observability_client

# Type checking
mypy observability_client
```

## Troubleshooting

### Service Unavailable

If the observability service is not running:

```bash
# Start the Docker service
cd /path/to/ai-observability
docker-compose up -d observability-service observability-db

# Check service health
curl http://localhost:8006/health
```

The client will:
- Queue events locally (in memory)
- Automatically retry with exponential backoff
- Log warnings in dev mode
- Continue working without blocking your application

### Debug Mode

Enable dev mode for detailed logging:

```python
init_observability(dev_mode=True)
```

This will print:
- Health check results
- Request/response details
- Retry attempts
- Error messages

### Common Issues

**Issue: Events not appearing**
- Check service is running: `curl http://localhost:8006/health`
- Enable dev mode to see detailed logs
- Verify service_url configuration

**Issue: Slow requests**
- Reduce timeout: `init_observability(timeout=5.0)`
- Reduce max retries: `init_observability(max_retries=1)`
- Check network latency to service

**Issue: Module import errors**
- Install framework extras: `pip install observability-client[fastapi]`
- Check Python version (requires 3.8+)

## Requirements

- Python 3.8+
- httpx >= 0.24.0
- pydantic >= 2.0.0

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md for guidelines.

## Support

- Documentation: https://github.com/your-org/ai-observability
- Issues: https://github.com/your-org/ai-observability/issues
- Email: support@example.com
