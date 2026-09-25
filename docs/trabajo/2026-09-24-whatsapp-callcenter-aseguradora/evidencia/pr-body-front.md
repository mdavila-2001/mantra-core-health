## Subtarea 2.5: certificación y cierre de brechas de WhatsApp/Call Center de aseguradora

Fuente: `REGISTRO DE PROCESOS POR MODULO.md:492` (Proceso 2 · ítem 5, "una opción para poder
llamar mediante Whatsapp directo a la compañía de seguro… y el usuario llamara desde su mismo
numero de whatsapp") = bóveda 6.2 · ítem 5. Certifica y endurece lo que la Subtarea 2.3 (PR #446)
ya dejó en `dev`, contra los CA-2.1…2.5 y el DoD de la Tarea 2.

### Qué cambia

- **`shared/utils/telephone/telephone.ts`**: `whatsappUrl` ahora rechaza (`null`) valores con
  letras o con menos de 8 dígitos (antes 7), y omite `?text=` con mensaje vacío (CA-2.4).
- **`insurance-contact-channels` (detalle de reclamo)**: testid del call center
  `btn-callcenter-claim` → `btn-call-center-phone` (CA-2.2); botones a `size="md"` (44 px en móvil,
  antes 32-40 con `size="sm"`, CA-2.5); el enlace de WhatsApp se activa también con Espacio
  (CA-2.1); `callCenterHref` ya no deja un `tel:` vacío si el valor guardado no tiene dígitos.
- **`patient-coverage-card` (tarjeta de `/my-account`)**: enlaces con `data-testid`
  (`btn-whatsapp-coverage`, `btn-call-center-coverage`), Espacio activa WhatsApp, `min-width: 44px`
  agregado junto al `min-height` ya existente.
- **Maqueta**: nuevo reclamo `CLM-2026-0185` (Caja Petrolera, sin canales, CA-2.3); la tarjeta de
  `/my-account` deja de usar un call center fijo (que era, sin marcarlo, el real de una aseguradora
  sembrada) y toma los canales ficticios de la aseguradora de cada paciente
  (`contactChannelsOfCarrier`, nuevo export de `insurance.handlers.ts`).
- **E2E**: `playwright/carril-contacto-aseguradora.spec.ts` renombrado a
  `carril-insurance-whatsapp.spec.ts` (lane-29) y reescrito con las tres superficies (detalle,
  tarjeta, API), popups reales de WhatsApp (clic/Enter/Espacio), PHI-guard y objetivos táctiles por
  ancho (390/768/1440).

### Evidencia

- Front: `yarn typecheck` → 0. Suites tocadas 3 archivos / 30 tests PASS (baseline 19); regresión
  de mock 26 archivos / 223 tests PASS.
- E2E: `playwright/carril-insurance-whatsapp.spec.ts --workers=1` → **12/12 PASS**, corrido contra
  `ng serve` real y el contenedor de la API reconstruido con el cambio del PR hermano.
- Doble revisión (regla 35.1): 5 capturas, 0 `RECHAZADA` (`evidencia/doble-revision.md`).
- Regresión del módulo: `carril-adjudicacion-clausulas.spec.ts` 5/6 (1 fallo preexistente y ajeno,
  403 vs 404 en un endpoint de cláusulas que este PR no toca); `carril-insurance-antifraud-duplicates.spec.ts`
  y `patient-coverage-copays.spec.ts` clasificados y documentados en el REPORTE.

### No cubierto

- Modo oscuro: no se capturó evidencia visual (cambio no toca colores; riesgo bajo, declarado).
- Correo de la aseguradora en la tarjeta de cobertura (exige tocar `declared-coverages-reader.ts`
  de la API): fuera de alcance de esta tarea.

Un bug real se encontró y corrigió por causa raíz durante el trabajo: `(keydown.space)` en Angular
tipa `$event` como `Event`, no `KeyboardEvent` — el handler se corrigió al patrón ya usado en el
repo (`body-map.ts:243`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
