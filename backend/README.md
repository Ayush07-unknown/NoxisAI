# Noxis Backend Deployment

This backend is production-ready and supports SSE chat streaming, model routing, memory, history, and secure code execution.

## Run Locally (Windows)

From the `backend` folder:

```powershell
python app.py
```

Server starts at `http://localhost:5000` (or `PORT` from your `.env`).

## Production Entry Point

Use `wsgi.py` as the app entry for process managers and WSGI servers.

App target:

```text
wsgi:app
```

## Linux Production (Gunicorn)

From the `backend` folder:

```bash
gunicorn -w 4 -k gthread --threads 8 --timeout 30 "wsgi:app"
```

## Windows Production-like (Waitress)

Install waitress:

```powershell
pip install waitress
```

Run:

```powershell
waitress-serve --host=0.0.0.0 --port=5000 wsgi:app
```

## Health Check

```text
GET /health
```

Returns server status, active model, and latency metrics.

## Fix file encoding (if garbled text appears)

If any backend Python file opens with unreadable characters, run:

```powershell
python fix_encoding.py
```

This scans `backend/*.py` recursively and converts UTF-16/BOM files to UTF-8.

## Render / GitHub extras

Blueprint (`render.yaml`), root `.gitignore` template, and env checklists are kept **outside** this folder on your PC (see `Documents\Noxis_Local_Only` under your user profile). Copy those into the **repository root** when you push; do not commit secrets.
