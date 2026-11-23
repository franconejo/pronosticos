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

export function toInputDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
