# Plan — Registrar dependiente por CI, con aceptación de la relación

- Fecha: 2026-09-25 · Repo: mantra-core-health (front, rama `mockup`) · Rama: `claude/dependiente-relacion-existente`
- Resultado observable: en **Mi cuenta → Dependientes**, «Registrar dependiente» abre un modal que
  pide **sólo el CI**. Si hay una cuenta registrada con ese CI, a esa cuenta le llega una
  notificación para **aceptar la relación de dependencia**; al aceptarla, el titular ve a la persona
  en su lista de dependientes.
- Kill-test: escribir un CI de una cuenta existente y que no llegue ninguna notificación a esa cuenta,
  o que el modal siga pidiendo nombre, fecha o parentesco.

## Alcance

- IN: modal de alta (sólo CI), contrato cliente de solicitudes de vínculo, simulador (`core/mock`)
  con la solicitud, la notificación y la aceptación/rechazo, bandeja de solicitudes recibidas en la
  pantalla de Dependientes, ruta de la notificación.
- OUT: API real (no existe el endpoint; se simula en `mockup`, que corre con `mockBackend: true`),
  revocar un apoderamiento, cualquier otra pantalla.
- Ambigüedades registradas (a confirmar con quien pidió el cambio):
  1. **CI sin cuenta.** El pedido sólo describe el caso «ya existe». Se tomó la instrucción «lo demás
     quitar del formulario» al pie de la letra: si no hay cuenta, el modal lo dice y no ofrece alta
     manual. Registrar a alguien sin cuenta (un recién nacido) deja de ser posible desde esta
     pantalla hasta que se decida otra cosa.
  2. **Parentesco.** Al quitarse del formulario, el vínculo nace con parentesco «Otro/a».
  3. **Privacidad.** La respuesta no revela el nombre del dueño del CI (evita enumerar personas por
     documento); sólo confirma que se envió la solicitud.

## H1 — Alta de dependiente por CI con aceptación

**CA:** Dado un paciente titular, cuando registra un dependiente escribiendo el CI de una cuenta
existente, entonces esa cuenta recibe una notificación, la acepta desde Dependientes y el titular pasa
a ver a esa persona como dependiente.
**DoD:** `yarn typecheck` exit 0 · `ng test` dirigido a dependientes y simulador en verde.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.M1 | Tipos y métodos del cliente para solicitudes de vínculo | Existen `requestDependentLink`, `listIncomingDependentLinkRequests`, `accept…`, `reject…` | `yarn typecheck` → exit 0 | HECHO |
| H1.M2 | Simulador: crear solicitud (404 sin cuenta, 422 propio CI, 409 duplicada/ya vinculado) y notificar | La cuenta destinataria tiene una notificación nueva | spec del simulador en verde | HECHO |
| H1.M3 | Simulador: aceptar / rechazar | Aceptar crea el apoderamiento y avisa al titular | spec del simulador en verde | HECHO |
| H1.M4 | Modal sólo con CI | El modal no tiene más campo que el CI | spec de dependientes en verde | HECHO |
| H1.M5 | Bandeja de solicitudes recibidas en Dependientes + ruta de la notificación | Aceptar/Rechazar visibles y operativos | spec de dependientes en verde | HECHO |

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El endpoint no existe en la API real | Fuera de `mockup` la pantalla daría 404 | Declarado en el reporte como pendiente de backend |

### Agregado durante la ejecución

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.M6 | Cualquier paciente del padrón con cuenta entra al simulador con su CI | La cuenta destinataria puede entrar y aceptar | E2E `b1-dependientes` en verde | HECHO |
| H1.M7 | Persistir los apoderamientos del simulador en `sessionStorage` | El vínculo aceptado sobrevive al cambio de cuenta | E2E `b1-dependientes` en verde | HECHO |
| H1.M8 | Pasar los E2E `b1-dependientes` y `carril-insurance-portability` al flujo nuevo | Recorren pedir → aceptar → ver | Playwright en verde salvo el desborde previo de la cabecera | HECHO |
