"""
OpenTelemetry setup for observability service
"""
from opentelemetry import trace, metrics, _logs
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
import os
import logging

def setup_opentelemetry(service_name: str, otel_collector_url: str = None):
    """
    Initialize OpenTelemetry for the observability service
    
    Args:
        service_name: Name of the service (e.g., 'observability-service')
        otel_collector_url: URL of OTEL Collector (default: from env or localhost)
    """
    if otel_collector_url is None:
        otel_collector_url = os.getenv("OTEL_COLLECTOR_URL", "http://localhost:4317")
    
    # Create resource with service name
    resource = Resource.create({
        "service.name": service_name,
        "service.namespace": "observability",
        "deployment.environment": os.getenv("ENVIRONMENT", "development")
    })
    
    # Setup Tracing
    trace.set_tracer_provider(TracerProvider(resource=resource))
    tracer_provider = trace.get_tracer_provider()
    
    # Export traces to OTEL Collector
    otlp_trace_exporter = OTLPSpanExporter(
        endpoint=otel_collector_url,
        insecure=True
    )
    span_processor = BatchSpanProcessor(otlp_trace_exporter)
    tracer_provider.add_span_processor(span_processor)
    
    # Setup Metrics
    otlp_metric_exporter = OTLPMetricExporter(
        endpoint=otel_collector_url,
        insecure=True
    )
    metric_reader = PeriodicExportingMetricReader(
        otlp_metric_exporter,
        export_interval_millis=5000
    )
    metrics.set_meter_provider(MeterProvider(
        resource=resource,
        metric_readers=[metric_reader]
    ))
    
    # Setup Logging
    log_provider = LoggerProvider(resource=resource)
    _logs.set_logger_provider(log_provider)
    
    otlp_log_exporter = OTLPLogExporter(
        endpoint=otel_collector_url,
        insecure=True
    )
    log_provider.add_log_record_processor(BatchLogRecordProcessor(otlp_log_exporter))
    
    # Configure Python logging to use OpenTelemetry
    handler = LoggingHandler(logger_provider=log_provider)
    logging.getLogger().addHandler(handler)
    logging.getLogger().setLevel(logging.INFO)
    
    # Don't propagate to root logger to avoid duplicate logs
    logging.getLogger().propagate = False
    
    print(f"OpenTelemetry initialized for {service_name} with endpoint {otel_collector_url}")
    return trace.get_tracer(__name__), metrics.get_meter(__name__)

def instrument_fastapi(app, service_name: str):
    """Auto-instrument FastAPI application"""
    FastAPIInstrumentor.instrument_app(app)

def instrument_sqlalchemy(engine):
    """Auto-instrument SQLAlchemy"""
    SQLAlchemyInstrumentor().instrument(engine=engine)

