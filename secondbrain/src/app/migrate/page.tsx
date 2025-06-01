'use client';

import { useState } from 'react';

export default function MigrationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sampleData, setSampleData] = useState<any>(null);

  const checkCurrentData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/migrate', {
        method: 'GET'
      });
      const data = await response.json();
      setSampleData(data);
    } catch (error) {
      console.error('Error:', error);
      setSampleData({ error: 'Error obteniendo datos' });
    } finally {
      setIsLoading(false);
    }
  };

  const runMigration = async () => {
    if (!confirm('¿Estás seguro de que quieres ejecutar la migración? Esto modificará la estructura de datos de las personas.')) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/migrate', {
        method: 'POST'
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: 'Error ejecutando migración' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Migración de Base de Datos - Seguimiento de Fechas en Personas
          </h1>

          <div className="space-y-6">
            {/* Explicación */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">¿Qué hace esta migración?</h3>
              <p className="text-blue-800 text-sm">
                Esta migración actualiza la estructura de datos de las personas para incluir fechas 
                en cada detalle. Convierte arrays simples y strings a objetos con entradas fechadas.
              </p>
              <div className="mt-3 text-xs text-blue-700">
                <strong>Antes:</strong> {`{"rol": ["estudiante"], "detalles": "información"}`}<br/>
                <strong>Después:</strong> {`{"rol": {"entries": [{"value": "estudiante", "date": "2024-01-15"}]}}`}
              </div>
            </div>

            {/* Verificar datos actuales */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">1. Verificar datos actuales</h3>
              <button
                onClick={checkCurrentData}
                disabled={isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoading ? 'Verificando...' : 'Verificar datos actuales'}
              </button>

              {sampleData && (
                <div className="mt-4 p-3 bg-gray-50 rounded border">
                  <h4 className="font-medium mb-2">Datos actuales (muestra):</h4>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(sampleData, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Ejecutar migración */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">2. Ejecutar migración</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <p className="text-yellow-800 text-sm">
                  ⚠️ <strong>Importante:</strong> Esta operación modificará permanentemente la estructura 
                  de datos. Asegúrate de hacer un respaldo si es necesario.
                </p>
              </div>
              
              <button
                onClick={runMigration}
                disabled={isLoading}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Ejecutando migración...' : 'Ejecutar migración'}
              </button>
            </div>

            {/* Resultado */}
            {result && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Resultado:</h3>
                <div className={`p-3 rounded border ${
                  result.success 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {result.success ? (
                    <div>
                      <p className="font-medium">✅ {result.message}</p>
                      <p className="text-sm mt-1">
                        La migración se completó exitosamente. Ahora puedes volver a tu aplicación 
                        y ver los detalles de las personas con fechas.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">❌ Error en la migración</p>
                      <p className="text-sm mt-1">{result.error}</p>
                      {result.details && (
                        <p className="text-xs mt-2">Detalles: {result.details}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instrucciones finales */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Después de la migración:</h3>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                <li>Vuelve a la aplicación principal</li>
                <li>Verifica que los detalles de las personas se muestran correctamente</li>
                <li>Las nuevas entradas de diario incluirán fechas automáticamente</li>
                <li>Puedes eliminar esta página de migración si todo funciona bien</li>
              </ol>
            </div>

            {/* Enlaces */}
            <div className="text-center pt-4">
              <a 
                href="/" 
                className="text-blue-600 hover:text-blue-800 underline"
              >
                ← Volver a la aplicación principal
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
