from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.db import close_driver, get_driver, init_constraints
from app.routers import transaction, user


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_driver()
    await init_constraints()
    yield
    await close_driver()


app = FastAPI(lifespan=lifespan)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


app.include_router(user.router, prefix="/api")
app.include_router(transaction.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
