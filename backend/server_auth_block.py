# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-key')
JWT_ALGORITHM = 'HS256'
REFRESH_SECRET = os.environ.get('REFRESH_TOKEN_SECRET', 'lucy-refresh-secret-2026')
ACCESS_EXPIRE_MIN = 15
REFRESH_EXPIRE_DAYS = 7

# LLM Config
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

ai_service = None


# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(user_id: str, email: str, role: str = "agent") -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRE_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, REFRESH_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    is_prod = os.environ.get("ENV", "development") == "production"
    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=is_prod, samesite="lax",
        max_age=ACCESS_EXPIRE_MIN * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=is_prod, samesite="lax",
        max_age=REFRESH_EXPIRE_DAYS * 24 * 3600, path="/api/auth/refresh",
    )

def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth/refresh")

async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Token requerido")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register")
async def register(request: Request, response: Response, user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": "agent",
        "language": "es",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)

    access  = create_access_token(user_id, user_data.email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)

    token_response = TokenResponse(
        token=access,
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name),
    )
    legacy = token_response.model_dump()
    return build_response(request, data=legacy, legacy=legacy, meta={"user_id": user_id})

@api_router.post("/auth/login")
async def login(request: Request, response: Response, credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    access  = create_access_token(user["id"], user["email"], user.get("role", "agent"))
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)

    token_response = TokenResponse(
        token=access,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            language=user.get("language", "es"),
        ),
    )
    legacy = token_response.model_dump()
    return build_response(request, data=legacy, legacy=legacy, meta={"user_id": user["id"]})

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Sin refresh token")
    try:
        payload = jwt.decode(token, REFRESH_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada, vuelve a iniciar sesión")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    new_access  = create_access_token(user["id"], user["email"], user.get("role", "agent"))
    new_refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, new_access, new_refresh)

    return {"message": "Token renovado"}

@api_router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Sesión cerrada"}

@api_router.get("/auth/me")
async def get_me(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        language=user.get("language", "es"),
    )
    legacy = user_response.model_dump()
    return build_response(request, data=legacy, legacy=legacy)

@api_router.put("/auth/language")
async def update_language(request: Request, response: Response, language: str, user: Dict[str, Any] = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"language": language}})
    legacy = {"status": "ok", "language": language}
    return build_response(request, data=legacy, legacy=legacy)
