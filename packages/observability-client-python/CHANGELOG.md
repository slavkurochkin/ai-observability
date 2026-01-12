# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-12

### Added

#### Core Client
- `ObservabilityClient` class with async/await support
- `init_observability()` convenience function for quick setup
- Global client instance management
- Configuration via `ObservabilityConfig` class
- Environment variable support for configuration
- Automatic retry logic with exponential backoff
- Graceful degradation when service unavailable
- Health check functionality
- Dev mode with detailed logging
- Test mode for unit testing

#### Tracking Functions
- `track_event()` - Track user events with metadata
- `track_service_error()` - Track service errors with stack traces
- Automatic service name injection
- Optional user_id and session_id support
- Custom metadata support
- Event categories

#### Middleware
- **FastAPI/Starlette middleware**
  - Automatic request tracking with duration
  - Automatic error tracking with stack traces
  - Configurable request/error tracking
  - Async support

- **Flask middleware**
  - Automatic request tracking
  - Automatic error tracking
  - before_request and after_request hooks
  - Error handler integration

- **Django middleware**
  - Automatic request tracking
  - Automatic exception tracking
  - process_request, process_response, process_exception hooks
  - Django middleware compatibility

#### Decorators
- `@track_event` - Automatically track function calls
  - Custom metadata extraction
  - User ID extraction from arguments
  - Support for both sync and async functions

- `@track_error` - Automatically track exceptions
  - Optional metadata extraction
  - Configurable re-raise behavior
  - Stack trace capture
  - Support for both sync and async functions

#### Utilities
- `get_request_context()` - Extract context from framework requests
- `extract_user_id()` - Auto-detect user ID from common patterns
- `extract_session_id()` - Auto-detect session ID from common patterns
- Multi-framework support (FastAPI, Flask, Django)

#### Configuration
- Default service URL: http://localhost:8006
- Environment variable configuration
- Timeout configuration (default: 10s)
- Retry configuration (default: 3 attempts)
- Dev mode and test mode flags

### Documentation
- Comprehensive README with examples
- API reference documentation
- Framework-specific integration guides
- Decorator usage examples
- Error tracking examples
- Context extraction documentation
- Testing guide with pytest examples
- Troubleshooting section

### Testing
- Unit tests for client
- Unit tests for configuration
- Unit tests for tracking functions
- pytest configuration
- Test fixtures
- Mock HTTP client support
- Async test support

### Examples
- FastAPI example application
- Flask example application
- Django example views
- Decorator examples
- Error tracking examples
- Manual tracking examples

### Infrastructure
- setup.py for package distribution
- pyproject.toml for modern Python packaging
- pytest.ini for test configuration
- .gitignore for Python projects
- Optional dependencies for frameworks
- Dev dependencies for testing and linting

## [Unreleased]

### Planned Features
- Query/analytics functions
- Real-time event streaming
- Connection pooling optimization
- Batch event sending
- Event queue persistence
- More framework integrations (Tornado, Sanic, etc.)
- CLI tools for testing and debugging
- Enhanced context extraction
- Custom serializers for complex data types
