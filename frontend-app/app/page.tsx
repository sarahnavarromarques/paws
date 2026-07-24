import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-blue-700">
          🐾 PAWS
        </h1>

        <p className="mt-6 text-2xl text-gray-700">
          AI-powered pet training and management platform
        </p>

        <Link href="/dashboard">
          <button className="mt-10 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl">
            Comenzar
          </button>
        </Link>
      </div>
    </main>
  );
};