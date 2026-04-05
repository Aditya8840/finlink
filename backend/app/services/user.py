import uuid
from datetime import UTC, datetime

from app.db import execute_query, execute_write
from app.models.common import Address, CursorPagination, PaymentMethod
from app.models.user import (
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)


async def _create_related_entities(user_id: str, data: UserCreate | UserUpdate) -> None:
    if data.address and any(data.address.model_dump(exclude_none=True).values()):
        await execute_write(
            """
            MATCH (u:User {id: $uid})
            CREATE (a:Address {
                street: $street, city: $city,
                state: $state, postal_code: $postal_code,
                country: $country
            })
            CREATE (u)-[:HAS_ADDRESS]->(a)
            """,
            {
                "uid": user_id,
                "street": data.address.street,
                "city": data.address.city,
                "state": data.address.state,
                "postal_code": data.address.postal_code,
                "country": data.address.country,
            },
        )
    if data.payment_methods and any(
        payment_method.model_dump(exclude_none=True).values()
        for payment_method in data.payment_methods
    ):
        for payment_method in data.payment_methods:
            await execute_write(
                """
                MATCH (u:User {id: $uid})
                CREATE (p:PaymentMethod {id: $id, type: $type})
                CREATE (u)-[:HAS_PAYMENT_METHOD]->(p)
                """,
                {
                    "uid": user_id,
                    "id": payment_method.id,
                    "type": payment_method.type.value,
                },
            )


def _format_user(record: dict) -> UserResponse:
    user = record["u"]
    address = record["a"]
    payment_methods = record["payment_methods"]
    return UserResponse(
        **user,
        address=Address(**address) if address else None,
        payment_methods=[PaymentMethod(**pm) for pm in payment_methods]
        if payment_methods
        else None,
    )


async def get_user(user_id: str) -> UserResponse:
    result = await execute_query(
        """
        MATCH (u:User {id: $id})
        OPTIONAL MATCH (u)-[:HAS_ADDRESS]->(a:Address)
        OPTIONAL MATCH (u)-[:HAS_PAYMENT_METHOD]->(p:PaymentMethod)
        RETURN u, a, collect(DISTINCT p { .id, .type }) AS payment_methods
        """,
        {"id": user_id},
    )
    if not result:
        return None
    return _format_user(result[0])


async def create_user(data: UserCreate) -> UserResponse:
    user_id = str(uuid.uuid4())
    now = datetime.now(tz=UTC).isoformat()
    await execute_write(
        """
        CREATE (u:User {
            id: $id, first_name: $first_name,
            last_name: $last_name,email: $email,
            phone: $phone, created_at: $now,
            updated_at: $now
        })
        RETURN u
        """,
        {
            "id": user_id,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "email": data.email,
            "phone": data.phone,
            "now": now,
        },
    )

    await _create_related_entities(user_id, data)
    return await get_user(user_id)


async def is_user_exists(user_id: str) -> bool:
    result = await execute_query(
        """
        MATCH (u:User {id: $id})
        RETURN u
        """,
        {"id": user_id},
    )
    return len(result) > 0


async def update_user(user_id: str, data: UserUpdate) -> UserResponse | None:
    if not await is_user_exists(user_id):
        return None

    updates = data.model_dump(exclude_none=True)
    if not updates:
        return await get_user(user_id)

    set_clauses = ", ".join(
        f"u.{key} = ${key}"
        for key in updates
        if key not in ("address", "payment_methods")
    )
    updates["id"] = user_id
    updates["updated_at"] = datetime.now(tz=UTC).isoformat()

    if set_clauses:
        set_clauses += ", u.updated_at = $updated_at"
        await execute_write(
            f"MATCH (u:User {{id: $id}}) SET {set_clauses}",
            updates,
        )

    if data.address is not None:
        await execute_write(
            "MATCH (u:User {id: $id})-[r:HAS_ADDRESS]->(a:Address) DELETE r, a",
            {"id": user_id},
        )

    if data.payment_methods is not None:
        await execute_write(
            """
            MATCH (u:User {id: $id})-[r:HAS_PAYMENT_METHOD]->(p:PaymentMethod)
            DELETE r, p
            """,
            {"id": user_id},
        )

    if data.address is not None or data.payment_methods is not None:
        await _create_related_entities(user_id, data)

    await execute_write(
        """
        MATCH (u:User {id: $id})-[r:SHARED_EMAIL
            |SHARED_PHONE
            |SHARED_ADDRESS
            |SHARED_PAYMENT_METHOD]-()
        DELETE r
        """,
        {"id": user_id},
    )

    return await get_user(user_id)


async def list_users(cursor: str | None = None, limit: int = 10) -> UserListResponse:
    params: dict = {"limit": limit + 1}
    if cursor:
        params["cursor"] = cursor
        query = """
            MATCH (u:User)
            WHERE u.created_at < $cursor
            WITH u ORDER BY u.created_at DESC
            LIMIT $limit
            OPTIONAL MATCH (u)-[:HAS_ADDRESS]->(a:Address)
            OPTIONAL MATCH (u)-[:HAS_PAYMENT_METHOD]->(p:PaymentMethod)
            RETURN u, a, collect(DISTINCT p { .id, .type }) AS payment_methods
        """
    else:
        query = """
            MATCH (u:User)
            WITH u ORDER BY u.created_at DESC
            LIMIT $limit
            OPTIONAL MATCH (u)-[:HAS_ADDRESS]->(a:Address)
            OPTIONAL MATCH (u)-[:HAS_PAYMENT_METHOD]->(p:PaymentMethod)
            RETURN u, a, collect(DISTINCT p { .id, .type }) AS payment_methods
        """
    result = await execute_query(query, params)

    has_more = len(result) > limit
    records = result[:limit]
    users = [_format_user(record) for record in records]
    next_cursor = users[-1].created_at.isoformat() if users and has_more else None
    return UserListResponse(
        users=users,
        pagination=CursorPagination(
            next_cursor=next_cursor,
            has_more=has_more,
            limit=limit,
        ),
    )


async def detect_shared_relationships(user_id: str) -> None:
    # Shared email
    await execute_write(
        """
        MATCH (u1:User {id: $uid}), (u2:User)
        WHERE u2.email = u1.email AND u2.id <> $uid
        MERGE (u1)-[:SHARED_EMAIL]-(u2)
        """,
        {"uid": user_id},
    )

    # Shared phone
    await execute_write(
        """
        MATCH (u1:User {id: $uid}), (u2:User)
        WHERE u2.phone = u1.phone AND u2.id <> $uid
        MERGE (u1)-[:SHARED_PHONE]-(u2)
        """,
        {"uid": user_id},
    )

    # Shared address
    await execute_write(
        """
       MATCH (u1:User {id: $uid})-[:HAS_ADDRESS]->(a1:Address)
       MATCH (u2:User)-[:HAS_ADDRESS]->(a2:Address)
       WHERE a1.street IS NOT NULL
         AND a1.street = a2.street AND a1.city = a2.city
         AND u2.id <> $uid
       MERGE (u1)-[:SHARED_ADDRESS]-(u2)
       """,
        {"uid": user_id},
    )

    # Shared payment method
    await execute_write(
        """
        MATCH (u1:User {id: $uid})-[:HAS_PAYMENT_METHOD]->(p1:PaymentMethod)
        MATCH (u2:User)-[:HAS_PAYMENT_METHOD]->(p2:PaymentMethod)
        WHERE p1.id = p2.id AND p1.type = p2.type AND u2.id <> $uid
        MERGE (u1)-[:SHARED_PAYMENT_METHOD]-(u2)
        """,
        {"uid": user_id},
    )
