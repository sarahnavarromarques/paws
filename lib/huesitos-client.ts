// Aviso interno del navegador: "el saldo de huesitos ha cambiado".
// Las pantallas lo lanzan después de usar la IA, y la pastilla del saldo
// lo escucha para actualizarse sola.
export const HUESITOS_CHANGED_EVENT = "paws:huesitos-changed";

export function notifyHuesitosChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HUESITOS_CHANGED_EVENT));
}