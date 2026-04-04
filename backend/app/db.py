from neo4j import AsyncDriver, AsyncGraphDatabase

from app.config import settings

_driver: AsyncDriver | None = None


async def get_driver() -> AsyncDriver:
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
        )
    return _driver


async def close_driver() -> None:
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None


async def execute_query(query: str, parameters: dict | None = None) -> list[dict]:
    driver = await get_driver()
    result = await driver.execute_query(
        query,
        parameters_=parameters or {},
        database_="neo4j",
    )
    return [record.data() for record in result.records]


async def execute_write(query: str, parameters: dict | None = None) -> None:
    return await execute_query(query, parameters)


async def init_constraints() -> None:
    for stmt in [
        "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
        "CREATE CONSTRAINT tx_id IF NOT EXISTS "
        "FOR (t:Transaction) REQUIRE t.id IS UNIQUE",
        "CREATE INDEX user_email IF NOT EXISTS FOR (u:User) ON (u.email)",
        "CREATE INDEX user_phone IF NOT EXISTS FOR (u:User) ON (u.phone)",
        "CREATE INDEX tx_sender IF NOT EXISTS FOR (t:Transaction) ON (t.sender_id)",
        "CREATE INDEX tx_receiver IF NOT EXISTS FOR (t:Transaction) ON (t.receiver_id)",
        "CREATE INDEX tx_timestamp IF NOT EXISTS FOR (t:Transaction) ON (t.created_at)",
        "CREATE INDEX device_ip IF NOT EXISTS FOR (d:DeviceInfo) ON (d.ip_address)",
        "CREATE INDEX device_id IF NOT EXISTS FOR (d:DeviceInfo) ON (d.device_id)",
    ]:
        await execute_write(stmt)
