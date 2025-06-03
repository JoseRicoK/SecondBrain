import React, { useState } from 'react';
import { FiCalendar, FiCheck, FiLink, FiSlash, FiShield, FiBell, FiGlobe, FiMoon, FiSun } from 'react-icons/fi';
import UserHeader from './UserHeader';

interface SettingsProps {
  userId: string;
}

const Settings: React.FC<SettingsProps> = ({ userId }) => {
  console.log('Settings component loaded for user:', userId);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  const handleConnectGoogle = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsGoogleConnected(true);
      setIsLoading(false);
    }, 1500);
  };

  const handleDisconnectGoogle = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsGoogleConnected(false);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header elegante */}
        <div className="mb-8">
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20">
            <UserHeader />
          </div>
        </div>
        
        {/* Título principal */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
            Configuración
          </h1>
          <p className="text-slate-600">Personaliza tu experiencia en SecondBrain</p>
        </div>

        {/* Grid de configuraciones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* Sección Calendario */}
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <FiCalendar className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Calendario</h2>
                <p className="text-slate-600 text-sm">Integración con servicios externos</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-slate-800">Google Calendar</h3>
                    <p className="text-slate-600 text-sm">Sincroniza eventos y recordatorios</p>
                  </div>
                  
                  {isGoogleConnected ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 text-green-600 text-sm font-medium">
                        <FiCheck size={16} />
                        <span>Conectado</span>
                      </div>
                      <button
                        onClick={handleDisconnectGoogle}
                        disabled={isLoading}
                        aria-label="Desconectar Google Calendar"
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <FiSlash size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={isLoading}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-70"
                    >
                      {isLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Conectando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <FiLink size={16} />
                          <span>Conectar</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sección Apariencia */}
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mr-4">
                {darkMode ? <FiMoon className="text-white text-xl" /> : <FiSun className="text-white text-xl" />}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Apariencia</h2>
                <p className="text-slate-600 text-sm">Personaliza la interfaz</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-200/50">
                <div>
                  <h3 className="font-medium text-slate-800">Modo oscuro</h3>
                  <p className="text-slate-600 text-sm">Tema oscuro para la interfaz</p>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  aria-label={`${darkMode ? 'Desactivar' : 'Activar'} modo oscuro`}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    darkMode ? 'bg-purple-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
              </div>
            </div>
          </div>

          {/* Sección Notificaciones */}
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center mr-4">
                <FiBell className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Notificaciones</h2>
                <p className="text-slate-600 text-sm">Gestiona tus alertas</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-200/50">
                <div>
                  <h3 className="font-medium text-slate-800">Recordatorios diarios</h3>
                  <p className="text-slate-600 text-sm">Recibe alertas para escribir</p>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  aria-label={`${notifications ? 'Desactivar' : 'Activar'} recordatorios diarios`}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications ? 'bg-green-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                    notifications ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
              </div>
            </div>
          </div>

          {/* Sección Privacidad */}
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center mr-4">
                <FiShield className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Privacidad</h2>
                <p className="text-slate-600 text-sm">Controla tus datos</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-200/50">
                <div>
                  <h3 className="font-medium text-slate-800">Guardado automático</h3>
                  <p className="text-slate-600 text-sm">Guarda cambios automáticamente</p>
                </div>
                <button
                  onClick={() => setAutoSave(!autoSave)}
                  aria-label={`${autoSave ? 'Desactivar' : 'Activar'} guardado automático`}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    autoSave ? 'bg-red-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                    autoSave ? 'translate-x-6' : 'translate-x-0.5'
                  }`}></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Información adicional */}
        <div className="bg-white/50 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 text-center">
          <div className="flex items-center justify-center mb-3">
            <FiGlobe className="text-slate-600 mr-2" />
            <span className="text-slate-600 font-medium">SecondBrain v1.0</span>
          </div>
          <p className="text-slate-500 text-sm max-w-2xl mx-auto">
            Tu privacidad es importante. Todos tus datos se almacenan de forma segura y solo tú tienes acceso a ellos. 
            SecondBrain utiliza tecnologías de vanguardia para proteger tu información personal.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
