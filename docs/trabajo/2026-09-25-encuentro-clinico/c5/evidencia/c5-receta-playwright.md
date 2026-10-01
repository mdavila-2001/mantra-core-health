# `clinica-c5-receta.spec.ts` — corrida real, 2026-09-25 (pase consolidado de C7)

Comando: `E2E_BASE_URL=http://localhost:4215 npx playwright test playwright/clinica-c5-receta.spec.ts`
(`ng serve --port 4215` levantado aparte, sin Postgres/API — `mockup` corre contra el interceptor).

## Bugs propios corregidos, en el orden en que aparecieron

1. **404 de ruta.** `/clinical-record/consultation` no existe; la ruta real es
   `/medical-records/:profileId/consultation`. Corregido: buscar el paciente desde «Archivo
   clínico» y entrar por «Ver expediente», igual que `consulta-rejilla.spec.ts`.
2. **`selectOption` sobre el host, no el nativo.** `<app-select data-testid="receta-diagnostico">`
   y `<app-textarea data-testid="receta-motivo">` son componentes propios; el `<select>`/`<textarea>`
   real vive adentro (`select.html:19`). Corregido con `.locator('select')`/`.locator('textarea')`.
3. **Violación de modo estricto en «Prescribir».** La casilla de la rejilla también se llama
   «Prescribir medicación», así que `getByRole('button', {name:'Prescribir'})` sin acotar resuelve a
   dos elementos. Corregido acotando a `getByTestId('content-dialog')`.
4. **Medicamento nunca elegido.** `puedeRecetar` exige `medicamento() !== null`; el spec original no
   tocaba el buscador (`app-reference-combobox`). Agregado un helper que escribe un carácter y elige
   la primera opción (con texto vacío el catálogo se ofrece entero).
5. **Dos diálogos no manejados:**
   - El motor de decisión clínica puede avisar una interacción (`Se detectó una interacción` →
     «Prescribir de todas formas»). Agregado `seguirPeseAInteraccion()`.
   - Tras un alta, el bloque ofrece adjuntar archivos a esa receta (`recetaRecienCreada`). Agregado
     `cerrarOfertaDeAdjuntos()` (`Listo, sin adjuntar`).

## Lo que sigue en rojo, y por qué (causa raíz encontrada, no arreglada)

Con los cinco bugs de arriba corregidos, el test llega hasta el final del flujo de alta (elige
diagnóstico o motivo, medicamento, resuelve la interacción, cierra la oferta de adjuntos) pero la
fila de la receta recién creada queda así, **incluso después de recargar la página** (evidencia:
`borrador-sin-firmar.png`):

```
Borrador
Activo
```

en vez de:

```
Diagnóstico: <etiqueta>
```
o
```
Motivo: Control de síntomas
```

**Causa:** el propio JSDoc de `recetar()` en `medication-block.ts` dice: *"Prescribe la medicación
(UC-08-10) — la receta queda en **borrador**."* El badge de vínculo (Diagnóstico:/Motivo:) que el
spec busca corresponde a una receta ya **firmada/emitida**, no a un borrador — el mismo bloque
muestra un `app-alert` "Falta la firma" para las que están en ese estado. El recorrido original del
prompt (§6) nunca menciona un paso de firma, y ni la versión original del spec ni mi reescritura lo
incluyen.

Como la persistencia se confirmó con un `page.reload()` real (no es un estado transitorio del
cliente: sobrevive la recarga), esto **no es un bug de UI que se cierre solo** — o el criterio de
aceptación de C5 nunca esperaba ver el badge sin firmar (y el spec está mal escrito, hay que agregar
el paso de firma), o hay algo más que investigar en el estado `Borrador`/`Activo` que no se cubrió
esta noche.

## Pendiente

- Localizar el testid/acción de «Firmar» en `medication-block.html` y agregarla al recorrido antes
  de la aserción del badge.
- Confirmar con quien diseñó el prompt C5 si el criterio de aceptación original esperaba una receta
  firmada o si el badge debería mostrarse también en borrador (ambigüedad, no una decisión mía).
- Sólo después de eso, correr y hacer la doble revisión (regla 35) de las capturas.
