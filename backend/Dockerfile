FROM python:3.13.14-alpine3.24@sha256:399babc8b49529dabfd9c922f2b5eea81d611e4512e3ed250d75bd2e7683f4b0

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.lock ./
RUN python -m pip install --no-cache-dir --require-hashes --only-binary=:all: -r requirements.lock

COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic

# Use a deterministic high-numbered runtime identity that owns no application files.
# The API only needs read access to /app; writable scratch space is supplied by the host.
RUN addgroup -S -g 10001 app \
    && adduser -S -D -H -u 10001 -G app app

USER 10001:10001

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD python -c "import os, urllib.request; port=os.getenv('PORT', '8000'); urllib.request.urlopen(f'http://127.0.0.1:{port}/api/v1/health', timeout=2).read()"

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
