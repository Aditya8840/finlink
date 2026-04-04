from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import close_driver, get_driver


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_driver()
    yield
    await close_driver()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}
