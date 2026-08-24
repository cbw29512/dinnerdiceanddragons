FROM python:3.14.7-alpine3.24@sha256:05b2b8b732ecd268fee8727a369f936f022d1321b59befd13c30ede22769dcdc

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
