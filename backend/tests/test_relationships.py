import asyncio


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


async def _create_transaction(client, sender_id, receiver_id, **kwargs):
    payload = {
        "transaction_type": "TRANSFER",
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "amount": 100,
        **kwargs,
    }
    resp = await client.post("/api/transactions/", json=payload)
    return resp.json()


class TestUserRelationships:
    async def test_empty_connections(self, client):
        r = await client.post(
            "/api/users/",
            json={
                "first_name": "Lonely",
                "last_name": "User",
                "email": "lonely@test.com",
            },
        )
        user_id = r.json()["id"]

        response = await client.get(f"/api/relationships/user/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["credit_links"] == []
        assert data["debit_links"] == []
        assert data["shared_links"] == []

    async def test_credit_links(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        await _create_transaction(client, sender_id, receiver_id, amount=250)

        response = await client.get(f"/api/relationships/user/{sender_id}")
        data = response.json()
        assert len(data["credit_links"]) == 1
        assert data["credit_links"][0]["transaction"]["amount"] == 250
        assert data["credit_links"][0]["counterparty"]["id"] == receiver_id

    async def test_debit_links(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        await _create_transaction(client, sender_id, receiver_id, amount=300)

        response = await client.get(f"/api/relationships/user/{receiver_id}")
        data = response.json()
        assert len(data["debit_links"]) == 1
        assert data["debit_links"][0]["transaction"]["amount"] == 300
        assert data["debit_links"][0]["counterparty"]["id"] == sender_id

    async def test_shared_email_link(self, client):
        await client.post(
            "/api/users/",
            json={
                "first_name": "Alice",
                "last_name": "A",
                "email": "same@test.com",
            },
        )
        r2 = await client.post(
            "/api/users/",
            json={
                "first_name": "Bob",
                "last_name": "B",
                "email": "same@test.com",
            },
        )
        await asyncio.sleep(1)

        user_id = r2.json()["id"]
        response = await client.get(f"/api/relationships/user/{user_id}")
        data = response.json()

        shared_types = [s["link_type"] for s in data["shared_links"]]
        assert "SHARED_EMAIL" in shared_types

    async def test_shared_address_link(self, client):
        addr = {"street": "99 Shared Ave", "city": "TestCity"}
        r1 = await client.post(
            "/api/users/",
            json={
                "first_name": "Alice",
                "last_name": "A",
                "email": "a1@test.com",
                "address": addr,
            },
        )
        await client.post(
            "/api/users/",
            json={
                "first_name": "Bob",
                "last_name": "B",
                "email": "b1@test.com",
                "address": addr,
            },
        )
        await asyncio.sleep(1)

        user_id = r1.json()["id"]
        response = await client.get(f"/api/relationships/user/{user_id}")
        data = response.json()

        shared_types = [s["link_type"] for s in data["shared_links"]]
        assert "SHARED_ADDRESS" in shared_types

    async def test_transaction_shared_ip_link(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        same_device = {"ip_address": "10.0.0.1", "device_id": "DEV-1"}

        await _create_transaction(
            client, sender_id, receiver_id, device_info=same_device
        )
        await _create_transaction(
            client, receiver_id, sender_id, device_info=same_device
        )
        await asyncio.sleep(1)

        response = await client.get(f"/api/relationships/user/{sender_id}")
        data = response.json()

        shared_types = [s["link_type"] for s in data["shared_links"]]
        assert "SHARED_IP" in shared_types
        ip_links = [s for s in data["shared_links"] if s["link_type"] == "SHARED_IP"]
        assert ip_links[0]["transaction_count"] is not None


class TestTransactionRelationships:
    async def test_sender_and_receiver(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        tx = await _create_transaction(client, sender_id, receiver_id)

        response = await client.get(f"/api/relationships/transaction/{tx['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["sender"]["id"] == sender_id
        assert data["receiver"]["id"] == receiver_id

    async def test_no_linked_transactions(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        tx = await _create_transaction(client, sender_id, receiver_id)

        response = await client.get(f"/api/relationships/transaction/{tx['id']}")
        data = response.json()
        assert data["linked_transactions"] == []

    async def test_shared_ip_linked_transactions(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        same_device = {"ip_address": "10.0.0.1", "device_id": "DEV-1"}

        tx1 = await _create_transaction(
            client, sender_id, receiver_id, device_info=same_device
        )
        await _create_transaction(
            client, receiver_id, sender_id, device_info=same_device
        )
        await asyncio.sleep(1)

        response = await client.get(f"/api/relationships/transaction/{tx1['id']}")
        data = response.json()

        link_types = [lt["link_type"] for lt in data["linked_transactions"]]
        assert "SHARED_IP" in link_types

    async def test_shared_payment_linked_transactions(self, client):
        sender_id, receiver_id = await _create_two_users(client)
        same_pm = {"id": "SHARED-CARD-999", "type": "CARD"}

        tx1 = await _create_transaction(
            client, sender_id, receiver_id, payment_method=same_pm
        )
        await _create_transaction(
            client, receiver_id, sender_id, payment_method=same_pm
        )
        await asyncio.sleep(1)

        response = await client.get(f"/api/relationships/transaction/{tx1['id']}")
        data = response.json()

        link_types = [lt["link_type"] for lt in data["linked_transactions"]]
        assert "SHARED_PAYMENT" in link_types

    async def test_nonexistent_transaction(self, client):
        response = await client.get("/api/relationships/transaction/fake-id")
        assert response.status_code == 404
