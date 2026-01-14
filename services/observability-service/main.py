from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import os
import asyncio
from contextlib import asynccontextmanager
from models import Base, UserEvent, UserSession, UIEvent, UIError, ServiceError, RecordedSession
from database import get_db, engine
from otel_setup import setup_opentelemetry, instrument_fastapi, instrument_sqlalchemy
from opentelemetry import trace
import logging

# Setup logger (will send to Loki via OpenTelemetry)
logger = logging.getLogger(__name__)


# Configuration
RETENTION_DAYS = int(os.getenv("EVENT_RETENTION_DAYS", "90"))  # Default: 90 days
CLEANUP_INTERVAL_HOURS = int(os.getenv("CLEANUP_INTERVAL_HOURS", "24"))  # Default: daily
ENABLE_AUTO_CLEANUP = os.getenv("ENABLE_AUTO_CLEANUP", "true").lower() == "true"

# Initialize OpenTelemetry
tracer, meter = setup_opentelemetry("observability-service")

# Background cleanup task
async def cleanup_old_events():
    """Periodically clean up events older than retention period"""
    # Wait before first cleanup to let service start
    await asyncio.sleep(60)
    
    while True:
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
            
            db = next(get_db())
            try:
                deleted_user_events = db.query(UserEvent).filter(
                    UserEvent.timestamp < cutoff_date
                ).delete()
                deleted_ui_events = db.query(UIEvent).filter(
                    UIEvent.timestamp < cutoff_date
                ).delete()
                deleted_ui_errors = db.query(UIError).filter(
                    UIError.timestamp < cutoff_date
                ).delete()
                deleted_service_errors = db.query(ServiceError).filter(
                    ServiceError.timestamp < cutoff_date
                ).delete()
                deleted_recorded_sessions = db.query(RecordedSession).filter(
                    RecordedSession.started_at < cutoff_date
                ).delete()
                db.commit()
                
                total_deleted = deleted_user_events + deleted_ui_events + deleted_ui_errors + deleted_service_errors + deleted_recorded_sessions
                if total_deleted > 0:
                    logger.info(f"Auto-cleanup: Deleted {deleted_user_events} user events, {deleted_ui_events} UI events, {deleted_ui_errors} UI errors, {deleted_service_errors} service errors, and {deleted_recorded_sessions} recorded sessions older than {RETENTION_DAYS} days")
            except Exception as e:
                db.rollback()
                logger.error(f"Auto-cleanup error: {e}", exc_info=True)
            finally:
                db.close()
            
            # Wait for next cleanup cycle
            await asyncio.sleep(CLEANUP_INTERVAL_HOURS * 3600)  # Convert hours to seconds
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Cleanup task error: {e}, retrying in 1 hour", exc_info=True)
            await asyncio.sleep(3600)  # Wait 1 hour before retrying on error

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables and start cleanup task
    Base.metadata.create_all(bind=engine)
    
    # Start background cleanup task
    cleanup_task = None
    if ENABLE_AUTO_CLEANUP:
        cleanup_task = asyncio.create_task(cleanup_old_events())
        logger.info(f"Started auto-cleanup task (retention: {RETENTION_DAYS} days, interval: {CLEANUP_INTERVAL_HOURS} hours)")
    
    yield
    
    # Shutdown: Cancel cleanup task
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="Observability Service",
    version="1.0.0",
    description="""
    Observability Service for tracking UI events and user behavior.
    
    Features:
    - User event tracking
    - UI interaction analytics
    - Session management
    - Error tracking (UI and service errors)
    - Event retention and cleanup
    """,
    openapi_tags=[
        {"name": "Events", "description": "User event tracking"},
        {"name": "UI Events", "description": "UI interaction tracking"},
        {"name": "Errors", "description": "Error tracking (UI and service errors)"},
        {"name": "Sessions", "description": "Session recording and management"},
        {"name": "Analytics", "description": "Analytics and statistics"},
        {"name": "Health", "description": "Health check endpoints"}
    ],
    lifespan=lifespan
)

# Instrument FastAPI and SQLAlchemy with OpenTelemetry
instrument_fastapi(app, "observability-service")
instrument_sqlalchemy(engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EventCreate(BaseModel):
    user_id: Optional[int] = None
    session_id: Optional[str] = None
    event_type: str
    event_category: Optional[str] = None
    event_metadata: Optional[Dict[str, Any]] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    service_name: Optional[str] = None
    request_id: Optional[str] = None

class EventResponse(BaseModel):
    id: int
    user_id: Optional[int]
    event_type: str
    timestamp: datetime
    event_metadata: Optional[Dict[str, Any]]
    
    class Config:
        from_attributes = True

@app.post("/events", response_model=EventResponse, tags=["Events"], summary="Create event")
async def create_event(
    event: EventCreate,
    db: Session = Depends(get_db)
):
    """Create a user behavior event"""
    logger.info(f"Creating event: {event.event_type} for user {event.user_id}")
    db_event = UserEvent(
        user_id=event.user_id,
        session_id=event.session_id,
        event_type=event.event_type,
        event_category=event.event_category,
        event_metadata=event.event_metadata,
        user_agent=event.user_agent,
        ip_address=event.ip_address,
        service_name=event.service_name,
        request_id=event.request_id,
        timestamp=datetime.utcnow()
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@app.get("/events", response_model=List[EventResponse], tags=["Events"], summary="List events")
async def get_events(
    user_id: Optional[int] = None,
    event_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Query user events"""
    query = db.query(UserEvent)
    
    if user_id:
        query = query.filter(UserEvent.user_id == user_id)
    if event_type:
        query = query.filter(UserEvent.event_type == event_type)
    if start_date:
        query = query.filter(UserEvent.timestamp >= start_date)
    if end_date:
        query = query.filter(UserEvent.timestamp <= end_date)
    
    events = query.order_by(UserEvent.timestamp.desc()).limit(limit).all()
    return events

@app.get("/analytics/summary", tags=["Analytics"], summary="Get analytics summary")
async def get_analytics_summary(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """Get analytics summary"""
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=7)
    if not end_date:
        end_date = datetime.utcnow()
    
    query = db.query(UserEvent).filter(
        UserEvent.timestamp >= start_date,
        UserEvent.timestamp <= end_date
    )
    
    total_events = query.count()
    unique_users = query.distinct(UserEvent.user_id).count()
    
    # Event types breakdown
    from sqlalchemy import func
    event_types = db.query(
        UserEvent.event_type,
        func.count(UserEvent.id).label('count')
    ).filter(
        UserEvent.timestamp >= start_date,
        UserEvent.timestamp <= end_date
    ).group_by(UserEvent.event_type).all()
    
    return {
        "total_events": total_events,
        "unique_users": unique_users,
        "event_types": {et: count for et, count in event_types},
        "start_date": start_date,
        "end_date": end_date
    }

@app.post("/cleanup", tags=["Events"], summary="Cleanup old events")
async def cleanup_events(
    days: Optional[int] = None,
    dry_run: bool = False,
    db: Session = Depends(get_db)
):
    """
    Manually trigger cleanup of old events.
    
    Args:
        days: Number of days to retain (defaults to RETENTION_DAYS env var)
        dry_run: If True, only count events to be deleted without deleting
    """
    retention_days = days or RETENTION_DAYS
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    
    user_events_query = db.query(UserEvent).filter(UserEvent.timestamp < cutoff_date)
    ui_events_query = db.query(UIEvent).filter(UIEvent.timestamp < cutoff_date)
    ui_errors_query = db.query(UIError).filter(UIError.timestamp < cutoff_date)
    service_errors_query = db.query(ServiceError).filter(ServiceError.timestamp < cutoff_date)
    recorded_sessions_query = db.query(RecordedSession).filter(RecordedSession.started_at < cutoff_date)
    user_events_count = user_events_query.count()
    ui_events_count = ui_events_query.count()
    ui_errors_count = ui_errors_query.count()
    service_errors_count = service_errors_query.count()
    recorded_sessions_count = recorded_sessions_query.count()
    
    if dry_run:
        return {
            "status": "dry_run",
            "user_events_to_delete": user_events_count,
            "ui_events_to_delete": ui_events_count,
            "ui_errors_to_delete": ui_errors_count,
            "service_errors_to_delete": service_errors_count,
            "recorded_sessions_to_delete": recorded_sessions_count,
            "total_events_to_delete": user_events_count + ui_events_count + ui_errors_count + service_errors_count + recorded_sessions_count,
            "cutoff_date": cutoff_date.isoformat(),
            "retention_days": retention_days
        }
    
    deleted_user_events = user_events_query.delete()
    deleted_ui_events = ui_events_query.delete()
    deleted_ui_errors = ui_errors_query.delete()
    deleted_service_errors = service_errors_query.delete()
    deleted_recorded_sessions = recorded_sessions_query.delete()
    db.commit()
    
    return {
        "status": "success",
        "deleted_user_events": deleted_user_events,
        "deleted_ui_events": deleted_ui_events,
        "deleted_ui_errors": deleted_ui_errors,
        "deleted_service_errors": deleted_service_errors,
        "deleted_recorded_sessions": deleted_recorded_sessions,
        "total_deleted": deleted_user_events + deleted_ui_events + deleted_ui_errors + deleted_service_errors + deleted_recorded_sessions,
        "cutoff_date": cutoff_date.isoformat(),
        "retention_days": retention_days
    }

@app.get("/stats", tags=["Analytics"], summary="Get statistics")
async def get_stats(db: Session = Depends(get_db)):
    """Get database statistics"""
    total_events = db.query(UserEvent).count()
    total_ui_events = db.query(UIEvent).count()
    total_ui_errors = db.query(UIError).count()
    total_service_errors = db.query(ServiceError).count()
    total_sessions = db.query(UserSession).count()
    total_recorded_sessions = db.query(RecordedSession).count()
    
    # Oldest and newest events
    oldest_event = db.query(func.min(UserEvent.timestamp)).scalar()
    newest_event = db.query(func.max(UserEvent.timestamp)).scalar()
    oldest_ui_event = db.query(func.min(UIEvent.timestamp)).scalar()
    newest_ui_event = db.query(func.max(UIEvent.timestamp)).scalar()
    oldest_ui_error = db.query(func.min(UIError.timestamp)).scalar()
    newest_ui_error = db.query(func.max(UIError.timestamp)).scalar()
    oldest_service_error = db.query(func.min(ServiceError.timestamp)).scalar()
    newest_service_error = db.query(func.max(ServiceError.timestamp)).scalar()
    
    # Events by category
    from sqlalchemy import func
    category_counts = db.query(
        UserEvent.event_category,
        func.count(UserEvent.id).label('count')
    ).group_by(UserEvent.event_category).all()
    
    # Events older than retention period
    cutoff_date = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
    old_events_count = db.query(UserEvent).filter(
        UserEvent.timestamp < cutoff_date
    ).count()
    old_ui_events_count = db.query(UIEvent).filter(
        UIEvent.timestamp < cutoff_date
    ).count()
    old_ui_errors_count = db.query(UIError).filter(
        UIError.timestamp < cutoff_date
    ).count()
    old_service_errors_count = db.query(ServiceError).filter(
        ServiceError.timestamp < cutoff_date
    ).count()
    
    # Estimate database size (rough calculation)
    # Average event size ~500 bytes, this is approximate
    estimated_size_mb = ((total_events + total_ui_events + total_ui_errors + total_service_errors) * 500) / (1024 * 1024)
    
    return {
        "total_events": total_events,
        "total_ui_events": total_ui_events,
        "total_ui_errors": total_ui_errors,
        "total_service_errors": total_service_errors,
        "total_errors": total_ui_errors + total_service_errors,
        "total_sessions": total_sessions,
        "total_recorded_sessions": total_recorded_sessions,
        "oldest_event": oldest_event.isoformat() if oldest_event else None,
        "newest_event": newest_event.isoformat() if newest_event else None,
        "oldest_ui_event": oldest_ui_event.isoformat() if oldest_ui_event else None,
        "newest_ui_event": newest_ui_event.isoformat() if newest_ui_event else None,
        "oldest_ui_error": oldest_ui_error.isoformat() if oldest_ui_error else None,
        "newest_ui_error": newest_ui_error.isoformat() if newest_ui_error else None,
        "oldest_service_error": oldest_service_error.isoformat() if oldest_service_error else None,
        "newest_service_error": newest_service_error.isoformat() if newest_service_error else None,
        "events_by_category": {cat: count for cat, count in category_counts if cat},
        "retention_days": RETENTION_DAYS,
        "events_older_than_retention": old_events_count,
        "ui_events_older_than_retention": old_ui_events_count,
        "ui_errors_older_than_retention": old_ui_errors_count,
        "service_errors_older_than_retention": old_service_errors_count,
        "estimated_size_mb": round(estimated_size_mb, 2),
        "auto_cleanup_enabled": ENABLE_AUTO_CLEANUP,
        "cleanup_interval_hours": CLEANUP_INTERVAL_HOURS
    }

# UI Events endpoints
class UIEventCreate(BaseModel):
    user_id: Optional[int] = None
    session_id: Optional[str] = None
    interaction_type: str  # click, change, focus, blur, submit
    element_type: Optional[str] = None  # button, input, checkbox, select, form
    element_name: Optional[str] = None
    element_id: Optional[str] = None
    page_path: Optional[str] = None
    page_context: Optional[str] = None
    route_name: Optional[str] = None
    event_value: Optional[str] = None
    event_metadata: Optional[Dict[str, Any]] = None
    user_agent: Optional[str] = None
    viewport_width: Optional[int] = None
    viewport_height: Optional[int] = None
    device_type: Optional[str] = None
    time_to_interaction_ms: Optional[int] = None

class UIEventResponse(BaseModel):
    id: int
    user_id: Optional[int]
    session_id: Optional[str]
    interaction_type: str
    element_type: Optional[str]
    element_name: Optional[str]
    element_id: Optional[str]
    page_path: Optional[str]
    page_context: Optional[str]
    route_name: Optional[str]
    event_value: Optional[str]
    event_metadata: Optional[Dict[str, Any]]
    viewport_width: Optional[int]
    viewport_height: Optional[int]
    device_type: Optional[str]
    timestamp: datetime
    
    class Config:
        from_attributes = True

@app.post("/ui-events", response_model=UIEventResponse, tags=["UI Events"], summary="Create UI event")
async def create_ui_event(
    event: UIEventCreate,
    db: Session = Depends(get_db)
):
    """Create a UI interaction event (optimized for UI analytics)"""
    db_event = UIEvent(
        user_id=event.user_id,
        session_id=event.session_id,
        interaction_type=event.interaction_type,
        element_type=event.element_type,
        element_name=event.element_name,
        element_id=event.element_id,
        page_path=event.page_path,
        page_context=event.page_context,
        route_name=event.route_name,
        event_value=event.event_value,
        event_metadata=event.event_metadata,
        user_agent=event.user_agent,
        viewport_width=event.viewport_width,
        viewport_height=event.viewport_height,
        device_type=event.device_type,
        time_to_interaction_ms=event.time_to_interaction_ms,
        timestamp=datetime.utcnow()
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@app.get("/ui-events", response_model=List[UIEventResponse], tags=["UI Events"], summary="List UI events")
async def get_ui_events(
    user_id: Optional[int] = None,
    session_id: Optional[str] = None,
    interaction_type: Optional[str] = None,
    element_type: Optional[str] = None,
    page_path: Optional[str] = None,
    page_context: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Query UI events with optimized filters"""
    query = db.query(UIEvent)
    
    if user_id:
        query = query.filter(UIEvent.user_id == user_id)
    if session_id:
        query = query.filter(UIEvent.session_id == session_id)
    if interaction_type:
        query = query.filter(UIEvent.interaction_type == interaction_type)
    if element_type:
        query = query.filter(UIEvent.element_type == element_type)
    if page_path:
        query = query.filter(UIEvent.page_path == page_path)
    if page_context:
        query = query.filter(UIEvent.page_context == page_context)
    if start_date:
        query = query.filter(UIEvent.timestamp >= start_date)
    if end_date:
        query = query.filter(UIEvent.timestamp <= end_date)
    
    events = query.order_by(UIEvent.timestamp.desc()).limit(limit).all()
    return events

@app.get("/ui-events/analytics", tags=["Analytics"], summary="Get UI analytics")
async def get_ui_analytics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page_path: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get UI event analytics with optimized queries"""
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=7)
    if not end_date:
        end_date = datetime.utcnow()
    
    query = db.query(UIEvent).filter(
        UIEvent.timestamp >= start_date,
        UIEvent.timestamp <= end_date
    )
    
    if page_path:
        query = query.filter(UIEvent.page_path == page_path)
    
    total_events = query.count()
    unique_users = query.distinct(UIEvent.user_id).count()
    unique_sessions = query.distinct(UIEvent.session_id).count()
    
    # Interactions by type
    interaction_types = db.query(
        UIEvent.interaction_type,
        func.count(UIEvent.id).label('count')
    ).filter(
        UIEvent.timestamp >= start_date,
        UIEvent.timestamp <= end_date
    )
    if page_path:
        interaction_types = interaction_types.filter(UIEvent.page_path == page_path)
    interaction_types = interaction_types.group_by(UIEvent.interaction_type).all()
    
    # Most clicked buttons
    top_buttons = db.query(
        UIEvent.element_name,
        func.count(UIEvent.id).label('count')
    ).filter(
        UIEvent.timestamp >= start_date,
        UIEvent.timestamp <= end_date,
        UIEvent.element_type == 'button',
        UIEvent.interaction_type == 'click'
    )
    if page_path:
        top_buttons = top_buttons.filter(UIEvent.page_path == page_path)
    top_buttons = top_buttons.group_by(UIEvent.element_name).order_by(func.count(UIEvent.id).desc()).limit(10).all()
    
    # Events by page
    events_by_page = db.query(
        UIEvent.page_path,
        func.count(UIEvent.id).label('count')
    ).filter(
        UIEvent.timestamp >= start_date,
        UIEvent.timestamp <= end_date
    ).group_by(UIEvent.page_path).order_by(func.count(UIEvent.id).desc()).limit(10).all()
    
    # Events by element type
    events_by_element = db.query(
        UIEvent.element_type,
        func.count(UIEvent.id).label('count')
    ).filter(
        UIEvent.timestamp >= start_date,
        UIEvent.timestamp <= end_date
    )
    if page_path:
        events_by_element = events_by_element.filter(UIEvent.page_path == page_path)
    events_by_element = events_by_element.group_by(UIEvent.element_type).all()
    
    return {
        "total_events": total_events,
        "unique_users": unique_users,
        "unique_sessions": unique_sessions,
        "interaction_types": {it: count for it, count in interaction_types},
        "top_buttons": [{"name": name, "count": count} for name, count in top_buttons],
        "events_by_page": {page: count for page, count in events_by_page if page},
        "events_by_element_type": {et: count for et, count in events_by_element if et},
        "start_date": start_date,
        "end_date": end_date
    }

# Error tracking endpoints
class UIErrorCreate(BaseModel):
    user_id: Optional[int] = None
    session_id: Optional[str] = None
    error_message: str
    error_type: Optional[str] = None
    error_stack: Optional[str] = None
    error_source: Optional[str] = None
    line_number: Optional[int] = None
    column_number: Optional[int] = None
    page_path: Optional[str] = None
    page_context: Optional[str] = None
    route_name: Optional[str] = None
    error_metadata: Optional[Dict[str, Any]] = None
    user_agent: Optional[str] = None
    viewport_width: Optional[int] = None
    viewport_height: Optional[int] = None
    device_type: Optional[str] = None

class UIErrorResponse(BaseModel):
    id: int
    user_id: Optional[int]
    session_id: Optional[str]
    error_message: str
    error_type: Optional[str]
    error_stack: Optional[str]
    error_source: Optional[str]
    line_number: Optional[int]
    column_number: Optional[int]
    page_path: Optional[str]
    page_context: Optional[str]
    timestamp: datetime
    
    class Config:
        from_attributes = True

class ServiceErrorCreate(BaseModel):
    user_id: Optional[int] = None
    session_id: Optional[str] = None
    error_message: str
    error_type: Optional[str] = None
    status_code: Optional[int] = None
    severity: Optional[str] = None  # INFO, WARNING, ERROR
    request_url: Optional[str] = None
    request_method: Optional[str] = None
    request_headers: Optional[Dict[str, Any]] = None
    request_body: Optional[str] = None
    response_body: Optional[str] = None
    response_headers: Optional[Dict[str, Any]] = None
    service_name: Optional[str] = None
    endpoint: Optional[str] = None
    request_id: Optional[str] = None
    error_code: Optional[str] = None
    timeout_ms: Optional[int] = None
    error_metadata: Optional[Dict[str, Any]] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None

class ServiceErrorResponse(BaseModel):
    id: int
    user_id: Optional[int]
    session_id: Optional[str]
    error_message: str
    error_type: Optional[str]
    status_code: Optional[int]
    severity: Optional[str]  # INFO, WARNING, ERROR
    request_url: Optional[str]
    request_method: Optional[str]
    service_name: Optional[str]
    endpoint: Optional[str]
    request_id: Optional[str]
    error_code: Optional[str]
    timestamp: datetime
    
    class Config:
        from_attributes = True

@app.post("/errors/ui", response_model=UIErrorResponse, tags=["Errors"], summary="Create UI error")
async def create_ui_error(
    error: UIErrorCreate,
    db: Session = Depends(get_db)
):
    """Create a UI console error from the frontend"""
    db_error = UIError(
        user_id=error.user_id,
        session_id=error.session_id,
        error_message=error.error_message,
        error_type=error.error_type,
        error_stack=error.error_stack,
        error_source=error.error_source,
        line_number=error.line_number,
        column_number=error.column_number,
        page_path=error.page_path,
        page_context=error.page_context,
        route_name=error.route_name,
        error_metadata=error.error_metadata,
        user_agent=error.user_agent,
        viewport_width=error.viewport_width,
        viewport_height=error.viewport_height,
        device_type=error.device_type,
        timestamp=datetime.utcnow()
    )
    db.add(db_error)
    db.commit()
    db.refresh(db_error)
    return db_error

@app.post("/errors/services", response_model=ServiceErrorResponse, tags=["Errors"], summary="Create service error")
async def create_service_error(
    error: ServiceErrorCreate,
    db: Session = Depends(get_db)
):
    """Create a service/network error"""
    # Auto-determine severity from status_code if not provided
    severity = error.severity
    if not severity and error.status_code:
        if 500 <= error.status_code < 600:
            severity = "ERROR"
        elif 400 <= error.status_code < 500:
            # 404s might be INFO, others WARNING
            if error.status_code == 404:
                severity = "INFO"
            else:
                severity = "WARNING"
        else:
            severity = "INFO"
    elif not severity:
        severity = "ERROR"  # Default to ERROR if no status code
    
    db_error = ServiceError(
        user_id=error.user_id,
        session_id=error.session_id,
        error_message=error.error_message,
        error_type=error.error_type,
        status_code=error.status_code,
        severity=severity,
        request_url=error.request_url,
        request_method=error.request_method,
        request_headers=error.request_headers,
        request_body=error.request_body,
        response_body=error.response_body,
        response_headers=error.response_headers,
        service_name=error.service_name,
        endpoint=error.endpoint,
        request_id=error.request_id,
        error_code=error.error_code,
        timeout_ms=error.timeout_ms,
        error_metadata=error.error_metadata,
        user_agent=error.user_agent,
        ip_address=error.ip_address,
        timestamp=datetime.utcnow()
    )
    db.add(db_error)
    db.commit()
    db.refresh(db_error)
    return db_error

@app.get("/errors/ui", response_model=List[UIErrorResponse], tags=["Errors"], summary="Get UI errors")
async def get_ui_errors(
    user_id: Optional[int] = None,
    session_id: Optional[str] = None,
    error_type: Optional[str] = None,
    page_path: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get UI console errors"""
    query = db.query(UIError)
    
    if user_id:
        query = query.filter(UIError.user_id == user_id)
    if session_id:
        query = query.filter(UIError.session_id == session_id)
    if error_type:
        query = query.filter(UIError.error_type == error_type)
    if page_path:
        query = query.filter(UIError.page_path == page_path)
    if start_date:
        query = query.filter(UIError.timestamp >= start_date)
    if end_date:
        query = query.filter(UIError.timestamp <= end_date)
    
    errors = query.order_by(UIError.timestamp.desc()).limit(limit).all()
    return errors

@app.get("/errors/services", response_model=List[ServiceErrorResponse], tags=["Errors"], summary="Get service errors")
async def get_service_errors(
    user_id: Optional[int] = None,
    session_id: Optional[str] = None,
    service_name: Optional[str] = None,
    error_type: Optional[str] = None,
    status_code: Optional[int] = None,
    severity: Optional[str] = None,  # Filter by severity: INFO, WARNING, ERROR
    endpoint: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get service/network errors"""
    query = db.query(ServiceError)
    
    if user_id:
        query = query.filter(ServiceError.user_id == user_id)
    if session_id:
        query = query.filter(ServiceError.session_id == session_id)
    if service_name:
        query = query.filter(ServiceError.service_name == service_name)
    if error_type:
        query = query.filter(ServiceError.error_type == error_type)
    if status_code:
        query = query.filter(ServiceError.status_code == status_code)
    if severity:
        query = query.filter(ServiceError.severity == severity.upper())
    if endpoint:
        query = query.filter(ServiceError.endpoint == endpoint)
    if start_date:
        query = query.filter(ServiceError.timestamp >= start_date)
    if end_date:
        query = query.filter(ServiceError.timestamp <= end_date)
    
    errors = query.order_by(ServiceError.timestamp.desc()).limit(limit).all()
    return errors

@app.get("/errors/total", tags=["Errors"], summary="Get total errors")
async def get_total_errors(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[int] = None,
    session_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get total errors (UI + service errors) with summary statistics"""
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=7)
    if not end_date:
        end_date = datetime.utcnow()
    
    # Base queries
    ui_errors_query = db.query(UIError).filter(
        UIError.timestamp >= start_date,
        UIError.timestamp <= end_date
    )
    service_errors_query = db.query(ServiceError).filter(
        ServiceError.timestamp >= start_date,
        ServiceError.timestamp <= end_date
    )
    
    # Apply optional filters
    if user_id:
        ui_errors_query = ui_errors_query.filter(UIError.user_id == user_id)
        service_errors_query = service_errors_query.filter(ServiceError.user_id == user_id)
    if session_id:
        ui_errors_query = ui_errors_query.filter(UIError.session_id == session_id)
        service_errors_query = service_errors_query.filter(ServiceError.session_id == session_id)
    
    # Counts
    total_ui_errors = ui_errors_query.count()
    total_service_errors = service_errors_query.count()
    total_errors = total_ui_errors + total_service_errors
    
    # UI errors by type
    ui_errors_by_type = db.query(
        UIError.error_type,
        func.count(UIError.id).label('count')
    ).filter(
        UIError.timestamp >= start_date,
        UIError.timestamp <= end_date
    )
    if user_id:
        ui_errors_by_type = ui_errors_by_type.filter(UIError.user_id == user_id)
    if session_id:
        ui_errors_by_type = ui_errors_by_type.filter(UIError.session_id == session_id)
    ui_errors_by_type = ui_errors_by_type.group_by(UIError.error_type).all()
    
    # Service errors by type
    service_errors_by_type = db.query(
        ServiceError.error_type,
        func.count(ServiceError.id).label('count')
    ).filter(
        ServiceError.timestamp >= start_date,
        ServiceError.timestamp <= end_date
    )
    if user_id:
        service_errors_by_type = service_errors_by_type.filter(ServiceError.user_id == user_id)
    if session_id:
        service_errors_by_type = service_errors_by_type.filter(ServiceError.session_id == session_id)
    service_errors_by_type = service_errors_by_type.group_by(ServiceError.error_type).all()
    
    # Service errors by status code
    service_errors_by_status = db.query(
        ServiceError.status_code,
        func.count(ServiceError.id).label('count')
    ).filter(
        ServiceError.timestamp >= start_date,
        ServiceError.timestamp <= end_date
    )
    if user_id:
        service_errors_by_status = service_errors_by_status.filter(ServiceError.user_id == user_id)
    if session_id:
        service_errors_by_status = service_errors_by_status.filter(ServiceError.session_id == session_id)
    service_errors_by_status = service_errors_by_status.group_by(ServiceError.status_code).all()
    
    # Service errors by service name
    service_errors_by_service = db.query(
        ServiceError.service_name,
        func.count(ServiceError.id).label('count')
    ).filter(
        ServiceError.timestamp >= start_date,
        ServiceError.timestamp <= end_date
    )
    if user_id:
        service_errors_by_service = service_errors_by_service.filter(ServiceError.user_id == user_id)
    if session_id:
        service_errors_by_service = service_errors_by_service.filter(ServiceError.session_id == session_id)
    service_errors_by_service = service_errors_by_service.group_by(ServiceError.service_name).order_by(func.count(ServiceError.id).desc()).limit(10).all()
    
    # Service errors by severity
    service_errors_by_severity = db.query(
        ServiceError.severity,
        func.count(ServiceError.id).label('count')
    ).filter(
        ServiceError.timestamp >= start_date,
        ServiceError.timestamp <= end_date
    )
    if user_id:
        service_errors_by_severity = service_errors_by_severity.filter(ServiceError.user_id == user_id)
    if session_id:
        service_errors_by_severity = service_errors_by_severity.filter(ServiceError.session_id == session_id)
    service_errors_by_severity = service_errors_by_severity.group_by(ServiceError.severity).all()
    
    return {
        "total_errors": total_errors,
        "total_ui_errors": total_ui_errors,
        "total_service_errors": total_service_errors,
        "ui_errors_by_type": {et: count for et, count in ui_errors_by_type if et},
        "service_errors_by_type": {et: count for et, count in service_errors_by_type if et},
        "service_errors_by_status_code": {sc: count for sc, count in service_errors_by_status if sc},
        "service_errors_by_severity": {sv: count for sv, count in service_errors_by_severity if sv},
        "service_errors_by_service": {sn: count for sn, count in service_errors_by_service if sn},
        "start_date": start_date,
        "end_date": end_date
    }

# Session recording endpoints
class RecordedSessionCreate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    session_metadata: Optional[Dict[str, Any]] = None

class RecordedSessionResponse(BaseModel):
    id: int
    name: Optional[str]
    started_at: datetime
    ended_at: Optional[datetime]
    duration_seconds: Optional[int]
    notes: Optional[str]
    session_metadata: Optional[Dict[str, Any]]
    
    class Config:
        from_attributes = True

class RecordedSessionUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    session_metadata: Optional[Dict[str, Any]] = None

@app.post("/sessions/record", response_model=RecordedSessionResponse, tags=["Sessions"], summary="Start recording a session")
async def start_recording_session(
    session: RecordedSessionCreate,
    db: Session = Depends(get_db)
):
    """Start recording a new session"""
    db_session = RecordedSession(
        name=session.name,
        notes=session.notes,
        session_metadata=session.session_metadata,
        started_at=datetime.utcnow()
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    logger.info(f"Started recording session: ID={db_session.id}, name={session.name}")
    return db_session

@app.post("/sessions/record/{session_id}/end", response_model=RecordedSessionResponse, tags=["Sessions"], summary="End recording a session")
async def end_recording_session(
    session_id: int,
    update: Optional[RecordedSessionUpdate] = None,
    db: Session = Depends(get_db)
):
    """End recording a session"""
    db_session = db.query(RecordedSession).filter(RecordedSession.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if db_session.ended_at:
        raise HTTPException(status_code=400, detail="Session already ended")
    
    db_session.ended_at = datetime.utcnow()
    duration = (db_session.ended_at - db_session.started_at).total_seconds()
    db_session.duration_seconds = int(duration)
    
    if update:
        if update.name is not None:
            db_session.name = update.name
        if update.notes is not None:
            db_session.notes = update.notes
        if update.session_metadata is not None:
            db_session.session_metadata = update.session_metadata
    
    db.commit()
    db.refresh(db_session)
    logger.info(f"Ended recording session: ID={session_id}, duration={db_session.duration_seconds}s")
    return db_session

@app.get("/sessions/record", response_model=List[RecordedSessionResponse], tags=["Sessions"], summary="List recorded sessions")
async def list_recorded_sessions(
    limit: int = 100,
    include_active: bool = True,
    db: Session = Depends(get_db)
):
    """List all recorded sessions"""
    query = db.query(RecordedSession)
    
    if not include_active:
        query = query.filter(RecordedSession.ended_at.isnot(None))
    
    sessions = query.order_by(RecordedSession.started_at.desc()).limit(limit).all()
    return sessions

@app.get("/sessions/record/{session_id}", response_model=RecordedSessionResponse, tags=["Sessions"], summary="Get a recorded session")
async def get_recorded_session(
    session_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific recorded session"""
    session = db.query(RecordedSession).filter(RecordedSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.get("/health", tags=["Health"], summary="Health check")
async def health():
    return {"status": "ok", "service": "observability-service"}

@app.get("/test-event", tags=["Health"], summary="Test event creation")
async def test_event(db: Session = Depends(get_db)):
    """Test endpoint to verify event creation works"""
    try:
        test_event = UserEvent(
            event_type="test_event",
            event_category="test",
            event_metadata={"test": True, "timestamp": datetime.utcnow().isoformat()},
            service_name="test",
            timestamp=datetime.utcnow()
        )
        db.add(test_event)
        db.commit()
        db.refresh(test_event)
        logger.info(f"Test event created: ID={test_event.id}")
        return {
            "status": "success",
            "message": "Test event created successfully",
            "event_id": test_event.id,
            "event": {
                "id": test_event.id,
                "event_type": test_event.event_type,
                "timestamp": test_event.timestamp.isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error creating test event: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create test event: {str(e)}")