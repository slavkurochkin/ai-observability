"""Pytest configuration and fixtures."""

import pytest
from unittest.mock import AsyncMock, MagicMock
import httpx

from observability_client import ObservabilityClient, ObservabilityConfig, reset_client, reset_config


@pytest.fixture
def test_config():
    """Create a test configuration."""
    return ObservabilityConfig(
        service_url="http://localhost:8006",
        service_name="test-service",
        timeout=5.0,
        max_retries=2,
        test_mode=True,
    )


@pytest.fixture
async def client(test_config):
    """Create a test client instance."""
    client = ObservabilityClient(test_config)
    await client._ensure_client()
    yield client
    await client.close()


@pytest.fixture
async def mock_http_client():
    """Create a mock HTTP client."""
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "success"}
    mock_client.post.return_value = mock_response
    mock_client.get.return_value = mock_response
    return mock_client


@pytest.fixture(autouse=True)
def reset_global_state():
    """Reset global state before each test."""
    reset_client()
    reset_config()
    yield
    reset_client()
    reset_config()
