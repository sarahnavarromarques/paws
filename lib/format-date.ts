// Fechas legibles en toda la app (las fechas se guardan como "AAAA-MM-DD").
// Español: "15/02/2023"   ·   Inglés: "15 Feb 2023"
export function formatDate(isoDate: string, locale: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;

  return locale === "en"
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date)
    : new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
}