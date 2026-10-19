// Nombre de la cookie donde se guarda el idioma en el navegador.
// La escribe lib/language.ts y la lee el servidor (i18n/request.ts)
// para saber el idioma cuando no hay sesión iniciada (login, registro).
export const LANGUAGE_COOKIE = "PAWS_LOCALE";

// La cookie dura un año
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;