# Fuentes primarias y trazabilidad

**Fecha de consulta:** 18 de septiembre de 2026. Investigación basada en documentación oficial, autores originales de metodologías y especialistas que publican sus propios marcos. Se consultaron las páginas enlazadas; no se usan artículos de terceros como sustitutos de documentación técnica.

El paquete sintetiza conceptos y propone procedimientos propios; no reproduce manuales completos ni traducciones extensas. Las duraciones, escalas, fases, presupuestos sugeridos y rúbricas son decisiones del kit y no se atribuyen a estas fuentes.

## Registro

| ID | Fuente primaria | Aporte utilizado | Aplicación principal |
|---|---|---|---|
| S01 | [Apple — Meet Liquid Glass, WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/) | Material, respuesta y separación entre controles y contenido | Dirección visual |
| S02 | [Apple — Get to know the new design system, WWDC25](https://developer.apple.com/videos/play/wwdc2025/356/) | Jerarquía contextual y continuidad entre experiencias | Navegación y materiales |
| S03 | [Brad Frost — Atomic Design Methodology](https://atomicdesign.bradfrost.com/chapter-2/) | Cinco niveles y revisión entre partes y conjunto | Composición visual |
| S04 | [NN/g — 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | Marco de diagnóstico sobre estado, comprensión y recuperación | Auditoría |
| S05 | [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Mostrar complejidad en niveles apropiados | Reubicación de funciones |
| S06 | [Robert C. Martin — The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html) | Responsabilidad y razones de cambio | Contratos de módulos |
| S07 | [Robert C. Martin — The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) | Dirección de dependencias y protección de políticas | Separación de UI y transporte |
| S08 | [DTCG — Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/) | Formato publicado para intercambio de tokens | Tokens y herramientas |
| S09 | [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Norma de accesibilidad y alcance de conformidad | Objetivo AA |
| S10 | [WAI — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Interpretación de contraste de texto | Legibilidad |
| S11 | [WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Adaptación de contenido y excepciones bidimensionales | Responsive y zoom |
| S12 | [WAI — Focus Not Obscured Minimum](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Visibilidad del componente enfocado | Sticky, overlays y foco |
| S13 | [WAI — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Objetivos de puntero y excepciones | Controles |
| S14 | [WAI APG — Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Interacción de diálogos modales | Foco y teclado |
| S15 | [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) | Preferencia de movimiento en CSS | Movimiento reducido |
| S16 | [web.dev — Web Vitals](https://web.dev/articles/vitals) | Métricas, umbrales y percentil de campo | Rendimiento |
| S17 | [web.dev — High-performance CSS animations](https://web.dev/articles/animations-guide) | Relación entre animación y renderizado | Perfilado de efectos |
| S18 | [Playwright — Best Practices](https://playwright.dev/docs/best-practices) | Pruebas centradas en comportamiento observable | Automatización |
| S19 | [Playwright — Visual Comparisons](https://playwright.dev/docs/test-snapshots) | Comparación de capturas y condiciones reproducibles | Regresión visual |
| S20 | [Playwright — Accessibility Testing](https://playwright.dev/docs/accessibility-testing) | Integración de análisis y limitaciones | QA de accesibilidad |
| S21 | [Anthropic — Extend Claude with skills](https://code.claude.com/docs/en/skills) | Estructura y descubrimiento de skills de Claude Code | Adaptador Claude |
| S22 | [OpenAI — Build skills](https://learn.chatgpt.com/docs/build-skills) | Skills y ubicaciones locales de Codex | Adaptador Codex |
| S23 | [OpenAI — Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) | Instrucciones con alcance por proyecto/directorio | Continuidad de agentes |
| S24 | [Agent Skills — Specification](https://agentskills.io/specification) | Metadatos y estructura portable de skills | Validación del paquete |

## Distinción de autoridad

- WCAG 2.2 es la norma utilizada como objetivo de accesibilidad. Los documentos Understanding explican criterios; no sustituyen el texto normativo.
- APG ofrece patrones de interacción; aplicar un ejemplo de APG no prueba conformidad completa de una página.
- Las guías de Apple se refieren a su ecosistema. Las propuestas web del kit son adaptaciones y requieren pruebas propias.
- DTCG 2025.10 se presenta como especificación estable del grupo y no como una Recomendación W3C. El borrador de desarrollo no debe confundirse con esa publicación.
- Atomic Design y SOLID son modelos de diseño; no certificaciones ni mandatos sobre un árbol de carpetas concreto.
- Las rutas de skills y las APIs de herramientas pueden cambiar. Confirmarlas con la versión instalada al ejecutar el plan.

## Limitaciones de acceso documentadas

Las páginas HIG de [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) y [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) devolvieron contenido que requiere JavaScript en el acceso textual. Se incluyen como referencias complementarias; no se afirma haber extraído de ellas recomendaciones detalladas. Para la síntesis de Apple se utilizaron las transcripciones públicas de S01 y S02.

La investigación trata principios y prácticas aplicables a la petición. No inspeccionó una web del usuario, porque no se proporcionó una para este encargo. No se infieren versiones de su stack, componentes existentes ni resultados de rendimiento.

## Actualización al ejecutar

Antes de instalar herramientas o usar APIs, consultar documentación oficial de la versión elegida. Mantener separados los conceptos estables de la sintaxis dependiente de versión. Si una fuente cambia, registrar la nueva decisión en el proyecto sin reescribir silenciosamente la evidencia original.
