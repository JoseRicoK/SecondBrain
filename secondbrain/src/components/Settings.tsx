import React, { useState } from 'react';
import { FiCalendar, FiCheck, FiLink, FiSlash } from 'react-icons/fi';

interface SettingsProps {
  userId: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Settings: React.FC<SettingsProps> = ({ userId }) => {
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConnectGoogle = async () => {
    setIsLoading(true);
    
    // Aquí iría el código real para conectar con Google Calendar API
    // Utilizando OAuth 2.0 y redirección al flujo de autenticación de Google
    
    // Por ahora, simulamos una conexión exitosa después de un delay
    setTimeout(() => {
      setIsGoogleConnected(true);
      setIsLoading(false);
    }, 1500);
  };

  const handleDisconnectGoogle = () => {
    setIsLoading(true);
    
    // Aquí iría el código real para desconectar la cuenta
    
    // Simulamos la desconexión
    setTimeout(() => {
      setIsGoogleConnected(false);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Configuración</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-medium text-slate-700 mb-4 flex items-center">
          <FiCalendar className="mr-2" /> Calendario
        </h2>
        
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-6">
            <h3 className="font-medium text-slate-700 mb-2">Google Calendar</h3>
            <p className="text-slate-600 text-sm mb-4">
              Conecta tu cuenta de Google para sincronizar eventos del calendario y recibir recordatorios en tu diario.
            </p>
            
            {isGoogleConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-green-100 text-green-600 p-1 rounded-full mr-3">
                    <FiCheck size={16} />
                  </div>
                  <span className="text-sm text-green-600 font-medium">Conectado</span>
                </div>
                
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={isLoading}
                  className="flex items-center px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <FiSlash className="mr-1.5" size={16} />
                  Desconectar
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={isLoading}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Conectando...
                  </>
                ) : (
                  <>
                    <FiLink className="mr-2" />
                    Conectar con Google Calendar
                  </>
                )}
              </button>
            )}
          </div>
          
          {isGoogleConnected && (
            <div>
              <h3 className="font-medium text-slate-700 mb-3">Opciones de sincronización</h3>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    id="sync-events" 
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    defaultChecked
                  />
                  <label htmlFor="sync-events" className="ml-2 text-sm text-slate-700">
                    Mostrar eventos del día en el diario
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    id="event-suggestions" 
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    defaultChecked
                  />
                  <label htmlFor="event-suggestions" className="ml-2 text-sm text-slate-700">
                    Sugerir mencionar eventos importantes
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    id="daily-summary" 
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    defaultChecked
                  />
                  <label htmlFor="daily-summary" className="ml-2 text-sm text-slate-700">
                    Incluir resumen de eventos del día
                  </label>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Calendarios a sincronizar</h4>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="calendar-main" 
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      defaultChecked
                    />
                    <label htmlFor="calendar-main" className="ml-2 text-sm text-slate-700 flex items-center">
                      <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
                      Calendario principal
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="calendar-work" 
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      defaultChecked
                    />
                    <label htmlFor="calendar-work" className="ml-2 text-sm text-slate-700 flex items-center">
                      <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                      Trabajo
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="calendar-personal" 
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      defaultChecked
                    />
                    <label htmlFor="calendar-personal" className="ml-2 text-sm text-slate-700 flex items-center">
                      <span className="w-3 h-3 rounded-full bg-purple-500 mr-2"></span>
                      Personal
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="text-sm text-slate-500 mt-8">
        <p>Para una mejor experiencia, asegúrate de permitir el acceso a tu calendario para que SecondBrain pueda sincronizar tus eventos y ayudarte a recordar tus actividades diarias.</p>
      </div>
    </div>
  );
};

export default Settings;
