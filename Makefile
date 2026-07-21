COMPOSE := docker compose

.PHONY: start up down restart logs ps api-logs web-logs db-logs migrate seed prisma-generate test lint typecheck

start:
	$(COMPOSE) up -d

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

api-logs:
	$(COMPOSE) logs -f api

web-logs:
	$(COMPOSE) logs -f web

db-logs:
	$(COMPOSE) logs -f postgres

migrate:
	$(COMPOSE) run --rm api npm run prisma:migrate -w @camiones/api -- --name local

seed:
	$(COMPOSE) run --rm api npm run seed:demo -w @camiones/api

prisma-generate:
	$(COMPOSE) run --rm api npm run prisma:generate -w @camiones/api

test:
	$(COMPOSE) run --rm api npm test

lint:
	$(COMPOSE) run --rm api npm run lint

typecheck:
	$(COMPOSE) run --rm api npm run typecheck
