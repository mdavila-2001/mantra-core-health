## Subtarea 2.5: certificación y cierre de brechas de WhatsApp/Call Center de aseguradora (mockup)

Porte a `mockup` del PR de `dev` (front). Mismos cambios funcionales: testid renombrado, botones a
44px en móvil, activación por Espacio, PHI-guard, y la tarjeta de `/my-account` deja de usar el
call center real de BISA sin marcarlo.

### Diferencia con el PR de `dev`

Un ajuste propio de esta rama: la pestaña de cobertura se llama `Seguros` en `mockup` (ya
separada de `Seguros y tutores` por `justin/perfil-seguro-tutor-separados`, mergeado antes de este
porte); el E2E portado se ajustó a ese nombre real.

### Evidencia

- `yarn typecheck` → 0.
- Specs tocados (telephone, contact-channels, coverage-card, mock handlers): 4 archivos / 35 tests PASS.
- E2E real contra `ng serve` (bloque de maqueta): ver evidencia adjunta.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
