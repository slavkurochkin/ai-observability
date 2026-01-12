# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-12

### Added

#### Core Functionality
- `initObservability()` - Initialize client with configuration
- `trackEvent()` - Track user events with database storage
- `trackEventTelemetryOnly()` - Track via OpenTelemetry only (no database)
- `trackUIEvent()` - Track UI interactions
- `trackUIError()` - Track frontend errors
- `trackServiceError()` - Track API/service errors

#### React Components
- `TrackedButton` - Auto-tracking button component
- `TrackedInput` - Auto-tracking input with sanitization
- `TrackedCheckbox` - Auto-tracking checkbox component
- `TrackedSelect` - Auto-tracking select component

#### React Hooks
- `useObservability()` - Access observability functions in React
- `useAutoTracking()` - Control auto-tracking per component

#### Auto-Instrumentation
- Automatic page view tracking (configurable)
- Automatic JavaScript error tracking (configurable)
- Automatic API error tracking (configurable)
- Selector-based click tracking (opt-in)
- Path and element exclusion support

#### Utilities
- Session management with 30-minute timeout
- Automatic session generation and persistence
- User ID detection from common auth patterns
- Manual user ID setting
- Device type detection (mobile/tablet/desktop)
- Viewport dimensions tracking
- User agent detection

#### Smart Features
- Event queuing with localStorage (max 100 events, FIFO)
- Automatic batching (10 events or 5 seconds)
- Retry logic with exponential backoff (max 3 attempts)
- Graceful degradation when service unavailable
- Quota management (clears oldest 25% if localStorage full)
- Docker health check on initialization
- Dev mode with console logging
- Test mode for unit testing

#### Configuration
- Service URL configuration (default: http://localhost:8006)
- Service name configuration
- Auto-track configuration per feature
- Selector-based auto-tracking
- Exclusion rules for paths and elements
- Batch size and interval configuration
- Retry attempts configuration
- Development and test modes

#### TypeScript Support
- Full TypeScript definitions
- Type-safe configuration
- Exported types for all public APIs

### Documentation
- Comprehensive README with API reference
- Migration guide from manual approach
- Configuration guide with examples
- React Router integration example
- Error Boundary integration example
- API error tracking example
- Troubleshooting guide
- Example usage documentation

### Testing
- Jest + React Testing Library setup
- Unit tests for core utilities (session, device, user)
- Unit tests for tracking functions
- Component tests for all tracked components
- Integration tests with mock service
- Test coverage reporting

### Infrastructure
- tsup build system with ESM and CJS outputs
- npm link support with React cleanup
- ESLint configuration
- TypeScript configuration
- Jest configuration
- Proper package.json exports
- .npmignore for clean distribution

## [Unreleased]

### Planned Features
- E2E tests with Playwright
- Publish to npm registry
- Framework-specific integrations (Vue, Angular, Svelte)
- Enhanced analytics SDK
- Real-time event streaming
- Advanced error tracking features
