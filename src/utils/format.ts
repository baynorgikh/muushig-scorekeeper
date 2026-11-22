export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  return `${sign}${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}₮`;
}

export function formatSigned(n: number): string {
  return n > 0 ? `+${formatMoney(n)}` : formatMoney(n);
}

export function formatPoints(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

const pad = (n: number) => n.toString().padStart(2, '0');

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function percent(n: number): string {
  return `${Math.round(n * 100)}%`;
}
