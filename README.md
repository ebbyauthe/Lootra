# Lootra

## Vercel deployment
This repository is now configured for deployment as a Vercel monorepo project.

- The frontend is built from `frontend/` using Vercel static build.
- The backend is exposed under `/api` using a Python serverless function at `api/index.py`.
- Frontend API calls default to `/api` when `REACT_APP_BACKEND_URL` is not set.

## Required environment variables
Set these in Vercel dashboard or locally:

- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`
- `VAULT_KEY`
- `ADMIN_EMAIL` (optional)
- `ADMIN_PASSWORD` (optional)
- `CORS_ORIGINS` (optional, default `*`)

### MongoDB setup
For Vercel, use a hosted MongoDB provider such as MongoDB Atlas.

1. Create a cluster and a database user.
2. Add the cluster connection string as `MONGO_URL`.
3. Set `DB_NAME` to the database name used by Lootra.
5. In local development, copy `backend/.env.example` to `backend/.env` and fill the values.

You can generate a secure `VAULT_KEY` with Python:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Secret storage best practices
- Never commit `backend/.env` or any secret values to Git.
- Keep `backend/.env.example` only as a template with placeholders.
- In production, store `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `VAULT_KEY`, and other secrets in Vercel environment variables.
- Use `CORS_ORIGINS` only as a runtime environment variable, not a hard-coded value.

## Local development

Frontend:

```bash
cd frontend
yarn install
yarn start
```

Backend:

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

## Vercel deploy

From repo root, run:

```bash
vercel --prod
```

Or connect the repository in the Vercel dashboard and deploy from root.

If the backend is hosted separately, set `REACT_APP_BACKEND_URL` to the backend URL in Vercel environment variables.

### Local backend environment file
The backend loads `backend/.env` for local development. Do not commit this file.
