FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .

RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r -g 1001 appgroup && \
    useradd -r -u 1001 -g appgroup -d /app -s /sbin/nologin devdesksiteadmin

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv

COPY --chown=devdesksiteadmin:appgroup . /app

RUN mkdir -p /app/staticfiles /app/media && \
    chown -R devdesksiteadmin:appgroup /app/staticfiles /app/media

RUN mkdir -p /app && chown -R 1001:1001 /app

USER devdesksiteadmin

EXPOSE 8000

CMD ["gunicorn", "backend.wsgi:application", \
    "--bind", "0.0.0.0:8000", \
    "--workers", "3", \
    "--timeout", "30", \
    "--access-logfile", "-", \
    "--error-logfile", "-"]