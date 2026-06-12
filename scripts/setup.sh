#!/bin/bash
set -e

# Saarthi MVP - Quick Setup Script
# This script automates installing dependencies, setting up local config, starting docker containers,
# applying migrations, and seeding the database.

# Colors for log messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}        🚀 Saarthi MVP Monorepo Setup 🚀            ${NC}"
echo -e "${BLUE}===================================================${NC}"

# 1. Root dependencies installation
echo -e "\n${YELLOW}📦 Step 1: Installing dependencies...${NC}"
npm install

# 2. Setup env file
echo -e "\n${YELLOW}⚙️ Step 2: Creating environment files...${NC}"
if [ ! -f backend/api/.env ]; then
  cp backend/api/.env.example backend/api/.env
  echo -e "${GREEN}✓ Created backend/api/.env from .env.example${NC}"
else
  echo -e "${BLUE}ℹ backend/api/.env already exists, skipping copy.${NC}"
fi

# 3. Check Docker status
echo -e "\n${YELLOW}🐳 Step 3: Starting Docker infrastructure...${NC}"
if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: Docker is not running. Please start Docker and run this script again.${NC}"
  exit 1
fi

# Spin up Postgres and Redis
docker compose -f docker/docker-compose.yml up -d postgres redis

# Wait for Postgres to be healthy
echo -e "\n${YELLOW}⌛ Step 4: Waiting for PostgreSQL to be ready...${NC}"
RETRIES=15
until docker exec saarthi_postgres pg_isready -U saarthi -d saarthi_dev >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo -e "Waiting for database connection... ($RETRIES retries left)"
  sleep 2
  RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
  echo -e "${RED}❌ Error: Database health check timed out. Checking docker container logs:${NC}"
  docker compose -f docker/docker-compose.yml logs postgres
  exit 1
fi
echo -e "${GREEN}✓ PostgreSQL is healthy!${NC}"

# 4. Prisma Setup
echo -e "\n${YELLOW}🗄️ Step 5: Generating Prisma client...${NC}"
npm run db:generate --workspace=backend/api

echo -e "\n${YELLOW}🚀 Step 6: Running database migrations...${NC}"
npm run db:migrate --workspace=backend/api

echo -e "\n${YELLOW}🌱 Step 7: Seeding the database with mock data...${NC}"
npm run db:seed --workspace=backend/api

echo -e "\n${GREEN}===================================================${NC}"
echo -e "${GREEN}🎉 Saarthi MVP Monorepo Setup Complete! 🎉${NC}"
echo -e "${GREEN}===================================================${NC}"
echo -e ""
echo -e "To start developing:"
echo -e "  - Start Backend:    ${BLUE}npm run dev:backend${NC}"
echo -e "  - Start Parent App: ${BLUE}npm run dev:parent${NC}"
echo -e "  - Start Driver App: ${BLUE}npm run dev:driver${NC}"
echo -e "  - Start Admin App:  ${BLUE}npm run dev:admin${NC}"
echo -e ""
echo -e "Demo login details (OTP bypass code is 123456):"
echo -e "  - Parent Account:  ${YELLOW}+919999000001${NC}"
echo -e "  - Driver Account:  ${YELLOW}+919999000002${NC}"
echo -e "  - Admin Account:   ${YELLOW}+919999000003${NC}"
echo -e "==================================================="
