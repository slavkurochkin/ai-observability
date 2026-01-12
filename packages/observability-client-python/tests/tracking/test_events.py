"""Tests for event tracking functions."""

import pytest
from unittest.mock import patch, AsyncMock

from observability_client.tracking import track_event, track_service_error


@pytest.mark.asyncio
async def test_track_event():
    """Test track_event function."""
    with patch("observability_client.tracking.events.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.track_event.return_value = {"status": "success"}
        mock_get_client.return_value = mock_client

        result = await track_event(
            event_type="test_event",
            user_id=123,
            session_id="session123",
            metadata={"key": "value"},
            category="test",
        )

        assert result == {"status": "success"}
        mock_client.track_event.assert_called_once_with(
            event_type="test_event",
            user_id=123,
            session_id="session123",
            metadata={"key": "value"},
            category="test",
        )


@pytest.mark.asyncio
async def test_track_event_defaults():
    """Test track_event with default values."""
    with patch("observability_client.tracking.events.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.track_event.return_value = {"status": "success"}
        mock_get_client.return_value = mock_client

        result = await track_event(event_type="test_event")

        assert result == {"status": "success"}
        mock_client.track_event.assert_called_once_with(
            event_type="test_event",
            user_id=None,
            session_id=None,
            metadata=None,
            category="user_action",
        )


@pytest.mark.asyncio
async def test_track_service_error():
    """Test track_service_error function."""
    with patch("observability_client.tracking.events.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.track_service_error.return_value = {"status": "success"}
        mock_get_client.return_value = mock_client

        result = await track_service_error(
            error_type="ValueError",
            error_message="Test error",
            stack_trace="Stack trace",
            request_path="/api/test",
            request_method="POST",
            user_id=123,
            session_id="session123",
            metadata={"additional": "info"},
        )

        assert result == {"status": "success"}
        mock_client.track_service_error.assert_called_once_with(
            error_type="ValueError",
            error_message="Test error",
            stack_trace="Stack trace",
            request_path="/api/test",
            request_method="POST",
            user_id=123,
            session_id="session123",
            metadata={"additional": "info"},
        )
