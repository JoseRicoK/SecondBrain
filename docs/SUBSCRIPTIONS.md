# Suscripciones, cuotas y preparación de pagos

## Estado de esta entrega

Cambios locales para revisión. No se han aplicado a la base publicada ni se han activado Stripe o correos de facturación. Consulta los pasos de publicación al final: esta versión de la app necesita el nuevo esquema.

Se inspeccionó la base publicada el 30 de septiembre de 2026: tres perfiles gratuitos/inactivos; uno conserva referencias de Stripe y otro consumo histórico de mayo. El SMTP personalizado de Supabase está activo con Resend, puerto 465 e intervalo mínimo de 60 segundos; la recuperación todavía utiliza el asunto y cuerpo predeterminados en inglés. Esta inspección no certifica una entrega real de correo.

## Modelo actual del código

| Tabla                  | Responsabilidad                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`             | Identidad y primera experiencia. El JSON anterior se conserva por compatibilidad; la app lee la relación tipada `subscriptions`.                                                                |
| `subscription_plans`   | Catálogo editable de límites. Solo el servidor puede modificarlo.                                                                                                                               |
| `subscriptions`        | Una suscripción por perfil; plan, estado, fechas, cancelación y referencias únicas de Stripe.                                                                                                   |
| `usage_counters`       | Una fila por usuario, mes UTC y función: consumo confirmado y reservas en curso.                                                                                                                |
| `usage_reservations`   | Una reserva por operación. Evita carreras entre comprobación de cuota y generación.                                                                                                             |
| `billing_events`       | Identificador de evento único y fecha del proveedor: deduplicación y protección ante eventos antiguos.                                                                                          |
| `statistics_reports`   | Último informe conjunto del propietario, generado en el servidor y reutilizable durante 30 minutos. JSON es adecuado para el resultado variable de un informe, no para contadores concurrentes. |
| `billing_email_outbox` | Notificaciones pendientes, confirmadas o fallidas, con intentos y arrendamiento de trabajo.                                                                                                     |
| `feedback_requests`    | Intentos de correo del usuario para aplicar cinco mensajes diferentes por hora.                                                                                                                 |

Los planes conservan estas condiciones:

| Plan     | Chat personal/mes | Chat de personas/mes | Informes/mes |
| -------- | ----------------: | -------------------: | -----------: |
| Gratuito |                 5 |                   10 |            0 |
| Pro      |                30 |                  100 |           10 |
| Elite    |               100 |                  500 |   Ilimitados |

Transcripción, personas y estilización siguen disponibles según su comportamiento anterior. Todos los planes utilizan los mismos modelos de IA; las diferencias implementadas son cuotas y acceso a estadísticas. La facturación mensual y el mes de cuota son conceptos distintos: la cuota se renueva el día 1 a las 00:00 UTC. Cambiar de plan conserva el consumo ya realizado; no duplica la cuota ni borra historial. El catálogo de la base es la autoridad para cuotas del servidor y la app; la landing refleja sus valores publicados y debe actualizarse si cambian las condiciones comerciales.

## Uso y actualización de la interfaz

1. Autenticar la petición y obtener su propietario del token.
2. `reserve_usage` bloquea brevemente la fila de suscripción, obtiene el límite vigente y reserva una unidad. Los consumos pendientes también cuentan.
3. Ejecutar el proveedor fuera de la transacción SQL.
4. Confirmar con `finish_usage`; en un fallo, liberar la reserva. Repetir la confirmación/liberación no duplica consumo.
5. Si el proceso se interrumpe, las reservas caducan tras 20 minutos. Una lectura de estado las recupera; las confirmaciones tardías de una reserva liberada se rechazan.

El plan efectivo vuelve a gratuito cuando no está activo o cuando termina el periodo, sin depender de un cron. Los contadores se mantienen aunque expire el plan. La cancelación mantiene la fecha de acceso ya pagada; no crea un mes nuevo. El mantenimiento de caducidades opera sobre columnas tipadas y conserva los identificadores del proveedor.

`useSubscription` comparte un único estado de servidor. Se actualiza tras chat, informes y cambios de suscripción; comunica cambios a otras pestañas mediante un evento de almacenamiento y vuelve a comprobar al recuperar el foco y cada minuto visible. Nunca guarda consumo o datos privados en ese evento. Los errores de estado se muestran como errores, no como una cuota de cero. El servidor sigue comprobando límites aunque una interfaz esté desactualizada.

## Estadísticas

`POST /api/statistics/report` genera resumen, cita, clasificación de menciones y gráfica semanal como un informe. La reserva y el informe se confirman juntos en SQL. Si falla la IA o la base, no se confirma el consumo. Solo se genera un informe simultáneo por usuario.

El informe se reutiliza 30 minutos; actualizar el resumen/cita genera otro informe y consume un acceso. Las rutas anteriores de resumen/cita solo leen el informe existente, sin generar IA. Todas las rutas comprueban el acceso de pago en el servidor. Cambiar semana/mes/año o actualizar las gráficas no consume accesos: esas consultas no invocan IA. Los siete días incluyen hoy y los seis anteriores; mes/año terminan hoy, usando la fecha del diario en Madrid. No se inventan valores para días sin análisis. Una caída de la base no se interpreta como un gráfico vacío. Las menciones cuentan una vez por persona y entrada, evitando contadores acumulados que pueden desviarse al reprocesar una entrada.

## Stripe preparado, desactivado

- `STRIPE_CHECKOUT_ENABLED` debe permanecer ausente o `false`. El servidor exige además todas las claves y precios para abrir checkout/portal. El navegador no carga Stripe mientras el pago está desactivado.
- El servidor verifica que los precios configurados estén activos, en euros, mensuales y por 9,99/19,99 € antes de crear checkout; rechaza una configuración que no coincida con las tarjetas.
- Se mantiene Stripe Node 18.4 y su API tipada `2025-07-30.basil`, eliminando la conversión de tipos que ocultaba un contrato antiguo. Las fechas vienen de los artículos de suscripción y las facturas de `parent.subscription_details`.
- La creación/reutilización del cliente y los reintentos de checkout usan claves de idempotencia. Los clientes se vinculan al usuario autenticado antes de iniciar checkout.
- Una suscripción existente se gestiona mediante Customer Portal; no se crea una segunda suscripción para cambiar de plan. El portal debe configurarse más adelante para permitir los productos/precios y la política de prorrateo elegida.
- Los webhooks verifican firma del cuerpo original y vuelven a consultar el estado actual en Stripe. El evento y la actualización de la suscripción se guardan en una transacción. Los eventos antiguos no regresan el estado; los duplicados no generan otra notificación.
- El regreso del navegador verifica pago y propiedad; nunca concede un plan. Si el webhook se retrasa, la pantalla muestra «Pago confirmado» y espera la sincronización sin pedir un segundo pago.
- La cancelación de una suscripción real solo se registra después de confirmarla con Stripe. No se borra la relación con el cliente ni el historial.

Antes de cobrar, verificar en un sandbox: alta, renovación, cambio de plan/prorrateo, SCA, rechazo y pago diferido, duplicados/eventos desordenados, cancelación al final de periodo y retorno con webhook retrasado. Este trabajo no crea productos, configura cuentas ni realiza cobros.

## Correos

- Fuente de formato: `src/lib/email-templates.ts`. HTML de una columna con tablas de presentación, español, tamaños legibles y CTA; el feedback y facturación incluyen texto plano.
- `node scripts/build-email-previews.mjs` regenera las plantillas de Auth y las vistas ficticias de `docs/email-previews/index.html`. No envía mensajes.
- `secondbrain/supabase/templates/` contiene los seis cuerpos de Auth y sus asuntos. Mantienen `{{ .ConfirmationURL }}`/`{{ .Token }}` oficiales; no construyen enlaces que rompan la verificación o los redirects.
- Feedback usa el correo verificado de la sesión, escapa HTML, limita intentos y usa idempotencia de Resend. El campo visible de respuesta corresponde a la cuenta.
- La cola de facturación se crea en la misma transacción del evento. `POST /api/emails/process-billing` exige `CRON_SECRET` y `BILLING_EMAILS_ENABLED=true`. **Mantener esa variable ausente o `false`** hasta revisar y habilitar correo de facturación.
- El trabajador obtiene destinatarios confirmados de Auth, no del correo editable del perfil. Usa `billing-<event_id>` para idempotencia, arrendamientos de 10 minutos y hasta cinco intentos. Después de 23 horas requiere revisión manual para no superar la ventana de idempotencia del proveedor y arriesgar duplicados. Monitorizar las filas `failed` al habilitarlo.
- No se ha añadido un cron de envío ni se han enviado correos reales. Los cuerpos de Auth preparados requieren aplicarse en Supabase y probar entrega/redirect en un entorno autorizado. Las notificaciones de seguridad de Auth no están activadas actualmente y requieren decidir y configurar sus plantillas antes de habilitarlas.

## Publicación después de revisar

1. Revisar SQL/código, obtener una copia de seguridad y comprobar el mapeo actual de plan/estado/fechas y unicidad de referencias Stripe. La conversión es transaccional y conserva meses de uso históricos; un dato inválido bloquea la operación completa.
2. Programar una ventana breve sin nuevas peticiones de consumo del código anterior. Aplicar **primero** `secondbrain/supabase/migrations/20260929204059_normalized_billing_and_atomic_usage.sql` en Supabase. No mezclar durante la ventana escrituras antiguas de contadores JSON con el sistema nuevo.
3. Verificar filas, backfill, FK, RLS y permisos de RPC; servidor con `service_role`, navegador solo lectura del propio plan/uso. El JSON de compatibilidad no se utiliza como contador en el código nuevo.
4. Ejecutar `npm run test:all` y builds normales de ambas apps. Publicar el código solo después del esquema. Una reversión al código antiguo necesitaría reconciliar consumo; no usar el JSON histórico como consumo vigente.
5. Aplicar los asuntos/cuerpos de Auth revisados desde las plantillas versionadas. Probar recuperación y confirmación, SMTP, allowlist y enlaces de un solo uso. Conservar desactivados Stripe y el envío de facturación.
6. Comprobar la web publicada con cuentas de prueba y limpiar únicamente datos ficticios autorizados.

Las pruebas automatizadas usan integraciones ficticias y PostgreSQL desechable sin red externa; no escriben en Supabase publicado, no envían correo ni cobran tarjetas. El proyecto OpenAI local había respondido `credit_balance_exhausted` en la comprobación previa; estas pruebas tampoco certifican saldo, permisos ni calidad de respuestas reales.

## Referencias oficiales

- [Funciones y permisos de Supabase](https://supabase.com/docs/guides/database/functions).
- [Plantillas y variables de Auth](https://supabase.com/docs/guides/auth/auth-email-templates).
- [Webhooks de Stripe](https://docs.stripe.com/webhooks), [idempotencia](https://docs.stripe.com/api/idempotent_requests) y [Customer Portal](https://docs.stripe.com/api/customer_portal/sessions/create).
- [Envío de Resend](https://resend.com/docs/api-reference/emails/send-email).
