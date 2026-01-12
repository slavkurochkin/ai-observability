"""Observability client for Python applications."""

from .client import ObservabilityClient, get_client, reset_client
from .config import ObservabilityConfig, get_config, set_config, reset_config
from .tracking import track_event, track_service_error
from .decorators import track_event as track_event_decorator
from .decorators import track_error

__version__ = "1.0.0"

__all__ = [
    # Client
    "ObservabilityClient",
    "get_client",
    "reset_client",
    # Config
    "ObservabilityConfig",
    "get_config",
    "set_config",
    "reset_config",
    # Tracking
    "track_event",
    "track_service_error",
    # Decorators
    "track_event_decorator",
    "track_error",
]


def init_observability(
    service_url: str = None,
    service_name: str = None,
    timeout: float = 10.0,
    max_retries: int = 3,
    dev_mode: bool = False,
    test_mode: bool = False,
) -> None:
    """Initialize the observability client with configuration.

    This is a convenience function that sets up the global configuration
    and client instance.

    Args:
        service_url: URL of the observability service (default: http://localhost:8006)
        service_name: Name of the service using the client
        timeout: Request timeout in seconds (default: 10)
        max_retries: Maximum number of retry attempts (default: 3)
        dev_mode: Enable development mode with verbose logging (default: False)
        test_mode: Enable test mode (disables actual API calls) (default: False)

    Example:
        ```python
        from observability_client import init_observability

        init_observability(
            service_url="http://localhost:8006",
            service_name="my-service",
            dev_mode=True
        )
        ```
    """
    config = ObservabilityConfig(
        service_url=service_url or "http://localhost:8006",
        service_name=service_name or "python-service",
        timeout=timeout,
        max_retries=max_retries,
        dev_mode=dev_mode,
        test_mode=test_mode,
    )
    set_config(config)
