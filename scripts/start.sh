#!/bin/bash
set -e

if [ ! -f .env ]; then
    echo ".env file not found. Copy .env.example to .env and fill in the values."
    exit 1
fi

cleanup() {
    echo -e "\nCaught signal! Cleaning up..."
    docker compose down -v --rmi local
    echo "Cleaned."
    exit 0
}

trap cleanup SIGINT SIGTERM

docker compose up --build -d

echo "Containers are running. Press Ctrl+C to stop..."
docker compose logs -f || true

cleanup
