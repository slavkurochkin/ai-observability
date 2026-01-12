"""Example FastAPI application with observability."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from observability_client import init_observability, track_event
from observability_client.middleware.fastapi import ObservabilityMiddleware
from observability_client.decorators import track_event as track_event_decorator, track_error

# Initialize observability
init_observability(
    service_url="http://localhost:8006",
    service_name="fastapi-example",
    dev_mode=True,  # Enable logging
)

app = FastAPI(title="Observability Example")

# Add middleware for automatic request/error tracking
app.add_middleware(
    ObservabilityMiddleware,
    track_requests=True,
    track_errors=True,
)


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float


# Decorator for automatic event tracking
@track_event_decorator(
    "item_created",
    category="business_event",
    extract_metadata=lambda item, **kw: {"name": item.name, "price": item.price},
)
async def create_item_in_db(item: Item) -> dict:
    """Simulate database operation."""
    return {"id": 1, "name": item.name, "price": item.price}


# Decorator for automatic error tracking
@track_error(reraise=True)
async def risky_operation(item_id: int) -> dict:
    """Simulate risky operation that might fail."""
    if item_id < 0:
        raise ValueError("Item ID must be positive")
    return {"id": item_id, "status": "processed"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "FastAPI Observability Example"}


@app.post("/items")
async def create_item(item: Item):
    """Create a new item with automatic tracking."""
    # This function call is automatically tracked
    result = await create_item_in_db(item)

    # Manual event tracking
    await track_event(
        "item_api_called",
        metadata={"endpoint": "/items", "method": "POST"},
        category="api_call",
    )

    return result


@app.get("/items/{item_id}")
async def get_item(item_id: int):
    """Get item with error handling."""
    try:
        result = await risky_operation(item_id)
        return result
    except ValueError as e:
        # Error is automatically tracked by @track_error decorator
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
