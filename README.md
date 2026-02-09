# Money Manager

Nuxt 4 app with PostgreSQL storage.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Database (PostgreSQL + Prisma)

Set `DATABASE_URL` (see `.env`) and run Prisma migrations:

```bash
yarn prisma:migrate
```

Generate the Prisma client if needed:

```bash
yarn prisma:generate
```

If you're using Docker Compose, run migrations inside the app container:

```bash
docker compose exec app yarn prisma:migrate
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Docker

Run the app and database with Docker Compose:

```bash
docker compose up --build
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
