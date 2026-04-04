from fastapi import APIRouter, HTTPException, status

from app.models.relationship import TransactionConnections, UserConnections
from app.services import relationship as relationship_service

router = APIRouter(
    prefix="/relationships",
    tags=["relationships"],
)


@router.get("/user/{user_id}", response_model=UserConnections)
async def get_user_relationships(user_id: str):
    return await relationship_service.get_user_connections(user_id)


@router.get("/transaction/{tx_id}", response_model=TransactionConnections)
async def get_transaction_relationships(tx_id: str):
    try:
        return await relationship_service.get_transaction_connections(tx_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
