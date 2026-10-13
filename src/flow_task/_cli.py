def main() -> None:
    """Console entry point: run the app with uvicorn using HOST/PORT settings."""
    import uvicorn

    from flow_task.core.config import get_settings

    settings = get_settings()
    uvicorn.run("flow_task.main:app", host=settings.host, port=settings.port, log_config=None)
