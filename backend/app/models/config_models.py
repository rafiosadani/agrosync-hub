from typing import Optional, List
from pydantic import BaseModel, Field

class DatabaseNodeConfig(BaseModel):
    CompanyName: str = Field(..., description="Nama entitas/perusahaan, misal: API, ANR, TTM")
    ServerPusat: str = Field(..., description="Host dan port server pusat, misal: localhost,1433")
    DatabasePusat: str = Field(..., description="Nama database pusat")
    UserPusat: str = Field(..., description="Username login SQL Server pusat")
    PasswordPusat: str = Field(..., description="Password login SQL Server pusat")
    ServerLokal: str = Field(..., description="Host dan port server lokal, misal: localhost,1434")
    DatabaseLokal: str = Field(..., description="Nama database lokal")
    UserLokal: str = Field(..., description="Username login SQL Server lokal")
    PasswordLokal: str = Field(..., description="Password login SQL Server lokal")

class DatabaseNodeMasked(BaseModel):
    id: int
    CompanyName: str
    ServerPusat: str
    DatabasePusat: str
    UserPusat: str
    PasswordPusat: str = "••••••••"
    ServerLokal: str
    DatabaseLokal: str
    UserLokal: str
    PasswordLokal: str = "••••••••"

class DatabaseNodeUpdate(BaseModel):
    CompanyName: Optional[str] = None
    ServerPusat: Optional[str] = None
    DatabasePusat: Optional[str] = None
    UserPusat: Optional[str] = None
    PasswordPusat: Optional[str] = None  # Jika tidak diubah atau tetap "••••••••", gunakan password lama
    ServerLokal: Optional[str] = None
    DatabaseLokal: Optional[str] = None
    UserLokal: Optional[str] = None
    PasswordLokal: Optional[str] = None  # Jika tidak diubah atau tetap "••••••••", gunakan password lama

class ConnectionTestRequest(BaseModel):
    server: str
    database: str
    user: str
    password: str
    node_id: Optional[int] = None
    role: Optional[str] = "pusat"

class ConnectionTestResponse(BaseModel):
    success: bool
    latency_ms: float = 0.0
    message: str
    version: Optional[str] = None
    server_online: bool = False
    database_exists: bool = False

class CreateDatabaseRequest(BaseModel):
    server: str
    database: str
    user: str
    password: str
    node_id: Optional[int] = None
    role: Optional[str] = "lokal"

class CreateDatabaseResponse(BaseModel):
    success: bool
    message: str


class FetchDatabasesRequest(BaseModel):
    server: str
    user: str
    password: str
    node_id: Optional[int] = None
    role: Optional[str] = "pusat"


class FetchDatabasesResponse(BaseModel):
    success: bool
    databases: List[str] = []
    message: str


class BatchCreateConfigRequest(BaseModel):
    nodes: List[DatabaseNodeConfig]


class BatchCreateConfigResponse(BaseModel):
    success: bool
    message: str
    nodes: List[DatabaseNodeMasked] = []


class BatchUpdateCredentialsRequest(BaseModel):
    node_ids: List[int] = Field(..., description="Daftar ID node yang akan diperbarui kredensialnya")
    ServerPusat: Optional[str] = None
    UserPusat: Optional[str] = None
    PasswordPusat: Optional[str] = None
    ServerLokal: Optional[str] = None
    UserLokal: Optional[str] = None
    PasswordLokal: Optional[str] = None


class BatchUpdateCredentialsResponse(BaseModel):
    success: bool
    message: str
    updated_count: int = 0
    nodes: List[DatabaseNodeMasked] = []


