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
