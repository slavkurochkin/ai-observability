"""Flask middleware for observability."""

import traceback
import time
import asyncio
from functools import wraps
from typing import Optional, Callable

from flask import Flask, request, g
from werkzeug.exceptions import HTTPException

from ..client import get_client
from ..config import get_config
from ..utils.context import get_request_context


class ObservabilityMiddleware:
    """Flask middleware for automatic request and error tracking.

    This middleware automatically tracks:
    - All requests (optional)
    - All errors/exceptions
    - Request duration

    Example:
        ```python
        from flask import Flask
        from observability_client.middleware.flask import ObservabilityMiddleware

        app = Flask(__name__)
        ObservabilityMiddleware(app)
        ```

    Attributes:
        app: The Flask application
        track_requests: Whether to track all requests (default: True)
        track_errors: Whether to track all errors (default: True)
    """

    def __init__(
        self,
        app: Optional[Flask] = None,
        track_requests: bool = True,
        track_errors: bool = True,
    ):
        """Initialize the middleware.

        Args:
            app: The Flask application (optional, can use init_app later)
            track_requests: Whether to track all requests (default: True)
            track_errors: Whether to track all errors (default: True)
        """
        self.track_requests = track_requests
        self.track_errors = track_errors

        if app is not None:
            self.init_app(app)

    def init_app(self, app: Flask) -> None:
        """Initialize the middleware with a Flask app.

        Args:
            app: The Flask application
        """
        app.before_request(self._before_request)
        app.after_request(self._after_request)

        if self.track_errors:
            app.errorhandler(Exception)(self._handle_error)

    def _before_request(self) -> None:
        """Hook called before each request."""
        g.observability_start_time = time.time()

    def _after_request(self, response):
        """Hook called after each request.

        Args:
            response: The Flask response object

        Returns:
            The response object (unmodified)
        """
        if self.track_requests and hasattr(g, "observability_start_time"):
            duration = time.time() - g.observability_start_time
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

    def _handle_error(self, error: Exception):
        """Handle errors and track them.

        Args:
            error: The exception that occurred

        Returns:
            The error response (allows Flask to continue handling)
        """
        if hasattr(g, "observability_start_time"):
            duration = time.time() - g.observability_start_time
        else:
            duration = 0.0

        context = get_request_context(request)

        # Run async tracking in background
        asyncio.create_task(
            self._track_error(
                error=error,
                context=context,
                duration=duration,
            )
        )

        # Re-raise to allow Flask's error handlers to work
        raise error

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
            # Don't track standard HTTP exceptions as errors
            if isinstance(error, HTTPException) and error.code < 500:
                return

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
