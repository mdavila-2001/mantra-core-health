# Carril R2-4 · El perfil del doctor

**Punto del reclamo, textual:**

> NO MODIFICO EL PERFIL DEL DOCTOR, ESTA PESIMO

**Repos:** frontend. **Rama:** `carril-r2-4/perfil-del-doctor`.
**Este carril mergea PRIMERO de la ronda** — R2-1 depende de lo que deje. Ver
`CARRILES-R2-2026-08-14-README.md`.
**Coordinación:** postear el bloque en `COORDINACION-AGENTES.md` antes de tocar nada.

## Lo primero, y es incómodo: este punto no dice qué está mal

Los otros cinco puntos del reclamo describen un resultado verificable —«agrupado por
especialidad», «como una barra de avance», «no hay etiquetas»—. Éste dice que está pésimo, y es
la segunda ronda que lo dice. **Arrancar a rediseñar contra nuestro propio criterio es
exactamente lo que ya falló una vez**, y el resultado más probable es una tercera ronda con la
misma frase.

**Paso cero del carril, antes de escribir una línea de código:** pedirle al cliente que marque
sobre la pantalla qué está mal. No una reunión abierta — una captura de
`/my-account` con un profesional logueado, y tres preguntas cerradas:

1. ¿Le falta **información** (qué dato querés ver que no está)?
2. ¿Le sobra o está **mal ordenada** (qué debería ir primero)?
3. ¿Es **cómo se ve** (seis tarjetas iguales apiladas)?

Mientras llega la respuesta, el carril **no se bloquea**: la base de abajo se hace igual, porque
hace falta para R2-1 y porque es defendible con la evidencia que ya tenemos.

## Lo que hay hoy

`src/app/features/account/my-profile/practitioner-profile/practitioner-profile.ts` + `.html`
(221 líneas) — lee `GET /profiles/practitioners/me/summary`, resuelve rótulos contra terminología
y pinta **seis tarjetas `outlined` apiladas, todas iguales**:

| Línea | Bloque |
|---|---|
| `:11` | Portada — avatar, nombre, título, especialidad principal, código, sello de habilitación, chips de disponibilidad e idiomas |
| `:83` | Presentación |
| `:93` | Actividad («qué lleva hecho acá») |
| `:114` | Especialidades |
| `:161` | Formación |
| `:205` | Matrículas |

Alrededor, en `my-profile/`, hay cuatro pantallas más del mismo perfil:
`practitioner-profile-edit/`, `work-history/`, `medical-articles/`, `public-profile-preview/`.

**No está roto ni vacío: lee datos reales y los presenta bien por dentro.** Lo que se puede
afirmar con evidencia, sin adivinar el gusto del cliente:

- **Seis tarjetas idénticas apiladas no tienen jerarquía.** Todo pesa lo mismo, así que nada
  resalta. Es la crítica que el propio repo ya se hizo una vez, en `my-profile.ts:46-51`: «era una
  tarjeta de cuatro campos en una pantalla de mil cuatrocientos píxeles».
- **El perfil está partido en cinco pantallas** (perfil, editar, trayectoria laboral, artículos,
  vista pública) que sólo se conectan por dos botones en la portada (`:74-75`). Quien entra a «Mi
  perfil» no ve que existen las otras cuatro.
- **No hay foto.** `app-avatar` se dibuja con las iniciales del nombre; el carril 12 de la ronda
  anterior trajo subida de imágenes, y este perfil no la usa.
- **Es el único perfil de doctor del sistema y no es reutilizable**: inyecta `ProfilesClient` y
  pide `me/summary` adentro, así que no puede pintar el perfil de otro. R2-1 lo necesita
  justamente para eso.

## Lo que este carril hace igual, sin esperar la respuesta

### 1 · Partir en dos: el que trae el dato y el que lo pinta

Es la parte que R2-1 espera, y no es refactor por gusto: sin esto habría **dos perfiles de doctor
distintos** en el producto, que es la forma más segura de volver a rebotar.

```
practitioner-profile/practitioner-profile.ts        → sigue siendo el contenedor de «Mi perfil»:
                                                       inyecta ProfilesClient, pide me/summary
practitioner-profile/practitioner-profile-view.ts   → NUEVO: componente presentacional puro
                                                       + .html + .css + .spec.ts
```

`practitioner-profile-view` recibe el perfil por `input()` y **no inyecta ningún cliente de
datos**. Toda la resolución de rótulos contra terminología que hoy vive adentro se hace en el
contenedor y baja ya resuelta. El `.spec.ts` del componente presentacional se escribe con datos
fijos: sin `HttpTestingController`.

Los dos consumidores quedan así:

- `my-profile` (propio) → contenedor actual → `practitioner-profile-view`
- `practitioner-detail` de R2-1 (ajeno) → su propio contenedor → **el mismo**
  `practitioner-profile-view`

El contrato del `input()` se acuerda con R2-1 en `COORDINACION-AGENTES.md` **antes** de escribirlo,
no después.

### 2 · Darle jerarquía a la pantalla

Sin inventar información nueva: la misma que ya se lee, ordenada por lo que se pregunta primero.

- **Portada con peso propio**, separada visualmente del resto — quién es, si está habilitado, si
  toma pacientes. Hoy es una tarjeta más entre seis.
- **Los cinco bloques restantes dejan de ser cinco tarjetas iguales.** Especialidades, formación y
  matrículas son *credenciales* y van juntas, agrupadas —con `app-tabs`, que el repo ya usa en
  `agenda.html:137`, o como secciones dentro de una sola tarjeta—; presentación y actividad son
  *quién es y qué hace*, y van arriba.
- **Las cinco pantallas del perfil se ven desde el perfil.** Trayectoria laboral, artículos,
  editar y vista pública dejan de ser dos botones sueltos y pasan a ser navegación declarada del
  perfil.
- **La foto se muestra si existe.** El módulo de archivos ya está (`core/data-access/files/`, del
  carril 12); si el perfil tiene imagen, va en la portada, y si no, sigue el avatar de iniciales
  —que es el comportamiento correcto para el caso vacío, no un defecto.

### 3 · Lo que hay que preguntar y no inventar

Hay datos que un doctor esperaría en su perfil y que **el backend no publica hoy** en
`me/summary`: dónde atiende y en qué horario, cómo lo contactan, qué cobra. Existen en otros
módulos (`practice-sites`, `scheduling`, `billing`) y **no se traen en este carril**: sumar tres
clientes nuevos a una pantalla que ya se criticó por larga es al revés. Se listan en el PR como
la pregunta explícita al cliente: *«¿es esto lo que le falta?»*.

## Archivos

**Nuevos:**

```
src/app/features/account/my-profile/practitioner-profile/practitioner-profile-view.ts + .html + .css + .spec.ts
```

**Que tocás:** todo dentro de
`src/app/features/account/my-profile/practitioner-profile/` y, si la navegación entre las cinco
pantallas lo pide, `my-profile.html`.

**Lo que NO tocás:** `work-history/`, `medical-articles/`, `public-profile-preview/` y
`practitioner-profile-edit/` **por dentro** —son pantallas terminadas de carriles anteriores; acá
sólo se las enlaza mejor—, `profiles.client.ts`, `terminology.client.ts`, `navigation.map.ts`,
`app.routes.ts` (R2-1 los toca) y **todo el backend**: este carril no pide una línea de API.

## Definición de hecho

- Existe `practitioner-profile-view` como componente presentacional puro, con su `.spec.ts`, y
  `my-profile` lo usa. R2-1 puede importarlo sin tocar una línea.
- La pantalla tiene jerarquía: la portada pesa distinto que los bloques, y las credenciales están
  agrupadas en vez de apiladas.
- Desde el perfil se llega a las cinco pantallas del perfil.
- **El cliente miró la pantalla nueva y dijo qué falta, o confirmó que ya está.** Este es el único
  criterio que cierra el punto 4 — el resto es condición necesaria, no suficiente. Cerrar el
  carril sin esa confirmación es repetir la ronda anterior.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build`.
