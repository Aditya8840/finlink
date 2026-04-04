from enum import Enum

from pydantic import BaseModel


class PaymentMethodType(str, Enum):
    CARD = "CARD"
    BANK_ACCOUNT = "BANK_ACCOUNT"
    WALLET = "WALLET"
    CASH = "CASH"


class Address(BaseModel):
    street: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None


class PaymentMethod(BaseModel):
    id: str  # represents the card fingerprint or account number
    type: PaymentMethodType


class CursorPagination(BaseModel):
    next_cursor: str | None = None
    has_more: bool
    limit: int


class TransactionType(str, Enum):
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    TRANSFER = "TRANSFER"
    PAYMENT = "PAYMENT"


class TransactionStatus(str, Enum):
    CREATED = "CREATED"
    SUCCESSFUL = "SUCCESSFUL"
    DECLINED = "DECLINED"
    SUSPENDED = "SUSPENDED"
    REFUNDED = "REFUNDED"


class Geolocation(BaseModel):
    country: str | None = None
    state: str | None = None


class DeviceData(BaseModel):
    device_id: str | None = None
    ip_address: str | None = None
    geolocation: Geolocation | None = None
