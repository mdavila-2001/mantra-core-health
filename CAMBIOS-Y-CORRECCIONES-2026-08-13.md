# Cambios y correcciones — 13 de agosto de 2026

Dos frentes: que el contenedor del frontend deje de morirse sin avisar, y la
ficha de organización, que era una de las lecturas que faltaban.

---

## 1 · El contenedor del frontend se caía y se quedaba caído

### Qué pasaba

Dos veces la página dejó de cargar sin que nadie se enterara. El contenedor
quedaba `Exited (129)` —un SIGHUP, típico de que Docker Desktop se reinicie— y
ahí se quedaba. `docker inspect` lo explicaba entero:

```
RestartPolicy=no · MemLimit=0 · OOMKilled=false · ExitCode=129
```

Dos causas, las dos arreglables:

1. **Sin política de reinicio.** Si el proceso moría, moría para siempre.
2. **Sin techo de memoria.** `ng serve` en modo watch crece sin límite, y en una
   máquina de 16 GB el que muere primero no es él: es PostgreSQL, que se cayó y
   entró en recuperación con la demo a un día.

### Qué se hizo

En `docker-compose.yml`:

| Ajuste | Valor | Por qué |
| --- | --- | --- |
| `restart` | `unless-stopped` | Se levanta solo. `unless-stopped` y no `always` a propósito: si alguien lo para a mano para liberar memoria, tiene que quedarse parado. |
| `mem_limit` | `3g` | No protege al contenedor, protege **al resto**. Con techo, el que se queda sin aire es el que la gasta. |
| `NODE_OPTIONS` | `--max-old-space-size=2048` | El recolector empieza a trabajar antes de que el kernel mate el proceso. |
| `healthcheck` | petición real a `:4200` | Que el proceso exista no prueba nada: un `ng serve` sin memoria puede seguir vivo y no atender. |

### Cómo se comprobó

No de palabra — matando el proceso:

```
docker exec … kill -9 27        # el `ng serve`, que es el que crece
→ estado=running · reinicios=1  # volvió solo
```

Dos cosas que se aprendieron por el camino:

- **`kill -9 1` no sirve** para probar esto: el kernel ignora las señales
  fatales al PID 1 de un espacio de nombres cuando vienen de dentro.
- **`docker kill` desde fuera tampoco reinicia**: Docker lo trata como
  intención de la persona, no como caída. El modo de fallo real —el proceso
  que se muere por dentro— sí dispara la política, y es el que se probó.

Y una corrección sobre mi propio número: había puesto el heap en 2560 MB. Medido
en marcha, dentro del contenedor viven ~1,3 GB de `ng serve` + ~0,4 GB de
esbuild + ~0,14 GB del `yarn` que hace de PID 1. Con el heap en 2,5 GB la suma
pasaba de los 3 GB del techo y el kernel habría matado el contenedor: justo lo
que se quería evitar. Con 2048 MB el consumo real queda en **1,88 GB de 3 (62 %)**.

---

## 2 · La ficha de organización (V04-02·L, V04-06·L, V04-07·L)

Una de las lecturas que faltaban: el módulo tenía escrituras y ninguna pantalla
que dejara volver a mirar lo escrito. Ahora `/administration/organizations/:id`
muestra sucursales, plantilla y sub-organizaciones.

### Tres defectos encontrados al probarla

**a) El proxy no enrutaba `/tenants`.** Se había añadido el contexto a
`proxy.conf.docker.json`, pero ese fichero **viaja dentro de la imagen** y no
está montado (lo dice el propio `docker-compose.yml`). El cambio en el host no
llegaba al contenedor hasta reconstruir. Reconstruido.

**b) Mi comprobación daba verde en falso.** El script miraba solo el código de
estado, y cuando el proxy no reconoce una ruta el servidor de desarrollo
devuelve el `index.html` de la aplicación **con 200**. Las cuatro llamadas
«pasaban» sin haber tocado la API. Ahora el script exige además que la
respuesta sea JSON:

```js
// Un 200 no basta: si el proxy no reconoce la ruta, el servidor de desarrollo
// devuelve el index.html con 200 y la comprobación pasaría en falso.
const esHtml = texto.trimStart().startsWith('<');
const ok = esperado.includes(res.status) && !esHtml;
```

**c) La ficha de otra organización daba 403.** El interceptor manda siempre el
tenant **de la sesión**, así que al abrir la ficha de una organización distinta
de la activa la API respondía:

> `FORBIDDEN — La solicitud privilegiada declara tenants propietarios contradictorios`

Es decir: el tenant de la ruta contradecía el de la cabecera. Arreglado en dos
sitios:

- `auth.interceptor.ts` — si la petición **ya trae** `X-Tenant-Id`, se respeta y
  no se pisa con el de la sesión.
- `directory.client.ts` — las cinco lecturas de `/tenants/{id}/…` declaran de
  qué organización hablan.

Con prueba que lo fija: *«respeta el X-Tenant-Id que ya trae la petición»*.

### Verificación

Los seis endpoints, por el proxy y con sesión real, devolviendo JSON:

```
✔ listado de organizaciones      ✔ sucursales           ✔ sub-organizaciones
✔ ficha de la organización       ✔ plantilla            ✔ sucursales de una membresía
```

- `yarn test --include='**/auth.interceptor.spec.ts'` → **13/13**
- `yarn typecheck` → limpio
- `yarn lint` → **0 errores, 0 avisos**

De paso se quitaron dos `eslint-disable no-console` que habían quedado sueltos
en `side-nav` y no desactivaban nada.

---

## Lo que sigue pendiente

- **25 módulos siguen con escrituras y cero lecturas.** El siguiente grande es
  `procedures_perioperative` (38 entidades, 24 escrituras), que es lo que hace
  falta para enseñar los procedimientos.
- **Dos PR de la API esperan aprobación ajena** (no puedo aprobar los míos y
  `dev` exige una revisión): #57 (balance de comprobación) y #61 (lecturas de
  `clinical_ext` y `community`).
- 21 contenedores de trabajadores siguen parados a propósito, para no repetir
  la falta de memoria que tumbó PostgreSQL.
