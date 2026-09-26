# Guardián de Playwright

Ejecutar los recorridos del simulador mediante `scripts/pw-guard.mjs`, desde la raíz
del frontend. Requiere Node compatible con el proyecto, Corepack y las dependencias
ya instaladas. Usa únicamente módulos estándar de Node; no instala paquetes.

```powershell
node scripts/pw-guard.mjs --self-test
node scripts/pw-guard.mjs --port 4210 --spec playwright/consulta-rejilla.spec.ts
node scripts/pw-guard.mjs --port 4210 --serve --spec playwright/consulta-rejilla.spec.ts --spec playwright/otro.spec.ts
```

Ejecutar el guardián en background cuando la herramienta de sesión tenga un límite
menor que la duración del recorrido, y conservar la notificación de salida.

## Opciones y ejecución

| Opción | Valor predeterminado | Comportamiento |
|---|---|---|
| `--port` | Obligatorio, salvo self-test | Puerto propio entre 1 y 65535. C0 usa 4210. |
| `--spec` | Suite completa | Repetible; filtros de archivos aceptados por Playwright. |
| `--attempts` | `3` | Presupuesto de intentos por infraestructura o cuelgue. |
| `--stall` | `120` segundos | Tiempo máximo sin una línea completa en stdout o stderr. |
| `--deadline` | `25` minutos | Tope global, incluyendo salud, arranque y reintentos. |
| `--serve` | Desactivado | Si el puerto no responde, inicia `corepack yarn dev --port <port>`. |
| `--retry-failures` | Desactivado | Una repetición extra de aserciones; declararla en el daily. |
| `--self-test` | Desactivado | Tres escenarios con procesos Node reales; no necesita servidor. |

Antes de cada intento exige HTTP 200 de `http://localhost:<port>/`, durante hasta
180 segundos, con consultas cada 5 segundos y timeout de 5 segundos por petición.
El tope global también interrumpe las consultas. `--serve` conserva el log en
`artifacts/pw-guard/serve-<port>.log`; nunca reemplaza un servidor que ya responde.
Se usa `dev` porque `start` ejecuta el SSR compilado y no acepta el puerto de Angular.

El hijo ejecuta:

```text
corepack yarn playwright test <specs> --workers=1 --reporter=list --timeout=90000
```

Recibe `E2E_BASE_URL=http://localhost:<port>` y salida de reporter sin terminal
interactiva. El launcher de Corepack se ejecuta con Node, sin shell ni interpolación
de argumentos. En Windows los procesos y `taskkill` se crean ocultos.

## Cuelgues, infraestructura y fallos

Se espejan ambas salidas a consola y al log del intento. El detector reconoce el
reporter Unicode (`✓`, `✘`) y ASCII (`ok`, `x`), códigos ANSI, líneas partidas entre
chunks y la última línea sin salto. El silencio durante `--stall` mata el árbol
propio y registra `STALL`. Si ya hay una aserción o un error determinista, conserva
ese fallo; en otro caso consume un intento antes de relanzar.

Se reintentan conexiones rechazadas y timeouts explícitos de `browserType.launch`.
`Target closed` solo se considera infraestructura antes de cualquier resultado.
Un timeout de `page.goto` por sí solo no demuestra infraestructura: el reporter
no identifica la primera navegación interna del test. Aunque sea el primer ordinal,
se conserva como fallo sin reintento, salvo evidencia concreta de conexión rechazada.
Las aserciones tienen prioridad sobre las señales de infraestructura.

Un error de aserción termina con 1, salvo la repetición explícita solicitada. Los
errores deterministas de configuración, sintaxis, módulos o ausencia de tests
terminan con 1 incluso con `--retry-failures`. Una salida distinta de cero sin
resultados **no basta** para atribuir el fallo a infraestructura: sin evidencia
concreta no se reintenta. Los intentos anteriores permanecen en el JSON aunque una
repetición termine verde.

La limpieza usa `taskkill /PID <pid> /T /F` en Windows y el grupo de procesos propio
en POSIX. En Windows un helper PowerShell oculto asigna cada launcher a un Job Object
nativo antes de reanudarlo; `KILL_ON_JOB_CLOSE` elimina descendientes aunque su padre
ya haya terminado. Su preparación PowerShell/Add-Type tiene hasta 30 segundos y está limitada por el deadline global; `STALL` comienza al recibir la confirmación nativa de que el hijo arrancó. Esta separación evita contar los 3–4 segundos observados de compilación como un cuelgue del self-test `--stall 3`. El helper generado queda en `artifacts/pw-guard/windows-job.ps1`.
Si `taskkill` falla o agota su timeout, termina el handle del hijo propio para cerrar
el Job Object. Si el cierre del hijo no se confirma, devuelve 125 y no relanza otro
intento; `cleanupConfirmed` conserva ese resultado en el JSON.
No instala bibliotecas ni ejecuta argumentos en un shell. En POSIX limpia el grupo
también al salir el padre. Se aplica al cuelgue, deadline, interrupción y cierre;
incluye el servidor solo cuando lo inició este guardián. No busca ni mata procesos
por puerto o nombre. La API está contrastada con [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects), [CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw) y [STARTUPINFOW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/ns-processthreadsapi-startupinfow) de Microsoft; los tres handles estándar se hacen heredables explícitamente y el handle del job no se hereda.

## Salidas y evidencia

| Exit | Outcome | Significado |
|---|---|---|
| `0` | `PASSED` | Playwright terminó correctamente o pasaron los tres self-tests. |
| `1` | `FAILED` | Aserción, configuración, argumentos o fallo sin evidencia de infraestructura. |
| `124` | `DEADLINE` | Se agotó el tiempo global. |
| `125` | `UNAVAILABLE` / `INTERRUPTED` | Servidor caído, intentos de infraestructura agotados o señal de interrupción. |

Siempre imprime `RESUMEN: outcome=… intentos=… duracion=…` y escribe
`artifacts/pw-guard/last-run.json`, con `outcome`, `attempt`, `failedTests`, detalle de
cada intento, duración y exit. Cada intento guarda su salida en
`<AAAAMMDD-HHmmss>-intento-N.log`. La carpeta ya está ignorada por `/artifacts/*`.
Un error de salud conserva los intentos anteriores y termina como `UNAVAILABLE` (125). Los logs y capturas deben contener exclusivamente datos sintéticos de prueba.

El self-test mantiene tres escenarios: (1) silencio, limpieza de padre/descendiente,
relanzamiento y limpieza cuando el padre sale primero; (2) éxito con Unicode/ASCII,
ANSI y chunks; (3) aserciones, fallo seguido de silencio sin reintento y error de
salud después de un intento sin perder el historial del JSON. También comprueba una sola repetición de aserciones aunque haya infraestructura entre ambas. La salida exigida es:

```text
pw-guard self-test: 3 PASS, 0 FAIL
```

En los specs nuevos: `test.setTimeout(90_000)`, esperas por selector o estado, login
con `playwright/support/sesion.ts` y modo serial cuando dependen de datos comunes.
No usar `waitForLoadState('networkidle')` ni elevar timeouts para ocultar fallos.
