# Money Manager

Nuxt 4 app with PostgreSQL storage.

## Setup

Install dependencies:

```bash
pnpm install
```

## Database (PostgreSQL + Prisma)

Set `DATABASE_URL` (see `.env`) and run Prisma migrations:

```bash
pnpm prisma:migrate
```

Generate the Prisma client if needed:

```bash
pnpm prisma:generate
```

If you're using Docker Compose, run migrations inside the app container:

```bash
docker compose exec app pnpm prisma:migrate
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Docker

Run the app and database with Docker Compose:

```bash
docker compose up --build
```

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
