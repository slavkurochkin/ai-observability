"""Middleware for various Python web frameworks."""

__all__ = []

try:
    from .fastapi import ObservabilityMiddleware as FastAPIObservabilityMiddleware

    __all__.append("FastAPIObservabilityMiddleware")
except ImportError:
    pass

try:
    from .flask import ObservabilityMiddleware as FlaskObservabilityMiddleware

    __all__.append("FlaskObservabilityMiddleware")
except ImportError:
    pass

try:
    from .django import ObservabilityMiddleware as DjangoObservabilityMiddleware

    __all__.append("DjangoObservabilityMiddleware")
except ImportError:
    pass
