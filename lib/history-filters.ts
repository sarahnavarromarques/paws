// Filtros del historial de entrenamientos, guardados en la dirección:
// /pets/ID/history?filter=completed&skill=3&from=2026-01-01&to=2026-02-01

export type HistoryStatus = "all" | "completed" | "pending";

export type HistoryQuery = {
  status: HistoryStatus;
  skill: string; // id de la habilidad, o "" para todas
  from: string; // YYYY-MM-DD, o "" sin límite
  to: string; // YYYY-MM-DD, o "" sin límite
};

type RawHistoryParams = {
  filter?: string;
  skill?: string;
  from?: string;
  to?: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^\d+$/;

// Lee los filtros de la dirección; cualquier valor raro se ignora
export function parseHistoryQuery(raw: RawHistoryParams): HistoryQuery {
  const status: HistoryStatus =
    raw.filter === "completed" || raw.filter === "pending"
      ? raw.filter
      : "all";

  return {
    status,
    skill: raw.skill && ID_PATTERN.test(raw.skill) ? raw.skill : "",
    from: raw.from && DATE_PATTERN.test(raw.from) ? raw.from : "",
    to: raw.to && DATE_PATTERN.test(raw.to) ? raw.to : "",
  };
}

// Construye la dirección del historial con los filtros indicados
export function buildHistoryHref(petId: number, query: HistoryQuery): string {
  const params = new URLSearchParams();

  if (query.status !== "all") params.set("filter", query.status);
  if (query.skill) params.set("skill", query.skill);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);

  const search = params.toString();
  return search
    ? `/pets/${petId}/history?${search}`
    : `/pets/${petId}/history`;
}