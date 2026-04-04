import os

import pytest
from httpx import ASGITransport, AsyncClient

from app import db
from app.main import app

TEST_NEO4J_URI = os.environ.get("NEO4J_TEST_URI", "bolt://localhost:7687")
TEST_NEO4J_USER = os.environ.get("NEO4J_TEST_USER", "neo4j")
TEST_NEO4J_PASSWORD = os.environ.get("NEO4J_TEST_PASSWORD", "password123")


@pytest.fixture(autouse=True)
async def setup_and_clean():
    db._driver = None
    db.settings.neo4j_uri = TEST_NEO4J_URI
    db.settings.neo4j_user = TEST_NEO4J_USER
    db.settings.neo4j_password = TEST_NEO4J_PASSWORD

    await db.get_driver()
    await db.init_constraints()
    await db.execute_write("MATCH (n) DETACH DELETE n")
    yield
    await db.close_driver()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
