from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.common import Address, Pagination, PaymentMethod


class UserBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    address: Address | None = None
    payment_methods: list[PaymentMethod] | None = None


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: Address | None = None
    payment_methods: list[PaymentMethod] | None = None


class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    users: list[UserResponse]
    pagination: Pagination
