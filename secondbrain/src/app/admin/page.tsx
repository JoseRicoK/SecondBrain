'use client';

import { useState } from 'react';
import { FaCrown, FaUserPlus, FaSearch } from 'react-icons/fa';

export default function AdminPage() {
  const [userId, setUserId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro' | 'elite'>('pro');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancelUserId, setCancelUserId] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const plans = {
    free: { name: 'Gratuito', color: 'bg-gray-500', price: 'Gratis' },
    pro: { name: 'Pro', color: 'bg-purple-500', price: '€9.99' },
    elite: { name: 'Elite', color: 'bg-yellow-500', price: '€19.99' }
  };

  const updateUserPlan = async () => {
    if (!userId.trim()) {
      setResult('❌ Necesitas introducir un User ID');
      return;
    }

    setLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/subscription/update-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: userId.trim(), 
          planType: selectedPlan 
        })
      });

      if (response.ok) {
        setResult(`✅ Usuario actualizado al plan ${plans[selectedPlan].name} exitosamente!`);
        setUserId('');
      } else {
        const error = await response.json();
        setResult(`❌ Error: ${error.error || 'Error desconocido'}`);
      }
    } catch (error) {
      setResult('❌ Error de conexión');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const simulateCancellation = async () => {
    if (!cancelUserId.trim()) {
      setResult('❌ Necesitas introducir un User ID para cancelar');
      return;
    }

    setCancelLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: cancelUserId.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setResult(`✅ Suscripción cancelada exitosamente! Expira: ${new Date(data.cancelAt).toLocaleDateString('es-ES')}`);
        setCancelUserId('');
      } else {
        const error = await response.json();
        setResult(`❌ Error: ${error.error || 'Error desconocido'}`);
      }
    } catch (error) {
      setResult('❌ Error de conexión');
      console.error('Error:', error);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FaCrown className="text-yellow-400 text-4xl" />
            <h1 className="text-4xl font-bold text-white">Panel Admin</h1>
          </div>
          <p className="text-gray-300">Asigna planes premium a usuarios sin procesar pagos</p>
        </div>

        {/* Card principal */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
          
          {/* User ID Input */}
          <div className="mb-6">
            <label className="block text-white font-semibold mb-3">
              <FaUserPlus className="inline mr-2" />
              User ID (Firebase UID)
            </label>
            <div className="relative">
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Introduce el UID del usuario"
                className="w-full px-4 py-3 pl-12 bg-white/20 border border-white/30 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              💡 Tip: Ve a Settings → usuario activo para copiar su UID
            </p>
          </div>

          {/* Plan Selection */}
          <div className="mb-6">
            <label className="block text-white font-semibold mb-3">
              Seleccionar Plan
            </label>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(plans).map(([key, plan]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPlan(key as 'free' | 'pro' | 'elite')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedPlan === key
                      ? `${plan.color} border-white text-white shadow-lg scale-105`
                      : 'bg-white/10 border-white/30 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  <div className="text-center">
                    <div className="font-bold">{plan.name}</div>
                    <div className="text-sm">{key === 'free' ? plan.price : `${plan.price}/mes`}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={updateUserPlan}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              loading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 shadow-lg'
            } text-white`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Actualizando...
              </div>
            ) : (
              `🚀 Asignar Plan ${plans[selectedPlan].name}`
            )}
          </button>

          {/* Result */}
          {result && (
            <div className={`mt-6 p-4 rounded-xl ${
              result.includes('✅') ? 'bg-green-900/50 border border-green-500' : 'bg-red-900/50 border border-red-500'
            }`}>
              <p className="text-white text-center font-medium">
                {result}
              </p>
            </div>
          )}
        </div>

        {/* Card de cancelación de suscripción */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 mt-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            🚫 Simular Cancelación de Suscripción
          </h2>
          
          <div className="mb-6">
            <label className="block text-white font-semibold mb-3">
              <FaUserPlus className="inline mr-2" />
              User ID para Cancelar
            </label>
            <div className="relative">
              <input
                type="text"
                value={cancelUserId}
                onChange={(e) => setCancelUserId(e.target.value)}
                placeholder="UID del usuario a cancelar"
                className="w-full px-4 py-3 pl-12 bg-white/20 border border-white/30 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              ⚠️ Esto simulará una cancelación con fecha de expiración en 1 mes
            </p>
          </div>

          <button
            onClick={simulateCancellation}
            disabled={cancelLoading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              cancelLoading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transform hover:scale-105 shadow-lg'
            } text-white`}
          >
            {cancelLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Cancelando...
              </div>
            ) : (
              '🚫 Simular Cancelación'
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-900/30 rounded-2xl p-6 border border-blue-500/30">
          <h3 className="text-white font-bold mb-3">📋 Instrucciones:</h3>
          <ol className="text-gray-300 space-y-2">
            <li><strong>1.</strong> Crea una cuenta normal en la app</li>
            <li><strong>2.</strong> Ve a Settings y copia el UID del usuario</li>
            <li><strong>3.</strong> Pégalo aquí y selecciona el plan deseado</li>
            <li><strong>4.</strong> ¡Listo! El usuario tendrá acceso premium inmediatamente</li>
          </ol>
        </div>

        {/* Quick Access */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Acceso rápido: <code className="bg-black/50 px-2 py-1 rounded text-purple-300">localhost:3000/admin</code>
          </p>
        </div>
      </div>
    </div>
  );
}
