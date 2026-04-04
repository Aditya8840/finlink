import asyncio

from app.db import execute_query


async def _create_two_users(client):
    r1 = await client.post(
        "/api/users/",
        json={
            "first_name": "Alice",
            "last_name": "Sender",
            "email": "alice@test.com",
        },
    )
    r2 = await client.post(
        "/api/users/",
        json={
            "first_name": "Bob",
            "last_name": "Receiver",
            "email": "bob@test.com",
        },
    )
    return r1.json()["id"], r2.json()["id"]


SAMPLE_DEVICE = {
    "device_id": "DEV-ABC123",
    "ip_address": "192.168.1.1",
    "geolocation": {"country": "US", "state": "CA"},
}

SAMPLE_PAYMENT = {"id": "card_4242", "type": "CARD"}


class TestCreateTransaction:
    async def test_create_with_all_fields(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        response = await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "TRANSFER",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "amount": 100.50,
                "currency": "USD",
                "description": "Test transfer",
                "device_info": SAMPLE_DEVICE,
                "payment_method": SAMPLE_PAYMENT,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["sender_id"] == sender_id
        assert data["receiver_id"] == receiver_id
        assert data["amount"] == 100.50
        assert data["transaction_type"] == "TRANSFER"
        assert data["device_info"]["ip_address"] == "192.168.1.1"
        assert data["payment_method"]["id"] == "card_4242"

    async def test_create_with_required_fields_only(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        response = await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "PAYMENT",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "amount": 50.00,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["device_info"] is None
        assert data["payment_method"] is None
        assert data["status"] == "CREATED"

    async def test_create_with_nonexistent_sender(self, client):
        _, receiver_id = await _create_two_users(client)
        response = await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "TRANSFER",
                "sender_id": "nonexistent-id",
                "receiver_id": receiver_id,
                "amount": 100,
            },
        )
        assert response.status_code == 400

    async def test_create_with_nonexistent_receiver(self, client):
        sender_id, _ = await _create_two_users(client)
        response = await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "TRANSFER",
                "sender_id": sender_id,
                "receiver_id": "nonexistent-id",
                "amount": 100,
            },
        )
        assert response.status_code == 400

    async def test_create_sender_equals_receiver(self, client):
        sender_id, _ = await _create_two_users(client)
        response = await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "TRANSFER",
                "sender_id": sender_id,
                "receiver_id": sender_id,
                "amount": 100,
            },
        )
        assert response.status_code == 400

    async def test_create_with_invalid_type(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        response = await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "INVALID",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "amount": 100,
            },
        )
        assert response.status_code == 422


class TestGetTransaction:
    async def test_get_existing(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        create_resp = await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "DEPOSIT",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "amount": 200,
            },
        )
        tx_id = create_resp.json()["id"]

        response = await client.get(f"/api/transactions/{tx_id}")
        assert response.status_code == 200
        assert response.json()["amount"] == 200

    async def test_get_nonexistent(self, client):
        response = await client.get("/api/transactions/nonexistent-id")
        assert response.status_code == 404


class TestListTransactions:
    async def test_list_empty(self, client):
        response = await client.get("/api/transactions/")
        assert response.status_code == 200
        assert response.json()["transactions"] == []

    async def test_list_returns_transactions(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        for i in range(3):
            await client.post(
                "/api/transactions/",
                json={
                    "transaction_type": "TRANSFER",
                    "sender_id": sender_id,
                    "receiver_id": receiver_id,
                    "amount": 100 + i,
                },
            )

        response = await client.get("/api/transactions/")
        assert response.status_code == 200
        assert len(response.json()["transactions"]) == 3

    async def test_list_pagination(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        for i in range(3):
            await client.post(
                "/api/transactions/",
                json={
                    "transaction_type": "TRANSFER",
                    "sender_id": sender_id,
                    "receiver_id": receiver_id,
                    "amount": 100 + i,
                },
            )

        response = await client.get("/api/transactions/?limit=2")
        data = response.json()
        assert len(data["transactions"]) == 2
        assert data["pagination"]["has_more"] is True

        cursor = data["pagination"]["next_cursor"]
        response2 = await client.get(f"/api/transactions/?cursor={cursor}&limit=2")
        data2 = response2.json()
        assert len(data2["transactions"]) == 1
        assert data2["pagination"]["has_more"] is False


class TestUpdateTransaction:
    async def test_update_status(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        create_resp = await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "TRANSFER",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "amount": 500,
            },
        )
        tx_id = create_resp.json()["id"]

        response = await client.put(
            f"/api/transactions/{tx_id}",
            json={
                "status": "SUCCESSFUL",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "SUCCESSFUL"
        assert response.json()["amount"] == 500  # unchanged

    async def test_update_nonexistent(self, client):
        response = await client.put(
            "/api/transactions/fake-id",
            json={
                "status": "DECLINED",
            },
        )
        assert response.status_code == 404


class TestSharedRelationships:
    async def test_shared_ip_detected(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        same_device = {"ip_address": "10.0.0.1", "device_id": "DEV-1"}

        await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "TRANSFER",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "amount": 100,
                "device_info": same_device,
            },
        )
        await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "PAYMENT",
                "sender_id": receiver_id,
                "receiver_id": sender_id,
                "amount": 50,
                "device_info": same_device,
            },
        )

        await asyncio.sleep(1)

        result = await execute_query("MATCH ()-[r:SHARED_IP]-() RETURN count(r) AS cnt")
        assert result[0]["cnt"] >= 1

    async def test_shared_device_detected(self, client):
        sender_id, receiver_id = await _create_two_users(client)

        await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "TRANSFER",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "amount": 100,
                "device_info": {"device_id": "SHARED-DEV", "ip_address": "1.1.1.1"},
            },
        )
        await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "TRANSFER",
                "sender_id": receiver_id,
                "receiver_id": sender_id,
                "amount": 200,
                "device_info": {"device_id": "SHARED-DEV", "ip_address": "2.2.2.2"},
            },
        )

        await asyncio.sleep(1)

        result = await execute_query(
            "MATCH ()-[r:SHARED_DEVICE]-() RETURN count(r) AS cnt"
        )
        assert result[0]["cnt"] >= 1

    async def test_shared_payment_detected(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        same_pm = {"id": "SHARED-CARD-999", "type": "CARD"}

        await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "PAYMENT",
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "amount": 100,
                "payment_method": same_pm,
            },
        )
        await client.post(
            "/api/transactions/",
            json={
                "transaction_type": "PAYMENT",
                "sender_id": receiver_id,
                "receiver_id": sender_id,
                "amount": 200,
                "payment_method": same_pm,
            },
        )

        await asyncio.sleep(1)

        result = await execute_query(
            "MATCH ()-[r:SHARED_PAYMENT]-() RETURN count(r) AS cnt"
        )
        assert result[0]["cnt"] >= 1
