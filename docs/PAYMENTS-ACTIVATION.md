# Activación de suscripciones

El código está preparado para Checkout alojado y Customer Portal. La configuración real de Stripe está creada, pero la contratación y el correo de facturación siguen desactivados mientras se completa el tratamiento fiscal. Este documento distingue la preparación del código de la configuración y las pruebas necesarias para cobrar.

## Comprobación de solo lectura

Desde la raíz, con variables del entorno que se quiere verificar:

```sh
npm run check:billing
npm run check:billing -- --remote
npm run check:billing -- --remote --live
```

El primer comando comprueba la configuración local. `--remote` consulta Supabase y Stripe; no crea ni elimina clientes, suscripciones, precios, webhooks o correos. Por defecto espera claves de prueba. `--live` espera claves y objetos reales. La salida muestra condiciones y resultados, nunca valores de claves. Un código de salida 1 indica comprobaciones pendientes. Un resultado correcto tampoco sustituye la matriz de aceptación de pago y correo.

No mezclar cuentas o modos de Stripe en una misma relación de facturación. Revisar las referencias existentes con la cuenta original antes de eliminarlas o sustituirlas: que una referencia no exista con una clave de prueba no demuestra que nunca haya existido en modo real.

## Orden de preparación

1. Revisar los cambios y ejecutar `npm ci`, `npm run test:all` y los builds normales de ambos workspaces. Se usa un único `package-lock.json` en la raíz. No configurar `SECOND_BRAIN_TEST_BUILD` en Vercel.
2. Revisar/aplicar `20260929234816_billing_subscription_lineage.sql` en el entorno de destino. No reejecutar las migraciones ya aplicadas. La nueva migración mantiene los datos actuales, protege frente a eventos de otra suscripción y limita las tablas internas al servidor. Incluye `billing_checkout_attempts` y RPC para compartir un único intento entre pestañas; una sesión impagada se caduca en Stripe antes de liberar su reserva. `billing_schema_version()` debe devolver 2 con `service_role`; no está disponible para el navegador. Checkout, portal y webhook rechazan la configuración incompleta.
3. Publicar una preview del código compatible, manteniendo `STRIPE_CHECKOUT_ENABLED=false` y `BILLING_EMAILS_ENABLED=false`.
4. Configurar un sandbox de Stripe: productos activos, Pro 499 céntimos/mes y Elite 999 céntimos/mes, EUR, sin periodo de prueba ni descuentos hasta que se implementen y validen expresamente. Usar precios distintos. No introducir claves reales en las pruebas automatizadas.
5. Configurar Customer Portal predeterminado con los dos precios, actualización de método de pago, facturas y cancelación al final del periodo. Decidir la política de prorrateo, cambios de plan, reembolsos y tratamiento fiscal. No habilitar cobros reales ni impuestos automáticos sin completar esa configuración comercial.
6. Configurar el webhook `https://app.lumadiary.com/api/stripe/webhook` con API **2026-08-26.dahlia** y su secreto de firma: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`. También se admite `invoice.payment_succeeded`. Revisar entregas y reintentos en Stripe.
7. Configurar `STRIPE_SECRET_KEY`, los dos `STRIPE_*_PRICE_ID` y `STRIPE_WEBHOOK_SECRET` del mismo modo/cuenta. `APP_BASE_URL` es un origen HTTPS fiable; por defecto es `https://app.lumadiary.com`. No deriva de cabeceras ni URLs enviadas por el usuario. Checkout alojado devuelve una URL y no requiere `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` en el navegador.
8. Ejecutar la comprobación remota y la matriz siguiente en el sandbox. Habilitar la contratación únicamente en ese entorno de prueba para recorrer el pago alojado. No reutilizar IDs del sandbox al activar modo real.
9. Revisar datos del titular del servicio, privacidad/proveedores, condiciones de renovación, cancelación, impuestos y reembolsos. Los textos técnicos de la landing no completan por sí solos esa información comercial.
10. Aplicar los cuerpos/asuntos de Auth revisados, confirmar remitente/DNS y probar confirmación/recuperación y redirects. Para correo de facturación, preparar el cron protegido que llame a `POST /api/emails/process-billing`, decidir su frecuencia, revisar las plantillas y monitorizar `billing_email_outbox`. Mantener su flag desactivado hasta validar la entrega.
11. Preparar el entorno real con objetos/claves/secreto nuevos; ejecutar `--remote --live`, comprobar referencias previas y activar solo tras aprobar las pruebas. El despliegue de la landing y la app se verifica por separado.

## Matriz de aceptación en sandbox

| Caso                                                 | Resultado exigido                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta correcta Pro/Elite                              | Una suscripción, importe correcto; acceso solo tras factura pagada y webhook firmado.                                                                               |
| Rechazo de tarjeta/SCA                               | Sin acceso de pago; error recuperable y sin segunda suscripción.                                                                                                    |
| Pago diferido                                        | No se concede acceso mientras la factura esté pendiente; se activa después de confirmar pago.                                                                       |
| Doble clic/reintento de red/dos pestañas             | Mismo intento reservado en servidor; una sola sesión/cargo, incluso con UUID de navegador distintos.                                                                |
| Cambio de plan con checkout pendiente                | Error recuperable; cancelar el intento caduca primero su sesión impagada y después permite un nuevo plan. Un pago completado no se libera como abandono.            |
| Abandono/caducidad de checkout                       | Sin cobro ni acceso; se puede iniciar un nuevo intento legítimo.                                                                                                    |
| Cuenta con suscripción incompleta, impagada o activa | Gestión de la existente; no contratar una segunda.                                                                                                                  |
| Cambio Pro/Elite en portal                           | Precio autorizado y prorrateo elegido; las cuotas conservan el consumo del mes.                                                                                     |
| Renovación y pago fallido                            | Fechas/estado sincronizados y política de acceso aplicada en servidor.                                                                                              |
| Webhooks duplicados/desordenados                     | No duplican consumo/correo ni restauran estados antiguos.                                                                                                           |
| Cancelación atrasada de una suscripción anterior     | No cancela ni sustituye la suscripción actual.                                                                                                                      |
| Regreso antes del webhook                            | Pago confirmado y espera de sincronización; el navegador no concede el plan.                                                                                        |
| Cancelación al fin de periodo                        | Mantiene acceso pagado hasta la fecha confirmada.                                                                                                                   |
| Eliminación de cuenta                                | Cierra sesiones pendientes y cliente Stripe antes de borrar Auth; cancela renovaciones inmediatamente. Un fallo de Stripe conserva la cuenta para poder reintentar. |
| Evento posterior a eliminación                       | Se reconoce si Stripe confirma que el cliente ya fue eliminado; no recrea datos ni genera reintentos indefinidos.                                                   |
| Fallo/cambio de cuenta en portal                     | Error visible; una respuesta obsoleta no abre la facturación de la cuenta anterior.                                                                                 |
| Límites y reinicio UTC                               | Reservas concurrentes, errores sin cargo y consumo conservado al cambiar de plan.                                                                                   |
| Correo y recuperación                                | Entrega real, enlaces correctos/de un solo uso y notificaciones sin duplicados.                                                                                     |

La eliminación del cliente de Stripe cancela sus suscripciones activas y bloquea nuevas operaciones con ese cliente. Es una acción irreversible que el usuario confirma al eliminar su cuenta; no equivale a cancelar al final del periodo. No implica un reembolso automático. [Referencia de Stripe](https://docs.stripe.com/api/customers/delete).

## Resultado de la revisión del 30 de septiembre de 2026

Esta sección es histórica; consultar la revisión del 5 de octubre para el estado posterior.

- Validación local final: 504 pruebas de código/API, 107 comprobaciones SQL y 86 recorridos de navegador en móvil/escritorio; todas pasan. Las reservas de cuota y checkout se verifican con 24 conexiones concurrentes cada una. Ambos builds normales de producción pasan y sus guardas no detectan copias numeradas; `npm audit` informa cero vulnerabilidades conocidas. Los proveedores son simulados en las suites y las pruebas SQL usan PostgreSQL desechable.
- Supabase publicado conserva 3 perfiles, 3 suscripciones y 54 entradas; los perfiles ya no tienen la columna JSON antigua. Las tablas públicas tienen RLS. No se han modificado filas ni aplicado la nueva migración durante esta revisión.
- La app publicada y la landing responden HTTP 200; la landing redirige del dominio raíz a `www.secondbrainapp.com`. El catálogo publicado devuelve contratación desactivada.
- Las consultas de solo lectura al sandbox validan ambos precios. Faltan la versión nueva del SQL, un webhook compatible, el portal predeterminado configurado y reconciliar referencias de facturación existentes con la cuenta/modo correspondiente. No se han configurado ni realizado pagos reales.
- Una petición mínima a OpenAI con texto ficticio devuelve HTTP 429, `credit_balance_exhausted`. Resolver el saldo del proyecto antes de ofrecer funciones de IA de pago y comprobar después texto/transcripción reales. Las pruebas simuladas no certifican saldo o acceso al modelo.
- Los avisos de Supabase incluyen descubrimiento del esquema GraphQL por SELECT de tablas con RLS, información sobre copias privadas, índices todavía sin uso y asignación fija de conexiones de Auth. La nueva migración retira acceso de navegador a tablas internas. No se eliminan índices por no haberse usado todavía; con el volumen actual eso no demuestra que sean innecesarios. [Avisos de esquema GraphQL](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed), [conexiones de producción](https://supabase.com/docs/guides/deployment/going-into-prod).

Las suites locales usan proveedores ficticios y PostgreSQL aislado. La comprobación remota de configuración es de lectura; la matriz de pago real todavía debe ejecutarse en un sandbox autorizado.

## Preparación y aceptación del 5 de octubre de 2026

- Se aplicó la migración de linaje en Supabase: `billing_schema_version()` devuelve 2. Se conservaron los datos y el plan de una cuenta Elite con referencias antiguas, desvinculando únicamente sus dos IDs de Stripe después de comprobar que no existían en las cuentas original de pruebas y real y obtener autorización del titular.
- La cuenta real tiene los precios mensuales Pro 499 y Elite 999 céntimos EUR, con `tax_behavior=inclusive`; se retiraron los precios anteriores después de comprobar que no tenían suscripciones. El portal permite facturas, método de pago y cancelación al final del periodo; las subidas cobran prorrateo y las bajadas se programan para la siguiente renovación.
- Se creó el webhook real con la API fijada y los eventos del ciclo de vida. La clave restringida y el secreto se guardaron como variables sensibles de Production en Vercel, conservando el sandbox en Preview. La comprobación `--remote --live` pasa; no acredita por sí sola la entrega del webhook publicado.
- Stripe muestra LumaDiary, su sitio, contacto y enlaces legales. Checkout exige aceptar los términos y explica renovación y garantía de reembolso. Los textos públicos incluyen al titular y su política: último cargo solicitado dentro de 30 días; cargos anteriores se revisan individualmente. Se preserva el desistimiento inicial de 14 días del consumidor, sin pedir su renuncia ([artículo 102](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555#a102)).
- Aceptación con proveedor real en modo de prueba y usuario ficticio aislado: Checkout Pro 499, rechazo de tarjeta recuperable, pago correcto y aceptación de términos; la cuenta permanece Free antes del webhook firmado y pasa a Pro después. Repetir el evento se reconoce sin duplicar la activación. El portal y el retorno verifican correctamente la suscripción. Una subida con factura de prueba pagada activa Elite mediante webhook y cancelar desde la API conserva Elite activo hasta el fin del periodo confirmado por Stripe.
- Se eliminaron el cliente Stripe de prueba y el usuario ficticio de Supabase; quedan los 3 perfiles originales. El portal predeterminado de sandbox queda configurado para futuras pruebas. No se realizaron cargos reales. Las pruebas de proveedor anteriores no cubren todavía SCA, renovaciones mediante reloj de prueba ni la entrega automática del webhook real.
- Validación local: 708 pruebas de código/API y las comprobaciones SQL pasan. El navegador predeterminado de Playwright no estaba instalado; usando `PLAYWRIGHT_CHANNEL=chrome` pasan 125 recorridos y se omiten 5. Ambos builds normales de los workspaces pasan.
- Pendiente de decisión del titular: confirmar su registro fiscal antes de configurar IVA y habilitar Checkout real. Un precio inclusivo no calcula IVA: no se ha habilitado `automatic_tax` ni supuesto un alta tributaria.
