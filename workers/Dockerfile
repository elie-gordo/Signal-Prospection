# Build context: repository root (see docker-compose.yml)
FROM python:3.11-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.8.10 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
WORKDIR /app/workers

COPY workers/pyproject.toml workers/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY workers/src ./src
COPY db/schema.sql /app/db/schema.sql
RUN uv sync --frozen --no-dev

ENV PATH="/app/workers/.venv/bin:$PATH"
RUN useradd --create-home prospect
USER prospect

CMD ["prospect", "daemon"]
