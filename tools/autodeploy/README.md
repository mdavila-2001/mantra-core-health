# Autodeploy del VPS

El VPS de Contabo no se reconstruía solo. Esto lo arregla sin pedirle permisos
a nadie.

## Instalar

```bash
tools/autodeploy/instalar.sh
```

Una línea. A partir de ahí, cada tres minutos mira si `origin/mockup` avanzó y,
si avanzó, le pide a Coolify que reconstruya.

Para quitarlo: `tools/autodeploy/instalar.sh --quitar`.

## Por qué no es el webhook de GitHub, que sería lo normal

Coolify **ya tiene el autodeploy encendido** en `mockup-frontend`. Esa opción
sólo dice «si me avisan, reconstruyo», y nadie le avisa: la aplicación se
conecta por llave SSH, no por una GitHub App, así que no existe el webhook que
le contaría los push.

Crear ese webhook exige ser **administrador del repositorio**. Se midió: la
cuenta del equipo tiene `push: true` y `admin: false`. El ámbito
`admin:repo_hook` del token no alcanza — el permiso que falta es el de la
cuenta sobre el repositorio, no el del token.

Un GitHub Action tampoco servía: necesitaría un secreto del repositorio, que
también pide administrador, y encima el CI corre en runners propios del equipo
que suelen estar apagados.

Esto rodea las tres cosas. Lee la rama con `git ls-remote`, que no pide
credenciales sobre un repositorio público, y le habla a la API de Coolify, que
es exactamente lo que hace el botón Redeploy.

**Si algún día un administrador está a mano, el webhook sigue siendo mejor**
—es instantáneo y no depende de que esta máquina esté encendida—:

```
Payload URL:   http://173.249.39.237:8000/webhooks/source/github/events/manual
Content type:  application/json
Secret:        el «Webhook secret» de mockup-frontend, pestaña Webhooks en Coolify
Eventos:       sólo push
```

Con el webhook puesto, se quita esto y listo.

## Lo que hay que saber

**Depende de que esta máquina esté encendida.** Es la limitación real y no hay
forma de esquivarla desde acá: lo correcto sería que el vigilante viviera en el
propio VPS, pero el acceso por SSH está cerrado para esta sesión.

**No redespliega en vano.** Guarda el sha que desplegó y compara; con la rama
quieta sale en silencio y el coste de una pasada es un `git ls-remote`.

**Espera a que la rama se aquiete antes de desplegar.** Un despliegue reemplaza
el contenedor y tarda entre 8 y 17 minutos, con una ventana en la que el sitio
devuelve 502. El 26/09/2026, desplegando en el acto, `test` acumuló **ocho
despliegues de la API en un día** y se caía a ratos toda la jornada — eran los
«no available server» que reportó el propietario, no un fallo de la aplicación.
Ahora el sha queda como candidato y sólo se despliega si sigue siendo el mismo
`AUTODEPLOY_REPOSO` segundos después (15 min por defecto), así que una ráfaga de
merges se junta en un despliegue. `AUTODEPLOY_ESPERA_MAX` (45 min) es el tope:
en una rama con merges todo el día el reposo no llegaría nunca, y sin tope
«esperar a que se aquiete» se volvería «no desplegar más».

`--estado` dice si hay un candidato esperando y cuánto le falta. `--forzar`
despliega ya, sin esperar el reposo.

**Un despliegue fallido no se da por hecho.** Si Coolify no responde 200, el
sha **no** se anota, así que la pasada siguiente vuelve a intentarlo en vez de
creer que ya está.

**El token no viaja por la línea de órdenes**, donde lo vería cualquiera con
`ps`. Sale de `~/.config/alovida/coolify.env`, fuera del repositorio.

## Ver qué está pasando

```bash
tools/autodeploy/vps-autodeploy.sh --estado    # rama, desplegado y últimas líneas
tools/autodeploy/vps-autodeploy.sh --forzar    # redesplegar ya, sin esperar un commit
tail -f ~/.local/state/alovida-autodeploy/autodeploy.log
```

## Configuración

Todo por entorno, con estos valores por defecto:

| Variable | Por defecto |
|---|---|
| `AUTODEPLOY_RAMA` | `mockup` |
| `AUTODEPLOY_APP` | `miwmlirpzpz9p5hdvbx1urjo` (`mockup-frontend`) |
| `AUTODEPLOY_COOLIFY` | `http://173.249.39.237:8000` |
| `AUTODEPLOY_ENV` | `~/.config/alovida/coolify.env` |
| `AUTODEPLOY_REPOSO` | `900` (segundos de rama quieta antes de desplegar) |
| `AUTODEPLOY_ESPERA_MAX` | `2700` (tope: se despliega igual pasado este tiempo) |

## La rama `test`: dos apps

`vps-autodeploy-test.sh` es el envoltorio que vigila `origin/test` en los **dos**
repositorios y redespliega las dos apps, llamando al guion de arriba una vez por
app con su propio directorio de estado (`~/.local/state/alovida-autodeploy-test/
{front,api}`):

| App | uuid | Repositorio |
|---|---|---|
| `alovida-frontend` | `zslh6pytstjjgf5mexeopvkz` | `mantra-core-health` |
| `alovida-backend-central` | `33sxkfqwp1axlkrishtgildb` | `mantra-core-health-api` |

Lo instala `bo.alovida.autodeploy-test.plist`, con el mismo intervalo de 180 s
que el de `mockup`.
