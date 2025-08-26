FROM python:3.12-slim

# Keep Python output unbuffered and avoid .pyc files
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt \
    && pip install --no-cache-dir waitress

# Copy backend source and migrations
COPY backend /app/backend
COPY migrations /app/migrations
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/backend/static/uploads

# Default env expected by the app/migrations
ENV PYTHONPATH=/app \
    FLASK_APP=app.py

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
