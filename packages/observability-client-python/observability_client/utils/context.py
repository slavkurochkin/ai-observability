"""Context utilities for extracting request information."""

from typing import Optional, Dict, Any, Union
import re


def get_request_context(request: Any) -> Dict[str, Any]:
    """Extract common context from a request object.

    This function works with FastAPI, Flask, and Django request objects.

    Args:
        request: Request object from any supported framework

    Returns:
        Dictionary containing request context (path, method, user_id, session_id)
    """
    context: Dict[str, Any] = {}

    # Extract path
    if hasattr(request, "url"):
        # FastAPI/Starlette
        if hasattr(request.url, "path"):
            context["request_path"] = str(request.url.path)
    elif hasattr(request, "path"):
        # Flask/Django
        context["request_path"] = str(request.path)

    # Extract method
    if hasattr(request, "method"):
        context["request_method"] = str(request.method)

    # Extract user ID
    user_id = extract_user_id(request)
    if user_id is not None:
        context["user_id"] = user_id

    # Extract session ID
    session_id = extract_session_id(request)
    if session_id is not None:
        context["session_id"] = session_id

    return context


def extract_user_id(request: Any) -> Optional[int]:
    """Extract user ID from a request object.

    Checks common patterns across frameworks:
    - request.user.id (Django, some FastAPI patterns)
    - request.state.user_id (FastAPI/Starlette)
    - session['user_id'] (Flask)

    Args:
        request: Request object from any supported framework

    Returns:
        User ID if found, None otherwise
    """
    # FastAPI/Starlette state
    if hasattr(request, "state") and hasattr(request.state, "user_id"):
        user_id = request.state.user_id
        if user_id is not None:
            return int(user_id)

    # Django/FastAPI user object
    # Use try-except to safely access request.user (Starlette requires AuthenticationMiddleware)
    # Note: hasattr() can trigger the property getter in Starlette, so we try directly
    try:
        user = request.user
        if hasattr(user, "id") and user.id is not None:
            return int(user.id)
        if hasattr(user, "pk") and user.pk is not None:
            return int(user.pk)
    except (AssertionError, AttributeError):
        # request.user requires AuthenticationMiddleware in Starlette/FastAPI
        # Skip if not available
        pass

    # Flask session
    # Use try-except to safely access request.session (Starlette requires SessionMiddleware)
    try:
        session = request.session
        if isinstance(session, dict):
            if "user_id" in session and session["user_id"] is not None:
                return int(session["user_id"])
            if "userId" in session and session["userId"] is not None:
                return int(session["userId"])
    except (AssertionError, AttributeError):
        # request.session requires SessionMiddleware in Starlette/FastAPI
        # Skip if not available
        pass

    # Check cookies
    if hasattr(request, "cookies"):
        cookies = request.cookies
        if "user_id" in cookies:
            try:
                return int(cookies["user_id"])
            except (ValueError, TypeError):
                pass

    return None


def extract_session_id(request: Any) -> Optional[str]:
    """Extract session ID from a request object.

    Checks common patterns across frameworks:
    - request.session.session_key (Django)
    - request.state.session_id (FastAPI/Starlette)
    - session.sid (Flask)
    - cookies

    Args:
        request: Request object from any supported framework

    Returns:
        Session ID if found, None otherwise
    """
    # FastAPI/Starlette state
    if hasattr(request, "state") and hasattr(request.state, "session_id"):
        return str(request.state.session_id)

    # Django session
    # Use try-except to safely access request.session (Starlette requires SessionMiddleware)
    try:
        session = request.session
        if hasattr(session, "session_key") and session.session_key:
            return str(session.session_key)
        # Flask-Session
        if hasattr(session, "sid") and session.sid:
            return str(session.sid)
    except (AssertionError, AttributeError):
        # request.session requires SessionMiddleware in Starlette/FastAPI
        # Skip if not available
        pass

    # Check cookies for common session cookie names
    if hasattr(request, "cookies"):
        cookies = request.cookies
        for cookie_name in ["sessionid", "session_id", "session", "_session"]:
            if cookie_name in cookies and cookies[cookie_name]:
                return str(cookies[cookie_name])

    return None
