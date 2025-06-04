# 📋 Sistema de Gestión de Perfil de Usuario

## ¿Cómo funciona la actualización del nombre?

### 🔄 Flujo de Actualización

1. **Usuario introduce nuevo nombre** en Settings.tsx
2. **Se llama `updateUserProfile()`** que guarda en Supabase Auth
3. **Supabase guarda en `user_metadata`** con dos campos:
   - `display_name`: El nombre que queremos mostrar
   - `name`: Copia de respaldo para compatibilidad

### 📍 Dónde se almacena la información

```typescript
// En Supabase Auth, el usuario tiene:
user.user_metadata = {
  display_name: "José María", // Campo principal
  name: "José María"          // Campo de respaldo
}
```

### 🔍 Cómo se obtiene el nombre

**Orden de prioridad en toda la aplicación:**
1. `user.user_metadata.display_name` (campo principal)
2. `user.user_metadata.name` (respaldo)
3. `user.email.split('@')[0]` (fallback al username del email)
4. `"Usuario"` (fallback final)

### 📁 Archivos que usan esta lógica

- **Settings.tsx**: Para mostrar y actualizar el nombre
- **UserHeader.tsx**: Para mostrar el nombre en el header
- **supabase.ts**: `updateUserProfile()` para guardar cambios

### 🛠️ Funciones clave

```typescript
// Actualizar perfil (guarda en ambos campos para consistencia)
updateUserProfile({ display_name: "Nuevo Nombre" })

// Obtener nombre (con orden de prioridad)
const name = user?.user_metadata?.display_name || 
             user?.user_metadata?.name || 
             user?.email?.split('@')[0] || 
             'Usuario'
```

### ✅ Validaciones implementadas

- **Cambios opcionales**: Puedes cambiar solo nombre, solo contraseña, o ambos
- **Detección de cambios**: Solo actualiza si hay cambios reales
- **Validación de contraseña**: Mínimo 6 caracteres y confirmación
- **Mensajes claros**: Feedback específico según lo que se actualizó

### 🔒 Seguridad

- Las contraseñas se validan antes del envío
- Se requiere confirmación para eliminación de cuenta
- Todos los datos del usuario se eliminan al borrar la cuenta

## 📝 Notas importantes

- **No usar `raw_user_meta_data`**: No está disponible en el cliente
- **Siempre usar el orden de prioridad**: Para consistencia en toda la app
- **Actualizar ambos campos**: `display_name` y `name` para compatibilidad
