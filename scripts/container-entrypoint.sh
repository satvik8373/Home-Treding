#!/bin/sh
set -eu
: "${N009_DATA_DIR:?Set the persistent engine data directory}"
# Hold a host-kernel lock across the whole process, including container PID reuse.
# Only the lock owner may clear the legacy advisory PID file after a crash.
exec flock --exclusive --nonblock --no-fork "$N009_DATA_DIR/engine.flock" sh -c '
  rm -f -- "$N009_DATA_DIR/engine.pid"
  exec node --import tsx server/index.ts
'
