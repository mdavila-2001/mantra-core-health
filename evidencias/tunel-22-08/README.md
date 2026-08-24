# Túnel de ALOVIDA — 22/08/2026 10:30 -04

Los cuatro `atlas-devtunnel@*` estaban en `activating (auto-restart)`, contador 91.
En `atlas-alovida.host.log`: **`Login token expired.`** — la sesión de GitHub caducada,
el caso de [[devtunnel-sesion-caduca-login-con-navegador]].

Arreglo, una orden (sandbox off: escribe en `~/.local/share/DevTunnels/`):

    DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-0 \
      devtunnel user login -g -b     # -> Logged in as PabloArauzCaballero using GitHub.

Las cuatro unidades reengancharon solas, sin reiniciarlas a mano.

## Comprobaciones

| qué | resultado |
|---|---|
| `atlas-devtunnel@{admin,alovida,decision,erp}` | los cuatro `active running` |
| front local `127.0.0.1:4200` | 200 |
| mismo con `Host: 2ptbhqtv-4200.brs.devtunnels.ms` | 200 (no hay 421 de nginx) |
| borde con token `connect` | 200 |
| `devtunnel show atlas-alovida` | `Host connections: 1`, ACL `+GitHub Org (mantra-core-technologies)` |

- `01-front-local-4200.png` — la pantalla de login de AloVida renderizada.
- `02-borde-tunel-pide-github.png` — el borde vivo, entregando a GitHub por la ACL de la org.
