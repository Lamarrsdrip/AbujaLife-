#!/bin/sh
set -eu
mkdir -p /run/abujalife-mongo
install -o mongodb -g mongodb -m 400 /run/secrets/mongo-keyfile /run/abujalife-mongo/keyfile
install -o mongodb -g mongodb -m 400 /run/secrets/mongo-root-password /run/abujalife-mongo/root-password
export MONGO_INITDB_ROOT_PASSWORD_FILE=/run/abujalife-mongo/root-password
exec /usr/local/bin/docker-entrypoint.sh "$@"
