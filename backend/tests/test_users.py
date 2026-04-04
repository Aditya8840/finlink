import asyncio

from app.db import execute_query

SAMPLE_USER = {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "1234567890",
    "address": {
        "street": "123 Main St",
        "city": "Anytown",
        "state": "CA",
        "postal_code": "12345",
        "country": "USA",
    },
    "payment_methods": [
        {"id": "card_1234567890", "type": "CARD"},
        {"id": "cash_1234567891", "type": "CASH"},
        {"id": "wallet_1234567892", "type": "WALLET"},
    ],
}


class TestCreateUser:
    async def test_create_user_with_all_fields(self, client):
        response = await client.post("/api/users/", json=SAMPLE_USER)
        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["first_name"] == SAMPLE_USER["first_name"]
        assert data["last_name"] == SAMPLE_USER["last_name"]
        assert data["email"] == SAMPLE_USER["email"]
        assert data["phone"] == SAMPLE_USER["phone"]
        assert data["address"] == SAMPLE_USER["address"]
        assert sorted(data["payment_methods"], key=lambda x: x["id"]) == sorted(
            SAMPLE_USER["payment_methods"], key=lambda x: x["id"]
        )
        assert data["created_at"] is not None
        assert data["updated_at"] is not None

    async def test_create_user_with_only_required_fields(self, client):
        response = await client.post(
            "/api/users/",
            json={
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane@test.com",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "Jane"
        assert data["phone"] is None
        assert data["address"] is None
        assert data["payment_methods"] is None

    async def test_create_user_with_invalid_email(self, client):
        response = await client.post(
            "/api/users/",
            json={
                **SAMPLE_USER,
                "email": "not-an-email",
            },
        )
        assert response.status_code == 422

    async def test_rejects_missing_required_fields(self, client):
        response = await client.post("/api/users/", json={})
        assert response.status_code == 422

    async def test_rejects_missing_first_name(self, client):
        response = await client.post(
            "/api/users/",
            json={
                "last_name": "Doe",
                "email": "test@test.com",
            },
        )
        assert response.status_code == 422


class TestGetUser:
    async def test_get_existing_user(self, client):
        create_resp = await client.post("/api/users/", json=SAMPLE_USER)
        user_id = create_resp.json()["id"]

        response = await client.get(f"/api/users/{user_id}")
        assert response.status_code == 200
        assert response.json()["email"] == SAMPLE_USER["email"]
        assert response.json()["address"]["city"] == "Anytown"

    async def test_get_nonexistent_user(self, client):
        response = await client.get("/api/users/nonexistent-id-123")
        assert response.status_code == 404


class TestListUsers:
    async def test_list_empty(self, client):
        response = await client.get("/api/users/")
        assert response.status_code == 200
        data = response.json()
        assert data["users"] == []
        assert data["pagination"]["has_more"] is False

    async def test_list_returns_created_users(self, client):
        await client.post(
            "/api/users/",
            json={
                **SAMPLE_USER,
                "email": "user1@test.com",
            },
        )
        await client.post(
            "/api/users/",
            json={
                **SAMPLE_USER,
                "email": "user2@test.com",
            },
        )

        response = await client.get("/api/users/")
        assert response.status_code == 200
        assert len(response.json()["users"]) == 2

    async def test_list_pagination(self, client):
        for i in range(3):
            await client.post(
                "/api/users/",
                json={
                    **SAMPLE_USER,
                    "email": f"page{i}@test.com",
                },
            )

        response = await client.get("/api/users/?limit=2")
        data = response.json()
        assert len(data["users"]) == 2
        assert data["pagination"]["has_more"] is True
        assert data["pagination"]["next_cursor"] is not None

        cursor = data["pagination"]["next_cursor"]
        response2 = await client.get(f"/api/users/?cursor={cursor}&limit=2")
        data2 = response2.json()
        assert len(data2["users"]) == 1
        assert data2["pagination"]["has_more"] is False


class TestUpdateUser:
    async def test_update_user_name(self, client):
        create_resp = await client.post("/api/users/", json=SAMPLE_USER)
        user_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/users/{user_id}",
            json={
                "first_name": "Updated",
            },
        )
        assert response.status_code == 200
        assert response.json()["first_name"] == "Updated"
        assert response.json()["last_name"] == "Doe"  # unchanged

    async def test_update_nonexistent_user(self, client):
        response = await client.put(
            "/api/users/fake-id-123",
            json={
                "first_name": "Ghost",
            },
        )
        assert response.status_code == 404


class TestSharedRelationships:
    async def test_shared_email_detected(self, client):
        await client.post(
            "/api/users/",
            json={
                **SAMPLE_USER,
                "email": "shared@test.com",
            },
        )
        await client.post(
            "/api/users/",
            json={
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "shared@test.com",
            },
        )

        await asyncio.sleep(1)

        result = await execute_query(
            "MATCH ()-[r:SHARED_EMAIL]-() RETURN count(r) AS cnt"
        )
        assert result[0]["cnt"] >= 1

    async def test_shared_address_detected(self, client):
        addr = {"street": "99 Shared Ave", "city": "SharedCity"}
        await client.post(
            "/api/users/",
            json={
                "first_name": "Alice",
                "last_name": "A",
                "email": "alice@test.com",
                "address": addr,
            },
        )
        await client.post(
            "/api/users/",
            json={
                "first_name": "Bob",
                "last_name": "B",
                "email": "bob@test.com",
                "address": addr,
            },
        )

        await asyncio.sleep(1)

        result = await execute_query(
            "MATCH ()-[r:SHARED_ADDRESS]-() RETURN count(r) AS cnt"
        )
        assert result[0]["cnt"] >= 1

    async def test_shared_payment_method_detected(self, client):
        pm = [{"id": "SHARED-CARD-001", "type": "CARD"}]
        await client.post(
            "/api/users/",
            json={
                "first_name": "Alice",
                "last_name": "A",
                "email": "alice2@test.com",
                "payment_methods": pm,
            },
        )
        await client.post(
            "/api/users/",
            json={
                "first_name": "Bob",
                "last_name": "B",
                "email": "bob2@test.com",
                "payment_methods": pm,
            },
        )

        await asyncio.sleep(1)

        result = await execute_query(
            "MATCH ()-[r:SHARED_PAYMENT_METHOD]-() RETURN count(r) AS cnt"
        )
        assert result[0]["cnt"] >= 1
