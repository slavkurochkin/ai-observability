"""Event tracking functions."""

from typing import Optional, Dict, Any

from ..client import get_client


async def track_event(
    event_type: str,
    user_id: Optional[int] = None,
    session_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    category: str = "user_action",
) -> Optional[Dict[str, Any]]:
    """Track a user event.

    This is a convenience function that uses the global client instance.

    Args:
        event_type: Type of event (e.g., 'user_action', 'page_view')
        user_id: ID of the user performing the action
        session_id: Session ID
        metadata: Additional event metadata
        category: Event category (default: 'user_action')

    Returns:
        Response data if successful, None otherwise

    Example:
        ```python
        await track_event(
            event_type="button_click",
            user_id=123,
            metadata={"button": "submit", "form": "login"}
        )
        ```
    """
    client = await get_client()
    return await client.track_event(
        event_type=event_type,
        user_id=user_id,
        session_id=session_id,
        metadata=metadata,
        category=category,
    )


async def track_service_error(
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

    This is a convenience function that uses the global client instance.

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

    Example:
        ```python
        try:
            # Some code that might fail
            result = risky_operation()
        except Exception as e:
            await track_service_error(
                error_type=type(e).__name__,
                error_message=str(e),
                stack_trace=traceback.format_exc(),
                request_path="/api/users",
                request_method="POST"
            )
        ```
    """
    client = await get_client()
    return await client.track_service_error(
        error_type=error_type,
        error_message=error_message,
        stack_trace=stack_trace,
        request_path=request_path,
        request_method=request_method,
        user_id=user_id,
        session_id=session_id,
        metadata=metadata,
    )
