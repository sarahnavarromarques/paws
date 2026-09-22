import { getRequestConfig } from "next-intl/server";
import { createClient } from "../lib/supabase/server";

const SUPPORTED_LOCALES = ["es", "en"] as const;
const DEFAULT_LOCALE = "es";

export default getRequestConfig(async () => {
  let locale: string = DEFAULT_LOCALE;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("[i18n] user:", user?.id ?? null, "userError:", userError);

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .single();

      console.log("[i18n] profile:", profile, "profileError:", profileError);

      if (
        profile?.language &&
        (SUPPORTED_LOCALES as readonly string[]).includes(profile.language)
      ) {
        locale = profile.language;
      }
    }
  } catch (err) {
    console.log("[i18n] caught error:", err);
    locale = DEFAULT_LOCALE;
  }

  console.log("[i18n] final locale:", locale);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});