"""Example Django views with observability.

Add this to your Django app's views.py.

Also add to settings.py:
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'observability_client.middleware.django.ObservabilityMiddleware',
    # ... other middleware
]
"""

import asyncio
import traceback
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from observability_client import init_observability, track_event, track_service_error

# Initialize in your Django app's __init__.py or settings.py
# init_observability(
#     service_url="http://localhost:8006",
#     service_name="django-example",
#     dev_mode=True,
# )


def root(request):
    """Root endpoint."""
    return JsonResponse({"message": "Django Observability Example"})


@csrf_exempt
@require_http_methods(["POST"])
def create_item(request):
    """Create a new item with manual tracking."""
    import json

    try:
        data = json.loads(request.body)

        # Simulate database operation
        result = {"id": 1, **data}

        # Manual event tracking
        # Extract user_id if authenticated
        user_id = request.user.id if request.user.is_authenticated else None

        asyncio.create_task(
            track_event(
                "item_created",
                user_id=user_id,
                metadata={"name": data.get("name")},
                category="business_event",
            )
        )

        return JsonResponse(result, status=201)

    except json.JSONDecodeError as e:
        return JsonResponse({"error": "Invalid JSON"}, status=400)


@require_http_methods(["GET"])
def get_item(request, item_id):
    """Get item with error handling."""
    try:
        if item_id < 0:
            raise ValueError("Item ID must be positive")

        return JsonResponse({"id": item_id, "name": f"Item {item_id}"})

    except ValueError as e:
        # Manual error tracking
        user_id = request.user.id if request.user.is_authenticated else None

        asyncio.create_task(
            track_service_error(
                error_type=type(e).__name__,
                error_message=str(e),
                stack_trace=traceback.format_exc(),
                request_path=request.path,
                request_method=request.method,
                user_id=user_id,
            )
        )

        return JsonResponse({"error": str(e)}, status=400)


def health(request):
    """Health check endpoint."""
    return JsonResponse({"status": "healthy"})


# URL patterns (add to urls.py):
"""
from django.urls import path
from . import views

urlpatterns = [
    path('', views.root),
    path('items/', views.create_item),
    path('items/<int:item_id>/', views.get_item),
    path('health/', views.health),
]
"""
