# Registro por pasos, municipios y el calendario que no se podía usar

2026-08-22. Cuatro problemas del alta pública, y lo que se hizo con cada uno.

## 1. El calendario se abría fuera de la pantalla

`01-bug-datepicker-1366x768.png` — el modal aparecía pegado al borde derecho,
cortado, sin manera de elegir un día. Aparecía además una barra de scroll
horizontal en toda la página.

**Causa.** La tarjeta del registro (`.registro`) tiene
`backdrop-filter: blur(22px)`, y un ancestro con `backdrop-filter` se vuelve el
**bloque contenedor** de sus descendientes `position: fixed`. El velo del
calendario medía `100vw × 100vh` y se posicionaba respecto a la tarjeta, no
respecto a la ventana. Un `transform` o un `filter` en cualquier pantalla futura
habría hecho lo mismo.

**Arreglo.** `app-date-picker` pasa a `<dialog>` nativo abierto con
`showModal()`: la capa superior del navegador se posiciona respecto a la ventana
pase lo que pase arriba. De yapa trae el velo (`::backdrop`), el atrapado del
foco y el cierre con Escape.

`02-datepicker-arreglado-1366x768.png` — centrado y completo.

El arreglo es del componente, así que alcanza a las **~30 pantallas** que usan
el calendario, no sólo a ésta.

## 2. Formulario por pasos, máximo cuatro preguntas, barra arriba

`00-antes-paciente-1366x768.png` — antes: una sola columna de quince campos. En
un monitor de 768px de alto se veían tres, sin saber cuánto faltaba.

`03-paso-1-de-4-1366x768.png` · `04-paso-3-de-4-1366x768.png` — ahora: barra de
progreso arriba de todo, titular del paso, y **nunca más de cuatro preguntas**.

- Paciente: 4 pasos (documento · nombre · sobre vos · acceso).
- Profesional: 5 pasos, ninguno de más de cuatro. Son cinco y no cuatro porque
  el límite es de preguntas por paso, no de pasos.

Cada paso valida lo suyo antes de dejar avanzar, y **sólo lo suyo**: un paso
incompleto no pinta en rojo campos de pasos que la persona todavía no vio.
«Atrás» no valida nada — corregir es justamente para lo que se vuelve.

## 3. Los municipios: el catálogo que no existía

No estaba en ninguna parte. `VS_BO_MUNICIPALITY` se mencionaba en los DTO de
direcciones desde hacía tiempo, pero **nadie lo sembraba**, y el endpoint de
registro no recibía municipio.

Se sembraron los **340 municipios del INE** con su código `DDPPMM`, su provincia
y su departamento padre (`bo-geography.catalog.ts`). Corrida real contra la base
de desarrollo:

    municipalities: 340 · designations: 340 · properties: 680 · memberships: 340
    departments: 0   ← los nueve ya estaban; el seed es idempotente

`05-arbol-municipios-cerrado-1366x768.png` — los nueve departamentos con sus
cuentas: 29 + 87 + 47 + 35 + 41 + 11 + 56 + 19 + 15 = **340**.

`06-busqueda-san-pedro-1366x768.png` — por qué es un árbol y no una lista: siete
municipios se llaman «San Pedro» o empiezan así, en cuatro departamentos
distintos. Sueltos son indistinguibles.

`07-municipio-elegido-1366x768.png` — el campo muestra «Sacaba · Cochabamba»: el
nombre solo sería ambiguo.

La búsqueda ignora acentos y mayúsculas («Potosi» encuentra «Potosí») y casa
tanto contra el municipio como contra el departamento — escribir «Tarija» trae
sus once.

### De punta a punta

`08-profesional-paso-1-de-5-1366x768.png` — el alta de profesional, con sus
cinco marcas en la barra.

`09-alta-completa-1366x768.png` — el recorrido entero desde el navegador:
documento, nombre, municipio elegido en el árbol, acceso, y la cuenta creada.
La fila que dejó, buscada por el documento de esa alta:

    documento  | city   | municipio | departamento
    FIN2157463 | Sacaba | Sacaba    | Cochabamba

Contra la API con este código, no contra el contenedor: el del puerto 3000 corre
una imagen vieja y rechazaba el campo nuevo con
`property residenceMunicipalityConceptId should not exist`. Se levantó
`node dist/src/main.js` en un puerto aparte.

El mismo recorrido, campo por campo, contra la API:

    POST /iam/auth/register-patient
      { nationalId, name, lastName, password,
        residenceMunicipalityConceptId: <Sacaba> }
    → 201 { userId, personId, patientProfileId, patientCode }

Y la fila que quedó en `common.addresses`:

    city   | municipio | departamento | pais
    Sacaba | Sacaba    | Cochabamba   | Bolivia

**El departamento no viaja en el cuerpo: se deriva.** El código del INE de un
municipio lleva adentro el de su departamento, así que el par siempre es
coherente. Recibir los dos del cliente abriría la puerta a un municipio de
Tarija con el departamento de Beni, y no habría criterio para decidir cuál gana.

El alta de profesional hace lo mismo por el mismo camino:

    POST /iam/auth/register-practitioner  → 201
    common.addresses: Sacaba | Sacaba | Cochabamba

Un uuid con forma válida que no sea de un municipio se rechaza antes del
`INSERT`:

    → 400 VALIDATION_FAILED
      "El municipio indicado no pertenece al catálogo de municipios de Bolivia"

## 4. Fuera el género

El formulario preguntaba «Género» y «Sexo al nacer» uno al lado del otro, y la
pantalla terminaba pidiendo dos veces algo que la persona lee como lo mismo. De
los dos, el que tiene consecuencia clínica —dosis, valores de referencia,
tamizajes— es el sexo al nacer, así que es el que se queda.

El campo `gender` del DTO sigue existiendo y otros clientes lo pueden mandar;
esta pantalla no lo manda, y ausente no es lo mismo que vacío.

## Pruebas

- Frontend: **3356/3356**, 325 archivos.
- API: **5905/5907** — el único fallo (`Catálogo en castellano › cubre todos los
  conceptos que el glosario puede mostrar`) ya fallaba en `HEAD` antes de este
  trabajo; se comprobó en un worktree limpio.

## 5. La pantalla pasa al motor, y la lista de pendientes queda vacía

Lo de arriba lo servía un wizard **propio** de esta pantalla: su barra, su
índice de pasos, su validación de a un paso. Cumplía la disciplina, pero era una
segunda implementación de lo que ya hacía `app-paginated-form` en las otras 44
pantallas — y `check-form-pages.mjs` la llevaba en `PENDIENTES` con un motivo ya
vencido («la reescribe otra rama»).

Ahora la sirve el motor. La pantalla declara **qué se pregunta y en qué orden**,
y nada más:

    register-patient.html   526 → 136 líneas
    register-patient.css    302 → 209 líneas
    register-patient.ts     462 → 909 líneas   (las páginas se declaran acá)

`10-motor-paciente-paso-1-de-4-1366x768.png` — paso 1 de 4, barra e índice del
motor. El árbol del accesible dice `progressbar "Crear cuenta: paso 1 de 4"` y
marca cada paso como *paso actual* / *completado* / *pendiente*.

`14-motor-profesional-paso-1-de-5-1366x768.png` — el mismo motor con las cinco
páginas del profesional. Son cinco porque el tope es de preguntas por página, no
de páginas.

### Los dos catálogos van proyectados, no reimplementados

`11-motor-paciente-paso-3-arbol-proyectado-1366x768.png` ·
`12-motor-arbol-municipios-dentro-del-motor-1366x768.png`

El motor no dibuja árboles con búsqueda, así que el municipio entra como campo
`custom` y la pantalla lo proyecta con `<ng-template appCampoPersonalizado>`.
Lo mismo el aviso de «no pudimos traer el catálogo de departamentos», que sólo
aparece cuando esa lectura falló — es cuando el campo deja de ser un `select`.
Proyectar es lo que evita que el motor tenga que aprender un caso por pantalla.

### El alta entera, otra vez, contra la API con este código

`13-motor-alta-completa-contra-api-del-fuente-1366x768.png` — el recorrido
completo desde el navegador con la pantalla ya migrada: documento, nombre,
municipio elegido en el árbol, acceso, y «Tu cuenta está lista».

No sirve el contenedor del puerto 3000: corre una imagen anterior y contesta
`property residenceMunicipalityConceptId should not exist`. Se levantó la API
desde el fuente en 3030 y se sirvió el front con una copia del proxy apuntando
ahí. La fila que dejó, la última de `common.addresses`:

    city   | municipio | departamento | created_at
    Sacaba | Sacaba    | Cochabamba   | 2026-08-22 13:51:47+00

El departamento sigue derivándose del código INE del municipio; no viaja en el
cuerpo.

### Lo que queda verde

    node scripts/check-form-pages.mjs
    ✓ 77 formularios, ninguno pide más de 4 campos de una vez

    node scripts/check-route-prefixes.mjs
    ✓ 175 rutas del router, ninguna colisiona con los 46 prefijos de la API

`PENDIENTES` quedó **vacía**: ya no hay ninguna pantalla que sea un formulario
lineal y no pase por el motor. Y el verificador dejó de tener un punto ciego —
contaba sólo plantillas con `[formGroup]`, así que una pantalla migrada del todo
*desaparecía* de la cuenta en vez de contarse; ahora también cuenta las que
usan `<app-paginated-form>`.

- Frontend: **3366/3366**, 326 archivos. `yarn typecheck` y `yarn lint` limpios.
