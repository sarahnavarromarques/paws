"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";

import BoneIcon from "@/components/BoneIcon";
import { createClient } from "@/lib/supabase/client";
import { toHuesitoWallet, type HuesitoWallet } from "@/lib/huesitos-shared";
import { HUESITOS_CHANGED_EVENT } from "@/lib/huesitos-client";

// Por debajo de esta cantidad, la pastilla avisa en color ámbar.
const LOW_BALANCE = 5;

// Saldo de huesitos junto a la bandera, en todas las páginas.
// Solo aparece si hay sesión iniciada (en login y registro no sale).
// Lleva las marcas del tutorial: la guía "Huesitos" se engancha aquí.
export default function HuesitoBalance() {
  const pathname = usePathname();
  const locale = useLocale();
  const isEn = locale === "en";

  const [wallet, setWallet] = useState<HuesitoWallet | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setWallet(null);
        return;
      }

      const { data, error } = await supabase
        .from("huesito_wallets")
        .select("purchased_balance, subscription_balance, subscription_expires_at, unlimited")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        setWallet(null);
        return;
      }

      setWallet(toHuesitoWallet(data));
    } catch (err) {
      console.error("[HuesitoBalance] No se pudo leer el saldo:", err);
      setWallet(null);
    }
  }, []);

  // Se vuelve a leer al cambiar de página (así también aparece justo
  // después de iniciar sesión y desaparece al cerrarla).
  useEffect(() => {
    void loadWallet();
  }, [pathname, loadWallet]);

  // Y al momento, cada vez que una pantalla gasta huesitos.
  useEffect(() => {
    function handleChange() {
      void loadWallet();
    }

    window.addEventListener(HUESITOS_CHANGED_EVENT, handleChange);

    return () => {
      window.removeEventListener(HUESITOS_CHANGED_EVENT, handleChange);
    };
  }, [loadWallet]);

  if (!wallet) {
    return null;
  }

  const isLow = !wallet.unlimited && wallet.balance < LOW_BALANCE;
  const amountText = wallet.unlimited ? "∞" : String(wallet.balance);

  const label = isEn
    ? wallet.unlimited
      ? "Bones: unlimited"
      : `Bones: ${wallet.balance}`
    : wallet.unlimited
    ? "Huesitos: ilimitados"
    : `Huesitos: ${wallet.balance}`;

  return (
    <Link
      href="/settings#huesitos"
      aria-label={label}
      title={label}
      data-tour="huesito-balance"
      data-tour-section="huesitos"
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold shadow-sm transition ${
        isLow
          ? "border-amber-300 bg-amber-50 text-amber-600 hover:border-amber-400"
          : "border-slate-200 bg-white text-[#1e3a5f] hover:border-slate-300"
      }`}
    >
      <BoneIcon className="h-3.5 w-7" />
      <span className="min-w-[1ch] text-base leading-5">{amountText}</span>
    </Link>
  );
}