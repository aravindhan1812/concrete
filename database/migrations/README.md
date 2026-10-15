# Database migrations

`schema.sql` + `seed.sql` are the **baseline** (version `0000`). Every change after that is a new file here:

```
NNNN_short_name.sql      e.g. 0001_external_users.sql
```

- Four-digit, zero-padded, strictly increasing. Never edit a file after it has been merged — add a new one.
- Each file runs inside one transaction and is recorded in `schema_migrations`.
- Keep migrations additive where possible (new tables, nullable columns, new indexes). Destructive changes need a comment explaining the data impact.
- Run with `npm run migrate` in `backend/` (`DATABASE_URL` must be set); `npm run migrate -- status` lists state.
- The API container runs migrations before starting. The Postgres container still loads the baseline on first start; the runner detects that and records `0000` without re-running it.
- CI applies the baseline and every migration against a fresh Postgres on each push.
