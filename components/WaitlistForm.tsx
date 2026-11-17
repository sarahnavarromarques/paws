"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export type WaitlistTexts = {
  placeholder: string;
  button: string;
  sending: string;
  success: string;
  already: string;
  invalid: string;
  error: string;
  privacyNote: string;
  privacyLink: string;
};

type Status = "idle" | "sending" | "ok" | "already" | "invalid" | "error";

type Props = {
  locale: "es" | "en";
  texts: WaitlistTexts;
  dark?: boolean;
};

export default function WaitlistForm({ locale, texts, dark = false }: Props) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status === "sending") return;

    setStatus("sending");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, website }),
      });

      const data = (await response.json()) as { status?: Status };

      if (data.status === "ok" || data.status === "already") {
        setStatus(data.status);
        setEmail("");
        return;
      }

      setStatus(data.status === "invalid" ? "invalid" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok" || status === "already") {
    return (
      <div
        className={`mx-auto max-w-md rounded-2xl px-6 py-5 text-center font-semibold ${
          dark ? "bg-white/10 text-white" : "bg-green-50 text-green-800"
        }`}
      >
        {status === "ok" ? texts.success : texts.already}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status === "invalid" || status === "error") setStatus("idle");
          }}
          placeholder={texts.placeholder}
          autoComplete="email"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-600"
        />

        {/* Campo trampa para robots: invisible para las personas */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        <button
          type="submit"
          disabled={status === "sending"}
          className={`whitespace-nowrap rounded-xl px-6 py-3 font-semibold shadow disabled:opacity-60 ${
            dark
              ? "bg-white text-[#1e3a5f] hover:bg-blue-50"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {status === "sending" ? texts.sending : texts.button}
        </button>
      </div>

      {status === "invalid" && (
        <p className={`mt-2 text-sm ${dark ? "text-red-200" : "text-red-600"}`}>
          {texts.invalid}
        </p>
      )}
      {status === "error" && (
        <p className={`mt-2 text-sm ${dark ? "text-red-200" : "text-red-600"}`}>
          {texts.error}
        </p>
      )}

      <p className={`mt-3 text-xs ${dark ? "text-blue-100" : "text-slate-500"}`}>
        {texts.privacyNote}{" "}
        <Link href="/legal/privacidad" className="underline">
          {texts.privacyLink}
        </Link>
      </p>
    </form>
  );
}