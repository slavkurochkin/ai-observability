"""Decorator for automatic event tracking."""

import asyncio
import functools
from typing import Callable, Optional, Dict, Any, TypeVar, cast

from ..client import get_client
from ..config import get_config

T = TypeVar("T", bound=Callable[..., Any])


def track_event(
    event_type: str,
    category: str = "user_action",
    extract_metadata: Optional[Callable[..., Dict[str, Any]]] = None,
    extract_user_id: Optional[Callable[..., Optional[int]]] = None,
) -> Callable[[T], T]:
    """Decorator to automatically track function calls as events.

    Args:
        event_type: Type of event to track
        category: Event category (default: 'user_action')
        extract_metadata: Optional function to extract metadata from function arguments
        extract_user_id: Optional function to extract user ID from function arguments

    Returns:
        Decorated function

    Example:
        ```python
        @track_event("item_created", category="user_action")
        async def create_item(item_data: dict, user_id: int):
            # Implementation
            return item

        # With metadata extraction
        @track_event(
            "item_created",
            extract_metadata=lambda item_data, **kwargs: {"item_type": item_data.get("type")},
            extract_user_id=lambda user_id, **kwargs: user_id
        )
        async def create_item(item_data: dict, user_id: int):
            return item
        ```
    """

    def decorator(func: T) -> T:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            # Execute the function first
            result = await func(*args, **kwargs)

            # Extract metadata and user_id
            metadata: Dict[str, Any] = {}
            user_id: Optional[int] = None

            if extract_metadata is not None:
                try:
                    metadata = extract_metadata(*args, **kwargs)
                except Exception as e:
                    config = get_config()
                    if config.dev_mode:
                        print(f"Failed to extract metadata: {e}")

            if extract_user_id is not None:
                try:
                    user_id = extract_user_id(*args, **kwargs)
                except Exception as e:
                    config = get_config()
                    if config.dev_mode:
                        print(f"Failed to extract user_id: {e}")

            # Track the event (non-blocking)
            asyncio.create_task(
                _track_event_async(
                    event_type=event_type,
                    category=category,
                    metadata=metadata,
                    user_id=user_id,
                )
            )

            return result

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            # Execute the function first
            result = func(*args, **kwargs)

            # Extract metadata and user_id
            metadata: Dict[str, Any] = {}
            user_id: Optional[int] = None

            if extract_metadata is not None:
                try:
                    metadata = extract_metadata(*args, **kwargs)
                except Exception as e:
                    config = get_config()
                    if config.dev_mode:
                        print(f"Failed to extract metadata: {e}")

            if extract_user_id is not None:
                try:
                    user_id = extract_user_id(*args, **kwargs)
                except Exception as e:
                    config = get_config()
                    if config.dev_mode:
                        print(f"Failed to extract user_id: {e}")

            # Track the event (non-blocking)
            asyncio.create_task(
                _track_event_async(
                    event_type=event_type,
                    category=category,
                    metadata=metadata,
                    user_id=user_id,
                )
            )

            return result

        # Return appropriate wrapper based on whether function is async
        if asyncio.iscoroutinefunction(func):
            return cast(T, async_wrapper)
        else:
            return cast(T, sync_wrapper)

    return decorator


async def _track_event_async(
    event_type: str,
    category: str,
    metadata: Dict[str, Any],
    user_id: Optional[int],
) -> None:
    """Internal helper to track events asynchronously.

    Args:
        event_type: Type of event
        category: Event category
        metadata: Event metadata
        user_id: Optional user ID
    """
    try:
        client = await get_client()
        await client.track_event(
            event_type=event_type,
            category=category,
            metadata=metadata,
            user_id=user_id,
        )
    except Exception as e:
        config = get_config()
        if config.dev_mode:
            print(f"Failed to track event: {e}")
