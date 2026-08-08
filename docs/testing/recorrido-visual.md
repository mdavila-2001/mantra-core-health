# Recorrido visual

Una captura de **cada pantalla** y de **cada estado al que se llega accionando
algo**, reunidas en una sola página que se abre en el navegador.

```bash
yarn recorrido
```

Deja el reporte en `artifacts/recorrido/reporte.html` y las imágenes en una
carpeta por pantalla.

---

## Qué es y qué no es

No es regresión visual. La [regresión visual](visual-regression.md) compara
contra una base y **falla** cuando el aspecto cambió; esto no compara nada y no
falla nunca por lo que se ve. Son preguntas distintas:

| | Regresión visual | Recorrido |
| --- | --- | --- |
| Pregunta | ¿cambió algo sin querer? | ¿cómo se ve todo hoy? |
| Salida | verde o rojo | una galería |
| Necesita | capturas de referencia | nada |

Tampoco es la suite de extremo a extremo. `yarn e2e` comprueba que los journeys
funcionen; el recorrido entra a las mismas pantallas y **no afirma nada** sobre
ellas: sólo las fotografía.

Y no es el [recorrido con usuarios reales](recorrido-con-usuarios-reales.md).
Éste simula la red para que las capturas se puedan comparar entre corridas; aquél
no simula nada y sirve para lo contrario: descubrir qué se rompe con los permisos
y los datos de verdad. Escriben en carpetas distintas justamente para que una
galería no mezcle capturas de datos inventados con capturas de datos reales.

Sirve para lo que ninguna de las dos resuelve: mirar la aplicación entera sin
levantarla. Una revisión de diseño, un acta de avance, o responder «¿cómo quedó
la pantalla X después de tocar Y?» sin pedirle a nadie que lo reproduzca.

## Cómo encuentra «cada clic posible»

Escribir la lista a mano es escribir una lista que nace desactualizada: alguien
agrega un botón, nadie agrega su línea, y el reporte sigue diciendo que cubrió
todo.

`e2e/recorrido/support/explorador.ts` la lee del DOM **en cada corrida**:

1. entra a la ruta y captura el estado inicial;
2. enumera todo lo accionable que se ve;
3. acciona el primero que no haya accionado todavía —clic, texto, marcar,
   elegir, adjuntar, según lo que sea— y captura;
4. **vuelve a enumerar** y repite.

El paso 4 es el que importa. Enumerar una sola vez al principio perdería todo lo
que sólo existe **después** de un clic: los ítems de un menú desplegable, los
botones de un diálogo, el segundo paso de un formulario. Son justamente los
estados que nadie captura a mano.

Si una acción navega, el explorador vuelve a la ruta de la pantalla: la captura
del destino ya quedó tomada, y sin volver exploraría el resto de los controles
sobre la pantalla equivocada.

### El detalle que casi lo rompe

Los componentes de radio, casilla e interruptor envuelven un `<input>` nativo de
`width: 0; height: 0; opacity: 0` dentro de un `<label>` que es lo que se ve y se
toca. Medir sólo el elemento descartaba **todos** los controles de ese tipo de la
aplicación, y accionar el input tampoco funcionaba: el clic caía en la nada.

Por eso el explorador también mide la etiqueta que lo envuelve —o la que lo
referencia por `for`, que es como lo hace el adjunto— y acciona la etiqueta en
vez del input. El navegador marca el input por su cuenta y el `(change)` del
componente se dispara igual.

## Lo que se escribe a mano igual

El explorador acciona controles de a uno, así que hay caminos que no alcanza —un
envío válido es una secuencia, no un clic— y estados que no existen si nadie los
pide. Esos van escritos en las specs:

- **Secuencias**: abrir el menú de cuenta *y después* cerrar sesión; completar un
  formulario *y después* mandarlo.
- **Estados que dependen de la respuesta de la API**: el listado vacío, el
  directorio caído, las credenciales rechazadas, el `403` que exige verificar la
  identidad. Se piden con las opciones de `simularApiTotal`.
- **Estados que dependen del viewport**: el cajón de navegación sólo existe por
  debajo del punto de corte.

## Los datos son inventados y constantes

`e2e/recorrido/support/api-total.ts` simula la API entera. Los nombres, códigos
y fechas son fijos a propósito: las capturas se comparan entre corridas —la de
hoy contra la de la semana pasada, para ver qué cambió— y con datos aleatorios
**todas** difieren siempre, que es lo mismo que no poder comparar.

Por eso también se apagan las animaciones y el cursor que parpadea antes de cada
captura. Un cursor de texto aparece en la mitad de las capturas de un campo
enfocado y nunca en la otra mitad.

## Lo que no capturó, lo dice

Un recorrido que recorta y no lo menciona se lee como cobertura completa, que es
justo la conclusión equivocada. El reporte muestra, en la pantalla que
corresponda:

- los controles que quedaron fuera por el **tope de acciones** —existe por la
  vitrina de diseño, que tiene más de doscientos y sola se llevaría la corrida—;
- los que **no se pudieron accionar**, con su nombre;
- los que se **excluyeron a propósito**: cerrar sesión dejaría al resto del
  recorrido explorando el login, y un enlace externo se llevaría el navegador
  fuera de la aplicación. Ambos casos se capturan, pero en su propia prueba.

## Por qué corre aparte

`playwright.recorrido.config.ts` es una configuración propia, no un proyecto más
dentro de `playwright.config.ts`. La suite de extremo a extremo corre en cada
cambio y tiene que terminar rápido; el recorrido tarda minutos y produce
cientos de archivos. Como proyecto se ejecutaría con `yarn e2e` sin que nadie lo
pidiera.

Corre **contra el artefacto construido**, por lo mismo que la suite de extremo a
extremo: cuatro rutas se prerenderizan en el build y el prerenderizado sólo
existe ahí. Un recorrido hecho contra `ng serve` mostraría pantallas que no son
las que ve nadie.

Para iterar sobre el recorrido sin reconstruir cada vez:

```bash
PORT=4173 node dist/mantra-core-health/server/server.mjs &
yarn recorrido --reusar-servidor
```

Reutilizar el servidor es cómodo y tiene un filo: el servidor lee el HTML
prerenderizado **al arrancar** y lo guarda en memoria, así que si se reconstruye
mientras uno viejo sigue vivo, el HTML apunta a fragmentos cuyo hash ya cambió.
Por eso hay que pedirlo explícitamente.

Todo lo pasado después de `--` va a Playwright tal cual, que es como se corre una
sola pantalla:

```bash
yarn recorrido --reusar-servidor -- 03-administracion.spec.ts -g "ficha"
```

Ojo con eso: la limpieza de evidencias corre al arrancar Playwright, así que
correr una sola pantalla **borra las capturas de las demás**. Sirve para iterar
sobre una spec, no para completar un reporte a pedazos.

### Qué hace el script

`scripts/run-recorrido.mjs` es lo que hay detrás de `yarn recorrido`, y existe
por dos cabos sueltos que un `&&` entre dos comandos deja:

- **El puerto ocupado.** Un servidor de una corrida anterior que quedó vivo hace
  fallar el arranque con un mensaje que no dice qué hacer. El script lo detecta
  antes y ofrece la salida.
- **El reporte de una corrida que falló.** Con `&&` no se genera, y entonces no
  hay forma de mirar las pantallas que **sí** se capturaron antes del fallo —
  que es justo cuando más falta hacen. El script lo genera igual.

## Agregar una pantalla

Una prueba de tres líneas en el archivo del área que corresponda:

```ts
test('mi pantalla', async ({ page }) => {
  await simularApiTotal(page, { claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
  await iniciarSesion(page);

  await recorrer(
    page,
    { ruta: '/mi-ruta', carpeta: '99-mi-pantalla', titulo: 'Mi pantalla' },
    { evitar: EVITAR_POR_DEFECTO },
  );
});
```

El prefijo numérico de `carpeta` es lo que ordena el reporte, y `titulo` es lo
que se lee en el índice. Los controles no hace falta declararlos: los encuentra
el explorador.
