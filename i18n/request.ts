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
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .single();

      if (
        profile?.language &&
        (SUPPORTED_LOCALES as readonly string[]).includes(profile.language)
      ) {
        locale = profile.language;
      }
    }
  } catch {
    locale = DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});