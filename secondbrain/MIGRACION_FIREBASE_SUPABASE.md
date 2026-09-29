# Migración de Firebase a Supabase

Estado comprobado el 29 de septiembre de 2026. La aplicación usa Supabase para Auth y las tablas de diario, personas, perfiles, transcripciones y estados de ánimo. El proyecto de destino es `erwlkhqbaoijaeaqpvgc`; el origen era `secondbrainapp-ab98c`.

## Datos importados

| Recurso | Firebase | Supabase antes | Supabase después |
| --- | ---: | ---: | ---: |
| Usuarios de Auth | 3 | 1 | 3 |
| Perfiles Firestore | 4 | 1 | 3 activos; 1 archivado |
| Entradas de diario | 39 | 17 | 54 activas; 2 archivadas |
| Personas | 32 | 18 | 34 activas; 1 archivada |

Se asociaron usuarios por correo verificado de Firebase Auth. Las 37 entradas con propietario válido se fusionaron por usuario y fecha; las 31 personas con propietario válido se agruparon por usuario y nombre. La fusión conservó los datos existentes de Supabase y unió detalles y menciones sin repetirlos. Cinco personas duplicadas se consolidaron. Los cuatro documentos sin un propietario comprobable están en `migration.unmapped_firestore_documents`, sin acceso de `anon` ni `authenticated`; no se adjudicaron a otra cuenta.

El usuario que ya existía en Supabase conservó el estado de suscripción más reciente. Se preservaron las referencias de Stripe, pero el estado de facturación no se ha validado contra Stripe. No se debe activar un plan de pago a partir de los campos históricos de Firestore.

## Recuperación y repetición

La exportación original, los usuarios de Auth y el informe están en `/Users/jositomac/.codex/secure-migrations/secondbrain-20260928T204904Z` con permisos privados. No se incorporan datos personales ni secretos al repositorio. Antes de importar se copiaron las cinco tablas originales de Supabase al esquema privado `migration.before_firebase_*_20260928`.

La lógica de transformación se conserva en `scripts/migrate-firebase-to-supabase.mjs`. Requiere `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`. Por defecto hace una simulación; `--apply` importa. Una segunda ejecución de `--apply` creó cero usuarios, entradas y personas adicionales. El informe `migration_result.json` permite revisar los documentos huérfanos sin reasignarlos automáticamente. Las migraciones SQL de `supabase/migrations/` ya se aplicaron al proyecto de destino.

No ejecutar `supabase-preserve-data-migration.sql`: era un script antiguo que mezclaba datos de distintos propietarios. Se dejó bloqueado expresamente.

## Acceso y controles

Google Auth está habilitado y se probó con una cuenta migrada: se vinculó a la identidad existente sin crear otro usuario y se abrió una entrada de Firestore desde la app local. Las dos cuentas que usaban contraseña deben crear una nueva desde «Olvidé mi contraseña»: el hash SCRYPT de Firebase no se puede reutilizar directamente en Supabase Auth. No se enviaron correos de recuperación durante la migración.

Las tablas activas tienen claves foráneas a `auth.users`, RLS por propietario y permisos limitados. El cliente no puede editar la suscripción del perfil; las rutas del servidor que acceden con `service_role` comprueban la sesión y el propietario. La migración privada no está expuesta a los usuarios. Se comprobó la separación de filas simulando dos identidades distintas y se ejecutaron los asesores de Supabase.

## Puesta en servicio pendiente

Se configuró SMTP personalizado en Supabase con Resend (`smtp.resend.com:465`, remitente `no-reply@secondbrainapp.com`). Se comprobó la autenticación SMTP sin enviar mensajes. Los cuatro registros de envío (DKIM, MX, SPF y CNAME) se guardaron en GoDaddy y se comprobaron tanto en los servidores autoritativos como en los resolutores públicos. **Resend marcó el dominio y los cuatro registros como verificados.** Supabase generó correctamente un enlace de recuperación para una cuenta migrada y respetó el `redirectTo` local indicado. Aún no se ha probado la entrega real de un correo de recuperación; no se enviaron correos durante la migración. El proveedor de Google ya funciona.

La URL principal de Supabase Auth sigue siendo `http://localhost:3000` hasta que la aplicación esté publicada en un dominio operativo. La app envía un `redirectTo` explícito basado en el origen actual para la recuperación de contraseña; aun así, las dos cuentas con contraseña necesitan un entorno público accesible para usar este flujo fuera del equipo de desarrollo.

### DNS de envío configurado

| Tipo | Nombre | Valor | Prioridad |
| --- | --- | --- | ---: |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCrX+ydTiRDkNKFP/6ekZgQBiAZ9YdUJAFWLQdoD1Dfc5qHJ6vmcB4opUeEq6u4C21gK4tzK9fE90I6zXN+0aN9/4CloI5PTtu2Rnv2xTC+GyWQuY6Db8p/7zvx//wTtC0sKgbguoov3kQ9J7Kb4cTnxUq1vRQNs6Tqay5sXCEOQwIDAQAB` | — |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend` | `send.forge.rmta.net` | — |

Estos registros usan el subdominio de envío `send` y no modifican los MX del correo principal del dominio.

En Vercel se creó el despliegue **Preview** protegido `https://secondbrain-m43lcavkx-josericoks-projects.vercel.app`, con variables de entorno propias de Preview. Su compilación y las respuestas HTTP de `/login` (200) y una ruta privada sin sesión (401) se comprobaron. El endpoint de feedback sin sesión también devolvió 401. Se configuraron en Production las variables de Supabase, OpenAI y Resend, pero **no se publicó Production**: `app.secondbrainapp.com` no estaba asignado al proyecto y las claves locales de Stripe son de prueba. Vercel rechazó asignar el dominio mientras el último despliegue de Production siga en estado `ERROR`. Se deben configurar credenciales de pago reales y probar el flujo de cobro antes de publicar la app de pago.
