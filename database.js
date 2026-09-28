import pg from "pg";
import process from "node:process";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: Number(process.env.DATABASE_POOL_SIZE || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      guild_id TEXT PRIMARY KEY,
      admin_role_id TEXT,
      log_channel_id TEXT,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      started_at BIGINT NOT NULL,
      ended_at BIGINT,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'completed'))
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_active
      ON shifts(guild_id, user_id, status);

    CREATE TABLE IF NOT EXISTS breaks (
      id BIGSERIAL PRIMARY KEY,
      shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      started_at BIGINT NOT NULL,
      ended_at BIGINT
    );

    CREATE INDEX IF NOT EXISTS idx_breaks_active
      ON breaks(shift_id, ended_at);

    CREATE TABLE IF NOT EXISTS adjustments (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      amount_seconds BIGINT NOT NULL,
      reason TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_adjustments_user
      ON adjustments(guild_id, user_id, created_at);
  `);
}

export const statements = {
  getSettings: async (guildId) => {
    const { rows } = await pool.query(
      `SELECT * FROM settings WHERE guild_id = $1`,
      [guildId]
    );
    return rows[0] ?? null;
  },

  upsertSettings: async ({ guildId, adminRoleId, updatedAt }) => {
    await pool.query(`
      INSERT INTO settings (guild_id, admin_role_id, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT(guild_id) DO UPDATE SET
        admin_role_id = EXCLUDED.admin_role_id,
        updated_at = EXCLUDED.updated_at
    `, [guildId, adminRoleId, updatedAt]);
  },

  getActiveShift: async (guildId, userId) => {
    const { rows } = await pool.query(`
      SELECT * FROM shifts
      WHERE guild_id = $1 AND user_id = $2 AND status = 'active'
      ORDER BY id DESC LIMIT 1
    `, [guildId, userId]);
    return rows[0] ?? null;
  },

  startShift: async (guildId, userId, startedAt) => {
    const { rows } = await pool.query(`
      INSERT INTO shifts (guild_id, user_id, started_at, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING *
    `, [guildId, userId, startedAt]);
    return rows[0];
  },

  endShift: async (endedAt, id) => {
    await pool.query(`
      UPDATE shifts SET ended_at = $1, status = 'completed' WHERE id = $2
    `, [endedAt, id]);
  },

  startBreak: async (shiftId, startedAt) => {
    const { rows } = await pool.query(`
      INSERT INTO breaks (shift_id, started_at) VALUES ($1, $2) RETURNING *
    `, [shiftId, startedAt]);
    return rows[0];
  },

  getActiveBreak: async (shiftId) => {
    const { rows } = await pool.query(`
      SELECT * FROM breaks
      WHERE shift_id = $1 AND ended_at IS NULL
      ORDER BY id DESC LIMIT 1
    `, [shiftId]);
    return rows[0] ?? null;
  },

  endBreak: async (endedAt, id) => {
    await pool.query(`UPDATE breaks SET ended_at = $1 WHERE id = $2`, [endedAt, id]);
  },

  getBreaksForShift: async (shiftId) => {
    const { rows } = await pool.query(
      `SELECT * FROM breaks WHERE shift_id = $1 ORDER BY started_at ASC`,
      [shiftId]
    );
    return rows;
  },

  addAdjustment: async (guildId, userId, adminId, amountSeconds, reason, createdAt) => {
    await pool.query(`
      INSERT INTO adjustments
        (guild_id, user_id, admin_id, amount_seconds, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [guildId, userId, adminId, amountSeconds, reason, createdAt]);
  },

  getAdjustments: async (guildId, userId, limit) => {
    const { rows } = await pool.query(`
      SELECT * FROM adjustments
      WHERE guild_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `, [guildId, userId, limit]);
    return rows;
  },

  getCompletedShifts: async (guildId, userId, limit) => {
    const { rows } = await pool.query(`
      SELECT * FROM shifts
      WHERE guild_id = $1 AND user_id = $2 AND status = 'completed'
      ORDER BY started_at DESC
      LIMIT $3
    `, [guildId, userId, limit]);
    return rows;
  }
};

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function closeDatabase() {
  await pool.end();
}

process.once("SIGINT", () => void closeDatabase().catch(() => {}));
process.once("SIGTERM", () => void closeDatabase().catch(() => {}));
