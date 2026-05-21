export function formatDistanceToNow(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day >= 1) return `${day} hari lalu`;
  if (hr >= 1) return `${hr} jam lalu`;
  if (min >= 1) return `${min} minit lalu`;
  return "baru sahaja";
}
