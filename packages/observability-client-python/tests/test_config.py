"""Tests for configuration module."""

import pytest
import os

from observability_client.config import (
    ObservabilityConfig,
    get_config,
    set_config,
    reset_config,
)


def test_config_defaults():
    """Test that config has sensible defaults."""
    config = ObservabilityConfig()
    assert config.service_url == "http://localhost:8006"
    assert config.service_name == "python-service"
    assert config.timeout == 10.0
    assert config.max_retries == 3
    assert config.dev_mode is False
    assert config.test_mode is False


def test_config_from_env(monkeypatch):
    """Test that config can be set from environment variables."""
    monkeypatch.setenv("OBSERVABILITY_SERVICE_URL", "http://test:8080")
    monkeypatch.setenv("OBSERVABILITY_SERVICE_NAME", "env-service")
    monkeypatch.setenv("OBSERVABILITY_DEV_MODE", "true")

    config = ObservabilityConfig()
    assert config.service_url == "http://test:8080"
    assert config.service_name == "env-service"
    assert config.dev_mode is True


def test_config_custom_values():
    """Test that config can be created with custom values."""
    config = ObservabilityConfig(
        service_url="http://custom:9000",
        service_name="custom-service",
        timeout=20.0,
        max_retries=5,
        dev_mode=True,
        test_mode=True,
    )
    assert config.service_url == "http://custom:9000"
    assert config.service_name == "custom-service"
    assert config.timeout == 20.0
    assert config.max_retries == 5
    assert config.dev_mode is True
    assert config.test_mode is True


def test_global_config():
    """Test global config management."""
    # Get default config
    config1 = get_config()
    assert config1.service_url == "http://localhost:8006"

    # Set custom config
    custom_config = ObservabilityConfig(service_url="http://custom:8080")
    set_config(custom_config)

    # Get should return custom config
    config2 = get_config()
    assert config2.service_url == "http://custom:8080"

    # Reset to defaults
    reset_config()
    config3 = get_config()
    assert config3.service_url == "http://localhost:8006"
