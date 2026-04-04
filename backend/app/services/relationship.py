from app.db import execute_query
from app.models.relationship import (
    LinkedTransaction,
    RelatedUser,
    SharedLink,
    TransactionConnections,
    TransactionLink,
    TransactionSummary,
    UserConnections,
)


def _to_related_user(data: dict) -> RelatedUser:
    return RelatedUser(**data)


def _to_transaction_summary(data: dict) -> TransactionSummary:
    return TransactionSummary(**data)


async def get_user_connections(user_id: str) -> UserConnections:
    credit_records = await execute_query(
        """
        MATCH (u:User {id: $uid})-[:SENT]->(tx:Transaction)
        -[:RECEIVED_BY]->(receiver:User)
        RETURN tx, receiver {
            .id, .first_name, .last_name, .email
        } AS counterparty
        """,
        {"uid": user_id},
    )
    credit_links = [
        TransactionLink(
            transaction=_to_transaction_summary(r["tx"]),
            counterparty=_to_related_user(r["counterparty"]),
        )
        for r in credit_records
    ]

    debit_records = await execute_query(
        """
        MATCH (sender:User)-[:SENT]->(tx:Transaction)
        -[:RECEIVED_BY]->(u:User {id: $uid})
        RETURN tx, sender {
            .id, .first_name, .last_name, .email
        } AS counterparty
        """,
        {"uid": user_id},
    )
    debit_links = [
        TransactionLink(
            transaction=_to_transaction_summary(r["tx"]),
            counterparty=_to_related_user(r["counterparty"]),
        )
        for r in debit_records
    ]

    shared_records = await execute_query(
        """
        MATCH (u:User {id: $uid})
            -[r:SHARED_EMAIL|SHARED_PHONE
                |SHARED_ADDRESS|SHARED_PAYMENT_METHOD]
            -(other:User)
        RETURN type(r) AS link_type,
               other { .id, .first_name, .last_name, .email } AS user
        """,
        {"uid": user_id},
    )
    shared_links = [
        SharedLink(
            link_type=r["link_type"],
            user=_to_related_user(r["user"]),
        )
        for r in shared_records
    ]

    tx_shared_records = await execute_query(
        """
        MATCH (u:User {id: $uid})-[:SENT|RECEIVED_BY]-(tx1:Transaction)
              -[r:SHARED_IP|SHARED_DEVICE|SHARED_PAYMENT]-(tx2:Transaction)
        MATCH (tx2)-[:SENT|RECEIVED_BY]-(other:User)
        WHERE other.id <> $uid
        RETURN type(r) AS link_type,
               other { .id, .first_name, .last_name, .email } AS user,
               count(tx2) AS transaction_count
        """,
        {"uid": user_id},
    )
    shared_links.extend(
        [
            SharedLink(
                link_type=r["link_type"],
                user=_to_related_user(r["user"]),
                transaction_count=r["transaction_count"],
            )
            for r in tx_shared_records
        ]
    )

    return UserConnections(
        credit_links=credit_links,
        debit_links=debit_links,
        shared_links=shared_links,
    )


async def get_transaction_connections(tx_id: str) -> TransactionConnections:
    user_records = await execute_query(
        """
        MATCH (sender:User)-[:SENT]->
            (t:Transaction {id: $txId})
            -[:RECEIVED_BY]->(receiver:User)
        RETURN sender {
            .id, .first_name, .last_name, .email
        } AS sender, receiver {
            .id, .first_name, .last_name, .email
        } AS receiver
        """,
        {"txId": tx_id},
    )
    if not user_records:
        raise ValueError(f"Transaction {tx_id} not found")

    linked_records = await execute_query(
        """
        MATCH (t1:Transaction {id: $txId})
            -[r:SHARED_IP|SHARED_DEVICE
                |SHARED_PAYMENT]
            -(t2:Transaction)
        RETURN type(r) AS link_type, t2 AS transaction
        """,
        {"txId": tx_id},
    )

    return TransactionConnections(
        sender=_to_related_user(user_records[0]["sender"]),
        receiver=_to_related_user(user_records[0]["receiver"]),
        linked_transactions=[
            LinkedTransaction(
                link_type=r["link_type"],
                transaction=_to_transaction_summary(r["transaction"]),
            )
            for r in linked_records
        ],
    )
