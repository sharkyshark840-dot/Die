# Staff Time Bot

Professional Discord staff time tracking bot with clock-in, breaks, clock-out, hour totals, admin adjustments, and a persistent PostgreSQL backend.

## Railway deployment

1. Create a Railway project.
2. Add a PostgreSQL service to the project.
3. Deploy this repository as the bot service.
4. Add these environment variables to the bot service:
   - `DISCORD_TOKEN` — Discord bot token.
   - `CLIENT_ID` — Discord application/client ID.
   - `DATABASE_URL` — Railway PostgreSQL connection string.
   - `GUILD_ID` — optional; set this for fast guild-only slash-command registration. Omit it for global commands.
   - `DATABASE_SSL` — optional; defaults to SSL enabled. Set to `false` only when your PostgreSQL provider requires a non-SSL connection.
   - `DATABASE_POOL_SIZE` — optional; defaults to `10`.
5. Deploy. Railway uses the included `Dockerfile` and `railway.toml`.
6. Register slash commands with `npm run deploy` from an environment that has the Discord variables configured.

The bot creates its PostgreSQL tables automatically on startup. Staff shifts, breaks, and manual time adjustments are stored in PostgreSQL, so they are not lost when the Railway container restarts.

## Discord setup

1. Invite the bot with the `bot` and `applications.commands` scopes.
2. Run `/setup` as a Discord Administrator.
3. Select the role that should be allowed to manage staff time records.
4. Run `/panel` to post the staff control panel.

## Staff controls

- **Clock In** — starts an active shift.
- **Start Break** — pauses paid time.
- **End Break** — resumes paid time.
- **Clock Out** — closes the shift and calculates paid time.
- **My Hours** — shows recorded shift time plus manual adjustments.

## Admin controls

- `/admin addtime`
- `/admin removetime`
- `/admin history`

All manual adjustments require a reason and are stored in PostgreSQL for auditability.
