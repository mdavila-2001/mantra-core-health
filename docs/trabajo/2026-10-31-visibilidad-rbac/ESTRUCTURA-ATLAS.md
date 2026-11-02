# Estructura objetivo (AtlasAdminPortal) para el portal admin

Fuente: `pabloarauzcaballero/atlasadminportal`, `src/shared/components/layout/` (app-shell, internal-shell/*, page-header).
El usuario rechazó el estado actual («desastroso»). Se pide rediseño integral, con antes/después por pantalla.

## Marco (un solo marco, nada anidado)
1. **Una sola barra lateral oscura** fija (≈268 px en ≥1024 px) con **grupos plegables** (Inicio, Sistemas, Procesos,
   Catálogo y metadatos, Linaje, Esquema de datos, Gobierno y acceso…). Ítem activo: fondo blanco 9 %, barra de acento
   de 2 px a la izquierda, icono en el color de acento. Las secciones del «Portal de inventario» son grupos DE ESA MISMA
   barra — nunca una segunda barra/tarjeta oscura dentro del contenido.
2. **Barra superior pegajosa** (64 px, borde inferior, vidrio): a la izquierda **migas de pan** + línea pequeña de
   ambiente; a la derecha buscador global (≥768 px), notificaciones, usuario. Las migas viven SOLO aquí.
3. **Lienzo**: `main` con relleno 12/16/24 px (móvil/tablet/escritorio), sin hueco arriba, sin tarjeta envolviendo
   toda la página. Contenido usa el ancho completo disponible (sin cortarse en el borde derecho).
4. **Móvil (<1024 px)**: sin barra lateral; barra inferior con 4–5 destinos + «Más» que abre el MISMO cajón lateral.
   Sin hamburguesa metida dentro de tarjetas.

## Página (orden fijo)
1. `SectionTabs` (pestañas-enlace entre pantallas hermanas de una sección, solo si hay ≥2).
2. **Explicación de la vista** colapsada en una línea («Qué muestra esta vista ▸»), desplegable. Las advertencias de
   honestidad («datos simulados», «los permisos finos no gobiernan endpoints») se conservan, redactadas para negocio
   (sin `@Roles(...)`, sin «PDP», sin jerga), en un aviso compacto de una o dos líneas.
3. **Cabecera de página SOBRE el lienzo** (no en tarjeta): icono del módulo en loseta suave 40 px, eyebrow en
   mayúsculas pequeñas, título en color de acento (20/24/30 px), descripción ≤ 3xl de ancho, acciones a la derecha
   (carril desplazable en móvil). UNA sola cabecera; nada de migas repetidas.
4. Fila de **KPIs** (tarjetas pequeñas) si la pantalla tiene métricas.
5. **UNA tarjeta con pestañas** (regla del cliente) que contiene: barra de filtros (buscador + selects + segmentado en una
   fila, se apilan en móvil) → tabla densa con cabecera pegajosa, estados vacío/error/carga dentro de la tarjeta →
   paginación. Detalle en panel lateral/cajón, no en página aparte salvo que ya exista ruta.

## Reglas del repo que siguen mandando
Tokens CSS (188), sin Tailwind, primitivas existentes (`shared/components/organisms/page-header`, etc.), estados M34
(`ViewState<T>`), sin romper rutas/guardas/autorización/`*appVisible`, tema claro y oscuro, 390/768/1440.
