#!/usr/bin/env python3
"""
Script to manually create database tables for the observability service.
Use this if tables weren't created automatically on service startup.
"""
import os
import sys
from sqlalchemy import create_engine, inspect
from models import Base
# Import all models to ensure they're registered with Base
from models import UserEvent, UserSession, UIEvent, UIError, ServiceError, RecordedSession

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://eval_user:eval_pass@localhost:5437/observability_db"
)

def create_tables():
    """Create all tables if they don't exist"""
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 10}
    )
    
    # Check existing tables
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    print(f"Existing tables: {existing_tables}")
    
    # Create all tables
    print("\nCreating tables...")
    Base.metadata.create_all(bind=engine)
    
    # Verify tables were created
    inspector = inspect(engine)
    new_tables = inspector.get_table_names()
    
    print(f"\nTables after creation: {new_tables}")
    
    # Check specifically for error tables
    if 'ui_errors' in new_tables:
        print("✓ ui_errors table created successfully")
    else:
        print("✗ ui_errors table NOT found")
    
    if 'service_errors' in new_tables:
        print("✓ service_errors table created successfully")
    else:
        print("✗ service_errors table NOT found")
    
    if 'recorded_sessions' in new_tables:
        print("✓ recorded_sessions table created successfully")
    else:
        print("✗ recorded_sessions table NOT found")
    
    print("\nDone!")

if __name__ == "__main__":
    create_tables()

