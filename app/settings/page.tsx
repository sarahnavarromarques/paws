"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { startOnboardingTour } from "@/components/OnboardingTour";

const supabase = createClient();

type Language = "es" | "en";

const ACCOUNT_TYPES = ["particular", "profesional", "centro", "refugio"] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

function isAccountType(value: string | null | undefined): value is AccountType {
  return !!value && (ACCOUNT_TYPES as readonly string[]).includes(value);
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const AVATAR_BUCKET = "avatars";

// Textos de la tarjeta "Tutorial" (español / inglés)
const TUTORIAL_TEXT: Record<
  Language,
  { title: string; description: string; button: string }
> = {
  es: {
    title: "Tutorial",
    description: "Vuelve a ver la guía paso a paso de cómo funciona PAWS.",
    button: "Ver tutorial de nuevo",
  },
  en: {
    title: "Tutorial",
    description: "Watch the step-by-step guide to how PAWS works again.",
    button: "Replay tutorial",
  },
};

// Textos de la tarjeta "Calendario del móvil" (español / inglés)
type CalendarText = {
  title: string;
  description: string;
  appleButton: string;
  googleButton: string;
  linkLabel: string;
  privateHint: string;
  copyButton: string;
  copied: string;
  copyError: string;
  regenerateButton: string;
  regenerateConfirm: string;
  regenerated: string;
  activateButton: string;
  activated: string;
  working: string;
  saveError: string;
};

const CALENDAR_TEXT: Record<Language, CalendarText> = {
  es: {
    title: "Calendario del móvil",
    description:
      "Tus entrenamientos aparecerán automáticamente en el calendario de tu móvil. Los cambios pueden tardar un rato en verse.",
    appleButton: "Añadir a iPhone / Mac",
    googleButton: "Añadir a Google Calendar (Android)",
    linkLabel: "Enlace del calendario",
    privateHint: "Este enlace es privado: no lo compartas.",
    copyButton: "Copiar enlace",
    copied: "Enlace copiado.",
    copyError: "No se pudo copiar. Selecciona el enlace y cópialo a mano.",
    regenerateButton: "Generar enlace nuevo",
    regenerateConfirm:
      "El enlace actual dejará de funcionar y tendrás que volver a añadir el calendario en tu móvil. ¿Continuar?",
    regenerated: "Enlace nuevo generado. Vuelve a añadirlo en tu móvil.",
    activateButton: "Activar calendario",
    activated: "Calendario activado.",
    working: "Guardando...",
    saveError: "No se pudo guardar. Inténtalo de nuevo.",
  },
  en: {
    title: "Phone calendar",
    description:
      "Your trainings will show up automatically in your phone's calendar. Changes may take a while to appear.",
    appleButton: "Add to iPhone / Mac",
    googleButton: "Add to Google Calendar (Android)",
    linkLabel: "Calendar link",
    privateHint: "This link is private: don't share it.",
    copyButton: "Copy link",
    copied: "Link copied.",
    copyError: "Couldn't copy. Select the link and copy it manually.",
    regenerateButton: "Generate new link",
    regenerateConfirm:
      "The current link will stop working and you'll need to add the calendar to your phone again. Continue?",
    regenerated: "New link generated. Add it to your phone again.",
    activateButton: "Turn on calendar",
    activated: "Calendar turned on.",
    working: "Saving...",
    saveError: "Couldn't save. Please try again.",
  },
};

type Feedback = { type: "success" | "error"; text: string } | null;

// Error mínimo que devuelven Supabase Auth y la base de datos
type SupabaseLikeError = { code?: string; message?: string };

// Lee el código de error que devuelve /api/delete-account
function readErrorCode(data: unknown): string {
  if (typeof data === "object" && data !== null && "error" in data) {
    const value: unknown = data.error;
    if (typeof value === "string") return value;
  }
  return "";
}

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50";
const LABEL_CLASS = "mb-2 block text-sm font-semibold text-slate-600";
const CARD_CLASS = "mb-6 rounded-2xl bg-white p-6 shadow-sm md:p-8";
const PRIMARY_BUTTON_CLASS =
  "w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50";
const SECONDARY_BUTTON_CLASS =
  "w-full rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50";

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <div
      className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
        feedback.type === "success"
          ? "bg-green-100 text-green-800"
          : "bg-amber-100 text-amber-900"
      }`}
    >
      {feedback.text}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations("Settings");
  const tAuth = useTranslations("AuthErrors");
  const locale = useLocale();
  const tutorialText = TUTORIAL_TEXT[locale === "en" ? "en" : "es"];
  const calendarText = CALENDAR_TEXT[locale === "en" ? "en" : "es"];

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState("");

  // Idioma
  const [language, setLanguage] = useState<Language>("es");
  const [savingLanguage, setSavingLanguage] = useState(false);

  // Calendario del móvil
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [siteOrigin, setSiteOrigin] = useState("");
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarFeedback, setCalendarFeedback] = useState<Feedback>(null);

  // Foto
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<Feedback>(null);

  // Perfil
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("particular");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);

  // Correo
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<Feedback>(null);

  // Contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);

  // Sesión
  const [loggingOut, setLoggingOut] = useState(false);

  // Borrar cuenta
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteKeyword = t("deleteKeyword");
  const deleteReady =
    deletePassword.length > 0 &&
    deleteConfirm.trim().toUpperCase() === deleteKeyword;

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setCurrentEmail(user.email ?? "");
      setSiteOrigin(window.location.origin);

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "language, username, first_name, last_name, avatar_url, account_type, calendar_token"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        if (profile.language === "en" || profile.language === "es") {
          setLanguage(profile.language);
        }
        setUsername(profile.username ?? "");
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setAvatarUrl(profile.avatar_url ?? null);
        if (isAccountType(profile.account_type)) {
          setAccountType(profile.account_type);
        }
        setCalendarToken(profile.calendar_token ?? null);
      }

      setLoading(false);
    }

    void loadProfile();
  }, [router]);

  function authErrorMessage(error: SupabaseLikeError): string {
    switch (error.code) {
      case "same_password":
        return tAuth("samePassword");
      case "weak_password":
        return tAuth("weakPassword");
      case "email_exists":
        return t("errorEmailTaken");
      case "email_address_invalid":
        return tAuth("invalidEmail");
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return tAuth("rateLimited");
    }
    if (error.message?.toLowerCase().includes("fetch")) {
      return tAuth("network");
    }
    return tAuth("generic");
  }

  // ---------- IDIOMA ----------
  async function handleSaveLanguage(newLanguage: Language) {
    if (savingLanguage || newLanguage === language || !userId) return;

    setSavingLanguage(true);

    await supabase.from("profiles").upsert({
      id: userId,
      language: newLanguage,
      updated_at: new Date().toISOString(),
    });

    // Recarga completa para que el servidor sirva el nuevo idioma
    window.location.reload();
  }

  // ---------- CALENDARIO DEL MÓVIL ----------
  const calendarHttpsUrl =
    calendarToken && siteOrigin
      ? `${siteOrigin}/api/calendar/${calendarToken}.ics`
      : "";
  const calendarWebcalUrl = calendarHttpsUrl.replace(/^https?:\/\//, "webcal://");
  const calendarGoogleUrl = calendarWebcalUrl
    ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
        calendarWebcalUrl
      )}`
    : "";

  async function handleCopyCalendarLink() {
    setCalendarFeedback(null);
    if (!calendarHttpsUrl) return;

    try {
      await navigator.clipboard.writeText(calendarHttpsUrl);
      setCalendarFeedback({ type: "success", text: calendarText.copied });
    } catch (error) {
      console.error("Error copiando enlace del calendario:", error);
      setCalendarFeedback({ type: "error", text: calendarText.copyError });
    }
  }

  async function handleNewCalendarToken() {
    if (!userId || calendarBusy) return;
    setCalendarFeedback(null);

    const isRegenerating = calendarToken !== null;

    if (isRegenerating && !window.confirm(calendarText.regenerateConfirm)) {
      return;
    }

    setCalendarBusy(true);

    const newToken = crypto.randomUUID();

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      calendar_token: newToken,
      updated_at: new Date().toISOString(),
    });

    setCalendarBusy(false);

    if (error) {
      console.error("Error guardando enlace del calendario:", error);
      setCalendarFeedback({ type: "error", text: calendarText.saveError });
      return;
    }

    setCalendarToken(newToken);
    setCalendarFeedback({
      type: "success",
      text: isRegenerating ? calendarText.regenerated : calendarText.activated,
    });
  }

  // ---------- FOTO ----------
  async function removeOldAvatars(keepFileName: string | null) {
    if (!userId) return;

    const { data: files } = await supabase.storage
      .from(AVATAR_BUCKET)
      .list(userId);

    const toRemove = (files ?? [])
      .filter((file) => file.name !== keepFileName)
      .map((file) => `${userId}/${file.name}`);

    if (toRemove.length > 0) {
      await supabase.storage.from(AVATAR_BUCKET).remove(toRemove);
    }
  }

  async function handlePhotoChange(file: File) {
    if (!userId) return;
    setPhotoFeedback(null);

    const extension = ALLOWED_PHOTO_TYPES[file.type];
    if (!extension) {
      setPhotoFeedback({ type: "error", text: t("errorPhotoType") });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoFeedback({ type: "error", text: t("errorPhotoSize") });
      return;
    }

    setUploadingPhoto(true);

    try {
      const fileName = `avatar-${Date.now()}.${extension}`;
      const path = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        console.error("Error subiendo foto de perfil:", uploadError);
        setPhotoFeedback({ type: "error", text: t("errorPhotoUpload") });
        return;
      }

      const { data: publicData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(path);

      const { error: saveError } = await supabase.from("profiles").upsert({
        id: userId,
        avatar_url: publicData.publicUrl,
        updated_at: new Date().toISOString(),
      });

      if (saveError) {
        console.error("Error guardando foto de perfil:", saveError);
        setPhotoFeedback({ type: "error", text: t("errorPhotoUpload") });
        return;
      }

      setAvatarUrl(publicData.publicUrl);
      setPhotoFeedback({ type: "success", text: t("photoSaved") });

      // Borra fotos anteriores para no acumular archivos
      await removeOldAvatars(fileName);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    if (!userId) return;
    setPhotoFeedback(null);
    setUploadingPhoto(true);

    try {
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        avatar_url: null,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error quitando foto de perfil:", error);
        setPhotoFeedback({ type: "error", text: t("errorPhotoUpload") });
        return;
      }

      setAvatarUrl(null);
      setPhotoFeedback({ type: "success", text: t("photoRemoved") });
      await removeOldAvatars(null);
    } finally {
      setUploadingPhoto(false);
    }
  }

  // ---------- PERFIL ----------
  async function handleSaveProfile() {
    if (!userId) return;
    setProfileFeedback(null);

    const cleanUsername = username.trim().toLowerCase();

    if (cleanUsername && !USERNAME_REGEX.test(cleanUsername)) {
      setProfileFeedback({ type: "error", text: t("errorUsernameFormat") });
      return;
    }

    setSavingProfile(true);

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      username: cleanUsername || null,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      account_type: accountType,
      updated_at: new Date().toISOString(),
    });

    setSavingProfile(false);

    if (error) {
      const dbError: SupabaseLikeError = error;
      if (dbError.code === "23505") {
        setProfileFeedback({ type: "error", text: t("errorUsernameTaken") });
      } else if (dbError.code === "23514") {
        setProfileFeedback({ type: "error", text: t("errorUsernameFormat") });
      } else {
        console.error("Error guardando perfil:", error);
        setProfileFeedback({ type: "error", text: t("errorProfileSave") });
      }
      return;
    }

    setUsername(cleanUsername);
    setFirstName(firstName.trim());
    setLastName(lastName.trim());
    setProfileFeedback({ type: "success", text: t("profileSaved") });
  }

  // ---------- CORREO ----------
  async function handleChangeEmail() {
    setEmailFeedback(null);

    const cleanEmail = newEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setEmailFeedback({ type: "error", text: t("errorEnterNewEmail") });
      return;
    }
    if (cleanEmail === currentEmail.toLowerCase()) {
      setEmailFeedback({ type: "error", text: t("errorSameEmail") });
      return;
    }

    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: cleanEmail });
    setChangingEmail(false);

    if (error) {
      console.error("Error cambiando correo:", error);
      setEmailFeedback({ type: "error", text: authErrorMessage(error) });
      return;
    }

    setNewEmail("");
    setEmailFeedback({ type: "success", text: t("emailChangeSent") });
  }

  // ---------- CONTRASEÑA ----------
  async function handleChangePassword() {
    setPasswordFeedback(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordFeedback({ type: "error", text: t("errorPasswordFields") });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: "error", text: t("errorPasswordTooShort") });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: "error", text: t("errorPasswordsDontMatch") });
      return;
    }

    setChangingPassword(true);

    try {
      // 1) Comprobar la contraseña actual
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });

      if (verifyError) {
        const isRateLimited = verifyError.code === "over_request_rate_limit";
        setPasswordFeedback({
          type: "error",
          text: isRateLimited
            ? tAuth("rateLimited")
            : t("errorCurrentPasswordWrong"),
        });
        return;
      }

      // 2) Guardar la nueva contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error("Error cambiando contraseña:", updateError);
        setPasswordFeedback({
          type: "error",
          text: authErrorMessage(updateError),
        });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({ type: "success", text: t("passwordChanged") });
    } finally {
      setChangingPassword(false);
    }
  }

  // ---------- SESIÓN ----------
  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  // ---------- BORRAR CUENTA ----------
  function openDeleteModal() {
    setDeletePassword("");
    setDeleteConfirm("");
    setDeleteError(null);
    setDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteOpen(false);
  }

  async function handleDeleteAccount() {
    setDeleteError(null);

    if (!deleteReady) {
      setDeleteError(t("errorDeleteFields", { keyword: deleteKeyword }));
      return;
    }

    setDeleting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setDeleteError(t("errorSessionExpired"));
        return;
      }

      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirm,
        }),
      });

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const code = readErrorCode(data);

        if (code === "wrong_password") {
          setDeleteError(t("errorDeleteWrongPassword"));
        } else if (code === "rate_limited") {
          setDeleteError(tAuth("rateLimited"));
        } else if (code === "unauthorized") {
          setDeleteError(t("errorSessionExpired"));
        } else {
          setDeleteError(t("errorDeleteFailed"));
        }
        return;
      }

      // Cuenta borrada: limpiar la sesión local y salir
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Error borrando cuenta:", error);
      setDeleteError(tAuth("network"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-10">
        <div className="mx-auto max-w-2xl">
          <p className="text-slate-500">...</p>
        </div>
      </main>
    );
  }

  const avatarInitial =
    (firstName.trim()[0] ?? username.trim()[0] ?? "").toUpperCase();

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-block text-sm font-semibold text-slate-400 hover:text-slate-600"
        >
          {t("back")}
        </Link>

        <h1 className="mb-6 text-3xl font-extrabold tracking-tight">
          {t("title")}
        </h1>

        {/* PERFIL */}
        <section className={CARD_CLASS}>
          <h2 className="mb-6 text-xl font-bold">{t("profileTitle")}</h2>

          {/* Foto */}
          <p className={LABEL_CLASS}>{t("photoLabel")}</p>
          <div className="mb-2 flex flex-wrap items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={t("photoLabel")}
                className="h-20 w-20 rounded-full border-4 border-slate-100 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-3xl font-bold text-slate-500">
                {avatarInitial || "🙂"}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <label
                className={`cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 ${
                  uploadingPhoto ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {uploadingPhoto
                  ? t("uploadingPhoto")
                  : avatarUrl
                  ? t("changePhoto")
                  : t("uploadPhoto")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingPhoto}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handlePhotoChange(file);
                    }
                    e.target.value = "";
                  }}
                />
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => void handleRemovePhoto()}
                  disabled={uploadingPhoto}
                  className="rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                >
                  {t("removePhoto")}
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">{t("photoHint")}</p>
          <FeedbackMessage feedback={photoFeedback} />

          <hr className="my-6 border-slate-100" />

          {/* Usuario */}
          <div className="mb-4">
            <label className={LABEL_CLASS} htmlFor="username">
              {t("usernameLabel")}
            </label>
            <div className="flex items-center rounded-xl border border-slate-300 bg-white transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
              <span className="pl-3 font-semibold text-slate-400">@</span>
              <input
                id="username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, "")
                      .slice(0, 20)
                  )
                }
                disabled={savingProfile}
                placeholder={t("usernamePlaceholder")}
                className="w-full rounded-xl bg-transparent p-3 pl-1 outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">{t("usernameHint")}</p>
          </div>

          {/* Nombre y apellidos */}
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASS} htmlFor="firstName">
                {t("firstNameLabel")}
              </label>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={savingProfile}
                placeholder={t("firstNamePlaceholder")}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="lastName">
                {t("lastNameLabel")}
              </label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={savingProfile}
                placeholder={t("lastNamePlaceholder")}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Tipo de cuenta */}
          <div className="mb-6">
            <label className={LABEL_CLASS} htmlFor="accountType">
              {t("accountTypeLabel")}
            </label>
            <select
              id="accountType"
              value={accountType}
              onChange={(e) => {
                if (isAccountType(e.target.value)) {
                  setAccountType(e.target.value);
                }
              }}
              disabled={savingProfile}
              className={INPUT_CLASS}
            >
              <option value="particular">{t("accountTypeParticular")}</option>
              <option value="profesional">{t("accountTypeProfesional")}</option>
              <option value="centro">{t("accountTypeCentro")}</option>
              <option value="refugio">{t("accountTypeRefugio")}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={savingProfile}
            className={PRIMARY_BUTTON_CLASS}
          >
            {savingProfile ? t("savingProfile") : t("saveProfile")}
          </button>
          <FeedbackMessage feedback={profileFeedback} />
        </section>

        {/* IDIOMA */}
        <section className={CARD_CLASS}>
          <h2 className="mb-4 text-xl font-bold">{t("languageLabel")}</h2>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={savingLanguage}
              onClick={() => void handleSaveLanguage("es")}
              className={`rounded-xl border-2 p-4 text-center font-semibold transition ${
                language === "es"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              🇪🇸 {t("spanish")}
            </button>

            <button
              type="button"
              disabled={savingLanguage}
              onClick={() => void handleSaveLanguage("en")}
              className={`rounded-xl border-2 p-4 text-center font-semibold transition ${
                language === "en"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              🇬🇧 {t("english")}
            </button>
          </div>
        </section>

        {/* CALENDARIO DEL MÓVIL */}
        <section className={CARD_CLASS}>
          <h2 className="mb-2 text-xl font-bold">📅 {calendarText.title}</h2>
          <p className="mb-4 text-sm text-slate-500">
            {calendarText.description}
          </p>

          {calendarHttpsUrl ? (
            <>
              <div className="mb-4 flex flex-col gap-3">
                <a href={calendarWebcalUrl} className={`${PRIMARY_BUTTON_CLASS} text-center`}>
                  🍎 {calendarText.appleButton}
                </a>
                <a
                  href={calendarGoogleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${PRIMARY_BUTTON_CLASS} text-center`}
                >
                  🤖 {calendarText.googleButton}
                </a>
              </div>

              <label className={LABEL_CLASS} htmlFor="calendarLink">
                {calendarText.linkLabel}
              </label>
              <input
                id="calendarLink"
                type="text"
                readOnly
                value={calendarHttpsUrl}
                onFocus={(e) => e.target.select()}
                className={`${INPUT_CLASS} mb-1 text-xs text-slate-600`}
              />
              <p className="mb-4 text-xs text-slate-400">
                🔒 {calendarText.privateHint}
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleCopyCalendarLink()}
                  disabled={calendarBusy}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {calendarText.copyButton}
                </button>
                <button
                  type="button"
                  onClick={() => void handleNewCalendarToken()}
                  disabled={calendarBusy}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {calendarBusy ? calendarText.working : calendarText.regenerateButton}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleNewCalendarToken()}
              disabled={calendarBusy}
              className={PRIMARY_BUTTON_CLASS}
            >
              {calendarBusy ? calendarText.working : calendarText.activateButton}
            </button>
          )}

          <FeedbackMessage feedback={calendarFeedback} />
        </section>

        {/* TUTORIAL */}
        <section data-tour="replay-tour" className={CARD_CLASS}>
          <h2 className="mb-2 text-xl font-bold">🐾 {tutorialText.title}</h2>
          <p className="mb-4 text-sm text-slate-500">
            {tutorialText.description}
          </p>
          <button
            type="button"
            onClick={() => startOnboardingTour()}
            className={PRIMARY_BUTTON_CLASS}
          >
            {tutorialText.button}
          </button>
        </section>

        {/* CUENTA */}
        <section className={CARD_CLASS}>
          <h2 className="mb-6 text-xl font-bold">{t("accountTitle")}</h2>

          {/* Correo */}
          <h3 className="mb-3 font-bold text-slate-800">
            {t("emailSectionTitle")}
          </h3>
          <p className="mb-4 text-sm text-slate-500">
            {t("currentEmailLabel")}:{" "}
            <span className="font-semibold text-slate-700">{currentEmail}</span>
          </p>
          <div className="mb-4">
            <label className={LABEL_CLASS} htmlFor="newEmail">
              {t("newEmailLabel")}
            </label>
            <input
              id="newEmail"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={changingEmail}
              placeholder={t("newEmailPlaceholder")}
              className={INPUT_CLASS}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleChangeEmail()}
            disabled={changingEmail}
            className={PRIMARY_BUTTON_CLASS}
          >
            {changingEmail ? t("changingEmail") : t("changeEmailButton")}
          </button>
          <FeedbackMessage feedback={emailFeedback} />

          <hr className="my-6 border-slate-100" />

          {/* Contraseña */}
          <h3 className="mb-3 font-bold text-slate-800">
            {t("passwordSectionTitle")}
          </h3>
          <div className="mb-4">
            <label className={LABEL_CLASS} htmlFor="currentPassword">
              {t("currentPasswordLabel")}
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={changingPassword}
              className={INPUT_CLASS}
            />
          </div>
          <div className="mb-4">
            <label className={LABEL_CLASS} htmlFor="newPassword">
              {t("newPasswordLabel")}
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={changingPassword}
              className={INPUT_CLASS}
            />
          </div>
          <div className="mb-4">
            <label className={LABEL_CLASS} htmlFor="confirmPassword">
              {t("confirmPasswordLabel")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={changingPassword}
              className={INPUT_CLASS}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleChangePassword()}
            disabled={changingPassword}
            className={PRIMARY_BUTTON_CLASS}
          >
            {changingPassword ? t("changingPassword") : t("changePasswordButton")}
          </button>
          <FeedbackMessage feedback={passwordFeedback} />
        </section>

        {/* CERRAR SESIÓN */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="mb-6 w-full rounded-xl bg-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
        >
          {loggingOut ? t("loggingOut") : t("logoutButton")}
        </button>

        {/* ZONA PELIGROSA */}
        <section className="mb-10 rounded-2xl border-2 border-red-200 bg-white p-6 md:p-8">
          <h2 className="mb-2 text-xl font-bold text-red-700">
            {t("dangerTitle")}
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            {t("deleteAccountDescription")}
          </p>
          <button
            type="button"
            onClick={openDeleteModal}
            className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700"
          >
            {t("deleteAccountButton")}
          </button>
        </section>
      </div>

      {/* MODAL BORRAR CUENTA */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-2xl font-bold text-red-700">
              {t("deleteModalTitle")}
            </h3>
            <p className="mb-6 text-sm text-slate-600">
              {t("deleteModalBody")}
            </p>

            <div className="mb-4">
              <label className={LABEL_CLASS} htmlFor="deletePassword">
                {t("deletePasswordLabel")}
              </label>
              <input
                id="deletePassword"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                disabled={deleting}
                className={INPUT_CLASS}
              />
            </div>

            <div className="mb-6">
              <label className={LABEL_CLASS} htmlFor="deleteConfirm">
                {t("deleteConfirmLabel", { keyword: deleteKeyword })}
              </label>
              <input
                id="deleteConfirm"
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                disabled={deleting}
                placeholder={deleteKeyword}
                className={INPUT_CLASS}
              />
            </div>

            {deleteError && (
              <div className="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
                {deleteError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={!deleteReady || deleting}
                className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? t("deletingAccount") : t("deleteConfirmButton")}
              </button>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}