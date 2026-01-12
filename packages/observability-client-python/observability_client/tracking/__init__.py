"""Tracking functions for observability events."""

from .events import track_event, track_service_error

__all__ = ["track_event", "track_service_error"]
