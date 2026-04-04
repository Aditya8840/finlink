from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.models.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
    TransactionUpdate,
)
from app.services import transaction as transaction_service

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)


@router.post(
    "/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED
)
async def create_transaction(
    transaction: TransactionCreate, background_tasks: BackgroundTasks
):
    try:
        result = await transaction_service.create_transaction(transaction)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    background_tasks.add_task(
        transaction_service.detect_shared_relationships, result.id
    )
    return result


@router.get("/", response_model=TransactionListResponse, status_code=status.HTTP_200_OK)
async def list_transactions(
    cursor: str | None = None, limit: int = Query(30, ge=1, le=100)
):
    return await transaction_service.list_transactions(cursor, limit)


@router.get(
    "/{tx_id}", response_model=TransactionResponse, status_code=status.HTTP_200_OK
)
async def get_transaction(tx_id: str):
    transaction = await transaction_service.get_transaction(tx_id)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"
        )
    return transaction


@router.put(
    "/{tx_id}", response_model=TransactionResponse, status_code=status.HTTP_200_OK
)
async def update_transaction(
    tx_id: str, data: TransactionUpdate, background_tasks: BackgroundTasks
):
    transaction = await transaction_service.update_transaction(tx_id, data)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"
        )
    background_tasks.add_task(transaction_service.detect_shared_relationships, tx_id)
    return transaction
