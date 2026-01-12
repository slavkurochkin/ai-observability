"""Decorator for automatic error tracking."""

import asyncio
import functools
import traceback
from typing import Callable, Optional, Dict, Any, TypeVar, cast

from ..client import get_client
from ..config import get_config

T = TypeVar("T", bound=Callable[..., Any])


def track_error(
    extract_metadata: Optional[Callable[..., Dict[str, Any]]] = None,
    extract_user_id: Optional[Callable[..., Optional[int]]] = None,
    reraise: bool = True,
) -> Callable[[T], T]:
    """Decorator to automatically track exceptions in functions.

    Args:
        extract_metadata: Optional function to extract metadata from function arguments
        extract_user_id: Optional function to extract user ID from function arguments
        reraise: Whether to re-raise the exception after tracking (default: True)

    Returns:
        Decorated function

    Example:
        ```python
        @track_error(reraise=True)
        async def risky_operation(user_id: int):
            # Implementation that might fail
            pass

        # With metadata and user_id extraction
        @track_error(
            extract_metadata=lambda data, **kwargs: {"operation": "process_data"},
            extract_user_id=lambda user_id, **kwargs: user_id,
            reraise=True
        )
        async def risky_operation(data: dict, user_id: int):
            pass
        ```
    """

    def decorator(func: T) -> T:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                # Extract metadata and user_id
                metadata: Dict[str, Any] = {}
                user_id: Optional[int] = None

                if extract_metadata is not None:
                    try:
                        metadata = extract_metadata(*args, **kwargs)
                    except Exception as extract_error:
                        config = get_config()
                        if config.dev_mode:
                            print(f"Failed to extract metadata: {extract_error}")

                if extract_user_id is not None:
                    try:
                        user_id = extract_user_id(*args, **kwargs)
                    except Exception as extract_error:
                        config = get_config()
                        if config.dev_mode:
                            print(f"Failed to extract user_id: {extract_error}")

                # Track the error (non-blocking)
                asyncio.create_task(
                    _track_error_async(
                        error=e,
                        metadata=metadata,
                        user_id=user_id,
                        function_name=func.__name__,
                    )
                )

                # Re-raise if configured
                if reraise:
                    raise

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # Extract metadata and user_id
                metadata: Dict[str, Any] = {}
                user_id: Optional[int] = None

                if extract_metadata is not None:
                    try:
                        metadata = extract_metadata(*args, **kwargs)
                    except Exception as extract_error:
                        config = get_config()
                        if config.dev_mode:
                            print(f"Failed to extract metadata: {extract_error}")

                if extract_user_id is not None:
                    try:
                        user_id = extract_user_id(*args, **kwargs)
                    except Exception as extract_error:
                        config = get_config()
                        if config.dev_mode:
                            print(f"Failed to extract user_id: {extract_error}")

                # Track the error (non-blocking)
                asyncio.create_task(
                    _track_error_async(
                        error=e,
                        metadata=metadata,
                        user_id=user_id,
                        function_name=func.__name__,
                    )
                )

                # Re-raise if configured
                if reraise:
                    raise

        # Return appropriate wrapper based on whether function is async
        if asyncio.iscoroutinefunction(func):
            return cast(T, async_wrapper)
        else:
            return cast(T, sync_wrapper)

    return decorator


async def _track_error_async(
    error: Exception,
    metadata: Dict[str, Any],
    user_id: Optional[int],
    function_name: str,
) -> None:
    """Internal helper to track errors asynchronously.

    Args:
        error: The exception that occurred
        metadata: Additional error metadata
        user_id: Optional user ID
        function_name: Name of the function where error occurred
    """
    try:
        client = await get_client()

        # Add function name to metadata
        full_metadata = {**metadata, "function": function_name}

        await client.track_service_error(
            error_type=type(error).__name__,
            error_message=str(error),
            stack_trace=traceback.format_exc(),
            user_id=user_id,
            metadata=full_metadata,
        )
    except Exception as e:
        config = get_config()
        if config.dev_mode:
            print(f"Failed to track error: {e}")
