"""Decorators for observability tracking."""

from .track_event import track_event
from .track_error import track_error

__all__ = ["track_event", "track_error"]
