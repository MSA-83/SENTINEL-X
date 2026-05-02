#!/bin/bash
set -e

echo "=== SENTINEL-X Setup ==="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check required tools
check_tool() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1 (required)"
        exit 1
    fi
}

echo "Checking required tools..."
check_tool node
check_tool npm
check_tool docker

# Environment setup
echo -e "\n${YELLOW}Setting up environment...${NC}"

if [ ! -f .env.local ]; then
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo "Created .env.local from example"
    fi
fi

# Install dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
npm install

# Docker services
echo -e "\n${YELLOW}Starting Docker services...${NC}"
docker-compose up -d postgres redis

# Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
sleep 5

# Database setup
echo -e "\n${YELLOW}Setting up database...${NC}"
docker-compose exec -T postgres psql -U sentinel -c "SELECT 1" &> /dev/null || \
    docker-compose exec postgres psql -U sentinel -c "CREATE DATABASE sentinel;" || true

echo -e "\n${GREEN}=== Setup Complete ===${NC}"
echo "Run 'npm run dev' to start development server"