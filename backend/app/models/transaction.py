from datetime import datetime

from pydantic import BaseModel

from app.models.common import (
    CursorPagination,
    DeviceData,
    PaymentMethod,
    TransactionStatus,
    TransactionType,
)


class TransactionBase(BaseModel):
    transaction_type: TransactionType
    status: TransactionStatus = TransactionStatus.CREATED
    sender_id: str
    receiver_id: str
    amount: float
    currency: str = "USD"
    destination_amount: float | None = None
    destination_currency: str | None = None
    description: str | None = None
    device_info: DeviceData | None = None
    payment_method: PaymentMethod | None = None


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    # sender_id and receiver_id are immutable
    transaction_type: TransactionType | None = None
    status: TransactionStatus | None = None
    amount: float | None = None
    currency: str | None = None
    description: str | None = None
    device_info: DeviceData | None = None
    payment_method: PaymentMethod | None = None


class TransactionResponse(TransactionBase):
    id: str
    created_at: datetime
    updated_at: datetime


class TransactionListResponse(BaseModel):
    transactions: list[TransactionResponse]
    pagination: CursorPagination
