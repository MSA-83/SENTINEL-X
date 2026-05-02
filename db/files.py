#!/usr/bin/env python3
"""
SENTINEL-X File Storage Service
Phase 2: Free tier file storage (Supabase Storage, S3, or local)
"""
import os
import hashlib
import secrets
import aiohttp
import asyncio
from datetime import datetime
from typing import Optional, Dict, Binary
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class StorageProvider(str, Enum):
    SUPABASE = "supabase"
    S3 = "s3"
    LOCAL = "local"


@dataclass
class FileMetadata:
    id: str
    filename: str
    original_filename: str
    mime_type: str
    file_size: int
    file_hash: str
    storage_provider: str
    storage_path: str
    download_url: str
    uploaded_by: str
    created_at: datetime


class FileStorage:
    """Unified file storage interface"""
    
    def __init__(
        self,
        provider: StorageProvider = None,
        config: Dict = None
    ):
        self.provider = provider or StorageProvider(
            os.environ.get("STORAGE_PROVIDER", "local")
        )
        self.config = config or {}
        self.bucket = self.config.get("bucket", "sentinel-evidence")
        self.base_path = self.config.get("base_path", "/tmp/sentinel-files")
    
    # ==================== UPLOAD ====================
    
    async def upload_file(
        self,
        file_data: bytes,
        filename: str,
        mime_type: str,
        user_id: str,
        entity_id: Optional[str] = None,
        case_id: Optional[str] = None,
        event_id: Optional[str] = None
    ) -> FileMetadata:
        """Upload a file"""
        # Generate unique ID
        file_id = secrets.token_urlsafe(16)
        
        # Calculate hash
        file_hash = hashlib.sha256(file_data).hexdigest()
        
        # Generate storage path
        date_path = datetime.now().strftime("%Y/%m/%d")
        storage_path = f"{date_path}/{file_id}_{filename}"
        
        # Upload based on provider
        if self.provider == StorageProvider.SUPABASE:
            return await self._upload_supabase(
                file_data, filename, mime_type, file_id, storage_path, user_id
            )
        elif self.provider == StorageProvider.S3:
            return await self._upload_s3(
                file_data, filename, mime_type, file_id, storage_path, user_id
            )
        else:
            return await self._upload_local(
                file_data, filename, mime_type, file_id, storage_path, user_id
            )
    
    async def _upload_supabase(
        self,
        file_data: bytes,
        filename: str,
        mime_type: str,
        file_id: str,
        storage_path: str,
        user_id: str
    ) -> FileMetadata:
        """Upload to Supabase Storage"""
        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        
        if not supabase_url or not supabase_key:
            raise ValueError("Supabase credentials not configured")
        
        url = f"{supabase_url}/storage/v1/object/{self.bucket}/{storage_path}"
        
        headers = {
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": mime_type
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.put(url, data=file_data, headers=headers) as resp:
                if resp.status not in (200, 201):
                    raise Exception(f"Upload failed: {resp.status}")
                
                data = await resp.json()
        
        # Generate download URL
        download_url = f"{supabase_url}/storage/v1/object/public/{self.bucket}/{storage_path}"
        
        return FileMetadata(
            id=file_id,
            filename=filename,
            original_filename=filename,
            mime_type=mime_type,
            file_size=len(file_data),
            file_hash=hashlib.sha256(file_data).hexdigest(),
            storage_provider="supabase",
            storage_path=storage_path,
            download_url=download_url,
            uploaded_by=user_id,
            created_at=datetime.now()
        )
    
    async def _upload_s3(
        self,
        file_data: bytes,
        filename: str,
        mime_type: str,
        file_id: str,
        storage_path: str,
        user_id: str
    ) -> FileMetadata:
        """Upload to S3 (AWS or compatible)"""
        # For production, use boto3
        # This is a placeholder for S3 integration
        raise NotImplementedError("S3 upload requires boto3 configuration")
    
    async def _upload_local(
        self,
        file_data: bytes,
        filename: str,
        mime_type: str,
        file_id: str,
        storage_path: str,
        user_id: str
    ) -> FileMetadata:
        """Upload to local filesystem"""
        # Create directory
        full_path = Path(self.base_path) / storage_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write file
        full_path.write_bytes(file_data)
        
        # Generate download URL (local)
        download_url = f"/files/{storage_path}"
        
        return FileMetadata(
            id=file_id,
            filename=filename,
            original_filename=filename,
            mime_type=mime_type,
            file_size=len(file_data),
            file_hash=hashlib.sha256(file_data).hexdigest(),
            storage_provider="local",
            storage_path=storage_path,
            download_url=download_url,
            uploaded_by=user_id,
            created_at=datetime.now()
        )
    
    # ==================== DOWNLOAD ====================
    
    async def download_file(self, storage_path: str) -> Optional[bytes]:
        """Download a file"""
        if self.provider == StorageProvider.SUPABASE:
            return await self._download_supabase(storage_path)
        elif self.provider == StorageProvider.S3:
            return await self._download_s3(storage_path)
        else:
            return await self._download_local(storage_path)
    
    async def _download_supabase(self, storage_path: str) -> bytes:
        """Download from Supabase"""
        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        
        url = f"{supabase_url}/storage/v1/object/{self.bucket}/{storage_path}"
        
        headers = {"Authorization": f"Bearer {supabase_key}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    raise Exception(f"Download failed: {resp.status}")
                return await resp.read()
    
    async def _download_s3(self, storage_path: str) -> bytes:
        """Download from S3"""
        raise NotImplementedError("S3 download requires boto3")
    
    async def _download_local(self, storage_path: str) -> bytes:
        """Download from local"""
        full_path = Path(self.base_path) / storage_path
        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {storage_path}")
        return full_path.read_bytes()
    
    # ==================== DELETE ====================
    
    async def delete_file(self, storage_path: str) -> bool:
        """Delete a file"""
        if self.provider == StorageProvider.SUPABASE:
            return await self._delete_supabase(storage_path)
        elif self.provider == StorageProvider.S3:
            return await self._delete_s3(storage_path)
        else:
            return await self._delete_local(storage_path)
    
    async def _delete_supabase(self, storage_path: str) -> bool:
        """Delete from Supabase"""
        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        
        url = f"{supabase_url}/storage/v1/object/{self.bucket}/{storage_path}"
        headers = {"Authorization": f"Bearer {supabase_key}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.delete(url, headers=headers) as resp:
                return resp.status in (200, 204)
    
    async def _delete_s3(self, storage_path: str) -> bool:
        """Delete from S3"""
        raise NotImplementedError("S3 delete requires boto3")
    
    async def _delete_local(self, storage_path: str) -> bool:
        """Delete local file"""
        full_path = Path(self.base_path) / storage_path
        if full_path.exists():
            full_path.unlink()
            return True
        return False
    
    # ==================== GENERATE PRE-SIGNED URL ====================
    
    async def get_presigned_url(
        self,
        storage_path: str,
        expires_in: int = 3600
    ) -> str:
        """Generate pre-signed URL for download"""
        if self.provider == StorageProvider.SUPABASE:
            # Supabase doesn't need pre-signed URLs (public by default)
            supabase_url = os.environ.get("SUPABASE_URL", "")
            return f"{supabase_url}/storage/v1/object/public/{self.bucket}/{storage_path}"
        
        elif self.provider == StorageProvider.S3:
            # Generate S3 pre-signed URL (requires boto3)
            raise NotImplementedError("S3 presigned requires boto3")
        
        else:
            # Local - just return the path
            return f"/files/{storage_path}"


# FastAPI file upload endpoint
async def upload_endpoint(request) -> Dict:
    """Handle file upload from request"""
    # This would integrate with FastAPI
    
    # Get file from form
    form = await request.form()
    file = form.get("file")
    if not file:
        return {"error": "No file provided"}
    
    # Read file data
    file_data = await file.read()
    filename = file.filename
    mime_type = file.content_type
    
    # Get user from auth
    user_id = request.state.user.get("sub") if hasattr(request.state, "user") else "unknown"
    
    # Get entity/case/event IDs
    entity_id = form.get("entity_id")
    case_id = form.get("case_id")
    event_id = form.get("event_id")
    
    # Upload
    storage = FileStorage()
    metadata = await storage.upload_file(
        file_data, filename, mime_type, user_id,
        entity_id, case_id, event_id
    )
    
    return {
        "id": metadata.id,
        "filename": metadata.filename,
        "download_url": metadata.download_url,
        "file_size": metadata.file_size,
        "mime_type": metadata.mime_type,
        "created_at": metadata.created_at.isoformat()
    }


async def download_endpoint(request, file_id: str) -> bytes:
    """Handle file download"""
    # Get storage path from DB (file_id -> storage_path)
    # Then call storage.download_file(storage_path)
    pass


# Example usage
async def example():
    # Initialize storage
    storage = FileStorage(
        provider=StorageProvider.LOCAL,
        config={"base_path": "/tmp/sentinel-files"}
    )
    
    # Upload a file
    test_data = b"Test evidence file content"
    metadata = await storage.upload_file(
        test_data,
        "evidence.txt",
        "text/plain",
        "user-001",
        entity_id="entity-001",
        case_id="case-001"
    )
    
    print(f"Uploaded: {metadata.filename}")
    print(f"URL: {metadata.download_url}")
    print(f"Size: {metadata.file_size} bytes")
    print(f"Hash: {metadata.file_hash}")
    
    # Download
    data = await storage.download_file(metadata.storage_path)
    print(f"Downloaded: {len(data)} bytes")
    
    # Delete
    await storage.delete_file(metadata.storage_path)
    print("Deleted")


if __name__ == "__main__":
    import asyncio
    asyncio.run(example())