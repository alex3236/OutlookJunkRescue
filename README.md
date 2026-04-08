# Outlook Junk Rescue

## Set up azure app registration

You'll need a Azure account, free plan is sufficient. No need to use the same account as your Outlook email.

Then [register the app](docs/azure-app.md)

## Docker

```shell
wget https://raw.githubusercontent.com/stevenleeg/outlook-junk-rescue/main/docker-compose.yml
wget https://raw.githubusercontent.com/stevenleeg/outlook-junk-rescue/main/.env.example -O .env
vi .env # Edit .env with your values
docker compose up -d
```

## Development

Set up the project:

```shell
git clone https://github.com/stevenleeg/outlook-junk-rescue.git
cd outlook-junk-rescue
cp .env.example .env
vi .env # Edit .env with your values
```

Run the server:

```shell
pnpm dev
```

Run the auto-renew job:

```shell
pnpm renew:loop
```

## Smoke Test

After starting the app, run:

```powershell
pnpm smoke
```

The smoke test checks:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/status` (with session cookie)
- `GET /api/status` (with `Authorization: Bearer <APP_PASSWORD>`)
- `GET /api/logs` (with session cookie)

Optional override:

- `SMOKE_BASE_URL` to point to a non-local deployment.

