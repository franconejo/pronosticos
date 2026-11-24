export function nowIso(): string {
  return new Date().toISOString();
}

export function monthKey(dateIso: string): string {
  // YYYY-MM from ISO date
  return dateIso.slice(0, 7);
}

export function isBefore(aIso: string, bIso: string): boolean {
  return new Date(aIso).getTime() < new Date(bIso).getTime();
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-PY', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Asuncion',
  });
}

export function parseParaguayDateTimeLocal(value: string): string {
  // datetime-local viene sin zona horaria; lo interpretamos como hora de Paraguay (UTC-3).
  if (!value) return '';
  const v = value.trim();
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
  const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(withSeconds);
  const iso = hasZone ? withSeconds : `${withSeconds}-03:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}
