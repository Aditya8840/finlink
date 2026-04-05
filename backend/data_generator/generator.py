import asyncio
import os
import random
import sys
import time
import uuid
from datetime import UTC, datetime, timedelta

import numpy as np
from faker import Faker

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import (
    close_driver,
    execute_query,
    execute_write,
    get_driver,
    init_constraints,
)

fake = Faker()
Faker.seed(42)
random.seed(42)
np.random.seed(42)

BATCH_SIZE = 500
NOW = datetime.now(tz=UTC)
NINETY_DAYS = timedelta(days=90)

CITIES = [
    ("New York", "NY", "US"),
    ("Los Angeles", "CA", "US"),
    ("Chicago", "IL", "US"),
    ("London", "", "GB"),
    ("Berlin", "", "DE"),
    ("Paris", "", "FR"),
    ("Toronto", "ON", "CA"),
    ("Sydney", "NSW", "AU"),
    ("Singapore", "", "SG"),
    ("Mumbai", "MH", "IN"),
]
PAYMENT_TYPES = ["CARD", "BANK_ACCOUNT", "WALLET", "CASH"]
TX_TYPES = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "PAYMENT"]
TX_STATUSES = ["SUCCESSFUL"] * 4 + ["DECLINED", "SUSPENDED", "REFUNDED"]
CURRENCIES = ["USD"] * 4 + ["EUR", "GBP", "CAD"]

FRAUD_RINGS = [
    *[{"type": "shared_ip", "size": s} for s in [5, 4, 6, 5, 4, 5]],
    *[{"type": "shared_device", "size": s} for s in [4, 3, 5, 4, 3]],
    *[{"type": "shared_identity", "size": s} for s in [3, 4, 3, 4, 3]],
    *[{"type": "shared_payment", "size": s} for s in [4, 3, 5, 4]],
    *[{"type": "money_mule", "size": s} for s in [6, 4, 8]],
    *[{"type": "mixed", "size": s} for s in [5, 8]],
]


def rand_ip():
    parts = [
        random.randint(1, 223),
        random.randint(0, 255),
        random.randint(0, 255),
        random.randint(1, 254),
    ]
    return ".".join(str(p) for p in parts)


def rand_device():
    return f"DEV-{uuid.uuid4().hex[:8].upper()}"


def rand_payment_ref():
    return f"PAY-{uuid.uuid4().hex[:12].upper()}"


def rand_ts():
    delta = random.randint(0, int(NINETY_DAYS.total_seconds()))
    return (NOW - timedelta(seconds=delta)).isoformat()


def rand_amount():
    return round(float(np.random.lognormal(mean=5.0, sigma=1.5)), 2)


def make_user(uid, overrides=None):
    city, state, country = random.choice(CITIES)
    user = {
        "id": uid,
        "first_name": fake.first_name(),
        "last_name": fake.last_name(),
        "email": fake.unique.email(),
        "phone": fake.unique.phone_number(),
        "created_at": rand_ts(),
        "updated_at": rand_ts(),
        "street": fake.street_address(),
        "city": city,
        "state": state,
        "postal_code": fake.postcode(),
        "country": country,
        "payment_id": rand_payment_ref(),
        "payment_type": random.choice(PAYMENT_TYPES),
    }
    if overrides:
        user.update(overrides)
    return user


def make_transaction(sender_id, receiver_id, overrides=None):
    tx = {
        "id": str(uuid.uuid4()),
        "transaction_type": random.choice(TX_TYPES),
        "status": random.choice(TX_STATUSES),
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "amount": rand_amount(),
        "currency": random.choice(CURRENCIES),
        "created_at": rand_ts(),
        "updated_at": rand_ts(),
        "description": None,
        "device_id": rand_device(),
        "ip_address": rand_ip(),
        "geo_country": random.choice(CITIES)[2],
        "geo_state": random.choice(CITIES)[1],
        "payment_id": rand_payment_ref(),
        "payment_type": random.choice(PAYMENT_TYPES),
    }
    if overrides:
        tx.update(overrides)
    return tx


def generate_users(num_users=1000):
    users = []
    rings = []

    for i, ring_def in enumerate(FRAUD_RINGS):
        ring = {
            "type": ring_def["type"],
            "user_ids": [],
            "shared_ip": None,
            "shared_device": None,
            "shared_email": None,
            "shared_phone": None,
            "shared_address": None,
            "shared_payment": None,
        }

        if ring_def["type"] in ("shared_ip", "mixed"):
            ring["shared_ip"] = rand_ip()
        if ring_def["type"] in ("shared_device", "mixed"):
            ring["shared_device"] = rand_device()
        if ring_def["type"] == "shared_identity":
            if random.random() < 0.5:
                ring["shared_email"] = fake.email()
            else:
                ring["shared_phone"] = fake.phone_number()
        if ring_def["type"] in ("shared_payment", "mixed"):
            ring["shared_payment"] = rand_payment_ref()
        if ring_def["type"] == "mixed":
            city, state, _ = random.choice(CITIES[:5])
            ring["shared_address"] = {"street": fake.street_address(), "city": city}

        for _ in range(ring_def["size"]):
            uid = str(uuid.uuid4())
            ring["user_ids"].append(uid)

            overrides = {}
            if ring["shared_email"]:
                overrides["email"] = ring["shared_email"]
            if ring["shared_phone"]:
                overrides["phone"] = ring["shared_phone"]
            if ring["shared_payment"]:
                overrides["payment_id"] = ring["shared_payment"]
            if ring["shared_address"]:
                overrides["street"] = ring["shared_address"]["street"]
                overrides["city"] = ring["shared_address"]["city"]

            users.append(make_user(uid, overrides))

        rings.append(ring)

    remaining = num_users - len(users)
    for _ in range(remaining):
        users.append(make_user(str(uuid.uuid4())))

    return users, rings


def generate_transactions(all_user_ids, rings, total=100_000):
    txns = []
    fraud_count = min(5_000, total // 5)
    normal_count = total - fraud_count

    for _ in range(normal_count):
        s, r = random.sample(all_user_ids, 2)
        txns.append(make_transaction(s, r))

    per_ring = fraud_count // max(len(rings), 1)
    for ring in rings:
        uids = ring["user_ids"]
        for _ in range(per_ring):
            if len(uids) < 2:
                s, r = uids[0], random.choice(all_user_ids)
            elif ring["type"] == "money_mule":
                idx = random.randint(0, len(uids) - 2)
                s, r = uids[idx], uids[idx + 1]
            else:
                s, r = random.sample(uids, 2)

            overrides = {"transaction_type": "TRANSFER", "status": "SUCCESSFUL"}
            if ring["shared_ip"]:
                overrides["ip_address"] = ring["shared_ip"]
            if ring["shared_device"]:
                overrides["device_id"] = ring["shared_device"]
            if ring["shared_payment"]:
                overrides["payment_id"] = ring["shared_payment"]

            txns.append(make_transaction(s, r, overrides))

    txns.sort(key=lambda t: t["created_at"])
    return txns


async def seed_users(users):
    print(f"  Seeding {len(users)} users...")
    for i in range(0, len(users), BATCH_SIZE):
        batch = users[i : i + BATCH_SIZE]

        await execute_write(
            """
            UNWIND $batch AS u
            CREATE (n:User {
                id: u.id, first_name: u.first_name, last_name: u.last_name,
                email: u.email, phone: u.phone,
                created_at: u.created_at, updated_at: u.updated_at
            })
            """,
            {"batch": batch},
        )

        await execute_write(
            """
            UNWIND $batch AS u
            MATCH (n:User {id: u.id})
            CREATE (a:Address {
                street: u.street, city: u.city, state: u.state,
                postal_code: u.postal_code, country: u.country
            })
            CREATE (n)-[:HAS_ADDRESS]->(a)
            """,
            {"batch": batch},
        )

        await execute_write(
            """
            UNWIND $batch AS u
            MATCH (n:User {id: u.id})
            CREATE (p:PaymentMethod {id: u.payment_id, type: u.payment_type})
            CREATE (n)-[:HAS_PAYMENT_METHOD]->(p)
            """,
            {"batch": batch},
        )

        done = min(i + BATCH_SIZE, len(users))
        if done % 500 == 0:
            print(f"    {done}/{len(users)}")


async def seed_transactions(txns):
    print(f"  Seeding {len(txns)} transactions...")
    for i in range(0, len(txns), BATCH_SIZE):
        batch = txns[i : i + BATCH_SIZE]

        await execute_write(
            """
            UNWIND $batch AS tx
            MATCH (sender:User {id: tx.sender_id})
            MATCH (receiver:User {id: tx.receiver_id})
            CREATE (sender)-[:SENT]->(t:Transaction {
                id: tx.id, transaction_type: tx.transaction_type,
                status: tx.status, sender_id: tx.sender_id,
                receiver_id: tx.receiver_id, amount: tx.amount,
                currency: tx.currency, created_at: tx.created_at,
                updated_at: tx.updated_at, description: tx.description
            })-[:RECEIVED_BY]->(receiver)
            """,
            {"batch": batch},
        )

        await execute_write(
            """
            UNWIND $batch AS tx
            MATCH (t:Transaction {id: tx.id})
            CREATE (d:DeviceInfo {ip_address: tx.ip_address, device_id: tx.device_id})
            CREATE (t)-[:FROM_DEVICE]->(d)
            CREATE (g:Geolocation {country: tx.geo_country, state: tx.geo_state})
            CREATE (d)-[:LOCATED_AT]->(g)
            """,
            {"batch": batch},
        )

        await execute_write(
            """
            UNWIND $batch AS tx
            MATCH (t:Transaction {id: tx.id})
            CREATE (pm:PaymentMethod {id: tx.payment_id, type: tx.payment_type})
            CREATE (t)-[:USED_PAYMENT_METHOD]->(pm)
            """,
            {"batch": batch},
        )

        done = min(i + BATCH_SIZE, len(txns))
        if done % 5000 == 0 or done == len(txns):
            print(f"    {done}/{len(txns)}")


async def detect_relationships():
    print("  Detecting relationships...")

    queries = [
        (
            "SHARED_EMAIL",
            """
            MATCH (u1:User), (u2:User)
            WHERE u1.id < u2.id AND u1.email IS NOT NULL AND u1.email = u2.email
            MERGE (u1)-[r:SHARED_EMAIL]-(u2)
            RETURN count(r) AS cnt
        """,
        ),
        (
            "SHARED_PHONE",
            """
            MATCH (u1:User), (u2:User)
            WHERE u1.id < u2.id AND u1.phone IS NOT NULL AND u1.phone = u2.phone
            MERGE (u1)-[r:SHARED_PHONE]-(u2)
            RETURN count(r) AS cnt
        """,
        ),
        (
            "SHARED_ADDRESS",
            """
            MATCH (u1:User)-[:HAS_ADDRESS]->(a1:Address),
                  (u2:User)-[:HAS_ADDRESS]->(a2:Address)
            WHERE u1.id < u2.id AND a1.street IS NOT NULL
              AND a1.street = a2.street AND a1.city = a2.city
            MERGE (u1)-[r:SHARED_ADDRESS]-(u2)
            RETURN count(r) AS cnt
        """,
        ),
        (
            "SHARED_PAYMENT_METHOD",
            """
            MATCH (u1:User)-[:HAS_PAYMENT_METHOD]->(p1:PaymentMethod),
                  (u2:User)-[:HAS_PAYMENT_METHOD]->(p2:PaymentMethod)
            WHERE u1.id < u2.id AND p1.id = p2.id
            MERGE (u1)-[r:SHARED_PAYMENT_METHOD]-(u2)
            RETURN count(r) AS cnt
        """,
        ),
        (
            "SHARED_IP",
            """
            MATCH (d:DeviceInfo)
            WITH d.ip_address AS ip, collect(d)[0..50] AS devices
            WHERE size(devices) > 1
            UNWIND devices AS d1
            MATCH (t1:Transaction)-[:FROM_DEVICE]->(d1)
            WITH ip, collect(t1)[0..50] AS txns
            WHERE size(txns) > 1
            WITH txns, txns[0] AS anchor
            UNWIND txns[1..] AS other
            MERGE (anchor)-[:SHARED_IP]-(other)
            RETURN count(*) AS cnt
        """,
        ),
        (
            "SHARED_DEVICE",
            """
            MATCH (d:DeviceInfo)
            WHERE d.device_id IS NOT NULL
            WITH d.device_id AS did, collect(d)[0..50] AS devices
            WHERE size(devices) > 1
            UNWIND devices AS d1
            MATCH (t1:Transaction)-[:FROM_DEVICE]->(d1)
            WITH did, collect(t1)[0..50] AS txns
            WHERE size(txns) > 1
            WITH txns, txns[0] AS anchor
            UNWIND txns[1..] AS other
            MERGE (anchor)-[:SHARED_DEVICE]-(other)
            RETURN count(*) AS cnt
        """,
        ),
        (
            "SHARED_PAYMENT",
            """
            MATCH (t1:Transaction)-[:USED_PAYMENT_METHOD]->(pm1:PaymentMethod)
            WITH pm1.id AS pmId, collect(t1)[0..50] AS txns
            WHERE size(txns) > 1
            WITH txns, txns[0] AS anchor
            UNWIND txns[1..] AS other
            MERGE (anchor)-[:SHARED_PAYMENT]-(other)
            RETURN count(*) AS cnt
        """,
        ),
    ]

    stats = {}
    for name, query in queries:
        t0 = time.time()
        result = await execute_write(query)
        cnt = result[0]["cnt"] if result else 0
        stats[name] = cnt
        print(f"    {name}: {cnt} ({time.time() - t0:.1f}s)")

    return stats


async def main():
    num_users = 10_000
    num_txns = 100_000

    print("Connecting to Neo4j...")
    await get_driver()
    await init_constraints()
    await execute_write("MATCH (n) DETACH DELETE n")
    print("Database cleared.\n")

    print(f"Step 1/4: Generating {num_users} users...")
    t0 = time.time()
    users, rings = generate_users(num_users)
    print(f"  {len(users)} users, {len(rings)} fraud rings ({time.time() - t0:.1f}s)\n")

    print(f"Step 2/4: Generating {num_txns} transactions...")
    t0 = time.time()
    all_ids = [u["id"] for u in users]
    txns = generate_transactions(all_ids, rings, total=num_txns)
    print(f"  {len(txns)} transactions ({time.time() - t0:.1f}s)\n")

    print("Step 3/4: Inserting into Neo4j...")
    t0 = time.time()
    await seed_users(users)
    await seed_transactions(txns)
    print(f"  Done ({time.time() - t0:.1f}s)\n")

    print("Step 4/4: Detecting relationships...")
    t0 = time.time()
    stats = await detect_relationships()
    print(f"  Done ({time.time() - t0:.1f}s)\n")

    result = await execute_query(
        "MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC"
    )

    print("=" * 50)
    print("SEED COMPLETE")
    print("=" * 50)
    print(f"Users:        {len(users)}")
    print(f"Transactions: {len(txns)}")
    print(f"Fraud rings:  {len(rings)}")
    print()
    print("Nodes:")
    for r in result:
        print(f"  {r['label']:20s} {r['count']}")
    print()
    print("Relationships detected:")
    for k, v in sorted(stats.items()):
        print(f"  {k}: {v}")

    await close_driver()


if __name__ == "__main__":
    asyncio.run(main())
