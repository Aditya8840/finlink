from pydantic import BaseModel


class RelatedUser(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str


class TransactionSummary(BaseModel):
    id: str
    transaction_type: str
    status: str
    sender_id: str
    receiver_id: str
    amount: float
    currency: str
    created_at: str


class TransactionLink(BaseModel):
    transaction: TransactionSummary
    counterparty: RelatedUser


class SharedLink(BaseModel):
    link_type: str
    user: RelatedUser
    transaction_count: int | None = None


class LinkedTransaction(BaseModel):
    link_type: str
    transaction: TransactionSummary
    sender: RelatedUser | None = None
    receiver: RelatedUser | None = None


class UserConnections(BaseModel):
    credit_links: list[TransactionLink]
    debit_links: list[TransactionLink]
    shared_links: list[SharedLink]


class TransactionConnections(BaseModel):
    sender: RelatedUser
    receiver: RelatedUser
    linked_transactions: list[LinkedTransaction]


class PathNode(BaseModel):
    id: str
    label: str
    properties: dict


class PathEdge(BaseModel):
    source: str
    target: str
    type: str


class ShortestPathResponse(BaseModel):
    path: list[PathNode]
    edges: list[PathEdge]
    length: int
