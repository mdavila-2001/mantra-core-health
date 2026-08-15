# Carril R2-1 · Guía de doctores por especialidad (en lugar del Muro profesional)

**Punto del reclamo, textual:**

> Sacar del perfil de paciente MURO PROFESIONAL, o cambiarle su enfoque: DEBE MOSTRAR UNA ESPECIE
> DE GUIA TELEFONICA DE TODOS LOS DOCTORES AGRUPADOS POR ESPECIALIDAD. ESTO DEBERIA TENER. Al
> darle clic debe mostrar su perfil del mismo completo con todo lo que hemos estado hablando.

**Repos:** backend + frontend. **Rama:** `carril-r2-1/guia-de-doctores`.
**Orden obligatorio:** este carril **mergea después de R2-4** — ver `CARRILES-R2-2026-08-14-README.md`.
**Coordinación:** postear el bloque en `COORDINACION-AGENTES.md` antes de tocar nada.

## Cómo se lee el pedido

El cliente da dos salidas ("sacar" **o** "cambiarle el enfoque") y acto seguido describe la
segunda con detalle. **Se hace la segunda.** El muro no se borra: se reemplaza por lo que el
cliente sí quiere en ese lugar del menú. La sección `feed` deja de ser un muro social y pasa a
ser una **guía de profesionales**, con tres requisitos que se cumplen literal o el carril no está
hecho:

1. Están **todos** los doctores, no una muestra ni un buscador que exige tipear primero.
2. Están **agrupados por especialidad** — la especialidad es el encabezado, no un filtro
   opcional. Una guía telefónica se hojea; no se interroga.
3. Un clic abre el **perfil completo**, el mismo que rehace R2-4. No una tarjetita con el nombre.

## Lo que hay hoy, y por qué no alcanza

**El muro que hay que reemplazar:**

- `src/app/core/navigation/navigation.map.ts:73-84` — sección `feed`, rótulo «Muro profesional»,
  grupo General, sin roles. La ve cualquiera con sesión, **incluido un paciente**: eso es
  literalmente lo que el cliente pide sacar.
- `src/app/features/feed/` — `feed.ts`, `feed.html`, `post-card/`. Lee
  `GET /community/feed` (`community.client.ts:338`). Es un muro de publicaciones de perfiles
  seguidos. Funciona; no es lo pedido.

**Lo que existe para construir la guía, y su techo:**

- `GET /public/directory?city=&specialty=` — `read_models/controllers/public-projections.controller.ts:23`.
  El frontend ya tiene cliente: `core/data-access/public/public.client.ts:62`.
  **Su techo, mirando el service** (`public-projections.service.ts:15-22`): devuelve exactamente
  cuatro campos —`slug`, `display_name`, `city`, `specialty`—, con página fija de **50**, leyendo
  la vista materializada `read_models.public_provider_directory`, y si la MV no está
  materializada **se degrada a vacío en silencio** (líneas 132-141). Sirve para el índice; no
  sirve para una ficha, no tiene teléfono y no garantiza que estén todos.
- `GET /community/profiles/:profileId` — `community-social.controller.ts:192`. Es el perfil
  público *social* (M19), no la trayectoria profesional.
- `GET /profiles/practitioners/me/summary` — `profiles-practitioners.controller.ts:66`. Es el
  perfil profesional completo, con especialidades, matrículas, credenciales e idiomas… **pero
  sólo el propio**. No existe ningún endpoint para leer el de otro profesional.

## Bloqueador de backend: el listado que no existe

`grep -n "@Get" src/modules/profiles/controllers/profiles-practitioners.controller.ts` devuelve
dos: `practitioners/me/summary` y `practitioners/me/affiliations`. **No hay listado de
profesionales y no hay lectura por identificador ajeno.** La guía no se puede construir sin eso,
y `/public/directory` no lo suple: cuatro campos, tope 50, y una MV que hoy puede estar vacía.

**Lo que este carril agrega al backend** (módulo `profiles`, exclusivo suyo esta ronda):

```
src/modules/profiles/controllers/profiles-practitioners.controller.ts   (extender, no reescribir)
src/modules/profiles/services/                                          (extender)
src/modules/profiles/dto/                                               (DTOs nuevos)
```

- `GET /profiles/practitioners` — listado paginado, filtrable por `specialtyConceptId`,
  ordenable por apellido. Devuelve lo que una guía necesita en la fila: nombre para mostrar,
  especialidad(es), sede/ciudad, teléfono de contacto profesional si es público, y el
  identificador con el que se abre la ficha.
- `GET /profiles/practitioners/:profileId/summary` — el mismo shape que ya devuelve
  `me/summary`, para un profesional ajeno. Reusá el service de `me/summary`: es el mismo
  contrato, cambia de dónde sale el sujeto.

**Roles:** el listado y la ficha son datos profesionales, no PHI. Seguí el criterio del propio
módulo (`me/summary` no exige rol, sólo sesión) y dejalo sin `@Roles` salvo que la revisión diga
lo contrario. El paciente tiene que poder usar la guía — es su menú el que la va a mostrar.

**Antes de tocar la entidad:** confirmá qué campo de contacto es publicable. Si el teléfono
profesional no está modelado o no tiene marca de visibilidad, **no lo agregues a mano**: declaralo
como bloqueador en `COORDINACION-AGENTES.md` (ver la advertencia de `SQL/` en el README de
carriles) y entregá la guía sin la columna teléfono, con el resto completo. No inventes el campo
ni lo derives de otra tabla.

**Ojo con el working tree:** la ronda anterior anotó que `profiles-practitioners.controller.ts`
puede tener cambios sin commitear de la rama `pablo/contabilidad-visible`. Verificalo antes de
arrancar.

## Frontend

**Archivos nuevos:**

```
src/app/core/data-access/practitioners-directory/practitioners-directory.client.ts + .types.ts + .spec.ts
src/app/features/directory/practitioners-directory.ts        + .html + .css + .spec.ts
src/app/features/directory/practitioner-detail.ts            + .html + .css + .spec.ts
```

- `practitioners-directory` es la pantalla que reemplaza al muro. **Agrupada por especialidad de
  entrada**, sin necesidad de escribir nada: encabezado por especialidad, y debajo los
  profesionales de esa especialidad. El buscador es un filtro **encima** de esa estructura, nunca
  la puerta de entrada — si al abrir la pantalla no se ven doctores, el punto sigue sin cumplirse.
- `practitioner-detail` es la ruta de destino del clic. **No pinta el perfil por su cuenta:**
  importa el componente presentacional que deja R2-4 y le pasa el perfil que trajo
  `GET /profiles/practitioners/:id/summary`. Si lo reimplementás, el punto 4 vuelve a rebotar.

**Archivos existentes que tocás:**

| Archivo | Qué le hacés |
|---|---|
| `src/app/core/navigation/navigation.map.ts` | **Editás la fila `feed`** (líneas 73-84): `path: 'directory'`, `label: 'Guía de profesionales'`, `summary` acorde, `module: 'M05 profiles'`. Es la única edición de fila ajena autorizada de la ronda, y es exclusiva de este carril |
| `src/app/app.routes.ts` | Repuntás la ruta `feed` a la pantalla nueva y agregás la ruta hija de detalle (`directory/:profileId`). La carga diferida se mantiene: el comentario de `app.routes.ts:50` explica por qué esa sección no es la primera pantalla de nadie |

**Qué pasa con `features/feed/`:** **no se borra en este PR.** El muro sigue existiendo como
código y sus tests siguen pasando; lo que se le saca es la entrada del menú. Borrarlo es una
decisión de producto que el cliente no pidió —dijo «sacar **del perfil de paciente**»— y que hay
que confirmarle antes, no de arranque. Anotalo como pregunta pendiente en el PR.

**Lo que NO tocás:** `features/feed/` y `post-card/` (siguen en pie), `community.client.ts` y
todo `src/modules/community/**` del backend (ahí trabajan los carriles 15 y 16 de la ronda
anterior y `PENDIENTES-RED-SOCIAL.md`), y `practitioner-profile/` del frontend, que es de R2-4.

## Definición de hecho

Se verifica leyendo la frase del cliente, no el diff:

- Un **paciente** entra, y donde antes decía «Muro profesional» ahora hay una guía.
- La guía muestra **todos** los doctores, **agrupados por especialidad**, sin escribir nada en
  ningún campo.
- Un clic en cualquiera abre su **perfil completo** — el de R2-4, el mismo que ve el doctor de sí
  mismo, no un resumen.
- Si el teléfono quedó fuera por el bloqueador de modelo, está dicho explícitamente en el PR y en
  `COORDINACION-AGENTES.md`. No se entrega en silencio.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend;
  `yarn lint` · `yarn typecheck` · `yarn test` · `yarn test:integration` en backend;
  `node scripts/check-route-prefixes.mjs` porque tocaste `navigation.map.ts`.
