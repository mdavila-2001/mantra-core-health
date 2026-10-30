# Evidencia — derivación por servicio concreto (consulta)

Pedido del cliente: «incluir derivación de servicios específicos de otro doctor
u organización médica específica, tipo tratamiento». Casilla «Derivar» de
`/medical-records/:profileId/consultation`.

- Fecha: 2026-10-28 · Rama: `claude/sleepy-bardeen-m8dn2i` (con `origin/dev` integrado)
- Modo: **maqueta** (`yarn start:demo`, `mockBackend: true`) · Chromium headless · cuenta `medica@alovida.mock`
- Persona: Ana Lucía Pérez Quiroga, **sintética** (fixture de la maqueta)
- Script: [`referral-evidence.cjs`](./referral-evidence.cjs) — `node referral-evidence.cjs http://localhost:4321 <salida>`
  (con `PW_CHROMIUM=<ruta>` si el Chromium instalado no es el que espera Playwright);
  no espera `networkidle`, espera selectores
- Resultado: [`run-log.json`](./run-log.json) — **16/16 aserciones**, 0 `pageerror`, 0 peticiones fallidas

## Qué demuestra

| Paso | Captura |
|---|---|
| La casilla «Derivar» en la rejilla, con su cifra (1440) | `consultation-grid-1440.png` |
| El modal: selector Profesional / Organización, Tratamiento por defecto, lista abajo | `referral-modal-1440.png` |
| Destino sin servicios → S3 con próxima acción | `referral-no-services-s3-1440.png` |
| Servicios del destino, con arancel | `referral-services-1440.png` |
| Formulario completo antes de enviar | `referral-form-filled-1440.png` |
| UI → petición → respuesta → relectura → UI: aviso y fila nueva «Solicitada» | `referral-after-submit-1440.png` |
| Recarga (F5): la casilla cuenta una más y la fila sigue | `referral-after-reload-1440.png` |
| 390 px: modal dentro del viewport, rótulos sin cortar, lista, rejilla | `referral-modal-390.png`, `referral-list-390.png`, `consultation-grid-390.png` |

## Lo que NO demuestra

- **API real.** La maqueta contesta dentro del interceptor: las peticiones no
  salen a la red (por eso `run-log.json → network` está vacío) y la
  persistencia es `sessionStorage` de la pestaña. Contra la API viva no se
  ejecutó.
- Sólo 1440 y 390. 768, 1024 y 1920 no se capturaron.
- Consola: 4 avisos — `NG0505` (hidratación pedida sin SSR en `demo`) y un
  `NG0955` (claves `Consulta` duplicadas). Ninguna plantilla de este cambio
  itera rótulos «Consulta»; no se comprobó contra `dev` sin el cambio.
