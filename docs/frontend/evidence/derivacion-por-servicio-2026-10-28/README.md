# Evidencia — derivación por servicio concreto (consulta)

Pedido del cliente: «incluir derivación de servicios específicos de otro doctor
u organización médica específica, tipo tratamiento». Casilla «Derivar» de
`/medical-records/:profileId/consultation`.

- Fecha: 2026-10-28 · Rama: `claude/sleepy-bardeen-m8dn2i` (con `origin/dev` integrado)
- Modo: **maqueta** (`yarn start:demo`, `mockBackend: true`) · Chromium headless · cuenta `medica@alovida.mock`
- Persona: Ana Lucía Pérez Quiroga, **sintética** (fixture de la maqueta)
- Script: [`evidencia-derivacion.cjs`](./evidencia-derivacion.cjs) — `node evidencia-derivacion.cjs http://localhost:4321 <salida>`;
  no espera `networkidle`, espera selectores
- Resultado: [`registro.json`](./registro.json) — **16/16 aserciones**, 0 `pageerror`, 0 peticiones fallidas

## Qué demuestra

| Paso | Captura |
|---|---|
| La casilla «Derivar» en la rejilla, con su cifra (1440) | `consulta-rejilla-1440.png` |
| El modal: selector Profesional / Organización, Tratamiento por defecto, lista abajo | `derivacion-modal-1440.png` |
| Destino sin servicios → S3 con próxima acción | `derivacion-sin-servicios-s3-1440.png` |
| Servicios del destino, con arancel | `derivacion-servicios-1440.png` |
| Formulario completo antes de enviar | `derivacion-formulario-lleno-1440.png` |
| UI → petición → respuesta → relectura → UI: aviso y fila nueva «Solicitada» | `derivacion-tras-emitir-1440.png` |
| Recarga (F5): la casilla cuenta una más y la fila sigue | `derivacion-tras-recargar-1440.png` |
| 390 px: modal dentro del viewport, rótulos sin cortar, lista | `derivacion-modal-390.png`, `derivacion-lista-390.png`, `consulta-rejilla-390.png` |

## Lo que NO demuestra

- **API real.** La maqueta contesta dentro del interceptor: las peticiones no
  salen a la red (por eso `registro.json → red` está vacío) y la persistencia
  es `sessionStorage` de la pestaña. Contra la API viva no se ejecutó.
- Sólo 1440 y 390. 768, 1024 y 1920 no se capturaron.
- Consola: 4 avisos ajenos a este cambio — `NG0505` (hidratación pedida sin
  SSR en `demo`) y un `NG0955` (claves `Consulta` duplicadas). Ninguna
  plantilla de este cambio itera rótulos «Consulta»; no se comprobó contra
  `dev` sin el cambio.
