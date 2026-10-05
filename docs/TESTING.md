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

| Función                                                                                     | Pruebas                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso por email y Google, registro, verificación, recuperación, cierre de sesión y borrado | `auth-boundaries`, `data-operations`, `auth-context`, `auth-forms`, `routing`; E2E de acceso, recuperación y borrado; SQL de cascadas.                                                                                            |
| Diario: escritura, lectura, edición, cancelación, guardado, errores, calendario e historial | `store`, `data-operations`, `editor`; E2E de diario y calendario. Las respuestas antiguas no deben reemplazar otra fecha o cuenta.                                                                                                |
| Audio: permiso, grabación, duración máxima, reproducción, transcripción y persistencia      | `audio-recorder`, `diary-recording`, API de transcripción, E2E con micrófono simulado; falta de saldo, conservación y reintento manual del audio y respuesta tardía tras cambiar de fecha.                                        |
| Personas: lectura, extracción, menciones, detalles, búsqueda, edición y fechas originales   | `person-information`, `people-manager`, `diary-people`, `data-operations`, API y SQL `people`: repeticiones, cambios reales A→B→A, fechas, reanálisis, concurrencia, renombrado y aislamiento; E2E de personas y chat individual. |
| IA: estilización, chat personal, chat por persona y análisis emocional                      | API: autenticación, propietario, límites, respuestas válidas, formatos JSON, errores y uso contabilizado; E2E de los flujos principales.                                                                                          |
| Estadísticas: resumen, cita, ranking, periodos emocionales y límites                        | API de estadísticas, políticas de plan y E2E del panel. Sin datos se devuelve vacío, sin inventar valores.                                                                                                                        |
| Suscripciones: planes, cuotas y reinicio mensual, cancelación y caducidad                   | `limits`, `subscriptions`, `subscription-hook`, API de mantenimiento y Stripe, E2E de pagos deshabilitados.                                                                                                                       |
| Pago: checkout, URL de retorno, propiedad de sesión, firma de webhook y eventos             | `stripe-config`, `checkout`, `routing`, API Stripe. La firma se verifica también con el SDK real sobre un evento local. No se hacen cobros.                                                                                       |
| Perfil, sugerencias, problemas y eliminación de cuenta                                      | Operaciones Auth, API de correo con escape HTML y E2E de ajustes.                                                                                                                                                                 |
| Bienvenida tras pago                                                                        | `welcome`: condiciones, cierre y errores de persistencia.                                                                                                                                                                         |
| Landing, precios, navegación móvil, FAQ, soporte, privacidad y términos                     | `site` y E2E de todas las páginas públicas; enlaces conservan el plan elegido.                                                                                                                                                    |
| SEO y despliegue                                                                            | Sitemap/robots en unitarios y HTTP; dos builds, errores de navegador y comprobaciones de ancho.                                                                                                                                   |
| Seguridad de datos                                                                          | Pruebas SQL con dos usuarios, rol anónimo y service role; RLS, bloqueo de autoasignación de plan y pagos, claves únicas, FKs y borrado en cascada.                                                                                |

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

Los casos de checkout incluyen dos pestañas con UUID distintos, reserva compartida, suscripción existente aún sin webhook, reanudación de sesión, cambio de plan pendiente, cancelación de sesión impagada y respuestas obsoletas al cambiar de cuenta. PostgreSQL comprueba permisos y registro de sesión y abre 24 conexiones adicionales: todas deben obtener la misma reserva de pago. Estas pruebas no crean sesiones remotas ni cobran tarjetas.

## Añadir o cambiar funciones

1. Añadir un caso que falle por la conducta incorrecta o que describa la nueva conducta.
2. Simular la integración remota, no la lógica que se quiere comprobar.
3. Verificar éxito, validación, propietario, límite y fallo de persistencia cuando correspondan. Para trabajo asíncrono, probar cambios de fecha/cuenta durante la petición.
4. Añadir el recorrido de navegador si cambia una función visible; hacerlo funcionar en ambos tamaños sin forzar clics en controles ocultos.
5. Ejecutar las suites afectadas y `npm run test:all` antes de una entrega, además de los builds normales si cambió configuración de producción.
6. Actualizar esta matriz y la skill canónica correspondiente en `.agents/skills/`. No guardar snapshots de datos personales ni secretos en fixtures o informes.

La acción `.github/workflows/tests.yml` aplica estas comprobaciones en pull requests y pushes a `main` o `master`. No despliega la web. Los informes son artefactos temporales del trabajo de CI.

## Suscripciones, estadísticas y correo

El panel de estadísticas tiene pruebas puras de periodos Madrid/DST, comparaciones, rachas, recuentos, nombres equivalentes, datos emocionales ausentes y series acotadas. Sus pruebas de UI verifican que la vista gratuita difuminada no realiza ninguna petición, que solo la acción explícita genera IA, que agotar la cuota mantiene las gráficas y que las respuestas antiguas no se filtran tras cambiar cuenta/plan/periodo. La API de agregados verifica autenticación, autorización antes de lecturas, paginación por fechas, propietario y ausencia de texto privado en la respuesta. Los E2E comprueban escritorio y móvil con datos simulados y el enlace de mejora de plan; nunca cobran ni calculan sobre la base publicada.

La base local aplica también el esquema normalizado: comprueba backfill histórico, permisos de lectura/escritura/RPC, reservas y liberaciones idempotentes, caducidad, cambios de cuota, eventos duplicados/desordenados, cola de correo y cascadas. Abre 24 conexiones de PostgreSQL simultáneas: exactamente diez deben reservar y confirmar mensajes en el plan gratuito. Usa `pg_isready` por TCP interno para esperar al servidor final del contenedor, no al servidor temporal de inicialización.

Las APIs comprueban que todos los endpoints de estadísticas bloquean al plan gratuito, que un informe genera dos resultados con una sola reserva, que el caché no consume otra cuota y que las caídas liberan la reserva. Los hooks prueban estado compartido, deduplicación, cambios de cuenta y notificaciones de consumo. Checkout/portal/webhooks se simulan: no hay cobros. Se verifica una firma real con el SDK usando una clave ficticia. Las pruebas de correos comprueban HTML escapado, texto plano, variables de Supabase, remitente verificado, worker desactivado y reintentos simulados.

`node scripts/build-email-previews.mjs` prepara vistas ficticias para revisión, sin enviar correo. Ver [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) antes de publicar código que requiera el nuevo esquema o habilitar facturación/correo.

Database checks apply the entire ordered migration chain, including removal of the profile subscription JSON. They assert that the obsolete column/projection are absent, new profiles still provision normalized subscriptions, billing writes succeed without a projection and browser billing writes remain denied. Browser fixtures return normalized PostgREST relations and store usage separately from profiles.

## Preparación de pago y SEO

La suite añade casos de factura pendiente, suscripción incompleta con estado local inactivo, propiedad del cliente, URL HTTPS de pago, origen de retorno fiable, bloqueo con SQL pendiente, fallo de eliminación de facturación y eventos después de eliminar una cuenta. El portal ignora respuestas de una identidad anterior. PostgreSQL prueba la cancelación tardía de otra suscripción, su reemplazo legítimo y la versión de esquema; los nuevos permisos internos permanecen cerrados al navegador.

La landing comprueba el catálogo validado y su fallback, contenido/canónicas de ocho rutas, guías desconocidas 404, JSON-LD sin valoraciones inventadas, precios EUR y pago deshabilitado, FAQ nativa y contenido sin JavaScript. Playwright recorre móvil y escritorio, registro sin parámetro de plan, selección por teclado y menú con Escape/foco. Los resultados de build cuantifican JavaScript, no sustituyen mediciones de rendimiento publicadas.

`npm run check:billing` es una herramienta operativa separada: `--remote` consulta la configuración real en lectura y requiere claves adecuadas. No ejecutarla dentro de la suite aislada ni interpretar sus comprobaciones como un pago de prueba. Ver [PAYMENTS-ACTIVATION.md](./PAYMENTS-ACTIVATION.md).

Statistics regressions: verify removal of KPI/rhythm/list UI, all names accessible via bubble groups/search, canonical parent references and missing explicit mentions without AI or cross-owner reads. The emotional calendar uses actual daily scores, Monday-first columns, coloured ties, real zero and distinct missing-analysis states; choosing a person must open and scroll to their expanded canonical profile on desktop and mobile.

Person emotions and connections: pure tests reconcile per-person sample counts and means, unordered pairs once per date, full-period counts with bounded latest dates, and focused network geometry without overlaps. API tests reject anonymous/free access before reads, validate bounded real dates, apply owner filters, recheck both canonical mentions and limit excerpts without providers or quota. UI tests cover on-demand loading, failure/retry, aborted/obsolete detail replies and neighbours outside the first bubble group. Browser tests on desktop and mobile open actual dated entries from both emotions and a clickable SVG line, check overflow and assert no report call or quota charge. Fixtures use synthetic diary data; they never write to production.

Emotion rankings: API tests verify old high-scoring entries, descending score/date tie order, real zero, missing values, strict cursor validation, owner scope, canonical parent recovery, twelve-result pages and bounded scans with continuation for rare mentions. UI tests verify the compact side-card controls, changing emotion, append pagination, retry and discarded late replies. Desktop/mobile browser tests open the actual ranked diary entry, load additional pages, switch sorting, close with Escape and restore focus. People-card tests preserve dated history and editing; browser checks exercise keyboard accordion headers, long names, readable date placement and non-overlapping action buttons.

### Administración y reportes

`dashboard-api.test.ts`, `tests/database/dashboard.sql` y los E2E de `admin dashboard` / `settings stores report` cubren permisos del administrador, revocación, ausencia de enlaces en navegación, directorio con filtros/fichas, seguimiento de reportes y guardado independiente de Resend. La base local incluye las columnas de identidad de Auth necesarias para comprobar que el directorio devuelve el email auténtico. También se lanzan 24 envíos concurrentes y solo cinco deben guardarse. Los fixtures son sintéticos y no modifican Supabase publicado ni envían mensajes. El retorno de pago se verifica en `/billing/return`; `/dashboard` tiene un contrato de autorización distinto.

### Responsive administration and Settings

The `mobile administration fits long content` E2E cases cover 320×568, 360×740, 390×844, 430×932 and 740×360. They use synthetic long names, emails and report messages; assert page overflow, dialog/header/body bounds, 44px close buttons, 16px inputs, report saving, cancellation preview bounds and non-submission, and account-deletion confirmation layout without deleting anything. Subscription dialogs must be portalled to `document.body`: a `backdrop-filter` ancestor otherwise makes `position: fixed` relative to the settings card. Re-run the app mobile suite and affected desktop flows after responsive changes; browser emulation does not replace testing Safari and the software keyboard on a physical phone.

### Neutralidad y análisis emocional

`mood-analysis.test.ts` verifica el esquema estricto de cinco dimensiones, `null` por evidencia insuficiente, ceros reales, intensidades independientes y parser con validación/redondeo/límites. Las pruebas de API comprueban que se analiza el texto completo validado, que un resultado incompleto no sobrescribe puntuaciones y que el ranking de Neutral respeta propietario, paginación y ausencia de llamadas de IA/cuota. Los agregados no incluyen valores desconocidos en medias ni denominadores.

`tests/database/emotions.sql` comprueba columna nullable sin backfill, ceros y emociones coexistentes, rango 0–100, rechazo de NaN, escritura nullable y aislamiento entre propietarios y rol anónimo. Se ejecuta únicamente en el PostgreSQL efímero del runner. El E2E `neutral emotion toggles, colours the calendar and ranks person entries without AI` recorre escritorio/móvil: filtro, tabla, calendario gris, media por persona, ranking 90 antes de 0 y apertura de la fecha real, sin peticiones de informe o extracción.

Para validar el significado de un cambio de prompt, se puede realizar por separado una comprobación controlada con el modelo real y textos ficticios de rutina, calma explícita, emociones mixtas y evidencia insuficiente. No forma parte de la suite aislada, tiene coste de proveedor y nunca debe enviar diarios personales ni guardar credenciales. Las puntuaciones concretas son estimaciones variables; verificar los criterios semánticos y el contrato, no exigir valores idénticos en cada ejecución.

### Reanálisis administrativo

`diary-reanalysis.test.ts` cubre autenticación/administrador, revocación en RPC, actor fiable, UUID de inicio, validación, reclamación ocupada, recálculo sin modificar personas, fallo de IA sin sobrescribir puntuaciones, rebase de hechos tras conflicto sin repetir proveedor y respuestas privadas sin texto ni concesión. `diary-reanalysis-dialog.test.tsx` verifica apertura sin IA, UUID conservado tras respuesta perdida, cierre durante una petición y revocación.

`tests/database/reanalysis.sql` ejecuta el contrato SQL real: snapshot por propietario, un proceso compartido, una sola entrada reclamada, tokens/confirmaciones repetidas, guardado de cinco valores nullable, fusión sin duplicados, edición simultánea, separación de propietarios, cancelación/resultados tardíos, reintento y concesión caducada. El runner abre 24 inicios concurrentes (un trabajo) y 24 procesadores (una sola reclamación). No llama a OpenAI. Los E2E de escritorio/móvil comprueban el diálogo, coste, pausa, cierre, reanudación, número de solicitudes y ausencia de duplicados/cuota; todos los diarios y resultados son ficticios.


### Emotional timeline dates and freshness

Regression fixtures cover a sparse diary beginning in May 2025 with September 30 and October 1–2, 2026: every recent date retains its own saved scores and no emotion point is fabricated for September 28. Dense histories retain the last 30 days individually, conserve sampled-entry counts and stay below 180 points; older multi-entry means disclose actual sampled date ranges in the tooltip/table. Unknown dimensions remain null and missing dates break lines. Stacked columns use actual entry dates in chronological order and omit inactive spans; they do not imply equal calendar spacing. API checks assert verified-owner scope and no provider/quota calls. Controller tests cover tab-return coalescing, cleanup, obsolete owner replies and Madrid midnight without background API polling. Browser regressions exercise the actual SVG tooltip and accessible table on desktop and mobile with synthetic data.


### Relative emotional distribution and descriptive writing

The overview alone displays score / sum of the five available scores × 100. Math regressions cover exactly 100% displayed totals after one-decimal rounding, high coexisting emotions, unknown dimensions, true zero, a zero denominator and unchanged source values. Tooltip tests distinguish relative shares from saved 0–100 intensities and disclose partial analysis. Browser tests keep all five stacked bands during highlighting, preserve the real recent dates/original-score table, verify tooltip percentages sum to 100 and check mobile/desktop overflow. Calendar and per-person emotion scores stay independent.

`npm run eval:mood` explicitly calls the configured OpenAI model on four built-in synthetic cases and checks broad behavioral expectations: descriptive prose must not imply neutrality, humor must not erase pressure and routine neutrality must remain possible. This evaluation costs provider credits, is excluded from the isolated test suite, contains no real diaries and never modifies the database. A successful mocked test alone does not validate an AI prompt's semantic behavior.
