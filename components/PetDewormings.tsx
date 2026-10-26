"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import Pawsi from "@/components/Pawsi";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import {
  DEWORMING_DEFAULT_INTERVAL,
  DEWORMING_ICONS,
  DEWORMING_KEYS,
  INTERVAL_OPTIONS,
  isDewormingKey,
  nextDewormingDate,
  type DewormingKey,
} from "@/lib/deworming";
import {
  daysBetween,
  getDueStatus,
  todayIso,
  type DueStatus,
} from "@/lib/vaccination-plan";

type HealthRow = Database["public"]["Tables"]["pet_vaccinations"]["Row"];
type HealthInsert = Database["public"]["Tables"]["pet_vaccinations"]["Insert"];

const PHOTO_BUCKET = "vaccination-photos";
const SIGNED_URL_SECONDS = 60 * 60;

type FormMode = "add" | "edit" | "done";

type FormState = {
  mode: FormMode;
  rowId: string | null;
  typeKey: DewormingKey;
  product: string;
  status: "pending" | "done";
  dueDate: string;
  givenDate: string;
  intervalMonths: number;
  vet: string;
  notes: string;
  existingPhotoPath: string | null;
  removePhoto: boolean;
  newPhoto: File | null;
  newPhotoPreview: string | null;
};

type Props = {
  petId: number;
  petName: string;
  userId: string;
  initialItems: HealthRow[];
  initialPhotoUrls: Record<string, string>;
};

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

const STATUS_STYLES: Record<DueStatus, string> = {
  overdue: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-700",
  upcoming: "bg-blue-100 text-blue-700",
  no_date: "bg-slate-100 text-slate-600",
  done: "bg-green-100 text-green-700",
};

// Pendientes: primero las que tienen fecha (de la más cercana a la más lejana)
function sortPending(a: HealthRow, b: HealthRow): number {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.created_at.localeCompare(b.created_at);
}

// Hechas: de la más reciente a la más antigua
function sortDone(a: HealthRow, b: HealthRow): number {
  return (b.given_date ?? "").localeCompare(a.given_date ?? "");
}

function formatDate(isoDate: string, locale: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;

  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function PetDewormings({
  petId,
  petName,
  userId,
  initialItems,
  initialPhotoUrls,
}: Props) {
  const t = useTranslations("Deworming");
  const tTypes = useTranslations("Deworming.typeNames");
  const locale = useLocale();

  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => todayIso(), []);

  const [items, setItems] = useState<HealthRow[]>(initialItems);
  const [photoUrls, setPhotoUrls] =
    useState<Record<string, string>>(initialPhotoUrls);

  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(
    () => items.filter((item) => item.status !== "done").sort(sortPending),
    [items]
  );

  const done = useMemo(
    () => items.filter((item) => item.status === "done").sort(sortDone),
    [items]
  );

  function typeOf(row: HealthRow): DewormingKey | null {
    return isDewormingKey(row.vaccine_key) ? row.vaccine_key : null;
  }

  function displayName(row: HealthRow): string {
    const key = typeOf(row);
    return key ? tTypes(key) : row.name;
  }

  function displayIcon(row: HealthRow): string {
    const key = typeOf(row);
    return key ? DEWORMING_ICONS[key] : "🛡️";
  }

  // --- Formulario ---

  function clearMessages() {
    setFormError(null);
    setInfo(null);
    setError(null);
  }

  // Al añadir, por defecto se registra como hecha hoy (así PAWS propone la siguiente)
  function openAdd(typeKey?: DewormingKey) {
    clearMessages();
    const key = typeKey ?? "internal";

    setForm({
      mode: "add",
      rowId: null,
      typeKey: key,
      product: "",
      status: "done",
      dueDate: "",
      givenDate: today,
      intervalMonths: DEWORMING_DEFAULT_INTERVAL[key],
      vet: "",
      notes: "",
      existingPhotoPath: null,
      removePhoto: false,
      newPhoto: null,
      newPhotoPreview: null,
    });
  }

  function rowToForm(row: HealthRow, mode: FormMode): FormState {
    const key = typeOf(row) ?? "internal";

    return {
      mode,
      rowId: row.id,
      typeKey: key,
      product: row.product ?? "",
      status: mode === "done" || row.status === "done" ? "done" : "pending",
      dueDate: row.due_date ?? "",
      givenDate: row.given_date ?? (mode === "done" ? today : ""),
      intervalMonths: row.interval_months ?? DEWORMING_DEFAULT_INTERVAL[key],
      vet: row.vet ?? "",
      notes: row.notes ?? "",
      existingPhotoPath: row.photo_path,
      removePhoto: false,
      newPhoto: null,
      newPhotoPreview: null,
    };
  }

  function openEdit(row: HealthRow) {
    clearMessages();
    setForm(rowToForm(row, "edit"));
  }

  function openDone(row: HealthRow) {
    clearMessages();
    setForm(rowToForm(row, "done"));
  }

  function closeForm() {
    if (form?.newPhotoPreview) {
      URL.revokeObjectURL(form.newPhotoPreview);
    }
    setForm(null);
    setFormError(null);
  }

  function updateForm(changes: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...changes } : current));
  }

  function handlePhotoChange(file: File | null) {
    if (!form) return;

    if (form.newPhotoPreview) {
      URL.revokeObjectURL(form.newPhotoPreview);
    }

    updateForm({
      newPhoto: file,
      newPhotoPreview: file ? URL.createObjectURL(file) : null,
      removePhoto: false,
    });
  }

  async function signPhoto(
    path: string,
    urls: Record<string, string>
  ): Promise<Record<string, string>> {
    if (urls[path]) return urls;

    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, SIGNED_URL_SECONDS);

    return data?.signedUrl ? { ...urls, [path]: data.signedUrl } : urls;
  }

  async function handleSave() {
    if (!form) return;
    setFormError(null);

    const status: "pending" | "done" =
      form.mode === "done" ? "done" : form.status;

    if (status === "done" && !form.givenDate) {
      setFormError(t("errorGivenDateRequired"));
      return;
    }

    setSaving(true);

    try {
      // 1) Foto nueva (si la hay)
      let photoPath: string | null = form.removePhoto
        ? null
        : form.existingPhotoPath;
      let uploadedPath: string | null = null;

      if (form.newPhoto) {
        const extension =
          (form.newPhoto.name.split(".").pop() ?? "jpg")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${userId}/${petId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, form.newPhoto, {
            contentType: form.newPhoto.type || undefined,
            upsert: false,
          });

        if (uploadError) {
          setFormError(t("errorPhoto"));
          return;
        }

        photoPath = path;
        uploadedPath = path;
      }

      // 2) Guardar la desparasitación
      const payload = {
        category: "deworming",
        vaccine_key: form.typeKey,
        name: tTypes(form.typeKey),
        product: form.product.trim() || null,
        dose_label: null,
        status,
        due_date: form.dueDate || null,
        given_date: status === "done" ? form.givenDate : null,
        interval_months: form.intervalMonths,
        vet: form.vet.trim() || null,
        notes: form.notes.trim() || null,
        photo_path: photoPath,
      };

      const previous = form.rowId
        ? items.find((item) => item.id === form.rowId) ?? null
        : null;

      let saved: HealthRow;

      if (form.rowId) {
        const { data, error: updateError } = await supabase
          .from("pet_vaccinations")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", form.rowId)
          .select("*")
          .single();

        if (updateError || !data) {
          if (uploadedPath) {
            await supabase.storage.from(PHOTO_BUCKET).remove([uploadedPath]);
          }
          setFormError(t("errorGeneric"));
          return;
        }

        saved = data;
      } else {
        const insert: HealthInsert = { ...payload, pet_id: petId };

        const { data, error: insertError } = await supabase
          .from("pet_vaccinations")
          .insert(insert)
          .select("*")
          .single();

        if (insertError || !data) {
          if (uploadedPath) {
            await supabase.storage.from(PHOTO_BUCKET).remove([uploadedPath]);
          }
          setFormError(t("errorGeneric"));
          return;
        }

        saved = data;
      }

      // 3) Borrar la foto antigua si se ha cambiado o quitado
      const oldPath = previous?.photo_path ?? null;
      if (oldPath && oldPath !== saved.photo_path) {
        await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
      }

      let nextList = items.filter((item) => item.id !== saved.id).concat(saved);
      let nextUrls = photoUrls;

      if (saved.photo_path) {
        nextUrls = await signPhoto(saved.photo_path, nextUrls);
      }

      // 4) Si se acaba de hacer y no queda otra pendiente del mismo tipo,
      //    se crea sola la siguiente con el intervalo elegido
      let infoText: string | null = null;
      const becameDone =
        saved.status === "done" && previous?.status !== "done";
      const savedKey = typeOf(saved);

      if (becameDone && savedKey && saved.given_date) {
        const savedId = saved.id;

        const hasOtherPending = nextList.some(
          (item) =>
            item.id !== savedId &&
            item.vaccine_key === savedKey &&
            item.status !== "done"
        );

        const nextDate = nextDewormingDate(
          saved.given_date,
          saved.interval_months
        );

        if (!hasOtherPending && nextDate) {
          const next: HealthInsert = {
            pet_id: petId,
            category: "deworming",
            vaccine_key: savedKey,
            name: tTypes(savedKey),
            product: saved.product,
            interval_months: saved.interval_months,
            status: "pending",
            due_date: nextDate,
          };

          const { data: nextRow } = await supabase
            .from("pet_vaccinations")
            .insert(next)
            .select("*")
            .single();

          if (nextRow) {
            nextList = nextList.concat(nextRow);
            infoText = t("nextCreated", { date: formatDate(nextDate, locale) });
          }
        }
      }

      setItems(nextList);
      setPhotoUrls(nextUrls);
      closeForm();
      setInfo(infoText);
    } catch (saveError) {
      console.error("[desparasitaciones] Error al guardar:", saveError);
      setFormError(t("errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: HealthRow) {
    if (!window.confirm(t("confirmDelete"))) return;

    setBusyId(row.id);
    setInfo(null);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("pet_vaccinations")
        .delete()
        .eq("id", row.id);

      if (deleteError) {
        setError(t("errorDelete"));
        return;
      }

      if (row.photo_path) {
        await supabase.storage.from(PHOTO_BUCKET).remove([row.photo_path]);
      }

      setItems((current) => current.filter((item) => item.id !== row.id));
    } catch (deleteError) {
      console.error("[desparasitaciones] Error al eliminar:", deleteError);
      setError(t("errorDelete"));
    } finally {
      setBusyId(null);
    }
  }

  // --- Tarjeta de cada desparasitación ---

  function renderCard(row: HealthRow) {
    const dueStatus = getDueStatus(row.status, row.due_date, today);
    const photoUrl = row.photo_path ? photoUrls[row.photo_path] : undefined;
    const isBusy = busyId === row.id;

    const statusLabel: Record<DueStatus, string> = {
      overdue: t("statusOverdue"),
      soon: t("statusSoon"),
      upcoming: t("statusUpcoming"),
      no_date: t("statusNoDate"),
      done: t("statusDone"),
    };

    let dateLine: string;

    if (row.status === "done") {
      dateLine = row.given_date
        ? t("givenOn", { date: formatDate(row.given_date, locale) })
        : t("statusDone");
    } else if (row.due_date) {
      const diff = daysBetween(today, row.due_date) ?? 0;
      const relative =
        diff < 0
          ? t("daysOverdue", { count: -diff })
          : t("inDays", { count: diff });
      dateLine = `${t("dueOn", { date: formatDate(row.due_date, locale) })} · ${relative}`;
    } else {
      dateLine = t("addDueDate");
    }

    return (
      <div key={row.id} className="rounded-2xl bg-white p-5 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">
                {displayIcon(row)} {displayName(row)}
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[dueStatus]}`}
              >
                {statusLabel[dueStatus]}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {row.product && (
                <span className="text-slate-700">
                  <span className="font-semibold">{t("detailsProduct")}</span>{" "}
                  {row.product}
                </span>
              )}
              {row.interval_months && (
                <span className="font-semibold text-blue-700">
                  🔁 {t("every", { count: row.interval_months })}
                </span>
              )}
            </div>

            <p className="mt-2 text-slate-600">📅 {dateLine}</p>

            {row.vet && (
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-semibold">{t("detailsVet")}</span>{" "}
                {row.vet}
              </p>
            )}

            {row.notes && (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                {row.notes}
              </p>
            )}

            {photoUrl && (
              <a
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt={t("fieldPhoto")}
                  className="h-20 w-28 rounded-lg border border-slate-200 object-cover"
                />
              </a>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {row.status !== "done" && (
              <button
                type="button"
                onClick={() => openDone(row)}
                disabled={isBusy}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                ✓ {t("markDone")}
              </button>
            )}
            <button
              type="button"
              onClick={() => openEdit(row)}
              disabled={isBusy}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              {t("edit")}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(row)}
              disabled={isBusy}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
            >
              {t("delete")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Botones de "Añadir rápido" (uno por tipo) ---

  const quickAdd = (
    <div className="flex flex-wrap gap-2">
      {DEWORMING_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => openAdd(key)}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          {DEWORMING_ICONS[key]} {tTypes(key)}
        </button>
      ))}
    </div>
  );

  // --- Pantalla ---

  const formTitle =
    form?.mode === "done"
      ? t("formTitleDone")
      : form?.mode === "edit"
      ? t("formTitleEdit")
      : t("formTitleAdd");

  const currentPhotoUrl =
    form?.newPhotoPreview ??
    (form && !form.removePhoto && form.existingPhotoPath
      ? photoUrls[form.existingPhotoPath] ?? null
      : null);

  const hasPhoto = Boolean(
    form && (form.newPhoto || (form.existingPhotoPath && !form.removePhoto))
  );

  const showsGivenDate = form ? form.mode === "done" || form.status === "done" : false;

  return (
    <>
      {info && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
          {info}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow">
          <Pawsi pose="espera" size={110} />
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            {t("emptyTitle")}
          </h2>
          <p className="mt-2 max-w-md text-slate-500">
            {t("emptyText", { name: petName })}
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              {t("quickAddTitle")}
            </p>
            {quickAdd}
          </div>
        </div>
      ) : (
        <div data-tour="deworming-list" className="space-y-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {quickAdd}
            <button
              type="button"
              onClick={() => openAdd()}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              {t("addDeworming")}
            </button>
          </div>

          {/* PRÓXIMAS */}

          <section>
            <h2 className="mb-4 text-2xl font-bold text-slate-900">
              {t("sectionPending")}
            </h2>
            {pending.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-slate-500 shadow">
                {t("noPending")}
              </p>
            ) : (
              <div className="space-y-4">{pending.map(renderCard)}</div>
            )}
          </section>

          {/* HECHAS */}

          <section>
            <h2 className="mb-4 text-2xl font-bold text-slate-900">
              {t("sectionDone")}
            </h2>
            {done.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-slate-500 shadow">
                {t("noDone")}
              </p>
            ) : (
              <div className="space-y-4">{done.map(renderCard)}</div>
            )}
          </section>
        </div>
      )}

      {/* FORMULARIO (ventana) */}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-900">{formTitle}</h2>

            <div className="mt-5 space-y-4">
              {/* Tipo (al cambiarlo, se propone su intervalo) */}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-600">
                  {t("fieldType")}
                </span>
                <select
                  value={form.typeKey}
                  onChange={(e) => {
                    const key = isDewormingKey(e.target.value)
                      ? e.target.value
                      : "internal";
                    updateForm({
                      typeKey: key,
                      intervalMonths: DEWORMING_DEFAULT_INTERVAL[key],
                    });
                  }}
                  className={INPUT_CLASS}
                >
                  {DEWORMING_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {DEWORMING_ICONS[key]} {tTypes(key)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Producto o marca */}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-600">
                  {t("fieldProduct")}
                </span>
                <input
                  type="text"
                  value={form.product}
                  placeholder={t("fieldProductPlaceholder")}
                  onChange={(e) => updateForm({ product: e.target.value })}
                  className={INPUT_CLASS}
                />
              </label>

              {/* Estado (no en "marcar como hecha") */}
              {form.mode !== "done" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-600">
                    {t("fieldStatus")}
                  </span>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      updateForm({
                        status: e.target.value === "done" ? "done" : "pending",
                        givenDate:
                          e.target.value === "done" && !form.givenDate
                            ? today
                            : form.givenDate,
                      })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="done">{t("statusDone")}</option>
                    <option value="pending">{t("statusUpcoming")}</option>
                  </select>
                </label>
              )}

              {/* Fechas */}
              {showsGivenDate ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-600">
                    {t("fieldGivenDate")}
                  </span>
                  <input
                    type="date"
                    value={form.givenDate}
                    max={today}
                    onChange={(e) => updateForm({ givenDate: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-600">
                    {t("fieldDueDate")}
                  </span>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => updateForm({ dueDate: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </label>
              )}

              {/* Repetir cada… */}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-600">
                  {t("fieldInterval")}
                </span>
                <select
                  value={String(form.intervalMonths)}
                  onChange={(e) =>
                    updateForm({ intervalMonths: Number(e.target.value) })
                  }
                  className={INPUT_CLASS}
                >
                  {INTERVAL_OPTIONS.map((months) => (
                    <option key={months} value={String(months)}>
                      {t("every", { count: months })}
                    </option>
                  ))}
                  {!INTERVAL_OPTIONS.includes(form.intervalMonths) && (
                    <option value={String(form.intervalMonths)}>
                      {t("every", { count: form.intervalMonths })}
                    </option>
                  )}
                </select>
                <span className="mt-1 block text-xs text-slate-500">
                  {t("intervalHint")}
                </span>
              </label>

              {/* Veterinario */}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-600">
                  {t("fieldVet")}
                </span>
                <input
                  type="text"
                  value={form.vet}
                  onChange={(e) => updateForm({ vet: e.target.value })}
                  className={INPUT_CLASS}
                />
              </label>

              {/* Notas */}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-600">
                  {t("fieldNotes")}
                </span>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                  rows={3}
                  className={INPUT_CLASS}
                />
              </label>

              {/* Foto */}
              <div>
                <span className="mb-1 block text-sm font-semibold text-slate-600">
                  {t("fieldPhoto")}
                </span>

                {currentPhotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentPhotoUrl}
                    alt={t("fieldPhoto")}
                    className="mb-3 h-32 w-full rounded-xl border border-slate-200 object-cover"
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
                    📷 {hasPhoto ? t("changePhoto") : t("choosePhoto")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handlePhotoChange(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>

                  {hasPhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        if (form.newPhotoPreview) {
                          URL.revokeObjectURL(form.newPhotoPreview);
                        }
                        updateForm({
                          newPhoto: null,
                          newPhotoPreview: null,
                          removePhoto: true,
                        });
                      }}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50"
                    >
                      {t("removePhoto")}
                    </button>
                  )}
                </div>
              </div>

              {formError && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}