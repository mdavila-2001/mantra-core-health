## Subtarea 2.5: validación E.164 de 8 dígitos para el WhatsApp de la aseguradora

Fuente: `REGISTRO DE PROCESOS POR MODULO.md:492` (Proceso 2 · ítem 5) = bóveda 6.2 · ítem 5 =
Subtarea 2.3 (`docs/tareas/subtarea-2.3-canales-contacto-aseguradora/`). Certificación y cierre de
brechas de la Tarea 2 sobre lo que la Subtarea 2.3 (PR #395) ya dejó en `dev`.

### Qué cambia

Único cambio de contrato: `UpdateCarrierContactChannelsDto.whatsappNumber` exigía mínimo 7 dígitos
después del `+` (`^\+[1-9]\d{6,14}$`); ahora exige 8 (`^\+[1-9]\d{7,14}$`), coherente con el parser
del front (`shared/utils/telephone/telephone.ts`, PR de front adjunto) y con CA-2.4 del pedido.
Ningún número boliviano se ve afectado (`+591` + 8 dígitos = 11 en total). Sin cambio de contrato
OpenAPI (el `@ApiProperty` no declara `pattern`).

### Evidencia

- `yarn test src/modules/insurance/dto/backbone.dto.spec.ts` → 23/23 PASS (+2 casos: 7 dígitos
  rechaza con 400 nombrando "E.164", 8 dígitos acepta).
- `yarn test src/modules/insurance` → 336/336 PASS.
- `yarn typecheck` → 0. `yarn lint src/modules/insurance` → 0.
- E2E contra Neon real (`playwright/carril-insurance-whatsapp.spec.ts -g "API"`, front): el mismo
  caso 7/8 dígitos verificado en runtime contra el contenedor reconstruido.

### No cubierto

- El endpoint no lleva `@Roles` (decisión ya tomada en la Subtarea 2.3, sin cambios acá).
- El resto del DTO (call center, correo) no cambia.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
