// Archivo temporal para probar la conectividad con Firebase
import { auth, db } from './firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

export async function testFirebaseConnection() {
  console.log('🔍 Probando conectividad con Firebase...');
  
  try {
    // Test 1: Verificar configuración básica
    console.log('📋 Configuración Firebase:');
    console.log('- Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    console.log('- Auth Domain:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
    console.log('- API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Configurado ✅' : 'No configurado ❌');
    console.log('- Current URL:', typeof window !== 'undefined' ? window.location.origin : 'Server Side');
    
    // Test 2: Verificar si Auth está inicializado
    console.log('\n🔐 Verificando Firebase Auth...');
    if (!auth) {
      throw new Error('Firebase Auth no inicializado');
    }
    console.log('- Auth Domain:', auth.config.authDomain);
    console.log('- Auth inicializado ✅');
    
    // Test 3: Probar Firestore (más directo)
    console.log('\n🗂️ Probando Firestore...');
    const testDocRef = doc(db, 'test_connection', 'connectivity_test');
    const testData = { 
      timestamp: new Date().toISOString(),
      test: true,
      url: typeof window !== 'undefined' ? window.location.origin : 'server'
    };
    
    await setDoc(testDocRef, testData);
    console.log('✅ Firestore: Escritura exitosa');
    
    const testDoc = await getDoc(testDocRef);
    if (testDoc.exists()) {
      console.log('✅ Firestore: Lectura exitosa');
      console.log('- Datos:', testDoc.data());
    } else {
      throw new Error('No se pudo leer el documento de prueba');
    }
    
    // Limpiar el documento de prueba
    await deleteDoc(testDocRef);
    console.log('✅ Firestore: Limpieza exitosa');
    
    // Test 4: Verificar conectividad específica de Auth
    console.log('\n🌐 Verificando conectividad de Auth...');
    
    // Intentar acceder a la configuración de Auth mediante una llamada que no requiere autenticación
    const authUrl = `https://identitytoolkit.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`;
    
    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (response.status === 400) {
        // Status 400 es esperado con body vacío, significa que el endpoint está accesible
        console.log('✅ Firebase Auth API: Accesible');
      } else {
        console.log(`⚠️ Firebase Auth API: Respuesta inesperada (${response.status})`);
      }
    } catch (authError) {
      console.error('❌ Firebase Auth API: Error de conectividad', authError);
      throw new Error(`Error de conectividad con Firebase Auth: ${authError}`);
    }
    
    return {
      success: true,
      message: 'Todas las pruebas de conectividad pasaron ✅'
    };
    
  } catch (error) {
    console.error('❌ Error en las pruebas de Firebase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      details: {
        authInitialized: !!auth,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        currentUrl: typeof window !== 'undefined' ? window.location.origin : 'server-side'
      }
    };
  }
}
