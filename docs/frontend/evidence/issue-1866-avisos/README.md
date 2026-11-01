# Un aviso por origen (mdavila-2001/mantra-core-health#1866, 01/11/2026)

Capturas de `playwright/issue-1866-avisos.mjs`, contra `ng serve` (`real-api`), la API local con
C9-3 y el simulador de `mock-provider-server/`, en la pestaña Integración del catálogo de farmacia
(«Farmacia Central C93»). El script guarda el sistema de la farmacia y **enseguida** lo quita,
mientras el aviso de «guardado» sigue en pantalla, y cuenta los avisos con los milisegundos desde
que apareció el de «guardado» (`avisos.txt`). Se cuenta también **antes de confirmar**, para que no
quede duda de que el de «guardado» seguía vivo, y aparte los que están **saliendo** (un aviso
reemplazado se va con su animación de salida de 140 ms, `--pulse-dur-exit`, y mientras tanto
sigue en el DOM). 1440×900 en claro y 390×844 en oscuro (`mantra-core-health.theme`). Esto es
evidencia, no aprobación.

```
[1440] después de guardar: 1 aviso(s) ["El sistema de la farmacia respondió y quedó guardado."]
[1440] antes de confirmar «Quitar» (+196 ms): 1 aviso(s) ["El sistema de la farmacia respondió y quedó guardado."]
[1440] después de quitar (+372 ms; el de éxito dura 5000): 1 aviso(s) ["Quitó el sistema de la farmacia."] · saliendo ["El sistema de la farmacia respondió y quedó guardado."]
[1440] terminada la salida (+977 ms): 1 aviso(s) ["Quitó el sistema de la farmacia."]
[390] después de guardar: 1 aviso(s) ["El sistema de la farmacia respondió y quedó guardado."]
[390] antes de confirmar «Quitar» (+234 ms): 1 aviso(s) ["El sistema de la farmacia respondió y quedó guardado."]
[390] después de quitar (+1265 ms; el de éxito dura 5000): 1 aviso(s) ["Quitó el sistema de la farmacia."] · saliendo ["El sistema de la farmacia respondió y quedó guardado."]
[390] terminada la salida (+1875 ms): 1 aviso(s) ["Quitó el sistema de la farmacia."]
```

Todo pasa antes de los 2 s (977 y 1875 ms): sin el reemplazo, el de «guardado» seguiría visible hasta los
5000 ms (`TOAST_DEFAULT_DURATION_MS.success`), al lado del de «Quitó». Antes de este cambio quedaban los dos apilados encima de «Guardar y probar» (primera vuelta de la
revisión de `docs/frontend/evidence/far-c9-sistema-de-la-farmacia/`, mdavila-2001/mantra-core-health#1867).

## Lo que no resuelve

- **La posición.** La pila sigue abajo a la derecha y un aviso todavía puede rozar la acción
  principal (`guardar-y-quitar-1440-light.jpg`, sobre «Guardar y probar»), aunque ahora es uno solo
  y se cierra a los 5 s. Se probó llevarla arriba en el teléfono y se descartó: suponía un
  encabezado de 56px (`--h-header`), pero el público mide 165px a 390 y el aviso tapaba
  «Emergencia», «Entrar» y el buscador. Queda en el issue, con lo medido.
- **Otras pantallas**: el reemplazo es opcional (`ToastInput.key`); solo «Sistema de la farmacia» lo
  usa por ahora.
