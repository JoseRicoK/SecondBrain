import React, { useState } from 'react';
import { FiCalendar, FiCheck, FiLink, FiUser, FiTrash2, FiMessageSquare, FiMail, FiAlertTriangle, FiSave, FiEye, FiEyeOff, FiLogOut, FiCreditCard, FiArrowUp, FiX } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { updateUserProfile, updateUserPassword, deleteUserAccount } from '@/lib/firebase-operations';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface SettingsProps {
  userId: string;
}

const Settings: React.FC<SettingsProps> = ({ userId }) => {
  console.log('Settings component loaded for user:', userId);
  const { user, signOut, isGoogleUser } = useAuth();
  const { userProfile, currentPlan, planLimits } = useSubscription();
  const router = useRouter();
  
  // Estados para cambio de datos personales
  const [newDisplayName, setNewDisplayName] = useState(
    user?.displayName || 
    user?.email?.split('@')[0] || 
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
      
      // Actualizar nombre de usuario si ha cambiado (solo para usuarios no-Google)
      const currentDisplayName = user?.displayName || user?.email?.split('@')[0] || '';
      if (!isGoogleUser && newDisplayName.trim() && newDisplayName.trim() !== currentDisplayName) {
        await updateUserProfile({ displayName: newDisplayName.trim() });
        setUpdateSuccess('Nombre actualizado correctamente');
        hasUpdates = true;
      }

      // Actualizar contraseña si se proporcionó (solo para usuarios no-Google)
      if (!isGoogleUser && newPassword.trim()) {
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

      // Para usuarios de Google, mostrar mensaje informativo
      if (isGoogleUser) {
        setUpdateError('Los usuarios de Google no pueden cambiar sus datos desde aquí. La información se sincroniza automáticamente desde tu cuenta de Google.');
        return;
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
      // Si llegamos aquí, la eliminación fue exitosa
      alert('Tu cuenta y todos tus datos han sido eliminados exitosamente. Serás redirigido al login.');
      // Recargar la página para que se muestre el login
      window.location.reload();
    } catch (error: unknown) {
      console.error('Error deleting account:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar la cuenta';
      
      // Si es el error de reautenticación, dar instrucciones más claras
      if (errorMessage.includes('volver a introducir tu contraseña')) {
        setUpdateError('Para mayor seguridad, necesitas cerrar sesión, volver a entrar con tu contraseña y luego intentar eliminar la cuenta de nuevo.');
      } else {
        setUpdateError(errorMessage);
      }
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

      // Enviar el feedback usando fetch directo
      const response = await fetch('/api/send-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          message: text.trim(),
          userEmail: contactEmail,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error('Error al enviar el mensaje');
      }
      
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
                    disabled={isGoogleUser}
                    className={`w-full px-4 py-3 border rounded-xl transition-colors ${
                      isGoogleUser 
                        ? 'border-slate-200 bg-slate-50 text-slate-500' 
                        : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    placeholder="Tu nombre de usuario"
                  />
                  {isGoogleUser && (
                    <p className="text-xs text-slate-500 mt-1">
                      El nombre se sincroniza automáticamente desde tu cuenta de Google
                    </p>
                  )}
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
                  {isGoogleUser && (
                    <div className="flex items-center mt-2">
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="text-xs text-slate-500">Cuenta de Google</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cambio de contraseña - Solo para usuarios no-Google */}
              {!isGoogleUser && (
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
              )}

              {/* Información para usuarios de Google */}
              {isGoogleUser && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-blue-900 mb-1">
                          Cuenta de Google
                        </h4>
                        <p className="text-sm text-blue-700">
                          Tu información se sincroniza automáticamente desde Google. Para cambiar tu contraseña, hazlo desde tu cuenta de Google.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {user?.photoURL && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Foto de perfil
                      </label>
                      <div className="flex items-center space-x-3">
                        <Image 
                          src={user.photoURL} 
                          alt="Foto de perfil" 
                          width={48}
                          height={48}
                          className="rounded-full border-2 border-slate-200"
                        />
                        <span className="text-sm text-slate-500">
                          Sincronizada desde Google
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
              {!isGoogleUser && (
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
              )}
              
              <button
                onClick={signOut}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all"
              >
                <FiLogOut size={18} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>

          {/* Sección Suscripción */}
          <div className="lg:col-span-2 bg-white/70 backdrop-blur-lg rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mr-4">
                <FiCreditCard className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Mi Suscripción</h2>
                <p className="text-slate-600 text-sm">Gestiona tu plan y funcionalidades</p>
              </div>
            </div>
            
            {/* Plan actual - Card destacada */}
            <div className="mb-6">
              <div className={`rounded-2xl p-6 border-2 ${
                currentPlan === 'free' ? 'bg-gray-50 border-gray-200' :
                currentPlan === 'basic' ? 'bg-green-50 border-green-200' :
                currentPlan === 'pro' ? 'bg-purple-50 border-purple-200' :
                'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">
                      Plan {currentPlan === 'free' ? 'Gratuito' :
                           currentPlan === 'basic' ? 'Básico' :
                           currentPlan === 'pro' ? 'Pro' : 'Elite'}
                    </h3>
                    <p className={`text-sm font-medium ${
                      userProfile?.subscription.status === 'active' ? 'text-green-600' :
                      userProfile?.subscription.status === 'past_due' ? 'text-yellow-600' :
                      'text-gray-600'
                    }`}>
                      {userProfile?.subscription.status === 'active' ? '✅ Activo' :
                       userProfile?.subscription.status === 'past_due' ? '⚠️ Pago pendiente' :
                       userProfile?.subscription.status === 'canceled' ? '❌ Cancelado' :
                       '⏸️ Inactivo'}
                    </p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    currentPlan === 'free' ? 'bg-gray-200 text-gray-800' :
                    currentPlan === 'basic' ? 'bg-green-200 text-green-800' :
                    currentPlan === 'pro' ? 'bg-purple-200 text-purple-800' :
                    'bg-yellow-200 text-yellow-800'
                  }`}>
                    {currentPlan.toUpperCase()}
                  </span>
                </div>
                
                {userProfile?.subscription.currentPeriodEnd && (
                  <p className="text-sm text-slate-600 mb-4">
                    <strong>Próxima renovación:</strong> {new Date(userProfile.subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
                  </p>
                )}
                
                {/* Características del plan actual */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-sm">
                    <span className="text-slate-600">Transcripciones: </span>
                    <span className="font-semibold text-slate-800">
                      {planLimits.maxTranscriptions === -1 ? 'Ilimitadas' : planLimits.maxTranscriptions}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-600">Personas: </span>
                    <span className="font-semibold text-slate-800">
                      {planLimits.maxPeopleManagement === -1 ? 'Ilimitadas' : planLimits.maxPeopleManagement}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-600">Chat personal: </span>
                    <span className="font-semibold text-slate-800">
                      {planLimits.hasPersonalChat ? '✅' : '❌'}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-600">Estadísticas: </span>
                    <span className="font-semibold text-slate-800">
                      {planLimits.hasStatistics ? '✅' : '❌'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-3">
              {currentPlan === 'free' ? (
                <>
                  <button
                    onClick={() => router.push('/subscription')}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <FiArrowUp className="w-4 h-4" />
                    Mejorar Plan
                  </button>
                  
                  {/* Botón temporal de corrección */}
                  <div className="flex-1">
                    <details className="bg-orange-50 border border-orange-200 rounded-xl">
                      <summary className="p-3 cursor-pointer text-orange-800 font-medium text-sm">
                        ¿Ya pagaste? Corregir plan
                      </summary>
                      <div className="p-3 pt-0 flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/subscription/update-manual', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: user?.uid, planType: 'basic' })
                              });
                              if (response.ok) {
                                alert('Plan actualizado a Básico');
                                window.location.reload();
                              }
                            } catch (error) {
                              alert('Error actualizando plan');
                            }
                          }}
                          className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                        >
                          Básico
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/subscription/update-manual', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: user?.uid, planType: 'pro' })
                              });
                              if (response.ok) {
                                alert('Plan actualizado a Pro');
                                window.location.reload();
                              }
                            } catch (error) {
                              alert('Error actualizando plan');
                            }
                          }}
                          className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                        >
                          Pro
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/subscription/update-manual', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: user?.uid, planType: 'elite' })
                              });
                              if (response.ok) {
                                alert('Plan actualizado a Elite');
                                window.location.reload();
                              }
                            } catch (error) {
                              alert('Error actualizando plan');
                            }
                          }}
                          className="px-3 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
                        >
                          Elite
                        </button>
                      </div>
                    </details>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/subscription')}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <FiArrowUp className="w-4 h-4" />
                    Cambiar Plan
                  </button>
                  
                  {userProfile?.subscription.status === 'active' && !userProfile.subscription.cancelAtPeriodEnd && (
                    <button
                      onClick={() => {
                        if (confirm('¿Estás seguro de que quieres cancelar tu suscripción? Perderás acceso a las funciones premium al final del período actual.')) {
                          alert('Función de cancelación en desarrollo. Contacta soporte para cancelar.');
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <FiX className="w-4 h-4" />
                      Cancelar
                    </button>
                  )}
                </>
              )}
            </div>
            
            {userProfile?.subscription.cancelAtPeriodEnd && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-yellow-800 text-sm text-center">
                  <strong>⚠️ Suscripción cancelada:</strong> Tu plan actual estará activo hasta el{' '}
                  {userProfile.subscription.currentPeriodEnd && 
                    new Date(userProfile.subscription.currentPeriodEnd).toLocaleDateString('es-ES')
                  }
                </p>
              </div>
            )}
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
                <label htmlFor="contactEmailProblem" className="block text-sm font-medium text-slate-700 mb-2">
                  Tu email de contacto
                </label>
                <input
                  id="contactEmailProblem"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="tu@email.com"
                />
              </div>
              
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
