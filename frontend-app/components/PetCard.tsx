type PetCardProps = {
  name: string;
  breed: string;
  age: string;
};

export default function PetCard({
  name,
  breed,
  age,
}: PetCardProps) {
  return (
    <div className="bg-white rounded-xl shadow p-5 mb-4">
      <h2 className="text-2xl font-bold">{name}</h2>

      <p className="text-gray-600">
        {breed}
      </p>

      <p className="text-gray-500">
        {age}
      </p>
    </div>
  );
}