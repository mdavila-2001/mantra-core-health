# Alta del centro de imagenología — qué queda para `dev`

**Módulo del propietario:** «MODULO ANALISIS MEDICOS (RAYOS X, RESONANCIA, ETC.)», en
`REGISTRO DE PROCESOS POR MODULO.md`.
**Rama:** `mockup`. **Alcance de este PR: sólo visual.** Nada sale a la red y no se tocó el
modelo, el DDL, los seeds ni la API.

---

## 1. Qué entró

Una pantalla nueva, `/auth/register/imaging-center`
(`src/app/features/auth/register-imaging-center/`), y una quinta tarjeta —«Imagenología»— en
la rejilla de «Crear cuenta».

Es **el alta del laboratorio de sangre con dos diferencias**, porque el registro de procesos
repite los dieciocho puntos de datos legales palabra por palabra en los dos módulos. Once
pasos:

| # | Paso | Qué frena |
|---|---|---|
| 1 | La empresa | Razón social · tipo de sociedad · NIT |
| 2 | **Qué estudios hacés** | **Al menos uno** |
| 3 | Los papeles de la empresa | SEPREC · licencia de funcionamiento · certificado del SEDES |
| 4 | Constitución, poder y radioprotección | nada |
| 5 | Dónde está la central | Dirección legal |
| 6 | Tus sucursales | nada |
| 7 | Representante legal | Nombre y correo |
| 8–10 | Gerencia general · comercial · marketing | nada |
| 11 | Tu acceso | Contraseña |

**Los tres cargos quedaron opcionales**, como los pidió el propietario. Opcional no es
«cualquier cosa»: un correo de gerente escrito a medias sigue frenando, porque un correo
inválido cargado es peor que el campo vacío — parece que hay a quién escribirle.

---

## 2. Las dos preguntas que la fuente NO hace, y por qué están

### 2.1 Qué estudios hace el centro — **frena el alta**

No sale de los dieciocho puntos: sale del punto 2.1.5 del **mismo** módulo, «la APP le mostrara
las opciones de todas las empresas de análisis clínicos **que pueden realizar los estudios**».
Sin eso no hay forma de armar esa lista, y es además lo único que distingue este alta de la del
laboratorio de sangre.

Se ofrecen seis, más «Otro» con texto libre: Rayos X · Ecografía · Tomografía computarizada ·
Resonancia magnética · Mamografía · Densitometría ósea.

### 2.2 Autorización de radioprotección — **no frena**

No sale de ninguna línea de la fuente. Está porque un centro de rayos, tomografía o mamografía
usa radiación ionizante y un laboratorio de sangre no: es el papel que un verificador va a
pedir primero. Es opcional por dos motivos distintos — un centro que sólo hace ecografía y
resonancia no la necesita, y un agregado no puede frenar un alta hasta que el propietario diga
que corresponde.

> **Pregunta para el propietario:** ¿la exigimos cuando el centro marca rayos X, tomografía o
> mamografía? Si la respuesta es sí, es un validador condicional en el mismo formulario —no
> hace falta nada del backend—.

---

## 3. Lo que hay que resolver en `dev`

### 3.1 El catálogo sólo tiene dos de las seis modalidades — **bloqueante para conectar**

`mantra-core-health-model/salud-db/gen_seeds.py` siembra tres conceptos de modalidad:

```python
("diagnostic_units:MODALITY_LABORATORY", "Laboratory modality"),
("diagnostic_units:MODALITY_XRAY",       "X-ray modality"),
("diagnostic_units:MODALITY_ULTRASOUND", "Ultrasound modality"),
```

O sea: **rayos X y ecografía existen; resonancia, tomografía, mamografía y densitometría no**.
Y el módulo se llama, justamente, «RAYOS X, **RESONANCIA**, ETC.».

Mientras sea maqueta no molesta —el valor guardado es la etiqueta—, pero **el día que esto se
conecte, el alta va a poder declarar algo que la base no sabe guardar**. Las cuatro que faltan
se siembran por el camino de siempre y **nunca a mano sobre la base**:

```text
gen_seeds.py  →  regenerar seedsGenerales/modules/03_terminology.seeds.json  →  load_seeds.py
```

Es un PR chico al repo del modelo, y es independiente de todo lo demás de esta lista.

### 3.2 No hay endpoint de alta — igual que el laboratorio

La API tiene tres altas públicas: paciente, profesional y aseguradora. El centro de diagnóstico
no es una de ellas, igual que no lo es el laboratorio de sangre. Por eso `submit()` **no llama a
nadie** y la pantalla cierra diciendo que quedó **una solicitud**, no una cuenta.

Cuando exista el alta, lo único que cambia es ese método: el formulario, sus reglas, sus papeles
y sus mensajes ya están escritos y probados.

Lo que el alta va a tener que aceptar, y dónde vive hoy cada cosa:

| Dato del formulario | Dónde iría | Existe |
|---|---|---|
| Razón social, NIT, dirección | `directory.tenants` | sí |
| Tipo de sociedad (8 valores) | concepto de terminología | **no** — no hay value set |
| Kind del centro (`IMAGING`) | `DU_TYPE_IMAGING` | sí, ya lo usa el directorio |
| Modalidades | `diagnostic_units` · modalidad | **parcial**, ver 3.1 |
| Los 7 papeles | `common.files` + verificación | sí (el patrón está en `profiles.professional_credentials`) |
| Sucursales con GPS | sedes de la unidad diagnóstica | sí |
| Los 3 cargos | contactos de la organización | **no** — hoy no hay dónde |

### 3.3 Dos cosas que la fuente no pregunta y el directorio va a necesitar

- **Departamento y municipio.** Los dieciocho puntos no los piden, y el directorio los necesita
  para ordenar por cercanía. Es una pregunta al propietario, no algo que la pantalla deba
  inventar.
- **Los ocho tipos societarios están duplicados** entre esta alta y la del laboratorio. Mientras
  sean dos módulos distintos está bien así —tocar la lista de uno no debe cambiar en silencio el
  formulario del otro—. El día que la plataforma decida que es **una sola lista de la empresa**,
  el lugar donde vive es un catálogo compartido, no el alta de laboratorio.

---

## 4. Por qué la pantalla dice «imagenología» y el propietario dijo «análisis médicos»

Dos motivos, los dos verificables:

1. En Bolivia «análisis» es lo que se pide en el laboratorio de sangre, y **ése es el otro
   módulo**. Dos altas que se llamaran parecido serían la manera más rápida de que un centro de
   rayos se registre en la equivocada.
2. El nombre no lo inventó esta pantalla: el catálogo ya publica la categoría `DU_TYPE_IMAGING`
   como **«Imagenología»**, y así la ve hoy el paciente en el directorio de laboratorios
   (`features/laboratory-directory/`). Decirlo distinto acá abriría dos nombres para lo mismo.

El título del módulo, tal como lo escribió el propietario, queda conservado en el JSDoc de
`RegisterImagingCenter` y en este documento. **Si el propietario prefiere «análisis médicos» en
la pantalla, es cambiar tres textos** — pero entonces conviene renombrar también la categoría
del directorio, para que no queden dos nombres.

---

## 5. Lo que NO entró, a propósito

El módulo del propietario tiene cuatro partes. Este PR es la primera.

| Parte | Estado |
|---|---|
| 1 · Registro de datos legales | **este PR** |
| 2 · Recepción de órdenes (con y sin seguro) | no entró — es la bandeja, misma pieza que LAB-E1 (`GET /diagnostics/inbound-orders`) |
| 3 · Módulo de puntos | no entró — **no existe en ninguna capa**, ni en el módulo de laboratorio |
| 4 · Módulo de promociones | no entró — hay `campaigns/` y `organization/pharmacy-campaigns/` como punto de partida |

Las partes 2, 3 y 4 son iguales para el laboratorio de sangre y para este módulo: la fuente las
repite palabra por palabra. **Conviene construirlas una sola vez para los dos**, no dos veces.

---

## 6. Evidencia

- `corepack yarn typecheck` → limpio.
- `corepack yarn lint` → limpio.
- `corepack yarn test --watch=false` → **5 221 pasan**, 29 nuevas de esta pantalla. Los 3 fallos
  que quedan son **los mismos 3 de antes del cambio** (`aviso-de-demora`,
  `identity-verification`, `shell-layout`), comprobado corriendo la suite con el árbol limpio.
- Recorrido en el navegador contra `localhost:4200`: pasos 1 → 4, el gate de «marcá al menos un
  estudio» frenando de verdad, los adjuntos mostrando nombre y peso, y la rejilla de «Crear
  cuenta» con las cinco tarjetas. Móvil (375×812) y escritorio (1440×900).
