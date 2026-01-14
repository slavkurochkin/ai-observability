from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, Index, Boolean
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class UserEvent(Base):
    __tablename__ = "user_events"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    session_id = Column(String(255), nullable=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    event_category = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    event_metadata = Column(JSON, nullable=True)
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    service_name = Column(String(50), nullable=True)
    request_id = Column(String(255), nullable=True, index=True)
    
    __table_args__ = (
        Index('idx_user_events_user_timestamp', 'user_id', 'timestamp'),
        Index('idx_user_events_session_timestamp', 'session_id', 'timestamp'),
    )

class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(String(255), primary_key=True)
    user_id = Column(Integer, nullable=True, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    page_views = Column(Integer, default=0)
    events_count = Column(Integer, default=0)
    device_type = Column(String(50), nullable=True)
    browser = Column(String(100), nullable=True)
    os = Column(String(100), nullable=True)

class UIEvent(Base):
    """
    Dedicated table for UI interaction events with optimized schema for analytics.
    Stores button clicks, form interactions, checkbox changes, etc.
    """
    __tablename__ = "ui_events"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    session_id = Column(String(255), nullable=True, index=True)
    
    # UI-specific fields
    interaction_type = Column(String(50), nullable=False, index=True)  # click, change, focus, blur, submit
    element_type = Column(String(50), nullable=True, index=True)  # button, input, checkbox, select, form
    element_name = Column(String(255), nullable=True, index=True)  # name/id of the element
    element_id = Column(String(255), nullable=True)  # HTML id if available
    
    # Context
    page_path = Column(String(500), nullable=True, index=True)  # Current route/page
    page_context = Column(String(255), nullable=True, index=True)  # Component/page context
    route_name = Column(String(255), nullable=True, index=True)  # Named route if available
    
    # Event details
    event_value = Column(Text, nullable=True)  # For inputs: value (sanitized), for checkboxes: checked state
    event_metadata = Column(JSON, nullable=True)  # Additional flexible metadata
    
    # Technical context
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    user_agent = Column(Text, nullable=True)
    viewport_width = Column(Integer, nullable=True)  # Screen width
    viewport_height = Column(Integer, nullable=True)  # Screen height
    device_type = Column(String(50), nullable=True)  # mobile, tablet, desktop
    
    # Performance metrics (optional)
    time_to_interaction_ms = Column(Integer, nullable=True)  # Time from page load to interaction
    
    __table_args__ = (
        Index('idx_ui_events_user_timestamp', 'user_id', 'timestamp'),
        Index('idx_ui_events_session_timestamp', 'session_id', 'timestamp'),
        Index('idx_ui_events_page_element', 'page_path', 'element_type', 'element_name'),
        Index('idx_ui_events_interaction_type', 'interaction_type', 'timestamp'),
        Index('idx_ui_events_context', 'page_context', 'interaction_type'),
    )

class UIError(Base):
    """
    Table for storing UI console errors from the frontend.
    Captures JavaScript errors, console errors, and frontend exceptions.
    """
    __tablename__ = "ui_errors"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    session_id = Column(String(255), nullable=True, index=True)
    
    # Error details
    error_message = Column(Text, nullable=False)  # The error message
    error_type = Column(String(100), nullable=True, index=True)  # Error, TypeError, ReferenceError, etc.
    error_stack = Column(Text, nullable=True)  # Stack trace
    error_source = Column(String(500), nullable=True)  # Source file/URL where error occurred
    line_number = Column(Integer, nullable=True)  # Line number in source
    column_number = Column(Integer, nullable=True)  # Column number in source
    
    # Context
    page_path = Column(String(500), nullable=True, index=True)  # Current route/page
    page_context = Column(String(255), nullable=True)  # Component/page context
    route_name = Column(String(255), nullable=True)  # Named route if available
    
    # Additional metadata
    error_metadata = Column(JSON, nullable=True)  # Additional flexible metadata
    user_agent = Column(Text, nullable=True)
    viewport_width = Column(Integer, nullable=True)
    viewport_height = Column(Integer, nullable=True)
    device_type = Column(String(50), nullable=True)
    
    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index('idx_ui_errors_user_timestamp', 'user_id', 'timestamp'),
        Index('idx_ui_errors_session_timestamp', 'session_id', 'timestamp'),
        Index('idx_ui_errors_type_timestamp', 'error_type', 'timestamp'),
        Index('idx_ui_errors_page_timestamp', 'page_path', 'timestamp'),
    )

class ServiceError(Base):
    """
    Table for storing service/network errors.
    Captures API errors, network failures, HTTP errors, and backend service errors.
    """
    __tablename__ = "service_errors"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    session_id = Column(String(255), nullable=True, index=True)
    
    # Error details
    error_message = Column(Text, nullable=False)  # The error message
    error_type = Column(String(100), nullable=True, index=True)  # NetworkError, HTTPError, TimeoutError, etc.
    status_code = Column(Integer, nullable=True, index=True)  # HTTP status code (if applicable)
    severity = Column(String(20), nullable=True, index=True)  # INFO, WARNING, ERROR - log level/severity
    
    # Request details
    request_url = Column(String(1000), nullable=True, index=True)  # The URL that failed
    request_method = Column(String(10), nullable=True)  # GET, POST, PUT, DELETE, etc.
    request_headers = Column(JSON, nullable=True)  # Request headers (sanitized)
    request_body = Column(Text, nullable=True)  # Request body (sanitized)
    
    # Response details
    response_body = Column(Text, nullable=True)  # Response body (if available)
    response_headers = Column(JSON, nullable=True)  # Response headers
    
    # Service context
    service_name = Column(String(100), nullable=True, index=True)  # Name of the service that failed
    endpoint = Column(String(500), nullable=True, index=True)  # API endpoint
    request_id = Column(String(255), nullable=True, index=True)  # Request ID for tracing
    
    # Network details
    error_code = Column(String(50), nullable=True)  # Network error code (e.g., ECONNREFUSED)
    timeout_ms = Column(Integer, nullable=True)  # Timeout duration if applicable
    
    # Additional metadata
    error_metadata = Column(JSON, nullable=True)  # Additional flexible metadata
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index('idx_service_errors_user_timestamp', 'user_id', 'timestamp'),
        Index('idx_service_errors_session_timestamp', 'session_id', 'timestamp'),
        Index('idx_service_errors_service_timestamp', 'service_name', 'timestamp'),
        Index('idx_service_errors_status_timestamp', 'status_code', 'timestamp'),
        Index('idx_service_errors_type_timestamp', 'error_type', 'timestamp'),
        Index('idx_service_errors_severity_timestamp', 'severity', 'timestamp'),
    )

class RecordedSession(Base):
    """
    Table for storing manually recorded sessions.
    Users can start/stop recording sessions and use them to filter events by time frame.
    """
    __tablename__ = "recorded_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)  # Optional name for the session
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    ended_at = Column(DateTime, nullable=True, index=True)
    duration_seconds = Column(Integer, nullable=True)  # Calculated duration
    notes = Column(Text, nullable=True)  # Optional notes about the session
    session_metadata = Column(JSON, nullable=True)  # Additional flexible metadata (renamed from 'metadata' to avoid SQLAlchemy reserved word)
    
    __table_args__ = (
        Index('idx_recorded_sessions_started', 'started_at'),
        Index('idx_recorded_sessions_ended', 'ended_at'),
    )
