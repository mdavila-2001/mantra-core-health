# A.2 · `dev` → `mockup`: el merge, resuelto hasta donde se puede sin decidir producto

**Rama:** `pablo/merge-dev-en-mockup` · **Base:** `origin/mockup` + `dev` (109 commits por delante)
**Estado:** los **25 conflictos están resueltos**; quedan **tres pantallas** que no son un
conflicto de texto sino dos implementaciones distintas de la misma cosa, y elegir cuál sobrevive
es una decisión de producto.

> **Esta rama no compila todavía.** Está a propósito: es trabajo guardado, no un candidato a
> mergear. No la lleves a `mockup` hasta cerrar la sección «Lo que falta».

---

## Por qué duele este merge

Las dos ramas construyeron **las mismas pantallas dos veces**. `mockup` las hizo contra su
simulador entre el 11 y el 13 de septiembre; `dev` las recibió mergeadas de C.1, C.2 y los
copagos entre el 15 y el 16. Git no puede saber cuál gana, así que donde las dos tocaron el
mismo archivo lo unió — y en tres casos el resultado son dos copias del mismo miembro.

La regla que aplicó esta resolución es la del AC-A2-01: **gana `dev` cuando el conflicto es
«campo simulado contra campo real»**, y gana `mockup` cuando es **sólo ergonomía**, que es lo
que el AC-A2-02 manda preservar.

---

## Lo que ya está resuelto (22 archivos)

| Archivo | Quién ganó | Por qué |
|---|---|---|
| `PENDIENTES-BACKEND.md` | unión | `mockup` trae P30/P31, `dev` trae el cierre de P32/P33. Los dos son ciertos |
| `docs/reports/generated/*` | regenerado | `node scripts/audit-design-views.mjs`. No se fusionan a mano |
| `practice-sites.types.ts` · `.client.ts` | **dev** | El campo se llama `isOwnSite`, no `esPropio`. Lo dice el propio PENDIENTES |
| `mock/handlers/practice.handlers.ts` · `public.handlers.ts` | renombrados | El simulador ahora sirve `isOwnSite`; si no, la maqueta dibuja a todos como ajenos |
| `work-history.html` | **mockup** + testids | Se conserva la ergonomía (insignia en línea, tres acciones en ícono, padrón) y se renombra el campo. Se agregan `sede-propia-marca` y `sede-ajena-marca`, que las pruebas de `dev` necesitan |
| `work-history.css` | **mockup** | Acompaña al marcado que quedó |
| `work-history.spec.ts` | unión | Conviven los cuatro bloques: los tres de `mockup` y el de P32/P33 de `dev` |
| `work-history.ts` | dedupe | Ver abajo |
| `site-bank-qr-dialog.spec.ts` | **dev** | El diálogo del QR contra el endpoint real |
| `public-directory.client.ts` | **dev** | `GET .../reviews` ya existe (P31 cerrado) |
| `public-profile-reviews.*` | **dev** | Ídem. **Ojo: esto es lo que rompe la ficha pública. Ver abajo** |
| `cockpit.html` | **dev** | La nota «lo sirve el simulador» dejó de ser cierta con C.4 |
| `agenda.html` | mezcla | Hunk 1 `mockup` (los filtros no se muestran en «Mi agenda»), hunk 2 `dev` (el botón de reprogramar, que `mockup` no tiene), hunk 3 `mockup` (reservar en ícono) |
| `agenda.ts` | **mockup** | `rangoDeVentana`, que `dev` no tiene |
| `appointments.html` · `.spec.ts` | **dev** | Copagos del paciente (PR #400/#454), que el AC-A2-01 nombra explícitamente |
| `my-profile.html` | **dev** | Ídem: usa `app-patient-coverage-card` |
| `mock/fixtures/conceptos.ts` | **mockup** | El glosario curado reemplaza a las siete categorías inventadas |
| `mock/handlers/directory.handlers.ts` | **dev** + `ROJAS` | Se toma el formato de `dev` y se devuelve el consultorio de la Dra. Rojas, que es la única sede que hace verdadero el `isOwnSite` del simulador |
| `mock/handlers/{diagnostics,pharmacy,profiles}.handlers.ts` | unión | Eran choques de línea de `import`, nada más |

### El dedupe de `work-history.ts`

Git unió los dos bloques en vez de reconocerlos como el mismo. De cada par se conservó **la
copia de `dev`** —la que habla de `isOwnSite` y del `PATCH` parcial— y se borró la de `mockup`:

`consultorioPropio`, `sedeEnEdicion`, `sedeConQrAbiertoId`, `sedeConQrAbierto`,
`abrirEdicionDeSede`, `abrirQrDeSede`, `cerrarQrDeSede`, `etiquetaDeRetiro`.

Lo que **sólo** tiene `mockup` no se tocó y sigue vivo: el padrón (`buscarLugar`, `atiendoAca`,
`lugarElegido`, `lugaresDelPadron`), el cambio de sección (`muestraConsultorios`,
`muestraHistorial`) y las etiquetas del QR (`tieneQrBancario`, `etiquetaDelQr`).

---

## Lo que falta, y por qué no lo decide quien mergea

Las tres son la misma forma: **`mockup` y `dev` implementaron la pantalla dos veces, distinto**.
No hay una resolución «correcta» de texto; hay que elegir cuál ve el cliente.

### 1 · La ficha pública y sus opiniones — **bloquea la compilación**

```
public-profile-card.ts(20): Module '../public-profile-reviews/public-profile-reviews'
                            has no exported member 'PestanaDeOpiniones'.
```

- **`mockup`** hizo las opiniones como un **modal de dos pestañas** («opiniones» y
  «estrellas»), y su `public-profile-card` lo abre pasándole `pestanaInicial`.
- **`dev`** las hizo como la **sección «Opiniones de pacientes» dentro de `/p/:slug`**
  (AC-C2-03), contra el endpoint real de P31.

Esta resolución tomó la de `dev` —es la que el AC-A2-01 pide— y con eso la tarjeta de `mockup`
quedó importando un tipo que ya no existe.

**Las dos salidas, y las dos son legítimas:**

- Quedarse con la sección de `dev` ⇒ hay que adaptar `public-profile-card` para que deje de
  abrir el modal (borrar `opinionesAbiertas`, `abrirOpiniones` y el `<app-public-profile-reviews>`
  del marcado, y enlazar a la sección).
- Quedarse con el modal de `mockup` ⇒ hay que reescribir su componente contra el contrato real
  (`PublicProfileReviewsPage`, que trae el promedio junto con la lista).

### 2 · `public-directory.types.ts`

```
types.ts(390): Property 'publishedAt' must be of type 'Date', but here has type 'Date | null'.
client.ts(42,435): Duplicate identifier 'WireReview'.
```

Mismo par de arriba, un piso más abajo: las dos ramas declararon `PublicProfileReview` con
formas distintas y el merge dejó las dos. Se resuelve solo en cuanto se decida el punto 1: se
borra la declaración de la implementación que no sobreviva.

### 3 · Nada más

Fuera de esos dos archivos y su tarjeta, `yarn typecheck` está limpio.

---

## Cómo terminarlo

```bash
git checkout pablo/merge-dev-en-mockup
# 1 · decidir el punto 1 y borrar la implementación que no sobreviva
# 2 · dedupe de public-directory.types.ts / .client.ts
yarn stock:generate && yarn typecheck   # tiene que dar 0
yarn lint && yarn test && yarn build
```

Y recién entonces:

```bash
git checkout mockup && git merge pablo/merge-dev-en-mockup
git push origin mockup     # dispara el redespliegue de Coolify
```

### Lo que queda del AC-A2-03, y que no se puede hacer desde acá

El redespliegue en `https://pablo-h310.taila8f993.ts.net:8443` y su prueba en vivo
—`/accounting/fiscal-years` y `/patients/me/summary` respondiendo datos reales, HTTP 200 en SSR
sin errores de hidratación ni 502 de Nginx— son operación sobre el servidor. El
`NO_EVIDENCE_NO_DONE` del repo pide prueba de navegador para cualquier afirmación visual de este
merge, y esa prueba se saca ahí.
