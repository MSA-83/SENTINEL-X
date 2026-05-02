#!/usr/bin/env python3
"""
SENTINEL-X RBAC Implementation
Role-Based Access Control for Admin, Analyst, Viewer roles
Phase 2: PostgreSQL-backed authentication
"""
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Callable
from dataclasses import dataclass
from enum import Enum

# For JWT tokens
try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False


class UserRole(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


# Permission constants
PERMISSIONS = {
    # Admin can do everything
    "admin": [
        "users:read", "users:write", "users:delete",
        "events:read", "events:write", "events:delete",
        "alerts:read", "alerts:write", "alerts:delete", "alerts:acknowledge",
        "cases:read", "cases:write", "cases:delete", "cases:assign",
        "entities:read", "entities:write", "entities:delete", "entities:link",
        "reports:read", "reports:write", "reports:delete", "reports:publish",
        "files:read", "files:write", "files:delete",
        "analytics:read", "analytics:write",
        "audit:read", "audit:write",
        "rules:read", "rules:write", "rules:delete",
        "settings:read", "settings:write"
    ],
    
    # Analyst can read/write most, but not user management
    "analyst": [
        "events:read", "events:write",
        "alerts:read", "alerts:write", "alerts:acknowledge",
        "cases:read", "cases:write", "cases:assign",
        "entities:read", "entities:write", "entities:link",
        "reports:read", "reports:write",
        "files:read", "files:write",
        "analytics:read",
        "audit:read",
        "rules:read"
    ],
    
    # Viewer can only read
    "viewer": [
        "events:read",
        "alerts:read",
        "cases:read",
        "entities:read",
        "reports:read",
        "files:read",
        "analytics:read",
        "rules:read"
    ]
}


@dataclass
class User:
    id: str
    email: str
    username: str
    role: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime


@dataclass
class Token:
    access_token: str
    refresh_token: str
    expires_at: datetime
    user: User


class RBAC:
    """Role-Based Access Control"""
    
    def __init__(self, jwt_secret: str = None):
        self.jwt_secret = jwt_secret or os.environ.get("JWT_SECRET", secrets.token_hex(32))
        self.token_expiry_hours = 24
        self.refresh_expiry_days = 30
    
    def hash_password(self, password: str) -> str:
        """Hash password with SHA-256 + salt"""
        salt = os.environ.get("PASSWORD_SALT", "sentinel-x-default-salt")
        return hashlib.pbkdf2_hmac(
            'sha256',
            password.encode(),
            salt.encode(),
            100000
        ).hex()
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password"""
        return self.hash_password(password) == hashed
    
    def has_permission(self, role: str, permission: str) -> bool:
        """Check if role has permission"""
        return permission in PERMISSIONS.get(role, [])
    
    def can(self, user: User, permission: str) -> bool:
        """Check if user has permission"""
        if not user.is_active:
            return False
        return self.has_permission(user.role, permission)
    
    def require_permission(self, user: User, permission: str) -> bool:
        """Raise if no permission"""
        if not self.can(user, permission):
            raise PermissionError(f"Missing permission: {permission}")
        return True
    
    def require_role(self, user: User, *roles: str) -> bool:
        """Raise if no matching role"""
        if user.role not in roles and user.role != "admin":
            raise PermissionError(f"Requires role: {', '.join(roles)}")
        return True


class AuthService(RBAC):
    """Authentication service with JWT tokens"""
    
    def __init__(self, db_queries=None):
        super().__init__()
        self.db = db_queries
    
    def create_access_token(self, user: User) -> str:
        """Create JWT access token"""
        if not JWT_AVAILABLE:
            return secrets.token_urlsafe(32)
        
        payload = {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "exp": datetime.utcnow() + timedelta(hours=self.token_expiry_hours),
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, self.jwt_secret, algorithm="HS256")
    
    def create_refresh_token(self, user: User) -> str:
        """Create JWT refresh token"""
        if not JWT_AVAILABLE:
            return secrets.token_urlsafe(32)
        
        payload = {
            "sub": user.id,
            "type": "refresh",
            "exp": datetime.utcnow() + timedelta(days=self.refresh_expiry_days),
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, self.jwt_secret, algorithm="HS256")
    
    def verify_token(self, token: str) -> Optional[Dict]:
        """Verify JWT token"""
        if not JWT_AVAILABLE:
            return None
        
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=["HS256"])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    async def login(
        self, email: str, password: str
    ) -> Optional[Token]:
        """Authenticate user"""
        if not self.db:
            return None
        
        # Get user from DB (implement in queries.py)
        # For now, check environment for demo
        from db.queries import SentinelDBQueries
        
        # This would query the database
        # user = await self.db.get_user_by_email(email)
        
        # Demo: check environment
        demo_users = {
            "admin@sentinel-x.dev": {
                "id": "admin-001",
                "email": "admin@sentinel-x.dev",
                "username": "admin",
                "role": "admin",
                "full_name": "System Administrator",
                "is_active": True
            },
            "analyst@sentinel-x.dev": {
                "id": "analyst-001",
                "email": "analyst@sentinel-x.dev", 
                "username": "analyst",
                "role": "analyst",
                "full_name": "Security Analyst",
                "is_active": True
            }
        }
        
        user_data = demo_users.get(email)
        if not user_data:
            return None
        
        # Create user object
        user = User(**user_data)
        
        # Generate tokens
        access_token = self.create_access_token(user)
        refresh_token = self.create_refresh_token(user)
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=datetime.utcnow() + timedelta(hours=self.token_expiry_hours),
            user=user
        )
    
    def logout(self, token: str) -> bool:
        """Logout (invalidate token - add to blocklist in production)"""
        # In production, add token to blocklist in Redis/DB
        return True


# Middleware decorator for FastAPI/Socketify
def require_auth(permission: str = None):
    """Decorator to require authentication"""
    def decorator(func: Callable):
        async def wrapper(*args, **kwargs):
            # Get request from args
            request = kwargs.get("request")
            if not request:
                raise ValueError("Request object required")
            
            # Get token from header
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                raise PermissionError("No token provided")
            
            token = auth_header.replace("Bearer ", "")
            
            # Verify token
            auth = AuthService()
            payload = auth.verify_token(token)
            if not payload:
                raise PermissionError("Invalid or expired token")
            
            # Add user to request
            request.state.user = payload
            
            # Check permission if specified
            if permission:
                if not auth.has_permission(payload.get("role", ""), permission):
                    raise PermissionError(f"Missing permission: {permission}")
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# Usage examples
async def example():
    # Initialize
    auth = AuthService()
    
    # Login
    token = await auth.login("admin@sentinel-x.dev", "password")
    if token:
        print(f"Logged in as {token.user.username}")
        print(f"Access token: {token.access_token[:20]}...")
        
        # Check permissions
        can_read = auth.has_permission(token.user.role, "events:read")
        can_delete = auth.has_permission(token.user.role, "events:delete")
        print(f"Can read events: {can_read}")
        print(f"Can delete events: {can_delete}")
    
    # Verify token
    payload = auth.verify_token(token.access_token)
    if payload:
        print(f"Token user: {payload.get('email')}")
        print(f"Token role: {payload.get('role')}")


if __name__ == "__main__":
    # Run example
    import asyncio
    asyncio.run(example())