# Runbook 13 · El mockup no publica lo que ya está en la rama

**Síntoma.** El enlace del mockup
(`https://pablo-h310.taila8f993.ts.net:8443`) sigue sirviendo una versión vieja
aunque el commit lleve horas en `origin/mockup`. En la bitácora del
redespliegue, `BUILD: FALLÓ <sha>` y, cada dos minutos, la misma línea:

```text
FETCH: <sha> ya falló antes; esperando a que la rama avance
```

**Impacto.** Nadie ve el trabajo nuevo: ni el cliente ni el equipo. La
aplicación no está caída, así que **nadie se entera** hasta que alguien abre el
enlace y no reconoce lo que ve.
**Severidad.** S3. No es producción, pero bloquea la revisión.

> **Lo primero que hay que saber:** el temporizador **no reintenta solo**.
> Cuando un commit falla, `mockup.sh` lo anota en `COMMIT_FALLIDO` y salta hasta
> que **la rama avance** con un commit nuevo. Es deliberado —evita reconstruir
> en bucle algo que no compila— y explica por qué esperar no arregla nada.

---

## Diagnóstico

Todos los pasos son de solo lectura.

### 1 · ¿Qué se está sirviendo y qué falló?

```bash
ssh atlas-db 'readlink /opt/alovida-mockup/publico/actual; \
  cat /opt/alovida-mockup/estado/COMMIT_DESPLEGADO; \
  cat /opt/alovida-mockup/estado/COMMIT_FALLIDO 2>/dev/null; \
  tail -3 /opt/alovida-mockup/estado/redeploy.log'
```

| Resultado | Siguiente |
|---|---|
| `COMMIT_DESPLEGADO` = punta de la rama | No es esto: el fallo está en el navegador o en la caché |
| `COMMIT_FALLIDO` con un sha | El build muere → paso 2 |
| `no se pudo hablar con origin` | Red o credencial de Git, no memoria |

### 2 · ¿Con qué murió el build?

```bash
ssh atlas-db 'n=$(grep -n "BUILD: FALLÓ" /opt/alovida-mockup/estado/redeploy.log | tail -1 | cut -d: -f1); \
  sed -n "$((n-20)),${n}p" /opt/alovida-mockup/estado/redeploy.log'
```

| Mensaje | Causa | Va a |
|---|---|---|
| `exceeded maximum budget` | Presupuesto de CSS o de paquete | [Pared 1](#pared-1--el-presupuesto) |
| `exit code: 137` | Algo lo **mató**: memoria o el guardián | paso 3 |
| `exit code: 129`, `esbuild … deadlock` | Memoria, aunque no lo diga | paso 3 |
| Error de compilación normal | Es el código: arreglarlo y empujar |

> **No fiarse del segundo que imprime buildkit.** La última línea que Angular
> alcanza a escribir (`3.684 ❯ Building...`) es cuándo **empezó** a compilar, no
> cuándo murió. Confundirlo lleva a descartar la memoria como causa. La hora
> real de la muerte está en la línea `BUILD: FALLÓ`.

### 3 · ¿Lo mató el guardián?

```bash
ssh atlas-db 'journalctl -t h310-guardian --no-pager -n 15'
```

| Línea | Qué significa |
|---|---|
| `matados N builds/ayudantes de build` | **Sí.** → [Pared 3](#pared-3--el-guardián) |
| `ALIVIO: … swap_libre=0%` | El disparo, justo antes de matar |
| `degradados N pasos de build (memory.high=…)` | Lo estranguló antes de matarlo |
| Sólo `latido:` | No fue él → [Pared 2](#pared-2--la-memoria-del-contenedor) |

### 4 · ¿Cómo está la máquina ahora?

```bash
ssh atlas-db 'free -h | head -3; \
  echo -n "enfriamiento hasta: "; date -d "@$(cat /run/h310-guardian/enfriamiento 2>/dev/null)" "+%H:%M:%S"; \
  cat /run/h310-guardian/ultimo'
```

**Con `swap_libre` en 20% o menos, cualquier intento está condenado**: es una de
las condiciones con las que el guardián dispara.

---

## Las tres paredes

### Pared 1 · El presupuesto

`anyComponentStyle` corta en error y **tumba el build entero**. Ha pasado dos
veces (24/08 y 13/09), las dos por un CSS de componente que creció importando
una hoja compartida; el mensaje culpa al archivo importado, no al que importa.

**Salida.** Subir **sólo el techo de error** en `angular.json` dejando el aviso
donde está, para que la deuda siga saliendo en cada build. Es lo que hicieron
`789565df` y `230b05f0`. Resolverla de verdad es sacar la hoja compartida de los
componentes que la importan.

### Pared 2 · La memoria del contenedor

`mockup.sh` construye con `docker build --memory` y `--memory-swap`. **Si los
dos valores son iguales, Docker le prohíbe el swap al contenedor**, y entonces
el límite deja de ser un techo y pasa a ser una sentencia. Por eso son dos
variables distintas (`MOCKUP_MEMORIA`, `MOCKUP_MEMORIA_SWAP`).

### Pared 3 · El guardián

`h310-guardian.service` vigila la presión de memoria y **mata compilaciones**
para que la máquina no se congele. No es un error: existe porque en septiembre
cuatro builds simultáneos dejaron el equipo 45 minutos inservible.

| Qué hace | Cuándo |
|---|---|
| Frena el build (`cpu.weight=20`, `memory.high` = RAM/4) | Presión moderada |
| **Mata** el build (`cgroup.kill`) | PSI ≥20% **y** `mem_disp` ≤10% **y** `swap_libre` ≤20% |
| Deja **600 s de enfriamiento** | Tras cada muerte: todo build nuevo muere al nacer |

Ese `memory.high` = RAM/4 (3.969 MB en la H310) es el **límite real**: da igual
lo que diga `--memory`. Umbrales en `/etc/default/h310-guardian`.

---

## Mitigación

El orden importa. Empujar antes de tiempo quema el intento, porque **el push es
lo que dispara el build**.

1. **Esperar el enfriamiento** y que `swap_libre` pase del 20% (paso 4).
2. **Bajar el pico** para caber bajo `memory.high`, en vez de pedirle a la
   máquina memoria que no tiene:

   | Ajuste | Dónde | Por qué |
   |---|---|---|
   | `NG_BUILD_MAX_WORKERS=1` | `Dockerfile` | Cada trabajador es un proceso con su propio montón: es lo que más baja el pico |
   | `--max-old-space-size=1536` | `Dockerfile` | El recolector entra antes de que lo maten |
   | `MOCKUP_MEMORIA=4g` + `MOCKUP_MEMORIA_SWAP=8g` | `mockup.sh` | Techo por debajo de lo disponible, con swap para desbordar |

3. **Empujar a `mockup`.** La rama avanza, se borra el salto de
   `COMMIT_FALLIDO` y el servidor se actualiza solo: `mockup.sh` hace
   `git reset --hard origin/mockup` **antes** de construir, así que un arreglo
   al propio script viaja en el mismo commit.
4. **Verificar de verdad.** La pantalla nueva suele vivir en un fragmento de
   carga diferida, así que **buscarla sólo en los `.js` que referencia
   `index.csr.html` da un falso negativo**:

   ```bash
   ssh atlas-db 'grep -rl "<marca-de-la-pantalla>" /opt/alovida-mockup/publico/actual/*.js'
   E2E_BASE_URL=https://pablo-h310.taila8f993.ts.net:8443 yarn playwright test <spec>
   ```

## Reversión

Se guardan las tres últimas entregas, así que volver atrás es mover el enlace:

```bash
ssh atlas-db 'cd /opt/alovida-mockup/publico && ls entregas/ && \
  ln -sfn entregas/<sha-anterior> .actual.nuevo && mv -T .actual.nuevo actual && readlink actual'
```

El cambio es atómico y nginx resuelve `actual` en cada petición: no hay que
reiniciar nada.

## Si el build no cabe de ninguna manera

Queda publicar un artefacto compilado fuera de la máquina, por la misma vía que
usa el script — comprobándolo **antes** de mover el enlace:

```bash
yarn build                                   # en una máquina con memoria
tar -czf entrega.tgz -C dist/mantra-core-health/browser .
scp entrega.tgz atlas-db:/tmp/
# extraer en publico/entregas/<sha>/, verificar index.csr.html, y mover el enlace
```

Es una salida de emergencia: deja `COMMIT_DESPLEGADO` apuntando a un commit que
esa máquina nunca compiló. Anotarlo en el canal del equipo.

## Escalamiento

Si la H310 sostiene dos plataformas a la vez —hoy corren **dos** OpenSearch de
~1 GB, uno del `docker compose` de la API y otro de Coolify, ambos con
consumidores vivos— ningún ajuste del build arregla el fondo. Eso es una
decisión de capacidad, no de despliegue: hay que hablarlo antes de parar nada.
