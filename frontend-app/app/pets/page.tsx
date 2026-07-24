export default function PetsPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <h1 className="text-4xl font-bold text-blue-700">
        🐶 Mis mascotas
      </h1>

      <p className="mt-4 text-lg text-gray-600">
        Aquí aparecerán todas tus mascotas.
      </p>

      <button className="mt-8 bg-blue-600 text-white px-6 py-3 rounded-xl">
        + Añadir mascota
      </button>
    </main>
  );
}