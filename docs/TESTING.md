# Pruebas de SecondBrain

Ejecutar desde la raíz del repositorio con Node.js 24 y `npm ci`. La app y la landing tienen versiones diferentes de Next.js; cada una se compila en su propio workspace.

## Comandos

| Comando                 | Qué comprueba                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `npm test`              | Vitest: lógica, repositorios, permisos, API y componentes. Sin acceso a red.                     |
| `npm run test:watch`    | La misma suite mientras se desarrolla.                                                           |
| `npm run test:coverage` | Suite con informe HTML en `coverage/index.html` y mínimos de cobertura.                          |
| `npm run test:database` | RLS, permisos de columnas, integridad y cascadas en PostgreSQL temporal. Requiere Docker activo. |
| `npm run test:e2e`      | Compila ambas webs y recorre sus flujos con Playwright en escritorio y móvil.                    |
| `npm run test:all`      | Ejecuta las tres capas anteriores.                                                               |
| `npm run test:report`   | Abre el último informe de Playwright.                                                            |

Antes del primer uso de Playwright: `npx playwright install chromium`. Si se utiliza Chrome instalado, se puede ejecutar `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. Los servidores de pruebas ocupan únicamente `127.0.0.1:3100` y `:3101`; el runner rechaza reutilizar servidores existentes. `npm run test:e2e:ui` usa las compilaciones preparadas con `npm run test:build`.

## Cobertura funcional

| Función                                                                                     | Pruebas                                                                                                                                            |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso por email y Google, registro, verificación, recuperación, cierre de sesión y borrado | `auth-boundaries`, `data-operations`, `auth-context`, `auth-forms`, `routing`; E2E de acceso, recuperación y borrado; SQL de cascadas.             |
| Diario: escritura, lectura, edición, cancelación, guardado, errores, calendario e historial | `store`, `data-operations`, `editor`; E2E de diario y calendario. Las respuestas antiguas no deben reemplazar otra fecha o cuenta.                 |
| Audio: permiso, grabación, duración máxima, reproducción, transcripción y persistencia      | `audio-recorder`, API de transcripción, E2E con micrófono simulado.                                                                                |
| Personas: lectura, extracción, menciones, detalles, búsqueda, edición y fechas originales   | `data-operations`, API de extracción, E2E de personas y chat individual.                                                                           |
| IA: estilización, chat personal, chat por persona y análisis emocional                      | API: autenticación, propietario, límites, respuestas válidas, formatos JSON, errores y uso contabilizado; E2E de los flujos principales.           |
| Estadísticas: resumen, cita, ranking, periodos emocionales y límites                        | API de estadísticas, políticas de plan y E2E del panel. Sin datos se devuelve vacío, sin inventar valores.                                         |
| Suscripciones: planes, cuotas y reinicio mensual, cancelación y caducidad                   | `limits`, `subscriptions`, `subscription-hook`, API de mantenimiento y Stripe, E2E de pagos deshabilitados.                                        |
| Pago: checkout, URL de retorno, propiedad de sesión, firma de webhook y eventos             | `stripe-config`, `checkout`, `routing`, API Stripe. La firma se verifica también con el SDK real sobre un evento local. No se hacen cobros.        |
| Perfil, sugerencias, problemas y eliminación de cuenta                                      | Operaciones Auth, API de correo con escape HTML y E2E de ajustes.                                                                                  |
| Bienvenida tras pago                                                                        | `welcome`: condiciones, cierre y errores de persistencia.                                                                                          |
| Landing, precios, navegación móvil, FAQ, soporte, privacidad y términos                     | `site` y E2E de todas las páginas públicas; enlaces conservan el plan elegido.                                                                     |
| SEO y despliegue                                                                            | Sitemap/robots en unitarios y HTTP; dos builds, errores de navegador y comprobaciones de ancho.                                                    |
| Seguridad de datos                                                                          | Pruebas SQL con dos usuarios, rol anónimo y service role; RLS, bloqueo de autoasignación de plan y pagos, claves únicas, FKs y borrado en cascada. |

Los nombres de suites anteriores corresponden a los archivos de `secondbrain/tests/`, `secondbrain-landing/tests/`, `tests/e2e/` y `tests/database/`.

## Aislamiento

- Vitest sustituye Supabase, OpenAI, Resend y las operaciones remotas de Stripe en sus límites. `tests/setup.ts` bloquea cualquier `fetch` no declarado explícitamente. Se ejecutan los handlers reales con `NextRequest`.
- Playwright usa datos ficticios independientes por test, intercepta Auth/PostgREST y las integraciones privadas, y bloquea destinos externos. La app y sus componentes reales se ejecutan como builds de producción. Los fixtures no simulan RLS: esa garantía la comprueba PostgreSQL.
- `scripts/test-environment.mjs` fuerza valores ficticios al compilar y arrancar: nunca toma las claves reales de `.env.local` para las integraciones probadas. Los pagos permanecen deshabilitados. No existe un bypass de autenticación en el código de producción.
- Las compilaciones de test viven en `.next-test/`, separadas de `.next/`, y están ignoradas por Git. Volver a compilar normalmente no requiere cambiar variables ni archivos locales.
- SQL usa un contenedor nuevo `postgres:16-alpine`, sin puertos publicados ni volúmenes, aplica el esquema del proyecto y la sección vigente de políticas/permisos del SQL versionado. Se elimina al terminar, incluso ante fallos. No acepta URL ni credenciales de una base remota. `auth.uid()` se reproduce con el claim de sesión de PostgreSQL.

## Interpretar los resultados

Las pruebas de API comprueban el contrato de los modelos actuales: `gpt-6-luna`, razonamiento `low` en Responses y `none` en chat, límite `max_completion_tokens`, y `gpt-transcribe` con `languages: ['es']`. También comprueban que el audio WebM conserva sus bytes y formato, y que un archivo por encima de 25 MB se rechaza antes de llamar al proveedor. Las pruebas automatizadas siguen simulando las respuestas de OpenAI.

`chat-readiness` comprueba que los dos chats esperan la carga de la cuota, permiten enviar al terminar y distinguen un fallo de carga de un límite realmente alcanzado. Un teclado rápido no debe causar un falso aviso de cuota agotada.

El informe de Vitest mide únicamente los archivos ejecutados en las pruebas unitarias y de API. Incluye también pantallas que se recorren mediante Playwright: el porcentaje global de Vitest no mide esos recorridos de navegador. Los módulos críticos de datos, suscripciones, store y permisos tienen mínimos específicos de 90% de líneas y funciones. No se exige 100% ni se excluyen pantallas activas para inflar el porcentaje. Los archivos antiguos `*_new.tsx` sin uso y las imágenes sociales generadas quedan fuera de ese informe; las rutas de producción se verifican al compilar.

Estas pruebas no certifican la configuración remota de Supabase, DNS, OAuth, SMTP, Stripe ni la calidad de respuestas de un modelo real. Los cambios de integración requieren, además, una comprobación controlada en un entorno de prueba. Un test con micrófono simulado comprueba el flujo de la app, sin sustituir una prueba de grabación con un dispositivo físico.

## Añadir o cambiar funciones

1. Añadir un caso que falle por la conducta incorrecta o que describa la nueva conducta.
2. Simular la integración remota, no la lógica que se quiere comprobar.
3. Verificar éxito, validación, propietario, límite y fallo de persistencia cuando correspondan. Para trabajo asíncrono, probar cambios de fecha/cuenta durante la petición.
4. Añadir el recorrido de navegador si cambia una función visible; hacerlo funcionar en ambos tamaños sin forzar clics en controles ocultos.
5. Ejecutar las suites afectadas y `npm run test:all` antes de una entrega, además de los builds normales si cambió configuración de producción.
6. Actualizar esta matriz y la skill canónica correspondiente en `.agents/skills/`. No guardar snapshots de datos personales ni secretos en fixtures o informes.

La acción `.github/workflows/tests.yml` aplica estas comprobaciones en pull requests y pushes a `main` o `master`. No despliega la web. Los informes son artefactos temporales del trabajo de CI.

## Suscripciones, estadísticas y correo

La base local aplica también el esquema normalizado: comprueba backfill histórico, permisos de lectura/escritura/RPC, reservas y liberaciones idempotentes, caducidad, cambios de cuota, eventos duplicados/desordenados, cola de correo y cascadas. Abre 24 conexiones de PostgreSQL simultáneas: exactamente cinco deben reservar y confirmar mensajes en el plan gratuito. Usa `pg_isready` por TCP interno para esperar al servidor final del contenedor, no al servidor temporal de inicialización.

Las APIs comprueban que todos los endpoints de estadísticas bloquean al plan gratuito, que un informe genera dos resultados con una sola reserva, que el caché no consume otra cuota y que las caídas liberan la reserva. Los hooks prueban estado compartido, deduplicación, cambios de cuenta y notificaciones de consumo. Checkout/portal/webhooks se simulan: no hay cobros. Se verifica una firma real con el SDK usando una clave ficticia. Las pruebas de correos comprueban HTML escapado, texto plano, variables de Supabase, remitente verificado, worker desactivado y reintentos simulados.

`node scripts/build-email-previews.mjs` prepara vistas ficticias para revisión, sin enviar correo. Ver [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) antes de publicar código que requiera el nuevo esquema o habilitar facturación/correo.
