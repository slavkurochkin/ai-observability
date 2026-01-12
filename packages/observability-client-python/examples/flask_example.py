"""Example Flask application with observability."""

import asyncio
import traceback
from flask import Flask, request, jsonify
from observability_client import init_observability, track_event, track_service_error
from observability_client.middleware.flask import ObservabilityMiddleware

# Initialize observability
init_observability(
    service_url="http://localhost:8006",
    service_name="flask-example",
    dev_mode=True,
)

app = Flask(__name__)

# Add middleware for automatic tracking
middleware = ObservabilityMiddleware(
    app,
    track_requests=True,
    track_errors=True,
)


def create_item_in_db(item_data: dict) -> dict:
    """Simulate database operation."""
    return {"id": 1, **item_data}


@app.route("/")
def root():
    """Root endpoint."""
    return jsonify({"message": "Flask Observability Example"})


@app.route("/items", methods=["POST"])
def create_item():
    """Create a new item with manual tracking."""
    data = request.get_json()

    # Simulate database operation
    result = create_item_in_db(data)

    # Manual event tracking
    asyncio.create_task(
        track_event(
            "item_created",
            metadata={"name": data.get("name")},
            category="business_event",
        )
    )

    return jsonify(result), 201


@app.route("/items/<int:item_id>", methods=["GET"])
def get_item(item_id):
    """Get item with error handling."""
    try:
        if item_id < 0:
            raise ValueError("Item ID must be positive")

        return jsonify({"id": item_id, "name": f"Item {item_id}"})

    except ValueError as e:
        # Manual error tracking
        asyncio.create_task(
            track_service_error(
                error_type=type(e).__name__,
                error_message=str(e),
                stack_trace=traceback.format_exc(),
                request_path=request.path,
                request_method=request.method,
            )
        )

        return jsonify({"error": str(e)}), 400


@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy"})


@app.errorhandler(500)
def internal_error(error):
    """Handle internal server errors."""
    # Error is automatically tracked by middleware
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
