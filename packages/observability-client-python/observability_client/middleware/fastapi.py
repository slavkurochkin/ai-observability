"""FastAPI middleware for observability."""

import traceback
import time
from typing import Callable
import asyncio

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..client import get_client
from ..config import get_config
from ..utils.context import get_request_context


class ObservabilityMiddleware(BaseHTTPMiddleware):
    """FastAPI/Starlette middleware for automatic request and error tracking.

    This middleware automatically tracks:
    - All requests (optional)
    - All errors/exceptions
    - Request duration

    Example:
        ```python
        from fastapi import FastAPI
        from observability_client.middleware.fastapi import ObservabilityMiddleware

        app = FastAPI()
        app.add_middleware(ObservabilityMiddleware)
        ```

    Attributes:
        track_requests: Whether to track all requests (default: True)
        track_errors: Whether to track all errors (default: True)
    """

    def __init__(
        self,
        app: Callable,
        track_requests: bool = True,
        track_errors: bool = True,
    ):
        """Initialize the middleware.

        Args:
            app: The FastAPI/Starlette application
            track_requests: Whether to track all requests (default: True)
            track_errors: Whether to track all errors (default: True)
        """
        super().__init__(app)
        self.track_requests = track_requests
        self.track_errors = track_errors
        self._client_task: asyncio.Task = None

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process the request and track observability events.

        Args:
            request: The incoming request
            call_next: Function to call the next middleware/handler

        Returns:
            The response from the application
        """
        start_time = time.time()
        
        # Safely extract context - don't let context extraction break the request
        try:
            context = get_request_context(request)
        except Exception as e:
            # If context extraction fails, use empty context and log in dev mode
            config = get_config()
            if config.dev_mode:
                print(f"Failed to extract request context: {e}")
            context = {}

        try:
            response = await call_next(request)

            # Track successful request
            if self.track_requests:
                duration = time.time() - start_time
                asyncio.create_task(self._track_request(context, response.status_code, duration))

            return response

        except Exception as e:
            duration = time.time() - start_time

            # Track error
            if self.track_errors:
                asyncio.create_task(
                    self._track_error(
                        error=e,
                        context=context,
                        duration=duration,
                    )
                )

            # Re-raise the exception
            raise

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
