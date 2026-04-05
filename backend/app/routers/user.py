from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.models.user import UserCreate, UserListResponse, UserResponse, UserUpdate
from app.services import user as user_service

router = APIRouter(
    prefix="/users",
    tags=["users"],
)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, background_tasks: BackgroundTasks):
    result = await user_service.create_user(user)
    background_tasks.add_task(user_service.detect_shared_relationships, result.id)
    return result


@router.get("/", response_model=UserListResponse, status_code=status.HTTP_200_OK)
async def list_users(
    cursor: str | None = None,
    limit: int = Query(30, ge=1, le=100),
    search: str | None = None,
    flagged: bool = False,
):
    return await user_service.list_users(cursor, limit, search=search, flagged=flagged)


@router.get("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_user(user_id: str):
    user = await user_service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


@router.put("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def update_user_route(
    user_id: str, data: UserUpdate, background_tasks: BackgroundTasks
):
    user = await user_service.update_user(user_id, data)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    background_tasks.add_task(user_service.detect_shared_relationships, user_id)
    return user
