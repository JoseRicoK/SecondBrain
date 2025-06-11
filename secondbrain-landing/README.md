# SecondBrain Landing Page

Landing page moderno y atractivo para SecondBrain - Tu diario personal inteligente.

## 🚀 Características

### Diseño Moderno
- **Glassmorphism** - Efectos de cristal con backdrop-blur
- **Gradientes dinámicos** - Colores vibrantes y profesionales
- **Animaciones fluidas** - Powered by Framer Motion
- **Responsive design** - Optimizado para móvil, tablet y desktop

### Componentes Interactivos
- **Hero Section** - Presentación impactante con CTAs
- **Animated Features** - Funcionalidades en círculo interactivo
- **Stats Section** - Estadísticas animadas
- **Testimonials Carousel** - Carrusel de testimonios automático
- **Pricing Section** - Planes con diseño atractivo
- **FAQ Section** - Preguntas frecuentes colapsables
- **CTA Section** - Llamada a acción con formulario
- **Animated Background** - Partículas flotantes

### Funcionalidades
- ✨ **Scroll suave** entre secciones
- 🎭 **Animaciones on-scroll** con Framer Motion
- 📱 **Navegación responsive** con menú móvil
- 🎨 **Efectos hover** interactivos
- 🌟 **Elementos flotantes** animados
- 📧 **Formulario de contacto** funcional

## 🛠️ Tecnologías

- **Next.js 15** - Framework React moderno
- **TypeScript** - Tipado estático
- **Tailwind CSS 4** - Estilos utility-first
- **Framer Motion** - Animaciones avanzadas
- **Lucide React** - Iconos modernos

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── globals.css          # Estilos globales y animaciones
│   ├── layout.tsx           # Layout principal con metadatos SEO
│   └── page.tsx             # Página principal
└── components/
    ├── AnimatedBackground.tsx    # Partículas animadas de fondo
    ├── AnimatedFeatures.tsx      # Funcionalidades en círculo
    ├── CtaSection.tsx           # Sección de llamada a acción
    ├── FAQSection.tsx           # Preguntas frecuentes
    ├── PricingSection.tsx       # Planes y precios
    ├── StatsSection.tsx         # Estadísticas animadas
    └── TestimonialsCarousel.tsx # Carrusel de testimonios
```

## 🎨 Guía de Diseño

### Colores Principales
- **Purple**: `#8b5cf6` - Color principal
- **Pink**: `#ec4899` - Color secundario
- **Blue**: `#06b6d4` - Acento
- **Green**: `#10b981` - Éxito
- **Orange**: `#f59e0b` - Advertencia

### Tipografía
- **Font Family**: Inter (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700, 800

### Efectos
- **Glass**: `backdrop-blur(10px)` + transparencia
- **Gradients**: Lineales en 135deg
- **Shadows**: Múltiples capas con colores temáticos
- **Animations**: Suaves con easing personalizado

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Producción
npm start

# Linting
npm run lint
```

## 📝 Configuración SEO

El proyecto incluye metadatos optimizados para SEO:

- **Title**: SecondBrain - Tu Diario Personal Inteligente
- **Description**: Optimizada para conversión
- **Keywords**: IA, diario personal, chat, transcripción
- **Open Graph**: Configurado para redes sociales
- **Twitter Cards**: Optimizado para Twitter
- **Robots**: Indexación habilitada

## 🔗 Enlaces Importantes

- **App Principal**: `https://app.secondbrain.com`
- **Signup**: `https://app.secondbrain.com/signup`
- **Support**: `support@secondbrain.com`

## 📱 Responsive Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px  
- **Desktop**: > 1024px

## 🎯 Conversión Optimizada

- **Multiple CTAs** estratégicamente ubicados
- **Social proof** con estadísticas y testimonios
- **Trust indicators** (seguridad, gratuito, usuarios)
- **Clear value proposition** en cada sección
- **Urgency elements** sutiles

## 🔧 Personalización

Para personalizar colores, edita las variables en `globals.css`:

```css
:root {
  --primary: #8b5cf6;
  --secondary: #ec4899;
  --accent: #06b6d4;
}
```

Para modificar animaciones, ajusta las duraciones en los componentes:

```tsx
transition={{ duration: 0.8, delay: 0.2 }}
```

## 🎪 Casos de Uso

1. **Landing principal** para adquisición de usuarios
2. **Página de referencia** para marketing
3. **Demo showcase** para inversores
4. **Base template** para otros productos

## 🔮 Futuras Mejoras

- [ ] Integración con analytics
- [ ] A/B testing components  
- [ ] Modo oscuro/claro
- [ ] Internacionalización (i18n)
- [ ] Video backgrounds
- [ ] Formularios avanzados
- [ ] Chat en vivo
- [ ] Blog integration

---

**SecondBrain Landing** - Diseñado para convertir visitantes en usuarios felices. 🧠✨
