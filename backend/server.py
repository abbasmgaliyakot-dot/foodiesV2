from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import socketio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer()

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "staff"  # staff or admin

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TableCreate(BaseModel):
    table_number: str
    capacity: int

class TableResponse(BaseModel):
    id: str
    table_number: str
    capacity: int
    status: str  # available, running, closed
    current_order_id: Optional[str] = None

class MenuItemCreate(BaseModel):
    name: str
    category: str
    price: float
    description: Optional[str] = None

class MenuItemResponse(BaseModel):
    id: str
    name: str
    category: str
    price: float
    description: Optional[str] = None

class OrderItemCreate(BaseModel):
    menu_item_id: Optional[str] = None
    item_name: str
    quantity: int
    price: float
    is_manual: bool = False

class OrderItem(BaseModel):
    id: str
    menu_item_id: Optional[str] = None
    item_name: str
    quantity: int
    price: float
    is_manual: bool
    is_new: bool = True
    added_at: str

class OrderCreate(BaseModel):
    table_id: str

class OrderAddItems(BaseModel):
    items: List[OrderItemCreate]

class OrderResponse(BaseModel):
    id: str
    table_id: str
    table_number: str
    items: List[OrderItem]
    subtotal: float
    tax_amount: float = 0.0
    tax_rate: float = 0.0
    total: float
    status: str  # active, completed, cancelled
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None

class SettingsResponse(BaseModel):
    currency_symbol: str
    currency_code: str
    tax_enabled: bool = False
    tax_rate: float = 0.0
    tax_name: str = "Tax"

class SettingsUpdate(BaseModel):
    currency_symbol: str
    currency_code: str
    tax_enabled: bool = False
    tax_rate: float = 0.0
    tax_name: str = "Tax"

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return UserResponse(**user)

# Generate unique ID
import uuid
def generate_id() -> str:
    return str(uuid.uuid4())

# Socket.IO events
@sio.event
async def connect(sid, environ):
    logging.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logging.info(f"Client disconnected: {sid}")

# Auth Routes
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"username": user.username}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user_id = generate_id()
    user_doc = {
        "id": user_id,
        "username": user.username,
        "password_hash": hash_password(user.password),
        "role": user.role
    }
    
    await db.users.insert_one(user_doc)
    return UserResponse(id=user_id, username=user.username, role=user.role)

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    db_user = await db.users.find_one({"username": user.username}, {"_id": 0})
    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token({"sub": db_user["id"]})
    user_response = UserResponse(id=db_user["id"], username=db_user["username"], role=db_user["role"])
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)

# User Management Routes
@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).limit(1000).to_list(None)
    return [UserResponse(**user) for user in users]

@api_router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: str, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return None

# Table Routes
@api_router.post("/tables", response_model=TableResponse)
async def create_table(table: TableCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if table number exists
    existing = await db.tables.find_one({"table_number": table.table_number}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Table number already exists")
    
    table_id = generate_id()
    table_doc = {
        "id": table_id,
        "table_number": table.table_number,
        "capacity": table.capacity,
        "status": "available",
        "current_order_id": None
    }
    
    await db.tables.insert_one(table_doc)
    await sio.emit('table_updated', table_doc)
    return TableResponse(**table_doc)

@api_router.get("/tables", response_model=List[TableResponse])
async def get_tables(current_user: UserResponse = Depends(get_current_user)):
    tables = await db.tables.find({}, {"_id": 0}).limit(1000).to_list(None)
    return [TableResponse(**table) for table in tables]

@api_router.put("/tables/{table_id}", response_model=TableResponse)
async def update_table(table_id: str, table: TableCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.tables.find_one_and_update(
        {"id": table_id},
        {"$set": {"table_number": table.table_number, "capacity": table.capacity}},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Table not found")
    
    result.pop('_id', None)
    await sio.emit('table_updated', result)
    return TableResponse(**result)

@api_router.delete("/tables/{table_id}", status_code=204)
async def delete_table(table_id: str, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.tables.delete_one({"id": table_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    
    await sio.emit('table_deleted', {"table_id": table_id})
    return None

# Menu Routes
@api_router.post("/menu", response_model=MenuItemResponse)
async def create_menu_item(item: MenuItemCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    item_id = generate_id()
    item_doc = {
        "id": item_id,
        "name": item.name,
        "category": item.category,
        "price": item.price,
        "description": item.description
    }
    
    await db.menu_items.insert_one(item_doc)
    return MenuItemResponse(**item_doc)

@api_router.get("/menu", response_model=List[MenuItemResponse])
async def get_menu(current_user: UserResponse = Depends(get_current_user)):
    items = await db.menu_items.find({}, {"_id": 0}).limit(1000).to_list(None)
    return [MenuItemResponse(**item) for item in items]

@api_router.get("/menu/search")
async def search_menu(q: str, current_user: UserResponse = Depends(get_current_user)):
    items = await db.menu_items.find(
        {"name": {"$regex": q, "$options": "i"}},
        {"_id": 0}
    ).to_list(100)
    return [MenuItemResponse(**item) for item in items]

@api_router.put("/menu/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(item_id: str, item: MenuItemCreate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.menu_items.find_one_and_update(
        {"id": item_id},
        {"$set": item.model_dump()},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    result.pop('_id', None)
    return MenuItemResponse(**result)

@api_router.delete("/menu/{item_id}", status_code=204)
async def delete_menu_item(item_id: str, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.menu_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return None

# Order Routes
@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order: OrderCreate, current_user: UserResponse = Depends(get_current_user)):
    # Get table
    table = await db.tables.find_one({"id": order.table_id}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Check if table already has an active order
    if table.get("current_order_id"):
        existing_order = await db.orders.find_one({"id": table["current_order_id"]}, {"_id": 0})
        if existing_order and existing_order.get("status") == "active":
            return OrderResponse(**existing_order)
    
    order_id = generate_id()
    now = datetime.now(timezone.utc).isoformat()
    order_doc = {
        "id": order_id,
        "table_id": order.table_id,
        "table_number": table["table_number"],
        "items": [],
        "subtotal": 0.0,
        "tax_amount": 0.0,
        "tax_rate": 0.0,
        "total": 0.0,
        "status": "active",
        "created_at": now,
        "updated_at": now,
        "completed_at": None
    }
    
    await db.orders.insert_one(order_doc)
    await db.tables.update_one(
        {"id": order.table_id},
        {"$set": {"status": "running", "current_order_id": order_id}}
    )
    
    await sio.emit('order_created', order_doc)
    return OrderResponse(**order_doc)

@api_router.post("/orders/{order_id}/items")
async def add_order_items(order_id: str, order_items: OrderAddItems, current_user: UserResponse = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get tax settings
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    tax_enabled = settings.get("tax_enabled", False) if settings else False
    tax_rate = settings.get("tax_rate", 0.0) if settings else 0.0
    
    new_items = []
    for item in order_items.items:
        item_id = generate_id()
        order_item = {
            "id": item_id,
            "menu_item_id": item.menu_item_id,
            "item_name": item.item_name,
            "quantity": item.quantity,
            "price": item.price,
            "is_manual": item.is_manual,
            "is_new": True,
            "added_at": datetime.now(timezone.utc).isoformat()
        }
        new_items.append(order_item)
    
    # Calculate totals
    all_items = order.get("items", []) + new_items
    subtotal = sum(item["price"] * item["quantity"] for item in all_items)
    tax_amount = (subtotal * tax_rate / 100) if tax_enabled else 0.0
    total = subtotal + tax_amount
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "items": all_items,
            "subtotal": subtotal,
            "tax_amount": tax_amount,
            "tax_rate": tax_rate,
            "total": total,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await sio.emit('order_updated', updated_order)
    
    return OrderResponse(**updated_order)

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(status: Optional[str] = None, current_user: UserResponse = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).limit(1000).to_list(None)
    return [OrderResponse(**order) for order in orders]

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: UserResponse = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderResponse(**order)

@api_router.post("/orders/{order_id}/acknowledge")
async def acknowledge_order_items(order_id: str, current_user: UserResponse = Depends(get_current_user)):
    # Mark all items as not new
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    items = order.get("items", [])
    for item in items:
        item["is_new"] = False
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"items": items}}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    await sio.emit('order_updated', updated_order)
    
    return {"success": True}

@api_router.post("/orders/{order_id}/complete")
async def complete_order(order_id: str, current_user: UserResponse = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    completed_at = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "completed",
            "updated_at": completed_at,
            "completed_at": completed_at
        }}
    )
    
    # Update table status
    await db.tables.update_one(
        {"id": order["table_id"]},
        {"$set": {"status": "available", "current_order_id": None}}
    )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    table = await db.tables.find_one({"id": order["table_id"]}, {"_id": 0})
    
    await sio.emit('order_completed', updated_order)
    await sio.emit('table_updated', table)
    
    return OrderResponse(**updated_order)

@api_router.delete("/orders/{order_id}", status_code=204)
async def cancel_order(order_id: str, current_user: UserResponse = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Mark order as cancelled
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update table status back to available
    await db.tables.update_one(
        {"id": order["table_id"]},
        {"$set": {"status": "available", "current_order_id": None}}
    )
    
    table = await db.tables.find_one({"id": order["table_id"]}, {"_id": 0})
    
    await sio.emit('order_cancelled', {"order_id": order_id})
    await sio.emit('table_updated', table)
    
    return None

# Settings Routes
@api_router.get("/settings", response_model=SettingsResponse)
async def get_settings(current_user: UserResponse = Depends(get_current_user)):
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    if not settings:
        # Default settings
        default_settings = {
            "key": "app_settings",
            "currency_symbol": "$",
            "currency_code": "USD",
            "tax_enabled": False,
            "tax_rate": 0.0,
            "tax_name": "Tax"
        }
        await db.settings.insert_one(default_settings)
        return SettingsResponse(
            currency_symbol="$", 
            currency_code="USD",
            tax_enabled=False,
            tax_rate=0.0,
            tax_name="Tax"
        )
    
    return SettingsResponse(
        currency_symbol=settings.get("currency_symbol", "$"),
        currency_code=settings.get("currency_code", "USD"),
        tax_enabled=settings.get("tax_enabled", False),
        tax_rate=settings.get("tax_rate", 0.0),
        tax_name=settings.get("tax_name", "Tax")
    )

@api_router.put("/settings", response_model=SettingsResponse)
async def update_settings(settings_update: SettingsUpdate, current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"key": "app_settings"},
        {"$set": {
            "currency_symbol": settings_update.currency_symbol,
            "currency_code": settings_update.currency_code,
            "tax_enabled": settings_update.tax_enabled,
            "tax_rate": settings_update.tax_rate,
            "tax_name": settings_update.tax_name
        }},
        upsert=True
    )
    
    await sio.emit('settings_updated', {
        "currency_symbol": settings_update.currency_symbol,
        "currency_code": settings_update.currency_code,
        "tax_enabled": settings_update.tax_enabled,
        "tax_rate": settings_update.tax_rate,
        "tax_name": settings_update.tax_name
    })
    
    return SettingsResponse(
        currency_symbol=settings_update.currency_symbol,
        currency_code=settings_update.currency_code,
        tax_enabled=settings_update.tax_enabled,
        tax_rate=settings_update.tax_rate,
        tax_name=settings_update.tax_name
    )

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
