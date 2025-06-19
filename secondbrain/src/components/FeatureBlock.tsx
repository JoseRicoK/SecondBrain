'use client';

import { FaCrown, FaLock, FaArrowUp } from 'react-icons/fa';
import { PlanType } from '@/middleware/subscription';

interface FeatureBlockProps {
  title: string;
  description: string;
  requiredPlan: PlanType;
  currentPlan: PlanType;
  onUpgrade?: () => void;
}

const planNames = {
  free: 'Gratuito',
  basic: 'Básico',
  pro: 'Pro',
  elite: 'Elite'
};

const planColors = {
  free: 'from-gray-400 to-gray-500',
  basic: 'from-green-400 to-emerald-500',
  pro: 'from-purple-400 to-pink-500',
  elite: 'from-yellow-400 to-orange-500'
};

export default function FeatureBlock({ 
  title, 
  description, 
  requiredPlan, 
  currentPlan, 
  onUpgrade 
}: FeatureBlockProps) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border-2 border-dashed border-gray-300">
      <div className="text-center">
        {/* Icono de bloqueo */}
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r ${planColors[requiredPlan]} flex items-center justify-center`}>
          <FaLock className="w-8 h-8 text-white" />
        </div>

        {/* Título */}
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          {title}
        </h3>

        {/* Descripción */}
        <p className="text-gray-600 mb-4">
          {description}
        </p>

        {/* Badge del plan requerido */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${planColors[requiredPlan]} text-white font-semibold mb-4`}>
          <FaCrown className="w-4 h-4" />
          Plan {planNames[requiredPlan]} requerido
        </div>

        {/* Plan actual */}
        <p className="text-sm text-gray-500 mb-4">
          Tu plan actual: <span className="font-semibold">{planNames[currentPlan]}</span>
        </p>

        {/* Botón de upgrade */}
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className={`w-full bg-gradient-to-r ${planColors[requiredPlan]} text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2`}
          >
            <FaArrowUp className="w-4 h-4" />
            Actualizar plan
          </button>
        )}
      </div>
    </div>
  );
}
