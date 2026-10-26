"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import Pawsi from "@/components/Pawsi";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import {
  ALL_VACCINE_KEYS,
  OPTIONAL_VACCINE_KEYS,
  buildSuggestedPlan,
  daysBetween,
  getDueStatus,
  isDoseLabel,
  isVaccineKey,
  nextBoosterDate,
  todayIso,
  type DoseLabel,
  type DueStatus,
  type PlannedDose,
  type VaccineKey,
} from "@/lib/vaccination-plan";

type VaccinationRow = Database["public"]["Tables"]["pet_vaccinations"]["Row"];
type VaccinationInsert =
  Database["public"]["Tables"]["pet_vaccinations"]["Insert"];

const PHOTO_BUCKET = "vaccination-photos";
const SIGNED_URL_SECONDS = 60 * 60;
const DOSE_LABELS: DoseLabel[] = ["dose1", "dose2", "dose3", "booster"];

type FormMode = "add" | "edit" | "done";

type FormState = {
  mode: FormMode;
  rowId: string | null;
  vaccineChoice: VaccineKey | "other";
  name: string;
  doseLabel: string;
  status: "pending" | "done";
  dueDate: string;
  givenDate: string;
  vet: string;
  batch: string;
  notes: string;
  existingPhotoPath: string | null;
  removePhoto: boolean;
  newPhoto: File | null;
  newPhotoPreview: string | null;
};

// Ventana "¿Cuáles de estas dosis ya se ha puesto?" al generar el plan
type PlanPrompt = {
  plan: PlannedDose[];
  pastIndexes: number[];
  checked: number[];
};

type Props = {
  petId: number;
  petName: string;
  userId: string;
  birthDate: string | null;
  initialVaccinations: VaccinationRow[];
  initialPhotoUrls: Record<string, string>;
};

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200";

// Pendientes: primero las que tienen fecha (de la más cercana a la más lejana),
// al final las que no tienen fecha
function sortPending(a: VaccinationRow, b: VaccinationRow): number {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.created_at.localeCompare(b.created_at);
}

// Puestas: de la más reciente a la más antigua
function sortDone(a: VaccinationRow, b: VaccinationRow): number {
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

const STATUS_STYLES: Record<DueStatus, string> = {
  overdue: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-700",
  upcoming: "bg-blue-100 text-blue-700",
  no_date: "bg-slate-100 text-slate-600",
  done: "bg-green-100 text-green-700",
};

export default function PetVaccinations({
  petId,
  petName,
  userId,
  birthDate,
  initialVaccinations,
  initialPhotoUrls,
}: Props) {
  const t = useTranslations("Vaccines");
  const tNames = useTranslations("Vaccines.vaccineNames");
  const tDoses = useTranslations("Vaccines.doses");
  const locale = useLocale();

  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => todayIso(), []);

  const [vaccinations, setVaccinations] =
    useState<VaccinationRow[]>(initialVaccinations);
  const [photoUrls, setPhotoUrls] =
    useState<Record<string, string>>(initialPhotoUrls);

  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [planPrompt, setPlanPrompt] = useState<PlanPrompt | null>(null);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(
    () => vaccinations.filter((v) => v.status !== "done").sort(sortPending),
    [vaccinations]
  );

  const done = useMemo(
    () => vaccinations.filter((v) => v.status === "done").sort(sortDone),
    [vaccinations]
  );

  // Opcionales que aún no se han añadido
  const missingOptional = useMemo(
    () =>
      OPTIONAL_VACCINE_KEYS.filter(
        (key) => !vaccinations.some((v) => v.vaccine_key === key)
      ),
    [vaccinations]
  );

  function displayName(row: VaccinationRow): string {
    return isVaccineKey(row.vaccine_key) ? tNames(row.vaccine_key) : row.name;
  }

  function displayDose(doseLabel: string | null): string | null {
    if (!doseLabel) return null;
    return isDoseLabel(doseLabel) ? tDoses(doseLabel) : doseLabel;
  }

  // --- Formulario ---

  function rowToForm(row: VaccinationRow, mode: FormMode): FormState {
    return {
      mode,
      rowId: row.id,
      vaccineChoice: isVaccineKey(row.vaccine_key) ? row.vaccine_key : "other",
      name: row.name,
      doseLabel: row.dose_label ?? "",
      status: mode === "done" || row.status === "done" ? "done" : "pending",
      dueDate: row.due_date ?? "",
      givenDate: row.given_date ?? (mode === "done" ? today : ""),
      vet: row.vet ?? "",
      batch: row.batch_number ?? "",
      notes: row.notes ?? "",
      existingPhotoPath: row.photo_path,
      removePhoto: false,
      newPhoto: null,
      newPhotoPreview: null,
    };
  }

  function openAdd(vaccineKey?: VaccineKey) {
    setFormError(null);
    setInfo(null);
    setError(null);
    setForm({
      mode: "add",
      rowId: null,
      vaccineChoice: vaccineKey ?? "polyvalent",
      name: "",
      doseLabel: "",
      status: "pending",
      dueDate: "",
      givenDate: "",
      vet: "",
      batch: "",
      notes: "",
      existingPhotoPath: null,
      removePhoto: false,
      newPhoto: null,
      newPhotoPreview: null,
    });
  }

  function openEdit(row: VaccinationRow) {
    setFormError(null);
    setInfo(null);
    setError(null);
    setForm(rowToForm(row, "edit"));
  }

  function openDone(row: VaccinationRow) {
    setFormError(null);
    setInfo(null);
    setError(null);
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

    const vaccineKey: VaccineKey | null =
      form.vaccineChoice === "other" ? null : form.vaccineChoice;
    const name = vaccineKey ? tNames(vaccineKey) : form.name.trim();
    const status: "pending" | "done" =
      form.mode === "done" ? "done" : form.status;

    if (!name) {
      setFormError(t("errorNameRequired"));
      return;
    }

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

      // 2) Guardar la vacuna
      const payload = {
        vaccine_key: vaccineKey,
        name,
        dose_label: form.doseLabel || null,
        status,
        due_date: form.dueDate || null,
        given_date: status === "done" ? form.givenDate : null,
        vet: form.vet.trim() || null,
        batch_number: form.batch.trim() || null,
        notes: form.notes.trim() || null,
        photo_path: photoPath,
      };

      const previous = form.rowId
        ? vaccinations.find((v) => v.id === form.rowId) ?? null
        : null;

      let saved: VaccinationRow;

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
        const insert: VaccinationInsert = { ...payload, pet_id: petId };

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

      let nextList = vaccinations.filter((v) => v.id !== saved.id).concat(saved);
      let nextUrls = photoUrls;

      if (saved.photo_path) {
        nextUrls = await signPhoto(saved.photo_path, nextUrls);
      }

      // 4) Si se acaba de poner y no queda otra dosis pendiente de esa vacuna,
      //    se crea sola el siguiente refuerzo
      let infoText: string | null = null;
      const becameDone =
        saved.status === "done" && previous?.status !== "done";

      if (becameDone && isVaccineKey(saved.vaccine_key) && saved.given_date) {
        const key = saved.vaccine_key;
        const savedId = saved.id;

        const hasOtherPending = nextList.some(
          (v) => v.id !== savedId && v.vaccine_key === key && v.status !== "done"
        );

        const boosterDate = nextBoosterDate(key, saved.given_date);

        if (!hasOtherPending && boosterDate) {
          const booster: VaccinationInsert = {
            pet_id: petId,
            vaccine_key: key,
            name: tNames(key),
            dose_label: "booster",
            status: "pending",
            due_date: boosterDate,
          };

          const { data: boosterRow } = await supabase
            .from("pet_vaccinations")
            .insert(booster)
            .select("*")
            .single();

          if (boosterRow) {
            nextList = nextList.concat(boosterRow);
            infoText = t("nextCreated", {
              date: formatDate(boosterDate, locale),
            });
          }
        }
      }

      setVaccinations(nextList);
      setPhotoUrls(nextUrls);
      closeForm();
      setInfo(infoText);
    } catch (saveError) {
      console.error("[vacunas] Error al guardar:", saveError);
      setFormError(t("errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  // --- Plan sugerido ---

  // Paso 1: calcular el plan. Si hay dosis con fecha pasada, se pregunta cuáles ya se puso.
  function handleGeneratePlan() {
    setInfo(null);
    setError(null);

    const plan = buildSuggestedPlan(birthDate, today);

    const pastIndexes = plan
      .map((dose, index) => (dose.dueDate && dose.dueDate < today ? index : -1))
      .filter((index) => index >= 0);

    if (pastIndexes.length === 0) {
      void createPlan(plan, []);
      return;
    }

    // Por defecto, todas marcadas (lo más probable es que ya se las haya puesto)
    setPlanPrompt({ plan, pastIndexes, checked: pastIndexes });
  }

  function togglePastDose(index: number) {
    setPlanPrompt((current) => {
      if (!current) return current;

      const checked = current.checked.includes(index)
        ? current.checked.filter((i) => i !== index)
        : current.checked.concat(index);

      return { ...current, checked };
    });
  }

  // Paso 2: guardar el plan. Las dosis marcadas quedan como puestas en su fecha.
  async function createPlan(plan: PlannedDose[], doneIndexes: number[]) {
    setGenerating(true);
    setInfo(null);
    setError(null);

    try {
      const rows: VaccinationInsert[] = plan.map((dose, index) => {
        const isDone = doneIndexes.includes(index) && dose.dueDate !== null;

        return {
          pet_id: petId,
          vaccine_key: dose.vaccineKey,
          name: tNames(dose.vaccineKey),
          dose_label: dose.doseLabel,
          status: isDone ? "done" : "pending",
          due_date: dose.dueDate,
          given_date: isDone ? dose.dueDate : null,
        };
      });

      const { data, error: insertError } = await supabase
        .from("pet_vaccinations")
        .insert(rows)
        .select("*");

      if (insertError || !data) {
        setError(t("errorGeneric"));
        return;
      }

      // Vacunas que han quedado sin ninguna dosis pendiente → su siguiente refuerzo
      const boosters: VaccinationInsert[] = [];
      const planKeys = Array.from(new Set(plan.map((dose) => dose.vaccineKey)));

      for (const key of planKeys) {
        const rowsOfKey = data.filter((row) => row.vaccine_key === key);
        const hasPending = rowsOfKey.some((row) => row.status !== "done");

        const lastGiven = rowsOfKey
          .map((row) => row.given_date)
          .filter((date): date is string => typeof date === "string")
          .sort()
          .pop();

        if (hasPending || !lastGiven) continue;

        const boosterDate = nextBoosterDate(key, lastGiven);
        if (!boosterDate) continue;

        boosters.push({
          pet_id: petId,
          vaccine_key: key,
          name: tNames(key),
          dose_label: "booster",
          status: "pending",
          due_date: boosterDate,
        });
      }

      let boosterRows: VaccinationRow[] = [];

      if (boosters.length > 0) {
        const { data: boosterData } = await supabase
          .from("pet_vaccinations")
          .insert(boosters)
          .select("*");

        boosterRows = boosterData ?? [];
      }

      setVaccinations((current) => current.concat(data, boosterRows));
      setPlanPrompt(null);
      setInfo(
        plan.some((dose) => dose.dueDate)
          ? t("planPuppyInfo")
          : t("planAdultInfo", { name: petName })
      );
    } catch (planError) {
      console.error("[vacunas] Error al generar el plan:", planError);
      setError(t("errorGeneric"));
    } finally {
      setGenerating(false);
    }
  }

  // --- Eliminar ---

  async function handleDelete(row: VaccinationRow) {
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

      setVaccinations((current) => current.filter((v) => v.id !== row.id));
    } catch (deleteError) {
      console.error("[vacunas] Error al eliminar:", deleteError);
      setError(t("errorDelete"));
    } finally {
      setBusyId(null);
    }
  }

  // --- Tarjeta de cada vacuna ---

  function renderCard(row: VaccinationRow) {
    const dueStatus = getDueStatus(row.status, row.due_date, today);
    const dose = displayDose(row.dose_label);
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
                💉 {displayName(row)}
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[dueStatus]}`}
              >
                {statusLabel[dueStatus]}
              </span>
            </div>

            {dose && (
              <p className="mt-1 text-sm font-semibold text-blue-700">{dose}</p>
            )}

            <p className="mt-2 text-slate-600">📅 {dateLine}</p>

            {(row.vet || row.batch_number) && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                {row.vet && (
                  <span>
                    <span className="font-semibold">{t("detailsVet")}</span>{" "}
                    {row.vet}
                  </span>
                )}
                {row.batch_number && (
                  <span>
                    <span className="font-semibold">{t("detailsBatch")}</span>{" "}
                    {row.batch_number}
                  </span>
                )}
              </div>
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

      {vaccinations.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow">
          <Pawsi pose="espera" size={110} />
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            {t("emptyTitle")}
          </h2>
          <p className="mt-2 max-w-md text-slate-500">
            {t("emptyText", { name: petName })}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleGeneratePlan}
              disabled={generating}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? t("generatingPlan") : t("generatePlan")}
            </button>
            <button
              type="button"
              onClick={() => openAdd()}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              {t("addVaccine")}
            </button>
          </div>
        </div>
      ) : (
        <div data-tour="vaccines-list" className="space-y-10">
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => openAdd()}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              {t("addVaccine")}
            </button>
          </div>

          {/* PRÓXIMAS DOSIS */}

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

          {/* VACUNAS PUESTAS */}

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

          {/* OPCIONALES */}

          {missingOptional.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">
                {t("sectionOptional")}
              </h2>
              <div className="flex flex-wrap gap-3">
                {missingOptional.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openAdd(key)}
                    className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
                  >
                    {t("addOptional", { vaccine: tNames(key) })}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* VENTANA: DOSIS CON FECHA PASADA AL GENERAR EL PLAN */}

      {planPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-900">
              {t("pastDosesTitle", { name: petName })}
            </h2>
            <p className="mt-2 text-slate-600">{t("pastDosesText")}</p>

            <div className="mt-5 space-y-2">
              {planPrompt.pastIndexes.map((index) => {
                const dose = planPrompt.plan[index];
                const isChecked = planPrompt.checked.includes(index);

                return (
                  <label
                    key={index}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      isChecked
                        ? "border-green-300 bg-green-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePastDose(index)}
                      className="mt-1 h-5 w-5 shrink-0 accent-green-600"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">
                        💉 {tNames(dose.vaccineKey)}
                      </span>
                      <span className="block text-sm text-slate-600">
                        {tDoses(dose.doseLabel)}
                        {dose.dueDate
                          ? ` · ${formatDate(dose.dueDate, locale)}`
                          : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPlanPrompt(null)}
                disabled={generating}
                className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() =>
                  void createPlan(planPrompt.plan, planPrompt.checked)
                }
                disabled={generating}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {generating ? t("generatingPlan") : t("createPlan")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORMULARIO (ventana) */}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-900">{formTitle}</h2>

            <div className="mt-5 space-y-4">
              {/* Vacuna */}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-600">
                  {t("fieldVaccine")}
                </span>
                <select
                  value={form.vaccineChoice}
                  onChange={(e) =>
                    updateForm({
                      vaccineChoice: isVaccineKey(e.target.value)
                        ? e.target.value
                        : "other",
                    })
                  }
                  className={INPUT_CLASS}
                >
                  {ALL_VACCINE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {tNames(key)}
                    </option>
                  ))}
                  <option value="other">{t("fieldVaccineOther")}</option>
                </select>
              </label>

              {form.vaccineChoice === "other" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-600">
                    {t("fieldName")}
                  </span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </label>
              )}

              {/* Dosis */}
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-600">
                  {t("fieldDose")}
                </span>
                <select
                  value={form.doseLabel}
                  onChange={(e) => updateForm({ doseLabel: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="">—</option>
                  {DOSE_LABELS.map((label) => (
                    <option key={label} value={label}>
                      {tDoses(label)}
                    </option>
                  ))}
                  {form.doseLabel && !isDoseLabel(form.doseLabel) && (
                    <option value={form.doseLabel}>{form.doseLabel}</option>
                  )}
                </select>
              </label>

              {/* Estado (no en "marcar como puesta") */}
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
                    <option value="pending">{t("statusUpcoming")}</option>
                    <option value="done">{t("statusDone")}</option>
                  </select>
                </label>
              )}

              {/* Fechas */}
              {form.mode !== "done" && form.status === "pending" && (
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

              {(form.mode === "done" || form.status === "done") && (
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
              )}

              {/* Veterinario y lote */}
              <div className="grid gap-4 sm:grid-cols-2">
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
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-600">
                    {t("fieldBatch")}
                  </span>
                  <input
                    type="text"
                    value={form.batch}
                    onChange={(e) => updateForm({ batch: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>

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

              {/* Foto de la cartilla */}
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