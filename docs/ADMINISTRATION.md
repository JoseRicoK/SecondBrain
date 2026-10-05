# Administración y reportes

## Pantallas

- `/dashboard` es el panel operativo privado. No aparece en el menú de la app ni en la landing. Requiere sesión y `profiles.admin = true`.
- Configuración permite enviar sugerencias y errores; los mensajes se guardan en `feedback_reports`. Resend puede avisar al equipo, pero la entrega de correo no determina si el reporte se ha guardado.
- El retorno de Checkout vive en `/billing/return?session_id=…`. Los enlaces de volver al diario de la pantalla de suscripción apuntan a `/`.

## Funcionalidades

El resumen muestra usuarios, nuevas altas, personas que escribieron/editan en 30 días, entradas no vacías, registros mensuales, planes efectivos, estados de suscripción, transcripciones, análisis e informes, consumo mensual de operaciones completadas, reportes por estado/tipo y estado de pagos/correos. Las gráficas de entradas usan la fecha de creación del registro, no la fecha del recuerdo; el consumo mensual usa UTC. Las condiciones del acceso efectivo son las mismas que las del resto de la app: estado activo y periodo sin caducar; un periodo nulo conserva el comportamiento actual del servidor.

El directorio incluye las cuentas de Supabase Auth, también si aún no tienen perfil. Usa el correo de Auth; el correo editable del perfil no prueba la identidad de una cuenta. Filtra por nombre/correo/UUID y plan efectivo, con 25 resultados por página. La ficha se carga bajo demanda: identidad, estado del perfil, suscripción/proveedor, fechas de actividad, cantidades de contenido, consumo de seis meses y diez últimos eventos de facturación. No descarga el texto del diario, el contenido de transcripciones ni las fichas personales de otros usuarios.

La bandeja filtra sugerencias/errores, estado y texto/autor, con 20 reportes por página. Permite gestionar `open`, `in_progress`, `resolved`, `closed`, prioridad y notas internas. Guarda el administrador que hizo el último cambio y su fecha. `updated_at` se usa como versión para rechazar actualizaciones concurrentes; el borrador se conserva ante errores. Las notas no se envían al remitente.

## Datos y seguridad

La migración `admin_dashboard_and_feedback` añade:

- `profiles.admin boolean not null default false`, excluido de INSERT/UPDATE del navegador.
- `feedback_reports`, propiedad del remitente, con FK y borrado en cascada al eliminar su cuenta.
- `submit_feedback`, transacción que bloquea la fila del perfil y permite como máximo cinco reportes nuevos por hora. La misma huella de propietario/tipo/mensaje/hora devuelve el mismo ID al reintentar.
- RPC operativas `admin_overview`, `admin_users`, `admin_user_detail`, `admin_feedback`, `admin_update_feedback`, y `assert_dashboard_admin`.
- `dashboard_private.accounts`, única lectura de Auth con `SECURITY DEFINER`; esquema privado, búsqueda vacía, verificación explícita de `profiles.admin` y EXECUTE únicamente para `service_role`. Devuelve solo los campos operativos seleccionados. El resto de RPC usa `SECURITY INVOKER`.

Cada ruta `/api/dashboard/*` verifica el token con Auth y vuelve a leer el booleano del perfil. El actor enviado a SQL se deriva de esa identidad. Cada RPC repite la comprobación del permiso; una revocación entre ambas lecturas también se rechaza. Los errores de autorización devuelven 401/403 y eliminan la vista anterior. Todas las respuestas privadas llevan `Cache-Control: private, no-store` y `Vary: Authorization`.

El navegador no tiene acceso directo a reportes, notas, fuente de cuentas, RPC de administración ni tablas internas de facturación/reservas. Tener `admin=true` no cambia su rol Postgres `authenticated`: el panel siempre pasa por el servidor. RLS permanece habilitado; las tablas internas sin políticas/grants de navegador están cerradas intencionadamente. No usar `user_metadata`, un flag local o esconder la URL como mecanismo de autorización.

## Dar acceso al primer administrador

Nadie recibe el permiso automáticamente. Identificar primero el correo exacto de Auth y la cuenta del titular, y comprobar que existe un único usuario con perfil. Tras autorización explícita del titular, actualizar solo ese UUID desde Supabase SQL/una conexión de servidor confiable:

```sql
select u.id, u.email, p.admin
from auth.users u join public.profiles p on p.uid = u.id
where lower(u.email) = lower('CORREO_CONFIRMADO');
-- Después de comprobar el UUID concreto:
update public.profiles set admin = true where uid = 'UUID_CONFIRMADO';
```

Para revocar, actualizar ese mismo registro a `false`. El cambio se comprueba en la siguiente operación; recargar `/dashboard` después de concederlo. No añadir un botón de promoción de administrador en Configuración ni una API pública para hacer este cambio.

## Verificación y despliegue

Aplicar la migración versionada antes de publicar estas rutas. El cambio es aditivo y no activa cobros reales. La ruta de retorno nueva debe estar incluida en el código publicado antes de habilitar Checkout. Confirmar el valor real de `admin`, los grants de columna, EXECUTE de las funciones y las consultas de resumen/listado en Supabase; no deducir el estado remoto de una compilación local.

`tests/dashboard-api.test.ts` comprueba autenticación, autorización, filtros, paginación, validación, conflictos y guardado duradero. `tests/database/dashboard.sql` ejecuta la SQL real en PostgreSQL local y prueba permisos, cuentas sin perfil, correo auténtico, acceso efectivo, duplicados, cuota y revocación. La suite paralela lanza 24 reportes y exige que solo cinco se guarden. Los E2E de escritorio y móvil usan cuentas/reportes ficticios; no envían correo ni escriben en producción.

## Reanalizar diarios desde Usuarios

Cada usuario con perfil y entradas tiene «Reanalizar». El diálogo consulta primero cantidades/progreso sin llamar a IA; el administrador inicia explícitamente la operación tras ver su alcance y coste. Recalcula las cinco emociones con el prompt vigente en todas las entradas con texto hasta hoy. Las que tienen `mood_analyzed_at` conservan personas/menciones; las pendientes realizan extracción completa y emociones. No crea diarios nuevos, no regenera informes semanales ni descuenta la cuota del usuario. El proveedor sí factura sus llamadas.

`GET/POST /api/dashboard/reanalysis` autentica y comprueba el administrador actual. Las RPC repiten ese permiso. `diary_reanalysis_jobs` y `diary_reanalysis_items` son tablas internas con RLS y permisos solo de servidor. Un UUID de solicitud hace idempotente el inicio; un índice parcial limita a un proceso activo por usuario, incluso entre administradores/pestañas. Las entradas se enumeran una vez al iniciar, con fecha, propietario y huella de su versión, sin copiar su texto. Los contadores se actualizan en la transacción, sin volver a contar todo el historial en cada paso.

Cada POST de procesamiento reclama una sola entrada con una concesión de cinco minutos. OpenAI tiene timeout de 90 segundos por llamada y ningún reintento automático; la ruta admite hasta 240 segundos. La ventana avanza secuencialmente mientras está abierta; pausa/cierre detiene las siguientes solicitudes, y el servidor termina la entrada en curso. Abrir de nuevo el diálogo y «Reanudar» reutiliza el progreso guardado. Una concesión caducada requiere reintento explícito, evitando cobros repetidos tras una interrupción. Un fallo detiene el avance; se pueden reintentar únicamente fallidas. Cancelar invalida resultados tardíos y deja las completadas intactas.

`admin_finish_reanalysis` guarda puntuaciones, menciones y personas pendientes en una única transacción. Comprueba la huella del diario y todas las versiones de personas antes de escribir. Si el diario cambió/se eliminó, omite la entrada conservando el estado actual; una nueva ejecución podrá analizar la nueva versión. Los conflictos de personas se fusionan con el catálogo actual y el mismo resultado validado, sin otra llamada al modelo. Reutiliza `mergePersonInformation` y la normalización SQL; el contador de menciones se deriva de fechas guardadas. Las puntuaciones existentes permanecen intactas si falla el proveedor o la persistencia.

El navegador recibe solo cantidades, estado y hasta doce fechas/códigos de incidencias, nunca texto del diario, resultados del modelo ni tokens de concesión. Al eliminar la cuenta destino se eliminan sus trabajos; al eliminar el administrador se conserva el trabajo con actor nulo. Aplicar `admin_diary_reanalysis` antes de publicar el código, sin iniciar trabajos reales como comprobación de despliegue.
