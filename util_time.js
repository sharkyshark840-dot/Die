export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function parseDuration(input) {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(input.trim());
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = (match[2] || "m").toLowerCase();

  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };

  return amount * multipliers[unit];
}

export function calculateShiftPaidSeconds(shift, breaks, now = Date.now()) {
  const end = shift.ended_at ?? now;
  const elapsed = Math.max(0, end - shift.started_at) / 1000;

  const breakSeconds = breaks.reduce((total, item) => {
    const breakEnd = item.ended_at ?? (shift.ended_at ?? now);
    return total + Math.max(0, breakEnd - item.started_at) / 1000;
  }, 0);

  return Math.max(0, elapsed - breakSeconds);
}
