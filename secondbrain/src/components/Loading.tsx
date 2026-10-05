import Image from 'next/image';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8">
          <Image
            src="/brand/logo.png"
            alt="LumaDiary"
            width={64}
            height={64}
            priority
            className="h-16 w-16 mx-auto"
          />
        </div>
        <div className="relative">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Cargando LumaDiary...</p>
        </div>
      </div>
    </div>
  );
}
