# Redespliegue continuo del frontend, detrás de un enlace fijo

Un solo script — [`redeploy.sh`](redeploy.sh) — que vigila `dev`, reconstruye la
imagen cuando entra un commit nuevo y lo sirve por un enlace que no cambia.

```
tools/redeploy/redeploy.sh start     # y ya está
tools/redeploy/redeploy.sh url       # https://2ptbhqtv-4200.brs.devtunnels.ms/
```

## El enlace

**https://2ptbhqtv-4200.brs.devtunnels.ms/**

Es el *dev tunnel* `atlas-alovida.brs`, el mismo que ya existía para este
proyecto. La URL la determina el identificador del túnel y el número de puerto
publicado (`2ptbhqtv` + `4200`), **no** el proceso que lo hospeda: se puede
matar el proceso, reiniciar la máquina o reconstruir todos los contenedores y el
enlace sigue siendo ese. Lo único que lo cambiaría es borrar el túnel o
publicarle otro puerto — y por eso `REDEPLOY_PUERTO` no se toca.

Es la diferencia con el supervisor anterior, que usaba un *quick tunnel* de
`trycloudflare`: aquel sorteaba un hostname nuevo en cada arranque del proceso,
así que conservarlo dependía de que el proceso no muriera nunca.

El acceso está restringido a la organización de GitHub `mantra-core-technologies`
(`Access control: +GitHub Org (mantra-core-technologies)`). Quien abra el enlace
se identifica primero; no es un enlace público. Para volverlo público haría falta
`devtunnel access create atlas-alovida.brs --anonymous`, que es una decisión de
seguridad, no de despliegue: el script no la toma solo.

## La forma

```
dev tunnel  →  127.0.0.1:4200  →  nginx (48 MB)  ┬─ /iam, /public, …  →  127.0.0.1:3000  (API del host)
                                                 └─ /                 →  127.0.0.1:4000  (SSR, contenedor)
```

`nginx` está por la misma razón que en producción: con `PUBLIC_API_BASE_URL`
vacía el navegador pide `/iam/...` **relativo**, y hace falta alguien que enrute
esos prefijos a la API. Su configuración se **genera** a partir de
[`deploy/nginx.conf`](../../deploy/nginx.conf) —la de producción— cambiándole
sólo los dos `upstream` y el `server_name`. Lo que se demuestra es lo que se
despliega; los prefijos no se mantienen por duplicado.

nginx corre **en la red del host**, y no es un detalle de comodidad: esta
máquina filtra el tráfico que entra desde los puentes de Docker. La API escucha
en `0.0.0.0:3010` y aun así un contenedor no la alcanza —ni por `172.17.0.1` ni
por la puerta de su propia red: da timeout—, mientras que desde el host
`127.0.0.1:3010` responde. Con nginx en la red del host la API queda a un
loopback de distancia y no hay que tocar ninguna regla del firewall.

Tanto nginx (`4200`) como el SSR (`4000`) escuchan **sólo en loopback**: el
único que tiene que alcanzarlos es el proceso del túnel, que corre en este mismo
host. Nada de esto queda expuesto a la red local.

## La memoria

Es la razón de que esto no use `ng serve`:

| | RAM en marcha |
|---|---|
| `docker-compose.yml` (desarrollo, `ng serve --poll`) | techo de **3 GB**, y los usa |
| este despliegue (SSR de producción + nginx) | **~250 MB** entre los dos |

Los contenedores llevan `--memory` **y** `--memory-swap` con el mismo valor: sin
lo segundo el contenedor se va a swap en vez de morir, y un proceso en swap no
se cae — se arrastra, y arrastra con él a la base de datos y a todo lo demás.
El heap de Node queda por debajo del techo del contenedor (512 MB contra 768 MB)
para que el recolector trabaje **antes** de que el kernel mate el proceso.

El precio: ya no hay recarga en caliente. Un cambio se ve cuando el script
reconstruye — unos minutos. Para un enlace de demostración es el precio
correcto, y es lo que permite tenerlo levantado sin ahogar la máquina.

El pico sí está en la construcción (el build de Angular pide ~2 GB durante unos
minutos), pero es transitorio y ocurre **mientras el contenedor anterior sigue
sirviendo**: una construcción fallida no deja el enlace caído, y si la nueva
imagen no llega a sana se vuelve sola a la anterior.

## Por qué esta rama

El despliegue corre sobre `pablo/redeploy-dev`, que es **`dev` más este único
commit de herramientas**. Cuando `dev` avanza, el script hace `git rebase
origin/dev`: la rama se reapoya sobre el `dev` nuevo y el commit de herramientas
queda arriba. Así lo que se sirve es siempre `dev` —estos archivos no tocan
`src/`— sin que el checkout tenga que estar en `dev` ni haga falta empujar nada.

Un `merge --ff-only` no serviría: con un commit propio de por medio, el
fast-forward es imposible.

## Órdenes

| | |
|---|---|
| `redeploy.sh once` | despliega el commit actual y sale |
| `redeploy.sh start` | deja el vigilante en segundo plano |
| `redeploy.sh stop` | baja vigilante, contenedores y túnel (el enlace vuelve intacto) |
| `redeploy.sh status` | rama, commit desplegado, enlace, contenedores y memoria real |
| `redeploy.sh url` | el enlace |
| `redeploy.sh proxy` | relanza sólo nginx con la configuración regenerada, sin reconstruir |
| `redeploy.sh logs [n]` | las últimas n líneas del diario |

Todo es configurable por entorno: `REDEPLOY_RAMA`, `REDEPLOY_TUNEL`,
`REDEPLOY_PUERTO`, `REDEPLOY_PUERTO_WEB`, `REDEPLOY_API_PUERTO`,
`REDEPLOY_INTERVALO`, `REDEPLOY_MEM_WEB`, `REDEPLOY_HEAP_WEB`,
`REDEPLOY_MEM_PROXY`.

El estado —diario, PIDs, la configuración generada de nginx, el commit
desplegado— vive en `estado/`, que no se versiona.

## Si algo va mal

- **El enlace da 502/503** — no hay nadie hospedando el túnel o el proxy está
  caído. El vigilante lo arregla en el siguiente ciclo; a mano, `start`.
- **La aplicación carga pero no autentica** — es lo que pasa hoy: **la API no
  está levantada**. El script lo comprueba en cada despliegue y lo deja escrito
  (`API: nada escucha en 127.0.0.1:3000`), y `status` lo muestra. Cuando la API
  esté arriba, si no es en el 3000:
  `REDEPLOY_API_PUERTO=<puerto> tools/redeploy/redeploy.sh proxy` — relanza sólo
  nginx, sin reconstruir nada y sin tocar el enlace.

  El puerto se comprueba y no se supone por una razón concreta: en esta máquina
  conviven varios proyectos, y el 3010 —donde esta API estuvo alguna vez— hoy lo
  ocupa un front de Next.js de ATLAS. Mandarle los prefijos clínicos a un
  desconocido es peor que no mandarlos a ningún lado.
- **Una comprobación local devuelve 421** — es correcto: el `default_server`
  rechaza los `Host` que no reconoce. Hay que pedirlo con el `Host` bueno:
  `curl -H 'Host: localhost' http://127.0.0.1:4200/auth`.
- **`dev` avanzó y no se desplegó** — casi siempre hay cambios sin guardar en el
  árbol: el script no rebasa encima de trabajo sin commitear. Lo dice el diario.
