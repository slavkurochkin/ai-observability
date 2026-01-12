"""Tests for client module."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from observability_client import ObservabilityClient, ObservabilityConfig


@pytest.mark.asyncio
async def test_client_initialization(test_config):
    """Test client initialization."""
    client = ObservabilityClient(test_config)
    assert client.config == test_config
    assert client._http_client is None
    assert client._service_healthy is True


@pytest.mark.asyncio
async def test_client_ensure_client(test_config):
    """Test that _ensure_client creates HTTP client."""
    client = ObservabilityClient(test_config)
    await client._ensure_client()
    assert client._http_client is not None
    assert isinstance(client._http_client, httpx.AsyncClient)
    await client.close()


@pytest.mark.asyncio
async def test_client_context_manager(test_config):
    """Test client as async context manager."""
    async with ObservabilityClient(test_config) as client:
        assert client._http_client is not None


@pytest.mark.asyncio
async def test_client_close(test_config):
    """Test client cleanup."""
    client = ObservabilityClient(test_config)
    await client._ensure_client()
    assert client._http_client is not None

    await client.close()
    assert client._http_client is None


@pytest.mark.asyncio
async def test_check_health_success(test_config):
    """Test health check with successful response."""
    test_config.test_mode = False  # Disable test mode for this test
    client = ObservabilityClient(test_config)
    await client._ensure_client()  # Initialize the client first

    with patch.object(client, "_http_client", new_callable=AsyncMock) as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_client.get.return_value = mock_response

        result = await client.check_health()

        assert result is True
        assert client._service_healthy is True
        mock_client.get.assert_called_once_with("http://localhost:8006/health")

    await client.close()


@pytest.mark.asyncio
async def test_check_health_failure(test_config):
    """Test health check with failed response."""
    test_config.test_mode = False
    client = ObservabilityClient(test_config)

    with patch.object(client, "_http_client", new_callable=AsyncMock) as mock_client:
        mock_client.get.side_effect = httpx.ConnectError("Connection failed")

        result = await client.check_health()

        assert result is False
        assert client._service_healthy is False


@pytest.mark.asyncio
async def test_check_health_test_mode(test_config):
    """Test health check in test mode."""
    test_config.test_mode = True
    client = ObservabilityClient(test_config)

    result = await client.check_health()
    assert result is True


@pytest.mark.asyncio
async def test_track_event(test_config):
    """Test tracking an event."""
    client = ObservabilityClient(test_config)

    result = await client.track_event(
        event_type="test_event",
        user_id=123,
        session_id="session123",
        metadata={"key": "value"},
        category="test_category",
    )

    # In test mode, should return test response
    assert result is not None
    assert result["status"] == "test_mode"
    assert result["data"]["event_type"] == "test_event"
    assert result["data"]["user_id"] == 123
    assert result["data"]["session_id"] == "session123"


@pytest.mark.asyncio
async def test_track_service_error(test_config):
    """Test tracking a service error."""
    client = ObservabilityClient(test_config)

    result = await client.track_service_error(
        error_type="ValueError",
        error_message="Test error",
        stack_trace="Stack trace here",
        request_path="/api/test",
        request_method="POST",
        user_id=123,
        metadata={"additional": "info"},
    )

    # In test mode, should return test response
    assert result is not None
    assert result["status"] == "test_mode"
    assert result["data"]["error_type"] == "ValueError"
    assert result["data"]["error_message"] == "Test error"


@pytest.mark.asyncio
async def test_send_request_with_retry(test_config):
    """Test request retry logic."""
    test_config.test_mode = False
    test_config.max_retries = 2
    test_config.retry_backoff = 0.1  # Fast retries for testing
    client = ObservabilityClient(test_config)

    with patch.object(client, "_http_client", new_callable=AsyncMock) as mock_client:
        # First two calls fail, third succeeds
        mock_response_fail = MagicMock()
        mock_response_fail.raise_for_status.side_effect = httpx.HTTPError("Error")

        mock_response_success = MagicMock()
        mock_response_success.status_code = 200
        mock_response_success.json.return_value = {"status": "success"}

        mock_client.post.side_effect = [
            httpx.HTTPError("Error 1"),
            httpx.HTTPError("Error 2"),
            mock_response_success,
        ]

        result = await client._send_request("/test", {"data": "test"})

        assert result == {"status": "success"}
        assert mock_client.post.call_count == 3


@pytest.mark.asyncio
async def test_send_request_max_retries_exceeded(test_config):
    """Test that request fails after max retries."""
    test_config.test_mode = False
    test_config.max_retries = 2
    test_config.retry_backoff = 0.1
    client = ObservabilityClient(test_config)

    with patch.object(client, "_http_client", new_callable=AsyncMock) as mock_client:
        mock_client.post.side_effect = httpx.HTTPError("Persistent error")

        result = await client._send_request("/test", {"data": "test"})

        assert result is None
        assert mock_client.post.call_count == 3  # Initial + 2 retries
        assert client._service_healthy is False
