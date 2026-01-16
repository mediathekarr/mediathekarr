#!/bin/sh
set -e

PUID=${PUID:-1001}
PGID=${PGID:-1001}

echo "Starting with UID: $PUID, GID: $PGID"

# Get or create group with desired GID
GROUP_NAME=$(getent group "$PGID" | cut -d: -f1)
if [ -z "$GROUP_NAME" ]; then
    addgroup -g "$PGID" appgroup
    GROUP_NAME="appgroup"
fi

# Get or create user with desired UID
USER_NAME=$(getent passwd "$PUID" | cut -d: -f1)
if [ -z "$USER_NAME" ]; then
    adduser -u "$PUID" -G "$GROUP_NAME" -s /bin/sh -D appuser
    USER_NAME="appuser"
fi

# Fix ownership of app directories
chown -R "$PUID:$PGID" /app/prisma/data /app/downloads /app/ffmpeg 2>/dev/null || true

# Run database migrations
echo "Running database migrations..."
echo "DATABASE_URL: $DATABASE_URL"
echo "Checking prisma directory..."
ls -la /app/prisma/ 2>&1 || echo "Cannot list /app/prisma/"
ls -la /app/prisma/data/ 2>&1 || echo "Cannot list /app/prisma/data/"

echo "Attempting prisma migrate deploy..."
if su-exec "$USER_NAME" npx prisma migrate deploy 2>&1; then
    echo "Migration successful via migrate deploy"
else
    echo "migrate deploy failed, trying db push..."
    if su-exec "$USER_NAME" npx prisma db push --skip-generate 2>&1; then
        echo "Migration successful via db push"
    else
        echo "WARNING: Both migration methods failed!"
    fi
fi

echo "Database directory after migration:"
ls -la /app/prisma/data/ 2>&1 || echo "Cannot list /app/prisma/data/"

# Run as the user
exec su-exec "$USER_NAME" "$@"
