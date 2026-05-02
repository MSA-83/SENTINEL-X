"""
SENTINEL-X API Error Handling
Standardized error responses and exception handlers
"""
from typing import Optional, Any
from datetime import datetime
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
import aiohttp
import logging

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base API Error"""
    
    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[dict] = None
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(APIError):
    """Resource not found"""
    
    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            message=f"{resource} not found: {identifier}",
            code="NOT_FOUND",
            status_code=404,
            details={"resource": resource, "identifier": str(identifier)}
        )


class UnauthorizedError(APIError):
    """Authentication required"""
    
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=401
        )


class ForbiddenError(APIError):
    """Permission denied"""
    
    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=403
        )


class ValidationError(APIError):
    """Request validation failed"""
    
    def __init__(self, message: str, field: Optional[str] = None):
        details = {}
        if field:
            details["field"] = field
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422,
            details=details
        )


class ConflictError(APIError):
    """Resource conflict"""
    
    def __init__(self, message: str):
        super().__init__(
            message=message,
            code="CONFLICT",
            status_code=409
        )


class RateLimitError(APIError):
    """Rate limit exceeded"""
    
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details={"retry_after": 60}
        )


class ExternalServiceError(APIError):
    """External service unavailable"""
    
    def __init__(self, service: str):
        super().__init__(
            message=f"External service unavailable: {service}",
            code="SERVICE_UNAVAILABLE",
            status_code=503,
            details={"service": service}
        )


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: Optional[dict] = None
) -> JSONResponse:
    """Create standardized error response"""
    content = {
        "error": {
            "code": code,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
        }
    }
    if details:
        content["error"]["details"] = details
    
    return JSONResponse(
        status_code=status_code,
        content=content
    )


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    """Handle API errors"""
    logger.error(f"API Error: {exc.code} - {exc.message}")
    
    return error_response(
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        details=exc.details
    )


async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Handle database errors"""
    logger.error(f"Database Error: {str(exc)}")
    
    return error_response(
        status_code=500,
        code="DATABASE_ERROR",
        message="Database operation failed"
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle validation errors"""
    errors = exc.errors()
    details = {"errors": errors}
    
    return error_response(
        status_code=422,
        code="VALIDATION_ERROR",
        message="Request validation failed",
        details=details
    )


async def aiohttp_error_handler(request: Request, exc: aiohttp.ClientError) -> JSONResponse:
    """Handle HTTP client errors"""
    logger.error(f"HTTP Client Error: {str(exc)}")
    
    return error_response(
        status_code=502,
        code="UPSTREAM_ERROR",
        message="External service request failed"
    )


async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle generic errors"""
    logger.error(f"Unhandled Error: {str(exc)}", exc_info=True)
    
    return error_response(
        status_code=500,
        code="INTERNAL_ERROR",
        message="An unexpected error occurred"
    )


def setup_error_handlers(app):
    """Setup all error handlers"""
    from fastapi import FastAPI
    
    app.add_exception_handler(APIError, api_error_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(aiohttp.ClientError, aiohttp_error_handler)
    app.add_exception_handler(Exception, generic_error_handler)


class ErrorCodes:
    """Standard error codes"""
    NOT_FOUND = "NOT_FOUND"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    CONFLICT = "CONFLICT"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    DATABASE_ERROR = "DATABASE_ERROR"
    UPSTREAM_ERROR = "UPSTREAM_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"