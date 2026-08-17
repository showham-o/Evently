export function formatEventDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
