# Motor de tutoriales

Ayuda en producto: recorridos guiados que se dibujan **sobre la aplicación
real**, no sobre capturas ni sobre una demo aparte.

---

## Por qué existe y qué decidió su forma

Una aplicación clínica con ocho secciones, roles que cambian lo que se ve y
flujos que cruzan pantallas no se aprende leyendo un manual. Lo que hacía falta
era algo que señalara el elemento de verdad, en la pantalla de verdad, con los
datos de verdad de quien está mirando.

Tres decisiones sostienen todo lo demás:

1. **Un tutorial es un dato, no código.** Se declara en
   `core/tutorials/definitions/` y el motor lo ejecuta. Agregar uno no toca ni
   una línea del motor. Sin esto, en seis meses hay tres tutoriales y un `if`
   gigante.
2. **Los pasos apuntan por atributo, no por selector CSS.** Un paso referencia
   `data-tutorial-id="agenda-ventana"`, no `.agenda__filtro > app-select`. La
   clase existe para dar estilo y cambia cuando alguien rediseña; el atributo
   existe sólo para esto, así que borrarlo es una decisión explícita que se ve
   en el diff.
3. **Nada bloquea.** Si el elemento no aparece en el plazo, el paso se salta y
   queda anotado. Un recorrido colgado esperando un botón que alguien borró hace
   tres meses es peor que uno al que le falta un paso.

La contrapartida de (3) es que un objetivo roto no se nota en tiempo de
ejecución. Por eso existe `definitions.spec.ts`, que lee el árbol de plantillas y
**exige** que cada objetivo declarado esté puesto en alguna. Si alguien borra un
`appTutorialTarget`, la prueba se pone en rojo en el mismo commit.

---

## Arquitectura

```
core/tutorials/
  tutorial.types.ts            contratos (definición, paso, progreso, problemas)
  tutorial.registry.ts         catálogo + validación + filtrado por rol
  tutorial.engine.ts           máquina de pasos, resolución de elementos, rutas
  tutorial-progress.store.ts   progreso por cuenta + adaptador de almacenamiento
  definitions/index.ts         los tutoriales

shared/components/organisms/tutorial-overlay/
  tutorial-target.directive.ts  [appTutorialTarget] → data-tutorial-id
  tutorial-overlay.*            velo, globo, progreso, teclado, foco

features/tutorials/
  tutorials-center.*            la sección «Tutoriales»
```

**Flujo de una ejecución**

```
Centro (o autoStart)
  → engine.start(id)
      → registry.find(id)            ¿esta sesión puede hacerlo?
      → progress.started(...)        queda «en curso» con su paso
      → preparar()
          → router.navigateByUrl()   si el paso vive en otra pantalla
          → esperarElemento()        sondeo acotado por `waitForTargetMs`
          → escucharLaAccion()       click / input, si el paso lo pide
  → overlay dibuja velo + globo sobre el rectángulo del elemento
  → next() / previous() / skip() / complete()
```

El overlay se monta **una sola vez**, en el armazón. Ninguna pantalla lo importa
ni sabe que existe: eso es lo que permite que un tutorial cruce de la agenda al
expediente sin que ninguna de las dos colabore.

---

## Estructura de un tutorial

```ts
const AGENDA_DEL_DIA: TutorialDefinition = {
  id: 'agenda-del-dia',
  version: '1.0',                       // mayor.menor
  title: 'Tu agenda del día',
  description: 'Ver tus turnos y entrar al expediente de quien llega.',
  category: 'Atención',                 // agrupa en el centro
  route: '/schedule',                   // dónde empieza
  roles: ['PRACTITIONER', 'CLINICIAN'], // omitir = cualquier sesión
  estimatedMinutes: 4,
  level: 'inicial',                     // inicial | intermedio | avanzado
  prerequisites: ['bienvenida'],        // avisan, no bloquean
  next: 'expediente-clinico',           // se ofrece al terminar
  steps: [
    {
      id: 'ventana',
      title: 'Cambiá la ventana',
      body: 'Elegí «Hoy». El listado se recarga solo.',
      target: 'agenda-ventana',         // el data-tutorial-id
      placement: 'bottom',              // auto | top | bottom | left | right | center
      advanceOn: 'input',               // next | click | input | navigate
      route: '/schedule',               // navega si no estás ahí
      waitForTargetMs: 4000,
      interactive: true,                // deja tocar el elemento
      roles: ['PRACTITIONER'],          // filtra el paso, no el tutorial
      hint: 'Si no pasa nada, abrí el desplegable.',
    },
  ],
};
```

---

## Cómo agregar un tutorial

**1. Marcá los elementos** en la plantilla que querés señalar:

```html
<app-form-field label="Ventana" appTutorialTarget="agenda-ventana">
```

Y agregá `TutorialTarget` a los `imports` del componente.

**2. Declará el tutorial** en `core/tutorials/definitions/index.ts` y sumalo al
array `TUTORIALS`.

**3. Corré las pruebas.** `definitions.spec.ts` verifica que los objetivos
existan y que la configuración sea válida; el registro verifica ids duplicados,
pasos repetidos, versiones mal formadas, rutas inexistentes, requisitos que no
existen y ciclos.

No hay paso 4: el motor no se toca.

---

## Validaciones

| Código | Qué detecta | ¿Descarta el tutorial? |
| --- | --- | --- |
| `id-duplicado` | dos tutoriales con el mismo id | se queda con el primero |
| `sin-pasos` | un recorrido de cero pasos | sí |
| `paso-duplicado` | dos pasos con el mismo id | sí |
| `version-invalida` | la versión no es `mayor.menor` | sí |
| `ruta-invalida` | la ruta no es una sección declarada | no, avisa |
| `requisito-inexistente` | apunta a un tutorial que no está | no, avisa |
| `requisito-circular` | los requisitos vuelven sobre sí | no, avisa |
| `siguiente-inexistente` | `next` apunta a la nada | no, avisa |
| `rol-imposible` | los roles del paso no cruzan con los del tutorial | no, avisa |

Los problemas **no tiran una excepción**: se acumulan en `registry.issues()` y el
centro de tutoriales los muestra. Un tutorial mal configurado no puede tumbar la
aplicación —es ayuda, no infraestructura— pero tampoco puede pasar inadvertido.

---

## Roles y permisos

El filtrado usa **la misma regla que el menú** (`isVisibleTo`): sin `roles`
declarados lo ve cualquiera, con `roles` alcanza tener uno, y `SUPERADMIN` es
comodín porque lo es en el `RolesGuard` del backend. Dos reglas de visibilidad
distintas es cómo se llega a un tutorial que enseña una sección que no está en
el menú.

Se filtra dos veces: el tutorial entero y después cada paso. Un tutorial cuyos
pasos se filtran todos deja de ofrecerse.

**Esto no autoriza nada.** Esconder un tutorial es cortesía y honestidad:
enseñar a usar una pantalla que va a responder 403 es peor que no enseñar nada.
Quien autoriza sigue siendo el backend, en cada petición.

---

## Progreso y versionado

Se guarda por cuenta (`mantra.tutoriales.progreso.<userId>`): un mostrador
compartido es el caso normal en una clínica, y heredar el avance de quien estuvo
antes ofrecería como completados tutoriales que esta persona nunca vio.

Cada entrada lleva estado, paso actual, versión, fechas y repeticiones.

**El versionado:** sólo un cambio de **mayor** vuelve a marcar pendiente un
tutorial completado. Obligar a repetir diez pasos porque alguien corrigió una
tilde es la forma más segura de que la gente deje de hacer los tutoriales.

### Dónde vive el progreso hoy, y dónde debería vivir

Hoy: el navegador, detrás de `TutorialStorageAdapter`.

**No es la decisión final.** Lo correcto para una cuenta autenticada es el
backend, para que quien empieza un tutorial en el consultorio lo continúe desde
su casa. Se hizo así porque el backend no tiene todavía dónde guardarlo: no hay
módulo de preferencias de usuario ni tabla de progreso, y agregarlos es una
decisión de modelo de datos que no correspondía tomar de costado.

Cambiar de adaptador **no toca el motor ni una definición**: es registrar otro
proveedor para `TUTORIAL_STORAGE`. El contrato que haría falta:

```
GET    /education/tutorials/me/progress          → TutorialProgress[]
PUT    /education/tutorials/me/progress/:id      → idempotente, cuerpo TutorialProgress
DELETE /education/tutorials/me/progress/:id      → reinicia
```

Con las reglas de siempre: el sujeto sale de la sesión, nadie puede leer ni
escribir el progreso de otro, y el `PUT` es idempotente para que un reintento no
cuente dos repeticiones.

---

## Accesibilidad

- El globo es `role="dialog"` con `aria-modal`; el foco entra al abrirse y se
  **devuelve** al elemento anterior al cerrarse.
- `Escape` pregunta antes de abandonar (salvo en el primer paso, donde no hay
  nada que perder). Un tecleo distraído no debería costar ocho pasos.
- Las flechas avanzan y retroceden **sólo con el foco dentro del globo**: en un
  paso interactivo, quien escribe en el campo resaltado las necesita para
  moverse por el texto.
- El progreso se dice **con palabras** («paso 3 de 8») además de con la barra:
  una barra no se escucha.
- El estado de espera («hacé clic en lo que está resaltado») va en un
  `role="status"`, no se deduce de que falte un botón.
- `prefers-reduced-motion` quita la animación de entrada además de las
  duraciones que ya anula la regla global.
- El velo y el marco son `aria-hidden`: lo que comunica es el globo.

---

## El velo tiene un agujero

El fondo se dibuja con **cuatro rectángulos** alrededor del elemento, no con un
rectángulo y `clip-path`. Así el hueco no tiene capa encima y, en un paso donde
hay que hacer clic en el botón resaltado, el clic llega al botón de verdad. Con
un velo entero, o se podía tocar todo o no se podía tocar nada.

En los pasos que sólo explican, el hueco lleva una tapa transparente: un clic
distraído en medio de una explicación no debería disparar una acción real.

---

## Ejecutar las pruebas

```bash
yarn ng test --watch=false --include='**/tutorial*.spec.ts'
yarn ng test --watch=false --include='**/definitions.spec.ts'
yarn ng test --watch=false --include='**/tutorials-center.spec.ts'
yarn e2e --spec "cypress/e2e/tutorials/**/*.cy.ts"
```

---

## Diagnóstico

| Síntoma | Causa habitual |
| --- | --- |
| El recorrido saltea un paso | el objetivo no existe; mirá `engine.failures()` |
| Un tutorial no aparece en el centro | los roles del token no alcanzan, o todos sus pasos se filtraron |
| El globo señala al vacío | el elemento se movió; el overlay remide en `resize` y `scroll` |
| Avanza de a dos pasos | dos escuchas sobre el mismo elemento — no debería pasar: `soltarEscuchas()` lo cubre |
| El progreso no se guarda | almacenamiento bloqueado; se avisa por consola y sigue en memoria |
| Un tutorial completado vuelve a pendiente | le subieron la versión mayor |

---

## Limitaciones conocidas

- **El progreso no cruza dispositivos.** Es la limitación real de la decisión de
  almacenamiento de arriba, con su camino de salida escrito.
- **`advanceOn: 'navigate'` está declarado en los tipos pero no implementado.**
  El motor navega cuando el paso lo pide, pero no hay ningún paso que espere a
  que la persona navegue por su cuenta; se dejó el modo declarado porque el
  contrato es el lugar donde se ve qué falta.
- **No hay analítica.** `TutorialAnalyticsAdapter` no existe: sin backend de
  progreso no hay a dónde mandar los eventos, y un adaptador que escribe en la
  consola es un componente de demostración desconectado.
- **Los tutoriales no se traducen.** Los textos están en castellano en la
  definición. La aplicación entera está igual, así que no es una deuda de este
  motor.
- **Un tutorial no puede abrir un modal por su cuenta.** Puede señalar el botón
  que lo abre y esperar el clic, que es lo que hacen los que cruzan modales.
