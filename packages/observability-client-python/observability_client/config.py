"""Configuration for the observability client."""

import os
from typing import Optional
from pydantic import BaseModel, Field


class ObservabilityConfig(BaseModel):
    """Configuration for the observability client.

    Attributes:
        service_url: URL of the observability service (default: http://localhost:8006)
        service_name: Name of the service using the client
        timeout: Request timeout in seconds (default: 10)
        max_retries: Maximum number of retry attempts (default: 3)
        retry_backoff: Exponential backoff multiplier for retries (default: 2)
        dev_mode: Enable development mode with verbose logging (default: False)
        test_mode: Enable test mode (disables actual API calls) (default: False)
    """

    service_url: str = Field(
        default_factory=lambda: os.getenv("OBSERVABILITY_SERVICE_URL", "http://localhost:8006")
    )
    service_name: str = Field(
        default_factory=lambda: os.getenv("OBSERVABILITY_SERVICE_NAME", "python-service")
    )
    timeout: float = 10.0
    max_retries: int = 3
    retry_backoff: float = 2.0
    dev_mode: bool = Field(
        default_factory=lambda: os.getenv("OBSERVABILITY_DEV_MODE", "").lower() == "true"
    )
    test_mode: bool = False

    model_config = {
        "frozen": False,
        "arbitrary_types_allowed": True,
    }


# Global configuration instance
_config: Optional[ObservabilityConfig] = None


def get_config() -> ObservabilityConfig:
    """Get the global configuration instance.

    Returns:
        The global ObservabilityConfig instance
    """
    global _config
    if _config is None:
        _config = ObservabilityConfig()
    return _config


def set_config(config: ObservabilityConfig) -> None:
    """Set the global configuration instance.

    Args:
        config: The ObservabilityConfig instance to use globally
    """
    global _config
    _config = config


def reset_config() -> None:
    """Reset the global configuration to defaults."""
    global _config
    _config = ObservabilityConfig()
