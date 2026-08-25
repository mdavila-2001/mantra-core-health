# Redespliegue y túneles

Qué prueba cada archivo de esta carpeta.

| Archivo | Qué prueba |
|---|---|
| `01-frontend-local-por-nginx.png` | El front servido por el nginx del redespliegue, en local. |
| `02-tunel-permanente.png` | El túnel hospedado con enlace fijo. |
| `03-con-el-host-del-tunel.png` | El front alcanzado a través del borde del túnel. |
| `04-relanzamiento-2026-08-22.png` | Estado completo tras el reinicio de la máquina del 21/08/2026 por la noche: sesión de `devtunnel` recuperada, las cuatro unidades `atlas-devtunnel@*` en `active running`, los cuatro bordes devolviendo 200 con el `<title>` real de cada app, los tres temporizadores de autodespliegue vivos, front `10503f6` y API `7e6a4a9e5376` (`/health` 200), 47 contenedores arriba. |
| `05-front-4200-tras-relanzar-2026-08-22.png` | El front de ALOVIDA en `:4200` después de ese relanzamiento — la pantalla de acceso renderiza. |
| `06-tuneles-y-autodeploy-2026-08-22.png` | Estado tras el barrido de ramas del 22/08/2026: los cuatro bordes en 200 con el `<title>` real de cada app, el `server_name` de nginx ya con el host del túnel, los tres temporizadores vivos, y la última pasada del front sin avisos. |

## Sobre el 302 del borde anónimo

Los cuatro túneles llevan la ACL `+GitHub Org [connect] (mantra-core-technologies)`: **no son
anónimos a propósito**. Un `curl` sin credencial devuelve 302 hacia GitHub, y eso es lo correcto,
no una caída. Para verificar de verdad que el borde llega al front local hay que pedir un token de
conexión:

```bash
tok=$(devtunnel token atlas-alovida --scopes connect | grep -oE 'ey[A-Za-z0-9._-]+' | head -1)
curl -sS -H "X-Tunnel-Authorization: tunnel $tok" https://2ptbhqtv-4200.brs.devtunnels.ms/
```

Es lo que hay detrás de la columna «borde 200» de `04-*`.

## Enlaces (no cambian: salen del identificador del túnel)

```
alovida    :4200   https://2ptbhqtv-4200.brs.devtunnels.ms
admin      :5273   https://n2vmpw58-5273.brs.devtunnels.ms
decision   :5173   https://fb1d5lxc-5173.brs.devtunnels.ms
erp        :3010   https://606hxpch-3010.brs.devtunnels.ms
```

## El 421 del enlace de ALOVIDA (22/08/2026)

Durante unos diez minutos el enlace devolvió **421** y el vigilante relanzaba el frontend cada dos
minutos sin arreglarlo. El aviso del script culpa a `SSR_ALLOWED_HOSTS`, pero esa variable estaba
bien: el 421 lo devolvía **nginx**. Su `server_name` se había generado en una pasada con
`estado/URL` vacío, y quedó como

```
server_name localhost 127.0.0.1 mantra-core-health.local localhost localhost;
```

—con `localhost` repetido donde iba el host del túnel—, así que toda petición con el `Host` del
enlace caía al bloque comodín que devuelve 421 a propósito. No se cura solo: el ciclo del vigilante
relanza el *front*, pero sólo regenera nginx cuando hay commit nuevo. Se arregla con:

```bash
cd mantra-core-health && tools/redeploy/redeploy.sh proxy
```

## 24/08/2026 — el relanzamiento que destrabó 65 commits

| Archivo | Qué prueba |
| --- | --- |
| `07-relanzado-a87afbb` | El frontend desplegado sirviendo, ya con la imagen `alovida-front:a87afbb` |
| `08-perfil-nuevo-en-el-despliegue` | Que el despliegue **lleva lo de hoy**: la ficha pública con portada y retrato montado, no la de anteayer |

Tres cosas se juntaron ese día, y ninguna gritaba:

1. **El enlace servía el PR #210 desde hacía 65 commits.** Siete despliegues
   seguidos fallaron por el presupuesto de bundle —el inicial pesa 1,05 MB
   contra un techo de 1 MB— y el redespliegue hizo lo correcto: conservar lo que
   servía y anotar el commit como fallido. El síntoma fue el silencio.
2. **La sesión de GitHub del túnel había caducado otra vez**, con las cuatro
   unidades en bucle. Se recupera con la orden de siempre —login por navegador
   en `DISPLAY=:0`— y las cuatro reenganchan solas.
3. **`SSR_ALLOWED_HOSTS` había quedado en `localhost,127.0.0.1`**, porque el
   redespliegue calcula los hosts desde `estado/URL` y ese archivo estaba vacío:
   el túnel estaba caído cuando corrió. El borde devolvía
   `Header "x-forwarded-host" ... is not allowed` — un 400, no el 421 de nginx de
   otras veces. Se arregla con `redeploy.sh web`, que relanza el frontend con la
   misma imagen y recalcula el entorno una vez el túnel ya tiene URL.

El orden importa: **primero el túnel, después el `web`**. Al revés, los hosts
vuelven a salir vacíos.
