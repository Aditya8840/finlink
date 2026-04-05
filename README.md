# Finlink User-Transaction Network

A fraud detection platform that models users and transactions as a graph, enabling relationship discovery, shared attribute detection, and network analysis.

## Overview

This application uses Neo4j as a graph database to store users and transactions, automatically detecting relationships between entities based on shared attributes (email, phone, payment methods, IP addresses, devices). The system provides:

- **User Management** — CRUD operations with address and payment method support
- **Transaction Management** — Create, update, and track transactions between users
- **Relationship Detection** — Automatic discovery of shared attributes between users
- **Graph Visualization** — Interactive network graphs showing user connections
- **Shortest Path Analysis** — Find connection paths between any two users

## Tech Stack

| Layer | Technology |
|-------|------------|
| Database | Neo4j 5 (Graph Database) |
| Backend | FastAPI + Python 3.12 |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Graph Viz | Cytoscape.js |
| Container | Docker Compose |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.12+ (for local backend development)

### Run with Docker

```bash
# Start all services
docker compose up -d

# Seed the database with sample data
docker compose --profile seed up seed

# View logs
docker compose logs -f backend
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Neo4j Browser: http://localhost:7474 (neo4j/password123)

## API Endpoints

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/` | List users (paginated) |
| GET | `/api/users/{id}` | Get user by ID |
| POST | `/api/users/` | Create user |
| PUT | `/api/users/{id}` | Update user |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions/` | List transactions (filterable) |
| GET | `/api/transactions/{id}` | Get transaction by ID |
| POST | `/api/transactions/` | Create transaction |
| PUT | `/api/transactions/{id}` | Update transaction |

### Relationships
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/relationships/user/{id}` | Get user's connections |
| GET | `/api/relationships/transaction/{id}` | Get transaction connections |
| GET | `/api/relationships/shortest-path` | Find shortest path between users |

## Features

### Relationship Detection

When a transaction is created or updated, a background task analyzes shared attributes:

- **SHARED_PAYMENT_METHOD** — Same card/account used
- **SHARED_IP** — Same IP address
- **SHARED_DEVICE** — Same device ID
- **SHARED_EMAIL** — Same email address
- **SHARED_PHONE** — Same phone number
- **SHARED_ADDRESS** — Same address

### Graph Visualization

- **User Detail Page** — Shows all connected users via transactions and shared attributes
- **Transaction Detail Page** — Shows sender, receiver, and linked transactions
- **Shortest Path Finder** — Visualizes the connection path between two users

## Testing

```bash
cd backend

# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=app --cov-report=term-missing

# Run specific test file
uv run pytest tests/test_relationships.py -v
```

## CI/CD

GitHub Actions workflows:
- `backend-lint.yml` — Ruff linting for Python
- `backend-test.yml` — Pytest with Neo4j testcontainer
- `frontend-lint.yml` — ESLint + TypeScript checking

## Future Enhancements

### Infrastructure & Architecture

- **Replace Background Tasks with Job Queue** — Current relationship detection runs as FastAPI background tasks. For production, replace with:
  - [Temporal](https://temporal.io/) — Durable workflow orchestration with retries, timeouts, and visibility
  - [Celery](https://celeryproject.org/) + Redis — Traditional async task queue
