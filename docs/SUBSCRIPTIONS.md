# Suscripciones, cuotas y preparación de pagos

## Estado de esta entrega

Esquema aplicado en Supabase SecondBrain (`erwlkhqbaoijaeaqpvgc`) el 30 de septiembre de 2026, tras autorización del propietario. Las migraciones versionadas `20260929231804_normalized_billing_and_atomic_usage.sql` y `20260929231923_billing_catalog_permissions_and_indexes.sql` coinciden con sus versiones del historial remoto. No volver a ejecutarlas en ese proyecto.

Verificación remota: tres perfiles y tres suscripciones; referencias, consumo histórico y datos anteriores conservados. Aislamiento entre usuarios, rechazo de RPC desde navegador y reserva/liberación de cuota comprobados con transacciones de prueba revertidas. El catálogo publicado devuelve HTTP 200 y `checkoutEnabled: false`. Stripe, correos de facturación y plantillas de Auth mantienen su configuración anterior. Se guardó una copia local privada del JSON de suscripciones antes de aplicar el esquema, fuera del repositorio.

Supabase asignaba permisos amplios por defecto al catálogo: la segunda migración los revoca y concede solo SELECT al navegador, además de indexar las claves foráneas de plan y destinatario de correo. Las pruebas locales reproducen esos permisos por defecto para detectar regresiones.

Se inspeccionó la base publicada el 30 de septiembre de 2026: tres perfiles gratuitos/inactivos; uno conserva referencias de Stripe y otro consumo histórico de mayo. El SMTP personalizado de Supabase está activo con Resend, puerto 465 e intervalo mínimo de 60 segundos; la recuperación todavía utiliza el asunto y cuerpo predeterminados en inglés. Esta inspección no certifica una entrega real de correo.

La retirada final de `profiles.subscription` está aplicada mediante `20260929232943_remove_profile_subscription_json.sql`. También se eliminaron el trigger/función de proyección y el índice JSON antiguo. Se conservaron sin cambios identidad, suscripciones normalizadas, consumo, diarios y personas, comprobando sus huellas antes/después. Permanece el trigger de alta que crea una suscripción gratuita. La lectura real de PostgREST confirma los tres perfiles con su relación normalizada y sin la columna JSON.

## Modelo actual del código

| Tabla                  | Responsabilidad                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`             | Identidad y primera experiencia. Sin JSON de suscripción. La app lee la relación tipada `subscriptions`; el objeto del dominio no es una columna de perfil.                                     |
| `subscription_plans`   | Catálogo editable de límites. Solo el servidor puede modificarlo.                                                                                                                               |
| `subscriptions`        | Una suscripción por perfil; plan, estado, fechas, cancelación y referencias únicas de Stripe.                                                                                                   |
| `usage_counters`       | Una fila por usuario, mes UTC y función: consumo confirmado y reservas en curso.                                                                                                                |
| `usage_reservations`   | Una reserva por operación. Evita carreras entre comprobación de cuota y generación.                                                                                                             |
| `billing_events`       | Identificador de evento único y fecha del proveedor: deduplicación y protección ante eventos antiguos.                                                                                          |
| `statistics_reports`   | Último informe conjunto del propietario, generado en el servidor y reutilizable durante 30 minutos. JSON es adecuado para el resultado variable de un informe, no para contadores concurrentes. |
| `billing_email_outbox` | Notificaciones pendientes, confirmadas o fallidas, con intentos y arrendamiento de trabajo.                                                                                                     |
| `feedback_requests`    | Registros históricos de intentos de correo. Los nuevos mensajes se guardan en `feedback_reports`, con límite atómico de cinco por hora.                                                         |

Los planes conservan estas condiciones:

| Plan     | Chat personal/mes | Chat de personas/mes | Informes/mes |
| -------- | ----------------: | -------------------: | -----------: |
| Gratuito |                 5 |                   10 |            0 |
| Pro      |                30 |                  100 |           10 |
| Elite    |               100 |                  500 |   Ilimitados |

Transcripción, personas y estilización siguen disponibles según su comportamiento anterior. Todos los planes utilizan los mismos modelos de IA; las diferencias implementadas son cuotas y acceso a estadísticas. La facturación mensual y el mes de cuota son conceptos distintos: la cuota se renueva el día 1 a las 00:00 UTC. Cambiar de plan conserva el consumo ya realizado; no duplica la cuota ni borra historial. El catálogo de la base es la autoridad para cuotas del servidor y la app; la landing consulta y valida sus cuotas publicadas, con revalidación cada 60 segundos y fallback identificado que mantiene el pago cerrado.

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

- `STRIPE_CHECKOUT_ENABLED` debe permanecer ausente o `false`. El servidor exige además todas las claves y precios para abrir checkout/portal. Checkout alojado devuelve una URL validada; no carga Stripe.js ni requiere clave publicable.
- El servidor verifica que los precios configurados estén activos, en euros, mensuales y por 4,99/9,99 € antes de crear checkout; rechaza una configuración que no coincida con las tarjetas.
- Se usa Stripe Node 22.6.2 y su API tipada `2026-08-26.dahlia`, eliminando la conversión de tipos que ocultaba un contrato antiguo. Las fechas vienen de los artículos de suscripción y las facturas de `parent.subscription_details`.
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
- Feedback guarda primero el reporte en `feedback_reports`, usa el correo verificado de la sesión, escapa HTML, limita envíos en SQL y usa idempotencia de Resend para el aviso opcional. El guardado no depende de la entrega del correo. El campo visible de respuesta corresponde a la cuenta.
- La cola de facturación se crea en la misma transacción del evento. `POST /api/emails/process-billing` exige `CRON_SECRET` y `BILLING_EMAILS_ENABLED=true`. **Mantener esa variable ausente o `false`** hasta revisar y habilitar correo de facturación.
- El trabajador obtiene destinatarios confirmados de Auth, no del correo editable del perfil. Usa `billing-<event_id>` para idempotencia, arrendamientos de 10 minutos y hasta cinco intentos. Después de 23 horas requiere revisión manual para no superar la ventana de idempotencia del proveedor y arriesgar duplicados. Monitorizar las filas `failed` al habilitarlo.
- No se ha añadido un cron de envío ni se han enviado correos reales. Los cuerpos de Auth preparados requieren aplicarse en Supabase y probar entrega/redirect en un entorno autorizado. Las notificaciones de seguridad de Auth no están activadas actualmente y requieren decidir y configurar sus plantillas antes de habilitarlas.

## Publicación en otros entornos o futuras versiones

1. Revisar SQL/código, obtener una copia de seguridad y comprobar el mapeo actual de plan/estado/fechas y unicidad de referencias Stripe. La conversión es transaccional y conserva meses de uso históricos; un dato inválido bloquea la operación completa.
2. Programar una ventana breve sin nuevas peticiones de consumo del código anterior. Aplicar **primero** `secondbrain/supabase/migrations/20260929231804_normalized_billing_and_atomic_usage.sql` y después `secondbrain/supabase/migrations/20260929231923_billing_catalog_permissions_and_indexes.sql` y `secondbrain/supabase/migrations/20260929232943_remove_profile_subscription_json.sql` en el entorno que todavía no los tenga. No mezclar durante la ventana escrituras antiguas de contadores JSON con el sistema nuevo.
3. Verificar filas, backfill, FK, RLS y permisos de RPC; servidor con `service_role`, navegador solo lectura del propio plan/uso. El esquema final no contiene `profiles.subscription`; los permisos y el alta de perfiles funcionan con las tablas normalizadas.
4. Ejecutar `npm run test:all` y builds normales de ambas apps. Publicar el código solo después del esquema. Una reversión debe usar código compatible con las tablas normalizadas; la columna antigua no existe.
5. Aplicar los asuntos/cuerpos de Auth revisados desde las plantillas versionadas. Probar recuperación y confirmación, SMTP, allowlist y enlaces de un solo uso. Conservar desactivados Stripe y el envío de facturación.
6. Comprobar la web publicada con cuentas de prueba y limpiar únicamente datos ficticios autorizados.

Las pruebas automatizadas usan integraciones ficticias y PostgreSQL desechable sin red externa; no escriben en Supabase publicado, no envían correo ni cobran tarjetas. El proyecto OpenAI local había respondido `credit_balance_exhausted` en la comprobación previa; estas pruebas tampoco certifican saldo, permisos ni calidad de respuestas reales.

## Referencias oficiales

- [Funciones y permisos de Supabase](https://supabase.com/docs/guides/database/functions).
- [Plantillas y variables de Auth](https://supabase.com/docs/guides/auth/auth-email-templates).
- [Webhooks de Stripe](https://docs.stripe.com/webhooks), [idempotencia](https://docs.stripe.com/api/idempotent_requests) y [Customer Portal](https://docs.stripe.com/api/customer_portal/sessions/create).
- [Envío de Resend](https://resend.com/docs/api-reference/emails/send-email).

## Protección previa a la activación

La nueva `20260929234816_billing_subscription_lineage.sql` está preparada y probada localmente; **no se ha aplicado en Supabase publicado**. Añade la versión 2 de contrato de cobro y protege contra eventos posteriores de una suscripción anterior, sin reescribir perfiles, suscripciones ni consumo. Retira los permisos de navegador sobre las tablas internas. Checkout/portal/webhook comprueban esta versión, y el catálogo no anuncia contratación si falta.

El proveedor se consulta incluso cuando el estado local es inactivo, para no duplicar una suscripción cuyo primer pago está incompleto. El acceso exige una factura vigente pagada, además de estado activo. El portal tiene un botón propio en la app. La eliminación de cuenta cierra checkout pendiente y cliente Stripe antes de borrar Auth, cancelando renovaciones de inmediato; el fallo del proveedor conserva la cuenta. Eventos posteriores de un cliente confirmado como eliminado se reconocen sin reconstruir datos.

La nueva migración incluye `billing_checkout_attempts` y RPC de reserva/registro exclusivos del servidor. Dos pestañas comparten el mismo intento, clave de idempotencia y sesión de Stripe. La reserva dura 36 minutos; si no se registró sesión puede renovarse después de seis minutos, manteniendo el mínimo de 30 minutos que exige Stripe. Cambiar de plan exige cancelar expresamente el intento pendiente: el servidor caduca primero la sesión impagada y después libera la reserva exacta. Nunca libera un pago completado como si fuera un abandono. Las respuestas de checkout obsoletas se ignoran al cambiar de cuenta o plan.

Seguir [PAYMENTS-ACTIVATION.md](./PAYMENTS-ACTIVATION.md) para configuración, referencias existentes, impuestos/prorrateo, correo y pruebas de aceptación en sandbox. La revisión técnica del código no ha activado cobro, enviado correos ni publicado cambios.
