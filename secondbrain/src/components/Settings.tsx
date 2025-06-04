import React, { useState } from 'react';
import { FiCalendar, FiCheck, FiLink, FiSlash, FiUser, FiTrash2, FiMessageSquare, FiMail, FiAlertTriangle, FiSave, FiEye, FiEyeOff, FiLogOut } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { updateUserProfile, updateUserPassword, deleteUserAccount, sendFeedbackEmail } from '@/lib/supabase';

interface SettingsProps {
  userId: string;
}

const Settings: React.FC<SettingsProps> = ({ userId }) => {
  console.log('Settings component loaded for user:', userId);
  const { user, signOut } = useAuth();
  
  // Estados para cambio de datos personales
  const [newDisplayName, setNewDisplayName] = useState(
    user?.user_metadata?.display_name || 
    user?.user_metadata?.name || 
    ''
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState('');
  const [updateError, setUpdateError] = useState('');
  
  // Estados para eliminación de cuenta
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Estados para sugerencias y problemas
  const [suggestionText, setSuggestionText] = useState('');
  const [problemText, setProblemText] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  const handleUpdateProfile = async () => {
    setUpdateLoading(true);
    setUpdateError('');
    setUpdateSuccess('');

    try {
      let hasUpdates = false;
      
      // Actualizar nombre de usuario si ha cambiado
      const currentDisplayName = user?.user_metadata?.display_name || user?.user_metadata?.name || '';
      if (newDisplayName.trim() && newDisplayName.trim() !== currentDisplayName) {
        await updateUserProfile({ display_name: newDisplayName.trim() });
        setUpdateSuccess('Nombre actualizado correctamente');
        hasUpdates = true;
      }

      // Actualizar contraseña si se proporcionó
      if (newPassword.trim()) {
        if (newPassword !== confirmPassword) {
          throw new Error('Las contraseñas no coinciden');
        }
        
        if (newPassword.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres');
        }

        await updateUserPassword(newPassword);
        setUpdateSuccess(hasUpdates ? 'Perfil y contraseña actualizados correctamente' : 'Contraseña actualizada correctamente');
        setNewPassword('');
        setConfirmPassword('');
        hasUpdates = true;
      }

      // Si no hay cambios que hacer
      if (!hasUpdates) {
        setUpdateError('No se detectaron cambios para actualizar');
      }
      
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      setUpdateError(error instanceof Error ? error.message : 'Error al actualizar el perfil');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'ELIMINAR') {
      setUpdateError('Debes escribir "ELIMINAR" para confirmar');
      return;
    }

    setDeleteLoading(true);
    setUpdateError('');

    try {
      await deleteUserAccount();
      alert('Tu cuenta y todos tus datos han sido eliminados exitosamente.');
    } catch (error: unknown) {
      console.error('Error deleting account:', error);
      setUpdateError(error instanceof Error ? error.message : 'Error al eliminar la cuenta');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSendFeedback = async (type: 'suggestion' | 'problem') => {
    setFeedbackLoading(true);
    setUpdateError('');
    setFeedbackSuccess('');

    try {
      const text = type === 'suggestion' ? suggestionText : problemText;
      if (!text.trim()) {
        throw new Error('Por favor escribe tu mensaje');
      }

      // Enviar el feedback usando la función real
      await sendFeedbackEmail(type, text.trim(), contactEmail);
      
      setFeedbackSuccess(`Tu ${type === 'suggestion' ? 'sugerencia' : 'reporte'} ha sido enviado correctamente`);
      
      if (type === 'suggestion') {
        setSuggestionText('');
      } else {
        setProblemText('');
      }
      
    } catch (error: unknown) {
      console.error('Error sending feedback:', error);
      setUpdateError(error instanceof Error ? error.message : 'Error al enviar el mensaje');
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Título principal */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
            Configuración
          </h1>
          <p className="text-slate-600">Personaliza tu experiencia en SecondBrain</p>
        </div>

        {/* Mensajes de éxito y error */}
        {updateSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-center">
            <FiCheck className="inline mr-2" />
            {updateSuccess}
          </div>
        )}
        
        {updateError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-center">
            <FiAlertTriangle className="inline mr-2" />
            {updateError}
          </div>
        )}

        {feedbackSuccess && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-700 text-center">
            <FiCheck className="inline mr-2" />
            {feedbackSuccess}
          </div>
        )}

        {/* Grid de configuraciones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* Sección Datos Personales */}
          <div className="lg:col-span-2 bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <FiUser className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Datos Personales</h2>
                <p className="text-slate-600 text-sm">Actualiza tu información personal</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cambio de nombre */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre de usuario
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Tu nombre de usuario"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                    Email (solo lectura)
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500"
                  />
                </div>
              </div>

              {/* Cambio de contraseña */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-2">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Nueva contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPasswords ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                    Confirmar contraseña
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPasswords ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Confirmar nueva contraseña"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
              <button
                onClick={handleUpdateProfile}
                disabled={updateLoading}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-70"
              >
                {updateLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Actualizando...</span>
                  </>
                ) : (
                  <>
                    <FiSave size={18} />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
              
              <button
                onClick={signOut}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all"
              >
                <FiLogOut size={18} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>

          {/* Sección Calendario */}
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center mr-4">
                <FiCalendar className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Calendario</h2>
                <p className="text-slate-600 text-sm">Integración con servicios externos</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/50 relative">
                {/* Badge de "Próximamente" */}
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
                  Próximamente
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <div className="opacity-60">
                    <h3 className="font-medium text-slate-800">Google Calendar</h3>
                    <p className="text-slate-600 text-sm">Sincroniza eventos y recordatorios</p>
                    <p className="text-amber-600 text-xs mt-1 font-medium">
                      🚧 Funcionalidad en desarrollo
                    </p>
                  </div>
                  
                  <button
                    onClick={() => alert('🚧 Función en desarrollo\n\nLa integración con Google Calendar estará disponible en una próxima actualización. ¡Mantente atento!')}
                    className="px-4 py-2 bg-gradient-to-r from-slate-400 to-slate-500 text-white rounded-xl transition-all cursor-pointer hover:from-slate-500 hover:to-slate-600"
                  >
                    <div className="flex items-center space-x-2">
                      <FiLink size={16} />
                      <span>Próximamente</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sección Sugerencias */}
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mr-4">
                <FiMessageSquare className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Sugerencias</h2>
                <p className="text-slate-600 text-sm">Ayúdanos a mejorar SecondBrain</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-slate-700 mb-2">
                  Tu email de contacto
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="tu@email.com"
                />
              </div>
              
              <div>
                <label htmlFor="suggestion" className="block text-sm font-medium text-slate-700 mb-2">
                  Tu sugerencia
                </label>
                <textarea
                  id="suggestion"
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors resize-none"
                  placeholder="Comparte tus ideas para mejorar la aplicación..."
                />
              </div>
              
              <button
                onClick={() => handleSendFeedback('suggestion')}
                disabled={feedbackLoading}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-70"
              >
                {feedbackLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <FiMail size={18} />
                    <span>Enviar Sugerencia</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sección Reportar Problemas */}
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mr-4">
                <FiAlertTriangle className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Reportar Problema</h2>
                <p className="text-slate-600 text-sm">¿Encontraste un error? Cuéntanos</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="problem" className="block text-sm font-medium text-slate-700 mb-2">
                  Describe el problema
                </label>
                <textarea
                  id="problem"
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none"
                  placeholder="Describe el problema que experimentaste, incluyendo los pasos para reproducirlo..."
                />
              </div>
              
              <button
                onClick={() => handleSendFeedback('problem')}
                disabled={feedbackLoading}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-70"
              >
                {feedbackLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <FiAlertTriangle size={18} />
                    <span>Reportar Problema</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sección Eliminar Cuenta */}
          <div className="lg:col-span-2 bg-red-50/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-red-200/50 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center mr-4">
                <FiTrash2 className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-red-800">Zona Peligrosa</h2>
                <p className="text-red-600 text-sm">Eliminar tu cuenta permanentemente</p>
              </div>
            </div>
            
            {!showDeleteConfirm ? (
              <div className="text-center">
                <p className="text-red-700 mb-4">
                  Esta acción eliminará permanentemente tu cuenta y todos tus datos. Esta acción no se puede deshacer.
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                >
                  Eliminar mi cuenta
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-red-100 border border-red-300 rounded-xl">
                  <p className="text-red-800 text-sm font-medium mb-2">
                    ⚠️ Esta acción es irreversible. Para confirmar, escribe &quot;ELIMINAR&quot; en el campo de abajo:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Escribe ELIMINAR"
                  />
                </div>
                
                <div className="flex space-x-3 justify-center">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmation('');
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading || deleteConfirmation !== 'ELIMINAR'}
                    className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Eliminando...</span>
                      </div>
                    ) : (
                      'Confirmar Eliminación'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Información de la aplicación */}
        <div className="bg-white/50 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 text-center">
          <div className="flex items-center justify-center mb-3">
            <FiUser className="text-slate-600 mr-2" />
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
