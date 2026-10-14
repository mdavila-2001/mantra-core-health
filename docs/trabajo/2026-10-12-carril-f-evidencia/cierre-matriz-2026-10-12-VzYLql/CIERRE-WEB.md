# Cierre de verificación web — 2026-10-12

Evidencia capturada con el simulador local Angular y Chromium de Playwright. No
se usó API externa ni se modificaron datos persistidos.

## Resultados confirmados

- `mock-banner-responsive.spec.ts`: 3/3 pruebas previas para siete anchos de
  paciente, tema claro/oscuro en cabecera compacta de médica y fallback sin
  `ResizeObserver`.
- `consulta-rejilla.spec.ts`: 4/4 combinaciones de 390/1440 px × claro/oscuro
  para la rejilla de consulta, modales de formulario/órdenes/reconsulta y
  retorno del foco.
- El mismo spec: 4/4 combinaciones 390/1440 px × claro/oscuro verifican que el
  stock muestra el formulario `MedicalNoteBlock` activo.
- Reejecución focalizada tras añadir auditoría: 9/9 pruebas — consulta y sus
  tres modales con axe en 390/1440 px × claro/oscuro; stock con axe sobre el
  formulario embebido en los mismos cuatro contextos; y movimiento reducido
  con el toggle Demo funcional.
- La prueba detectó contraste insuficiente en el estado del formulario clínico;
  se cambió a `--text-secondary`, y la reejecución pasó en ambos temas.
- Al auditar el formulario embebido se omiten solo las reglas de documento
  completo (título, `main`, `h1` y landmark global): el iframe muestra un
  fragmento, mientras el host aporta el nombre accesible del marco. El resto
  de reglas axe sigue activo.
- Imágenes de rejilla, formularios y stock: `capturas/` junto a este archivo.
- `corepack yarn typecheck`, ESLint de los dos specs modificados, `yarn gates:diseno`
  y `git diff --check`: terminados con código 0.
- Build de producción Angular: terminado con código 0 el 13/10/2026 en
  `/private/tmp/alovida-web-final-20261013-verified` (77,452 s); no se escribió
  en `dist/` del worktree.

Comando de la reejecución focalizada (servidor propio en 4380):

```sh
E2E_BASE_URL=http://localhost:4380 \
ALOVIDA_EVIDENCE_DIR=docs/trabajo/2026-10-12-carril-f-evidencia/cierre-matriz-2026-10-12-VzYLql/capturas \
corepack yarn playwright test playwright/mock-banner-responsive.spec.ts playwright/consulta-rejilla.spec.ts \
  --grep 'rejilla y tres modales (390|1440) (light|dark)|stock registra Nota médica, órdenes y reconsulta (390|1440) (light|dark)|reduced motion' --workers=1
```

## Alcance pendiente de esta evidencia

axe se ejecutó sobre consulta, tres modales y el formulario embebido, no sobre
todas las rutas web. Esta comprobación tampoco sustituye las pruebas de lector
de pantalla ni la validación completa de los carriles restantes del plan.
