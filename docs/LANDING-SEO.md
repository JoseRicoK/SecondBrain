# Landing: contenido, SEO y registro

## Arquitectura

El contenido público se sirve como HTML desde componentes de servidor. La portada prioriza mockups, iconos, tarjetas visuales y copy breve; los textos largos se concentran en las tres guías. La cabecera y `ProductPreview` son las islas interactivas: el mockup permite explorar diario, voz, chat y gráficas con datos ficticios identificados, sin acceder a proveedores ni diarios reales. Su movimiento se puede pausar y respeta la preferencia de movimiento reducido. Las preguntas frecuentes usan `details/summary` nativos. No se oculta el texto inicial detrás de animaciones. La portada, páginas informativas y tres guías se generan estáticamente. Precios revalida cada 60 segundos el catálogo público de la app, con un máximo de tres segundos para la consulta; si falla, muestra límites de referencia y mantiene cerrado el checkout de pago.

`src/lib/site.ts` centraliza los dominios y metadatos. El dominio canónico es **https://www.lumadiary.com**, destino actual del redirect del dominio raíz. El registro gratuito va a **https://app.lumadiary.com/signup?plan=free**. Revisar esta relación si se cambian los dominios de Vercel.

`src/lib/content.ts` contiene las preguntas frecuentes y las guías. Las guías cubren intenciones distintas: diario personal con IA, diario de voz y cómo empezar un diario. Incluyen pasos prácticos, ejemplo/preguntas y enlaces hacia las demás guías, precios, privacidad y registro. No añadir artículos que repitan la misma información solo para crear URLs.

## Metadatos y descubrimiento

- Un H1 y título/descripción/canónica propios por página; Open Graph/Twitter apuntan a URLs absolutas.
- Sitemap de ocho páginas públicas y fecha editorial explícita; actualizar la fecha cuando se revise el contenido, no en cada petición.
- Robots permite los recursos `/_next/` para que buscadores puedan renderizar CSS y JavaScript. No publicar archivos estáticos de robots/sitemap que sustituyan las rutas de Next.
- Organization/WebSite globales, SoftwareApplication en páginas relevantes y Article/BreadcrumbList en cada guía. Solo publicar ofertas realmente contratables. No inventar reviews, estrellas, estadísticas ni fechas de vigencia.
- No se promete elegibilidad para resultados enriquecidos: Google exige contenido representativo y no garantiza su aparición. [Directrices oficiales](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

## Conversión y confianza

El primer CTA abre registro, sin tarjeta; el secundario explica el flujo. Una entrada ficticia está identificada como ejemplo. Funciones, planes, privacidad y FAQs describen el producto implementado, sin prometer precisión de IA, tratamiento médico, cifrado de extremo a extremo ni resultados personales.

Precios usa euros, cuotas del catálogo y disponibilidad del backend. Mientras el cobro está desactivado, Pro/Elite indican que no pueden contratarse y sus CTAs permiten empezar gratis. Cuando el backend verifique esquema y configuración y permita contratar, los enlaces preservan el plan elegido. Un catálogo desactualizado nunca autoriza un pago: el servidor vuelve a comprobarlo.

No se han añadido analytics de terceros, píxeles ni cookies de marketing. Para medir conversión tras aprobar un sistema de medición, distinguir CTA pulsado, registro iniciado y cuenta confirmada; no enviar texto del diario ni datos personales a eventos. El 5 de octubre de 2026 se publicó LumaDiary, se verificó la propiedad de dominio `lumadiary.com` en Search Console y se envió `https://www.lumadiary.com/sitemap.xml`. La primera lectura mostró un error de recuperación, aunque el sitemap público responde HTTP 200 con XML válido. El envío no demuestra procesamiento ni indexación: comprobar ambos en Search Console, junto con el cambio de dirección desde la propiedad anterior.

## Velocidad y verificación

La revisión anterior redujo First Load JS de 163 kB a 112 kB. La versión visual con demo interactiva indica 115 kB: unos 3 kB adicionales frente a la portada estática, manteniendo una reducción aproximada del 29% frente al punto inicial. Este dato es del informe de Next, no una puntuación Lighthouse ni una garantía de Core Web Vitals en producción. La portada y guías no cargan Framer Motion, carrusel ni contadores animados. Los componentes de testimonios/cifras sin respaldo se han retirado. La optimización debe conservar una experiencia visual y dinámica.

Comprobar móvil/escritorio, menú con Escape y retorno de foco, selección de plan por teclado, FAQ sin JavaScript, contraste/foco, zoom permitido, ausencia de overflow, canónicas y 404 de guías desconocidas. Ejecutar las suites y ambos builds; tras desplegar, medir las URLs reales en Search Console y herramientas de rendimiento con datos de campo.
