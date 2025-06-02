# Chat con GPT-4.1 Mini - SecondBrain

## Funcionalidad Implementada

Se ha añadido una función de chat inteligente que permite conversar con GPT-4.1 mini (optimizado para grandes cantidades de datos) sobre cada persona registrada en tu diario de SecondBrain.

### Características

1. **Chat Contextual**: El asistente tiene acceso a toda la información recopilada sobre cada persona
2. **Interfaz Intuitiva**: Modal de chat moderno con historial de conversación
3. **Información Temporal**: El chat considera las fechas en que se registró cada información
4. **Respuestas Inteligentes**: GPT-4.1 mini analiza y responde basándose únicamente en los datos disponibles

### Uso

1. **Acceder al Chat**: En el PeopleManager, expande los detalles de cualquier persona y haz clic en "Chat con [Nombre]"
2. **Hacer Preguntas**: Puedes preguntar sobre:
   - Relaciones y roles de la persona
   - Detalles específicos registrados
   - Análisis de patrones en la información temporal
   - Sugerencias sobre qué información recopilar

### Ejemplos de Preguntas

- "¿Cuándo fue la última vez que se registró información sobre esta persona?"
- "¿Qué rol tiene esta persona en mi vida?"
- "¿Qué detalles importantes conozco sobre [nombre]?"
- "¿Qué información me falta por conocer sobre esta persona?"

### Configuración Requerida

#### Variables de Entorno

Crea un archivo `.env.local` con:

```bash
OPENAI_API_KEY="tu_clave_api_de_openai"
```

#### Obtener API Key de OpenAI

1. Ve a [OpenAI Platform](https://platform.openai.com/)
2. Crea una cuenta o inicia sesión
3. Ve a "API keys" en tu dashboard
4. Crea una nueva clave API
5. Añádela a tu archivo `.env.local`

### Estructura de Archivos

```
src/
├── app/api/chat-person/
│   └── route.ts           # API endpoint para el chat
├── components/
│   ├── PersonChat.tsx     # Componente del modal de chat
│   └── PeopleManager.tsx  # Modificado para incluir botón de chat
```

### Funcionalidades Técnicas

- **Modelo**: GPT-4.1 mini (gpt-4.1-mini-2025-04-14) - Versión más reciente optimizada para grandes cantidades de datos
- **Contexto**: Información completa de la persona con fechas
- **Historial**: Mantiene el contexto de la conversación
- **Límites**: 2000 tokens máximo por respuesta (aumentado para aprovechar las capacidades del modelo)
- **Idioma**: Configurado para responder en español

### Notas de Desarrollo

- El chat solo funciona con información ya registrada en la base de datos
- Compatible con formatos antiguos y nuevos de datos de personas
- Manejo de errores robusto con mensajes de fallback
- Interfaz responsive para móvil y escritorio
