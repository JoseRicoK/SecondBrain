import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Verificar si las variables de entorno están definidas
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.error(
    '❌ ERROR CRÍTICO: Las variables de entorno para Firebase no están configuradas.\n' +
    'Por favor, crea o actualiza tu archivo .env.local con:\n' +
    'NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key\n' +
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain\n' +
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id\n' +
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket\n' +
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id\n' +
    'NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id\n' +
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=tu_measurement_id'
  );
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Para desarrollo local con emuladores (opcional)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Conectar a emuladores si están disponibles
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectAuthEmulator(auth, 'http://localhost:9099');
      connectStorageEmulator(storage, 'localhost', 9199);
    } catch {
      console.log('Firebase emulators not available, using production services');
    }
  }
}

export { app };
export default app;
