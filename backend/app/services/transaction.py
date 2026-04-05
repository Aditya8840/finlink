import uuid
from datetime import UTC, datetime

from app.db import execute_query, execute_write
from app.models.common import CursorPagination, DeviceData, Geolocation, PaymentMethod
from app.models.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)
from app.services.user import is_user_exists


async def _create_related_entities(tx_id: str, data: TransactionCreate) -> None:
    if data.device_info and any(
        data.device_info.model_dump(exclude_none=True).values()
    ):
        await execute_write(
            """
            MATCH (t:Transaction {id: $id})
            CREATE (d:DeviceInfo {ip_address: $ip_address, device_id: $device_id})
            CREATE (t)-[:FROM_DEVICE]->(d)
            WITH d
            CALL {
                WITH d
                WITH d WHERE $country IS NOT NULL AND $state IS NOT NULL
                CREATE (g:Geolocation {country: $country, state: $state})
                CREATE (d)-[:LOCATED_AT]->(g)
            }

            """,
            {
                "id": tx_id,
                "ip_address": data.device_info.ip_address,
                "country": data.device_info.geolocation.country
                if data.device_info.geolocation
                else None,
                "state": data.device_info.geolocation.state
                if data.device_info.geolocation
                else None,
                "device_id": data.device_info.device_id,
            },
        )
    if data.payment_method and any(
        data.payment_method.model_dump(exclude_none=True).values()
    ):
        await execute_write(
            """
            MATCH (t:Transaction {id: $id})
            CREATE (pm:PaymentMethod {
                id: $payment_method_id,
                type: $payment_method_type
            })
            CREATE (t)-[:USED_PAYMENT_METHOD]->(pm)
            """,
            {
                "id": tx_id,
                "payment_method_id": data.payment_method.id,
                "payment_method_type": data.payment_method.type.value,
            },
        )


def _format_transaction(record: dict) -> TransactionResponse:
    transaction = record["t"]
    device_info = record["d"]
    geolocation = record["g"]
    payment_method = record["pm"]
    sender = record.get("sender")
    receiver = record.get("receiver")

    return TransactionResponse(
        **transaction,
        device_info=DeviceData(
            ip_address=device_info["ip_address"],
            device_id=device_info["device_id"],
            geolocation=Geolocation(**geolocation) if geolocation else None,
        )
        if device_info
        else None,
        payment_method=PaymentMethod(**payment_method) if payment_method else None,
        sender_name=f"{sender['first_name']} {sender['last_name']}" if sender else None,
        sender_email=sender["email"] if sender else None,
        receiver_name=f"{receiver['first_name']} {receiver['last_name']}"
        if receiver
        else None,
        receiver_email=receiver["email"] if receiver else None,
    )


async def get_transaction(tx_id: str) -> TransactionResponse | None:
    result = await execute_query(
        """
        MATCH (t:Transaction {id: $id})
        OPTIONAL MATCH (t)-[:FROM_DEVICE]->(d:DeviceInfo)
        OPTIONAL MATCH (d)-[:LOCATED_AT]->(g:Geolocation)
        OPTIONAL MATCH (t)-[:USED_PAYMENT_METHOD]->(pm:PaymentMethod)
        OPTIONAL MATCH (sender:User)-[:SENT]->(t)
        OPTIONAL MATCH (t)-[:RECEIVED_BY]->(receiver:User)
        RETURN t, d, g, pm,
               sender { .id, .first_name, .last_name, .email } AS sender,
               receiver { .id, .first_name, .last_name, .email } AS receiver
        """,
        {"id": tx_id},
    )
    if not result:
        return None
    return _format_transaction(result[0])


async def create_transaction(data: TransactionCreate) -> TransactionResponse:
    if data.sender_id == data.receiver_id:
        raise ValueError("Sender and receiver cannot be the same")

    if not await is_user_exists(data.sender_id):
        raise ValueError("Sender not found")

    if not await is_user_exists(data.receiver_id):
        raise ValueError("Receiver not found")

    tx_id = str(uuid.uuid4())
    now = datetime.now(tz=UTC).isoformat()

    await execute_write(
        """
        MATCH (s:User {id: $sender_id})
        MATCH (r:User {id: $receiver_id})
        CREATE (s)-[:SENT]->(t:Transaction {
            id: $id, transaction_type: $transaction_type, status: $status,
            sender_id: $sender_id, receiver_id: $receiver_id,
            amount: $amount, currency: $currency,
            destination_amount: $destination_amount,
            destination_currency: $destination_currency,
            description: $description, created_at: $now, updated_at: $now
        })-[:RECEIVED_BY]->(r)
        RETURN t
        """,
        {
            "id": tx_id,
            "sender_id": data.sender_id,
            "receiver_id": data.receiver_id,
            "transaction_type": data.transaction_type.value,
            "amount": data.amount,
            "currency": data.currency,
            "destination_amount": data.destination_amount,
            "destination_currency": data.destination_currency,
            "status": data.status.value,
            "now": now,
            "description": data.description,
        },
    )

    await _create_related_entities(tx_id, data)
    return await get_transaction(tx_id)


async def is_transaction_exists(tx_id: str) -> bool:
    result = await execute_query(
        """
        MATCH (t:Transaction {id: $id})
        RETURN t
        """,
        {"id": tx_id},
    )
    return len(result) > 0


async def update_transaction(
    tx_id: str, data: TransactionUpdate
) -> TransactionResponse | None:
    if not await is_transaction_exists(tx_id):
        return None

    updates = data.model_dump(exclude_none=True)
    if not updates:
        return await get_transaction(tx_id)

    node_keys = {
        k: v for k, v in updates.items() if k not in ("device_info", "payment_method")
    }
    for key in ("transaction_type", "status"):
        if key in node_keys and hasattr(node_keys[key], "value"):
            node_keys[key] = node_keys[key].value

    if node_keys:
        node_keys["id"] = tx_id
        node_keys["updated_at"] = datetime.now(tz=UTC).isoformat()
        set_clauses = ", ".join(f"t.{key} = ${key}" for key in node_keys if key != "id")
        await execute_write(
            f"MATCH (t:Transaction {{id: $id}}) SET {set_clauses}",
            node_keys,
        )

    if data.device_info is not None:
        await execute_write(
            """
            MATCH (t:Transaction {id: $id})-[r:FROM_DEVICE]->(d:DeviceInfo)
            OPTIONAL MATCH (d)-[r2:LOCATED_AT]->(g:Geolocation)
            DELETE r, r2, d, g
            """,
            {"id": tx_id},
        )

    if data.payment_method is not None:
        await execute_write(
            """
            MATCH (t:Transaction {id: $id})-[r:USED_PAYMENT_METHOD]->(pm:PaymentMethod)
            DELETE r, pm
            """,
            {"id": tx_id},
        )

    if data.device_info is not None or data.payment_method is not None:
        await _create_related_entities(tx_id, data)

    await execute_write(
        """
        MATCH (t:Transaction {id: $id})-[r:SHARED_IP
            |SHARED_DEVICE
            |SHARED_PAYMENT]-()
        DELETE r
        """,
        {"id": tx_id},
    )

    return await get_transaction(tx_id)


async def list_transactions(
    cursor: str | None = None,
    limit: int = 10,
    search: str | None = None,
    transaction_type: str | None = None,
    transaction_status: str | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
) -> TransactionListResponse:
    params: dict = {"limit": limit + 1}
    where_parts: list[str] = []

    if cursor:
        params["cursor"] = cursor
        where_parts.append("t.created_at < $cursor")

    search_clause = ""
    if search:
        params["search"] = f"(?i).*{search}.*"
        search_clause = """
            WITH t
            MATCH (s:User)-[:SENT]->(t)
            MATCH (t)-[:RECEIVED_BY]->(r:User)
            WHERE s.first_name =~ $search OR s.last_name =~ $search
               OR s.email =~ $search
               OR r.first_name =~ $search OR r.last_name =~ $search
               OR r.email =~ $search
        """

    if transaction_type:
        params["txType"] = transaction_type
        where_parts.append("t.transaction_type = $txType")

    if transaction_status:
        params["txStatus"] = transaction_status
        where_parts.append("t.status = $txStatus")

    if min_amount is not None:
        params["minAmount"] = min_amount
        where_parts.append("t.amount >= $minAmount")

    if max_amount is not None:
        params["maxAmount"] = max_amount
        where_parts.append("t.amount <= $maxAmount")

    where_clause = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    query = f"""
        MATCH (t:Transaction)
        {where_clause}
        {search_clause}
        WITH t ORDER BY t.created_at DESC
        LIMIT $limit
        OPTIONAL MATCH (t)-[:FROM_DEVICE]->(d:DeviceInfo)
        OPTIONAL MATCH (d)-[:LOCATED_AT]->(g:Geolocation)
        OPTIONAL MATCH (t)-[:USED_PAYMENT_METHOD]->(pm:PaymentMethod)
        OPTIONAL MATCH (sender:User)-[:SENT]->(t)
        OPTIONAL MATCH (t)-[:RECEIVED_BY]->(receiver:User)
        RETURN t, d, g, pm,
               sender {{ .id, .first_name, .last_name, .email }} AS sender,
               receiver {{ .id, .first_name, .last_name, .email }} AS receiver
    """
    result = await execute_query(query, params)
    has_more = len(result) > limit
    transactions = [_format_transaction(record) for record in result[:limit]]
    next_cursor = (
        transactions[-1].created_at.isoformat() if transactions and has_more else None
    )
    return TransactionListResponse(
        transactions=transactions,
        pagination=CursorPagination(
            next_cursor=next_cursor, has_more=has_more, limit=limit
        ),
    )


async def detect_shared_relationships(tx_id: str) -> None:
    # SHARED_IP
    await execute_write(
        """
        MATCH (t1:Transaction {id: $txId})-[:FROM_DEVICE]->(d1:DeviceInfo)
        MATCH (t2:Transaction)-[:FROM_DEVICE]->(d2:DeviceInfo)
        WHERE d1.ip_address IS NOT NULL
          AND d1.ip_address = d2.ip_address
          AND t2.id <> $txId
        MERGE (t1)-[:SHARED_IP]-(t2)
        """,
        {"txId": tx_id},
    )

    # SHARED_DEVICE
    await execute_write(
        """
        MATCH (t1:Transaction {id: $txId})-[:FROM_DEVICE]->(d1:DeviceInfo)
        MATCH (t2:Transaction)-[:FROM_DEVICE]->(d2:DeviceInfo)
        WHERE d1.device_id IS NOT NULL
          AND d1.device_id = d2.device_id
          AND t2.id <> $txId
        MERGE (t1)-[:SHARED_DEVICE]-(t2)
        """,
        {"txId": tx_id},
    )

    # SHARED_PAYMENT
    await execute_write(
        """
        MATCH (t1:Transaction {id: $txId})-[:USED_PAYMENT_METHOD]->(pm1:PaymentMethod)
        MATCH (t2:Transaction)-[:USED_PAYMENT_METHOD]->(pm2:PaymentMethod)
        WHERE pm1.id = pm2.id
          AND t2.id <> $txId
        MERGE (t1)-[:SHARED_PAYMENT]-(t2)
        """,
        {"txId": tx_id},
    )
