import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface UserSubscription {
  plan: 'free' | 'basic' | 'pro' | 'elite';
  status: 'active' | 'inactive' | 'canceled' | 'past_due';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  isGoogleUser: boolean;
  subscription: UserSubscription;
  isFirstLogin?: boolean;
  hasCompletedFirstPayment?: boolean;
  showWelcomeModal?: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}

// Crear/actualizar perfil de usuario con suscripción
export async function createUserProfile(
  uid: string, 
  userData: Partial<UserProfile>,
  preserveSubscription: boolean = true
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    const now = new Date();
    
    if (!userDoc.exists()) {
      // Usuario nuevo - plan gratuito por defecto
      const newUserProfile: UserProfile = {
        uid,
        email: userData.email || '',
        displayName: userData.displayName || '',
        isGoogleUser: userData.isGoogleUser || false,
        subscription: {
          plan: 'free',
          status: 'inactive',
          createdAt: now,
          updatedAt: now,
        },
        isFirstLogin: true,
        createdAt: now,
        lastLoginAt: now,
        ...userData
      };
      
      await setDoc(userRef, newUserProfile);
      console.log('✅ [Subscription] Perfil de usuario creado con plan gratuito');
    } else {
      // Usuario existente - actualizar datos pero preservar suscripción si se especifica
      const existingData = userDoc.data() as UserProfile;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        lastLoginAt: now,
        ...userData
      };
      
      // Si se especifica preservar suscripción, no incluirla en la actualización
      if (preserveSubscription && existingData.subscription) {
        delete (updateData as Partial<UserProfile>).subscription;
      }
      
      await updateDoc(userRef, updateData);
      console.log('✅ [Subscription] Perfil de usuario actualizado');
    }
  } catch (error) {
    console.error('❌ [Subscription] Error al crear/actualizar perfil:', error);
    throw error;
  }
}

// Obtener perfil completo del usuario
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data() as UserProfile;
      console.log('✅ [Subscription] Perfil obtenido:', data.subscription.plan);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('❌ [Subscription] Error al obtener perfil:', error);
    return null;
  }
}

// Actualizar suscripción del usuario
export async function updateUserSubscription(
  uid: string, 
  subscriptionData: Partial<UserSubscription>
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    
    // Primero obtener la suscripción actual para hacer merge
    const userDoc = await getDoc(userRef);
    let currentSubscription: UserSubscription;
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserProfile;
      currentSubscription = userData.subscription;
    } else {
      // Fallback si no existe el documento (no debería pasar)
      currentSubscription = {
        plan: 'free',
        status: 'inactive',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    // Hacer merge de los datos manteniendo campos existentes
    const updateData: Record<string, unknown> = {
      ...currentSubscription,
      ...subscriptionData,
      updatedAt: new Date()
    };
    
    await updateDoc(userRef, {
      subscription: updateData
    });
    
    console.log('✅ [Subscription] Suscripción actualizada:', subscriptionData.plan);
  } catch (error) {
    console.error('❌ [Subscription] Error al actualizar suscripción:', error);
    throw error;
  }
}

// Verificar si el usuario tiene una suscripción activa
export async function hasActiveSubscription(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  if (!profile) return false;
  
  const { plan, status } = profile.subscription;
  
  // Plan gratuito siempre está "activo" (con limitaciones)
  if (plan === 'free') return true;
  
  // Planes de pago deben tener status activo
  return status === 'active';
}

// Marcar que el usuario ya vio la bienvenida
export async function markWelcomeComplete(uid: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      isFirstLogin: false
    });
    
    console.log('✅ [Subscription] Bienvenida marcada como completada');
  } catch (error) {
    console.error('❌ [Subscription] Error al marcar bienvenida:', error);
    throw error;
  }
}

// Marcar que el usuario completó su primer pago exitoso
export async function markFirstPaymentComplete(uid: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      hasCompletedFirstPayment: true,
      showWelcomeModal: true  // Flag para mostrar el modal una vez
    });
    
    console.log('✅ [Subscription] Primer pago marcado como completado');
  } catch (error) {
    console.error('❌ [Subscription] Error al marcar primer pago:', error);
    throw error;
  }
}

// Marcar que el usuario ya vio el modal de bienvenida
export async function markWelcomeModalSeen(uid: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      showWelcomeModal: false
    });
    
    console.log('✅ [Subscription] Modal de bienvenida marcado como visto');
  } catch (error) {
    console.error('❌ [Subscription] Error al marcar modal como visto:', error);
    throw error;
  }
}

// Buscar usuario por Stripe Customer ID
export async function findUserByStripeCustomerId(customerId: string): Promise<string | null> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('subscription.stripeCustomerId', '==', customerId));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      console.log('✅ [Subscription] Usuario encontrado por Stripe Customer ID:', userDoc.id);
      return userDoc.id;
    }
    
    console.log('⚠️ [Subscription] No se encontró usuario con Stripe Customer ID:', customerId);
    return null;
  } catch (error) {
    console.error('❌ [Subscription] Error buscando usuario por Stripe Customer ID:', error);
    return null;
  }
}
