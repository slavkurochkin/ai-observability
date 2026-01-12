"""Core observability client implementation."""

import asyncio
import logging
from typing import Optional, Dict, Any
from datetime import datetime

import httpx
from pydantic import BaseModel

from .config import ObservabilityConfig, get_config

logger = logging.getLogger(__name__)


class ObservabilityClient:
    """Async HTTP client for the observability service.

    This client handles all communication with the observability service,
    including automatic retries, health checks, and graceful degradation.

    Attributes:
        config: Configuration for the client
        _http_client: Internal httpx client for making requests
        _service_healthy: Flag indicating if service is available
    """

    def __init__(self, config: Optional[ObservabilityConfig] = None):
        """Initialize the observability client.

        Args:
            config: Optional configuration. If not provided, uses global config.
        """
        self.config = config or get_config()
        self._http_client: Optional[httpx.AsyncClient] = None
        self._service_healthy = True

        if self.config.dev_mode:
            logging.basicConfig(level=logging.DEBUG)
            logger.debug("Observability client initialized in dev mode")

    async def __aenter__(self) -> "ObservabilityClient":
        """Async context manager entry."""
        await self._ensure_client()
        await self.check_health()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        await self.close()

    async def _ensure_client(self) -> None:
        """Ensure the HTTP client is initialized."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                timeout=self.config.timeout,
                follow_redirects=True,
            )

    async def close(self) -> None:
        """Close the HTTP client and cleanup resources."""
        if self._http_client is not None:
            await self._http_client.aclose()
            self._http_client = None

    async def check_health(self) -> bool:
        """Check if the observability service is available.

        Returns:
            True if service is healthy, False otherwise
        """
        if self.config.test_mode:
            return True

        try:
            await self._ensure_client()
            response = await self._http_client.get(f"{self.config.service_url}/health")
            self._service_healthy = response.status_code == 200

            if self.config.dev_mode:
                logger.debug(f"Health check: {'healthy' if self._service_healthy else 'unhealthy'}")

            return self._service_healthy
        except Exception as e:
            self._service_healthy = False
            if self.config.dev_mode:
                logger.warning(f"Health check failed: {e}")
            return False

    async def _send_request(
        self,
        endpoint: str,
        data: Dict[str, Any],
        retry_count: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """Send a request to the observability service with retry logic.

        Args:
            endpoint: API endpoint (e.g., '/events')
            data: Data to send in the request body
            retry_count: Current retry attempt number

        Returns:
            Response data as dict if successful, None otherwise
        """
        if self.config.test_mode:
            if self.config.dev_mode:
                logger.debug(f"Test mode: Would send to {endpoint}: {data}")
            return {"status": "test_mode", "data": data}

        if not self._service_healthy and retry_count == 0:
            # Skip first attempt if service is known to be unhealthy
            if self.config.dev_mode:
                logger.warning("Service unhealthy, skipping request")
            return None

        try:
            await self._ensure_client()
            url = f"{self.config.service_url}{endpoint}"

            if self.config.dev_mode:
                logger.debug(f"Sending request to {url}: {data}")

            response = await self._http_client.post(url, json=data)
            response.raise_for_status()

            self._service_healthy = True
            return response.json()

        except httpx.HTTPError as e:
            self._service_healthy = False

            if retry_count < self.config.max_retries:
                # Exponential backoff
                wait_time = (self.config.retry_backoff ** retry_count)
                if self.config.dev_mode:
                    logger.warning(f"Request failed, retrying in {wait_time}s: {e}")

                await asyncio.sleep(wait_time)
                return await self._send_request(endpoint, data, retry_count + 1)
            else:
                if self.config.dev_mode:
                    logger.error(f"Request failed after {self.config.max_retries} retries: {e}")
                return None

        except Exception as e:
            if self.config.dev_mode:
                logger.error(f"Unexpected error sending request: {e}")
            return None

    async def track_event(
        self,
        event_type: str,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        category: str = "user_action",
    ) -> Optional[Dict[str, Any]]:
        """Track a user event.

        Args:
            event_type: Type of event (e.g., 'user_action', 'page_view')
            user_id: ID of the user performing the action
            session_id: Session ID
            metadata: Additional event metadata
            category: Event category (default: 'user_action')

        Returns:
            Response data if successful, None otherwise
        """
        data = {
            "event_type": event_type,
            "service_name": self.config.service_name,
            "event_metadata": metadata or {},
            "category": category,
        }

        if user_id is not None:
            data["user_id"] = user_id

        if session_id is not None:
            data["session_id"] = session_id

        return await self._send_request("/events", data)

    async def track_service_error(
        self,
        error_type: str,
        error_message: str,
        stack_trace: Optional[str] = None,
        request_path: Optional[str] = None,
        request_method: Optional[str] = None,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Track a service error.

        Args:
            error_type: Type of error (e.g., exception class name)
            error_message: Error message
            stack_trace: Full stack trace
            request_path: Request path where error occurred
            request_method: HTTP method (GET, POST, etc.)
            user_id: ID of the user (if applicable)
            session_id: Session ID (if applicable)
            metadata: Additional error metadata

        Returns:
            Response data if successful, None otherwise
        """
        data = {
            "error_type": error_type,
            "error_message": error_message,
            "service_name": self.config.service_name,
            "stack_trace": stack_trace,
            "request_path": request_path,
            "request_method": request_method,
            "error_metadata": metadata or {},
        }

        if user_id is not None:
            data["user_id"] = user_id

        if session_id is not None:
            data["session_id"] = session_id

        return await self._send_request("/service-errors", data)


# Global client instance
_client: Optional[ObservabilityClient] = None


async def get_client() -> ObservabilityClient:
    """Get or create the global client instance.

    Returns:
        The global ObservabilityClient instance
    """
    global _client
    if _client is None:
        _client = ObservabilityClient()
        await _client._ensure_client()
    return _client


def reset_client() -> None:
    """Reset the global client instance."""
    global _client
    if _client is not None:
        # Note: Cannot await here, caller should handle cleanup
        _client = None
