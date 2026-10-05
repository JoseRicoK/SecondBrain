# SecondBrain landing

Web pública en español con Next.js 15, React 19 y Tailwind 4. El contenido principal es HTML generado en servidor y las guías son estáticas. La portada prioriza mockups y copy breve. La cabecera tiene un menú móvil interactivo, `ProductPreview` permite explorar cuatro vistas ficticias de la app y pausar su movimiento, y las FAQs usan controles nativos.

Desde la raíz del repositorio:

```sh
npm ci
npm run dev --workspace secondbrain-landing
npm run build --workspace secondbrain-landing
npm run test:all
```

El lockfile canónico está en la raíz; no crear otro en este workspace. Los builds comprueban copias de archivos con sufijo numérico.

- `src/app/page.tsx`: portada, funciones, ejemplo ficticio y CTAs de registro.
- `src/app/precios`: catálogo de planes y contratación disponible.
- `src/app/[slug]`: tres guías definidas en `src/lib/content.ts`.
- `src/lib/site.ts`: dominios, metadatos y serialización JSON-LD.
- `src/lib/plans.ts`: consulta validada del catálogo, caché y fallback con pago cerrado.
- `Header`, `Footer`, `CtaSection`, `FAQSection`, `PricingSection`: componentes activos compartidos.
- `ProductPreview` y `ProductArtwork`: demo visual de diario, voz, chat y gráficas; no acceden a diarios reales ni ejecutan operaciones de IA.
- `src/app/landing-visual.css`: estilos de los mockups, las tarjetas y los breakpoints. Movimiento reducido y pausa disponibles.

Leer las instrucciones portables en [la skill de landing](../.agents/skills/secondbrain-landing/SKILL.md), [contenido y SEO](../docs/LANDING-SEO.md) y [activación de pagos](../docs/PAYMENTS-ACTIVATION.md). La app privada está en el workspace `secondbrain` y tiene su propia versión de Next.
