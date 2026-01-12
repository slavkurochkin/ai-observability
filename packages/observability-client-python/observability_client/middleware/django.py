"""Django middleware for observability."""

import traceback
import time
import asyncio
from typing import Callable

from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

from ..client import get_client
from ..config import get_config
from ..utils.context import get_request_context


class ObservabilityMiddleware(MiddlewareMixin):
    """Django middleware for automatic request and error tracking.

    This middleware automatically tracks:
    - All requests (optional)
    - All errors/exceptions
    - Request duration

    Example:
        Add to settings.py MIDDLEWARE:
        ```python
        MIDDLEWARE = [
            # ... other middleware
            'observability_client.middleware.django.ObservabilityMiddleware',
        ]
        ```

    Attributes:
        track_requests: Whether to track all requests (default: True)
        track_errors: Whether to track all errors (default: True)
    """

    def __init__(self, get_response: Callable):
        """Initialize the middleware.

        Args:
            get_response: The next middleware or view in the chain
        """
        super().__init__(get_response)
        self.track_requests = True  # Can be configured via Django settings
        self.track_errors = True

    def process_request(self, request: HttpRequest) -> None:
        """Process the request before it reaches the view.

        Args:
            request: The Django HttpRequest object
        """
        request._observability_start_time = time.time()

    def process_response(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        """Process the response after the view.

        Args:
            request: The Django HttpRequest object
            response: The Django HttpResponse object

        Returns:
            The response object (unmodified)
        """
        if self.track_requests and hasattr(request, "_observability_start_time"):
            duration = time.time() - request._observability_start_time
            context = get_request_context(request)

            # Run async tracking in background
            asyncio.create_task(
                self._track_request(
                    context=context,
                    status_code=response.status_code,
                    duration=duration,
                )
            )

        return response

    def process_exception(self, request: HttpRequest, exception: Exception) -> None:
        """Process exceptions that occur during view execution.

        Args:
            request: The Django HttpRequest object
            exception: The exception that occurred
        """
        if self.track_errors:
            if hasattr(request, "_observability_start_time"):
                duration = time.time() - request._observability_start_time
            else:
                duration = 0.0

            context = get_request_context(request)

            # Run async tracking in background
            asyncio.create_task(
                self._track_error(
                    error=exception,
                    context=context,
                    duration=duration,
                )
            )

        # Return None to allow other exception handlers to work
        return None

    async def _track_request(
        self,
        context: dict,
        status_code: int,
        duration: float,
    ) -> None:
        """Track a request event.

        Args:
            context: Request context
            status_code: HTTP status code
            duration: Request duration in seconds
        """
        try:
            client = await get_client()
            await client.track_event(
                event_type="request",
                user_id=context.get("user_id"),
                session_id=context.get("session_id"),
                metadata={
                    "request_path": context.get("request_path"),
                    "request_method": context.get("request_method"),
                    "status_code": status_code,
                    "duration_ms": round(duration * 1000, 2),
                },
                category="api_request",
            )
        except Exception as e:
            config = get_config()
            if config.dev_mode:
                print(f"Failed to track request: {e}")

    async def _track_error(
        self,
        error: Exception,
        context: dict,
        duration: float,
    ) -> None:
        """Track an error event.

        Args:
            error: The exception that occurred
            context: Request context
            duration: Request duration until error in seconds
        """
        try:
            client = await get_client()
            await client.track_service_error(
                error_type=type(error).__name__,
                error_message=str(error),
                stack_trace=traceback.format_exc(),
                request_path=context.get("request_path"),
                request_method=context.get("request_method"),
                user_id=context.get("user_id"),
                session_id=context.get("session_id"),
                metadata={
                    "duration_ms": round(duration * 1000, 2),
                },
            )
        except Exception as e:
            config = get_config()
            if config.dev_mode:
                print(f"Failed to track error: {e}")
