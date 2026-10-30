# Marketing: skills instaladas y cómo usarlas

Las 52 skills de [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)
(licencia MIT, copia en [LICENSE-marketingskills.txt](LICENSE-marketingskills.txt)) están
instaladas en `.claude/skills/`, junto a las skills de ingeniería del repo.

- **Versión copiada:** commit `820ad2c` del repositorio de origen (2026-10-29; actualizada el 2026-10-30, antes `e85f3cb`). Copia sin
  modificar; para actualizar, volver a copiar `skills/*` desde el origen.
- **Contexto común:** [`.agents/product-marketing.md`](../../.agents/product-marketing.md).
  Todas las skills lo leen antes de preguntar. Contiene la plataforma y los cuatro módulos
  (Farmacia, Imagenología, Laboratorio, Organización médica). Lo no verificable en el repo
  está marcado **POR CONFIRMAR**: completarlo con el negocio antes de publicar nada.

## Qué skill usar para cada módulo

| Necesidad | Skill | Aplica a |
|---|---|---|
| Completar el contexto con datos reales | `product-marketing`, `customer-research` | los cuatro |
| Fichas públicas indexables (farmacia, laboratorio, clínica) | `seo-audit`, `schema`, `programmatic-seo`, `site-architecture` | Farmacia, Laboratorio, Org. médica |
| Textos de páginas y de captación de altas | `copywriting`, `copy-editing`, `cro`, `signup` | los cuatro |
| Mensajería a pacientes (pedido, orden, resultado) | `emails`, `sms` | Farmacia, Imagenología, Laboratorio |
| Promociones de farmacia | `offers`, `emails` | Farmacia |
| Captación B2B de centros y organizaciones | `prospecting`, `sales-enablement`, `cold-email` | Imagenología, Laboratorio, Org. médica |
| Medición | `analytics`, `conversion-tracking` | los cuatro |
| Planificación | `marketing-plan`, `content-strategy`, `launch` | los cuatro |

## Límites que no se negocian

1. **Sin invención**: cifras, testimonios, logos, precios y acreditaciones solo si tienen
   fuente. Las skills sugieren pruebas sociales y estadísticas: aquí no se fabrican.
2. **Sin datos de salud ni personales** en ejemplos, segmentaciones, eventos de analítica o
   capturas. `analytics` y `conversion-tracking` pueden proponer píxeles y eventos: en una
   plataforma de salud, ningún evento lleva diagnósticos, medicamentos, estudios ni
   identificadores de pacientes, y los píxeles de terceros requieren decisión legal previa.
3. **Sin promesas clínicas** y sin publicidad regulada (medicamentos con receta, promoción a
   profesionales) sin revisión humana. Marco regulatorio boliviano: POR CONFIRMAR.
4. **Estado real**: las altas de laboratorio e imagenología dejan hoy una *solicitud* (sin
   endpoint); las promociones de farmacia están apagadas en algunos entornos. El copy no
   promete lo que la pantalla no cumple.
5. **`ads`, `cold-email`, `sms`, `aso`, `influencer-marketing`** quedan instaladas pero
   inactivas por defecto: requieren presupuesto, consentimiento y revisión legal que hoy no
   están definidos.

## Pendiente de decisión humana

Precios y modelo comercial, competidores, segmentos objetivo, voz de marca de cara al
mercado (voseo vs. «usted»), responsable legal de publicidad de salud, política de analítica
y consentimiento.
