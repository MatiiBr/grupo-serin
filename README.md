# Camiones

Monorepo for an internal steel truck loading and stowage planner. The MVP keeps the browser app, backend API, and shared domain contracts separated from day one.

## Quick Start

1. Install dependencies with `npm install`.
2. Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL` if you are not using the local Docker database.
3. Start local PostgreSQL with `docker compose up -d postgres`.
4. Apply database migrations with `npm run prisma:migrate`.
5. Seed demo data with `npm run seed:demo -w @camiones/api`.
6. Run the frontend with `npm run dev:web`.
7. Run the API with `npm run dev:api`.
8. Open Swagger at `http://localhost:3000/docs` once the API is running.

### Alternative: full Docker stack

If you'd rather not run Node locally, `make up` builds and starts Postgres, the API, and the web app as containers (ports `3002` for the API and `5173` for the web app):

```sh
make up        # build + start postgres, api, and web
make migrate   # run Prisma migrations inside the api container
make seed      # seed demo data inside the api container
```

Other useful targets: `make logs`, `make api-logs`, `make web-logs`, `make down`. See the `Makefile` for the full list.

## Structure

| Path | Purpose |
| --- | --- |
| `apps/web` | React + Vite + TypeScript frontend. |
| `apps/api` | NestJS + TypeScript API prepared for PostgreSQL, Prisma, and Swagger/OpenAPI. |
| `packages/shared` | Shared MVP enums, DTO skeletons, and domain types. |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev:web` | Starts the Vite frontend. |
| `npm run dev:api` | Starts the NestJS API in watch mode. |
| `npm run test` | Runs workspace test suites that define a test script. |
| `npm run test:api` | Runs API domain unit tests with Vitest. |
| `npm run typecheck` | Runs TypeScript checks across workspaces that define them. |
| `npm run lint` | Runs lint scripts across workspaces that define them. |
| `npm run prisma:generate` | Generates Prisma Client for the API schema. |
| `npm run prisma:migrate` | Runs Prisma migrations for the API schema. |
| `npm run seed:demo -w @camiones/api` | Seeds the database with demo dispatch lifecycle data. |

## Local Database

The default development database is PostgreSQL on Docker Compose:

```sh
docker compose up -d postgres
```

The API expects `DATABASE_URL` in `apps/api/.env`. The local development default is:

```sh
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/camiones?schema=public"
```

Create and apply Prisma migrations from the repository root with:

```sh
npm run prisma:migrate -- --name init_mvp_schema
npm run prisma:generate
```

Check migration state with:

```sh
npm exec -w @camiones/api prisma migrate status -- --schema prisma/schema.prisma
```

## Seed Data

`npm run seed:demo -w @camiones/api` populates the database with a demo dispatch lifecycle: customers, products, destinations, a truck/trailer pair, orders in different states (ready, blocked, planned), and a delivery plan with dispatch orders. Use it after migrating a fresh database to have data to explore in the frontend.

## MVP Architecture

The frontend owns user interaction for planning loads, reviewing alerts, and tracking plan status. The API owns validation, persistence, and OpenAPI documentation. Shared contracts live in `packages/shared` so both sides use the same core vocabulary for operation states, loading methods, product families, plan lifecycle, and alert metadata.

The Prisma schema in `apps/api/prisma/schema.prisma` contains the initial MVP persistence model for operations, trucks, destinations, load products, generated plans, placement results, loading steps, alerts, and plan metrics. Run `npm run prisma:generate` after schema changes, and use `npm run prisma:migrate` when applying those changes to a configured PostgreSQL database.
