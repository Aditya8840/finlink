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


class Pagination(BaseModel):
    total: int
    page: int
    per_page: int
