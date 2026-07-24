import Link from "next/link";
export default function Dashboard() {
  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <h1 className="text-4xl font-bold text-blue-700">
        Dashboard PAWS
      </h1>

      <p className="mt-4 text-lg text-gray-600">
        Bienvenido a tu centro de control.
      </p>

      <div className="grid grid-cols-2 gap-6 mt-10">
        <div className="bg-white rounded-xl shadow p-6">
         <Link href="/pets">
  <div className="bg-white rounded-xl shadow p-6 cursor-pointer hover:bg-blue-50 transition">
    🐶 Mis mascotas
  </div>
</Link>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          📅 Entrenamientos
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          🤖 IA
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          📊 Progreso
        </div>
      </div>
    </main>
  );
}