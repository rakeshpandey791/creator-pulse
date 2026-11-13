/* global CP_SCHEMA_PATH, load */

// DB-01: idempotent schema, validators and indexes.
load(
  typeof CP_SCHEMA_PATH === "undefined"
    ? "docs/database/SCHEMA.sql"
    : CP_SCHEMA_PATH,
);
