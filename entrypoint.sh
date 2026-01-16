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

# Run as the user
exec su-exec "$USER_NAME" "$@"
