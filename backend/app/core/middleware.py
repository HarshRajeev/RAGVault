from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()
        content_length = request.headers.get("content-length")
        if (
            request.url.path.startswith("/api/documents")
            and content_length
            and int(content_length) > settings.max_upload_bytes
        ):
            return JSONResponse(
                {"detail": f"Upload exceeds the {settings.max_upload_mb}MB limit."},
                status_code=413,
            )

        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response
