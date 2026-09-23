# El corpus «Bolivia Salud · Eje Central»

Los laboratorios y las farmacias que muestra la maqueta **existen**. Salen de una
investigación con procedencia por registro, no del generador de datos.

| | |
|---|---|
| Fuente | `data/bolivia-salud-eje-central/` (45 JSON) |
| Corte | 13/09/2026 |
| Alcance | La Paz, El Alto, Cochabamba y Santa Cruz de la Sierra |
| Fixture | `src/app/core/mock/fixtures/bolivia-eje-central.generated.ts` |
| Generador | `yarn mock:bolivia` |
| Prueba de deriva | `src/app/core/mock/fixtures/bolivia-eje-central.spec.ts` |

## Qué trae

| | |
|---|---|
| Laboratorios y centros | 10 |
| Sedes de laboratorio | 21 |
| Cadenas de farmacia | 5 |
| Sucursales de farmacia | 50 |
| Pruebas médicas | 1 035 |
| Categorías | 27 |
| Paneles y perfiles | 9 |
| Relaciones centro ↔ prueba | 252 |
| Fuentes citadas | 28 |

Los diez centros son Plexus, DR+ZUNA, SELADIS (UMSA), INLASA, CENETROP, Magnus,
Universo, Praxis, LabClinics y el laboratorio del Hospital San Juan de Dios. Las
cinco cadenas son Farmacorp, Hipermaxi, Farmacias Bolivia, Farmacias Chávez y
Económica.

## Dónde se ve

| Pantalla | Qué muestra |
|---|---|
| `/laboratory-directory` | Los diez centros, agrupados por categoría |
| `/laboratory-directory/:id` | Sus sedes, su catálogo y su vigencia |
| `/search/diagnostics` | Los mismos, en el buscador público |
| `/pharmacies-directory` | Las 50 sucursales, agrupadas por ciudad |
| `/public/nearby` y «dónde comprar mi receta» | Las sucursales con su punto en el mapa |

## Las tres cosas que este corpus se niega a afirmar

Y que la aplicación no puede afirmar por él.

### 1 · No hay coordenadas

`metadata/metodologia.json` pone «coordenadas» entre sus `criterios_no_inventar`.
Pero los directorios dibujan un mapa, así que el punto se **deriva** con
Nominatim (OpenStreetMap, el mismo proveedor que ya usan esos mapas) mediante
`tools/geocode-bolivia-corpus.py`, y viaja siempre con su precisión:

| Precisión | Sucursales | Qué significa |
|---|---:|---|
| `direccion` | 17 | Nominatim reconoció la dirección publicada |
| `via` | 28 | Reconoció la vía, sin el número |
| `zona` | 6 | Reconoció el barrio |
| `ciudad` | 20 | No reconoció nada: es el centro de la ciudad |

Las 20 de `ciudad` se muestran como ubicación aproximada. Ninguna coordenada se
escribe a mano.

### 2 · No hay códigos terminológicos

Los 1 035 registros traen `LOINC` y `SNOMED_CT` en `null`, porque el corpus no
los verificó uno por uno. El generador **descarta el campo entero**: uno que
siempre es nulo no informa. Hay una prueba que falla si alguna vez reaparece con
contenido.

### 3 · No todo lo registrado sigue abierto

El corpus distingue tres estados, y la distinción llega a la ficha:

| Estado | Sucursales | En pantalla |
|---|---:|---|
| Verificado en 2026 | 18 | «Verificada» |
| Línea base histórica | 44 | «Declarada» · vigencia no confirmada |
| Por reconciliar | 9 | Pendiente de reconciliar con el registro oficial |

35 de las 50 sucursales de farmacia llevan `vigencia_2026_no_inferida`: el corpus
dice que estaban así, no que sigan abiertas hoy. Una farmacia cerrada mostrada
como abierta es un viaje en vano, así que esa frase no se pierde por el camino.

## Lo que la maqueta sí deriva, y lo dice

### El catálogo de nueve de los diez centros

Sólo **Plexus publicó el suyo**, y el corpus lo recogió: 252 relaciones
verificadas. Los otros nueve no publicaron ninguno, así que su oferta se deriva
de los `services` que ellos mismos declaran —«hematología», «biología
molecular», «microbiología»…— acotada a las pruebas que alguna fuente acredita
como disponibles en Bolivia.

La traducción de servicio a categoría vive en `CATEGORIAS_POR_SERVICIO`, en
`bolivia-eje-central.ts`. Un servicio que no esté en esa tabla **hace fallar la
carga** en vez de desaparecer en silencio.

Cada centro lleva su `evidenciaDeOferta`: `CATALOGO_PUBLICADO` o
`DERIVADA_DE_SERVICIOS`.

### Los precios

**El corpus no publica ninguno.** Los que se ven los calcula el manejador y son
maqueta: viajan con la tarifa `MAQUETA` en vez de `PUBLICO`, y la ficha los
rotula «Precio de demostración». El rótulo no es cosmético: «precio público»
significa que el centro lo publicó, y de estos centros no sabemos ninguno.

## Lo que la maqueta NO inventa sobre estos centros

Tres cosas que sí se generan para los centros ficticios y **no** para los reales:

- **Opiniones y puntuación.** Van sin nota media. Fabricarle un 4,8 a SELADIS es
  una afirmación sobre una institución que existe.
- **Acreditaciones.** Nada de «Habilitación SEDES HAB-PLEXUS-2024»: sería un
  número de registro sanitario que nadie emitió.
- **Inventario de equipos.** Nada de «Sysmex XN-550, número de serie SN-1000»:
  sería el inventario de un laboratorio real, inventado.

Las tres secciones quedan vacías en la ficha, que es lo honesto.

Tampoco se afirma la atención sin cita ni la recepción de órdenes externas: el
corpus no lo declara, así que viajan en `null` y el sello no se dibuja. «No lo
sabemos» no es «no».

## Cómo se regenera

```bash
# 1 · las ubicaciones (incremental; sólo pide lo que falta)
python3 tools/geocode-bolivia-corpus.py

# 2 · el fixture
yarn mock:bolivia

# 3 · que no se haya separado de su fuente
yarn test --watch=false src/app/core/mock/fixtures/bolivia-eje-central.spec.ts
```

El generador es determinista: correrlo dos veces seguidas no cambia un byte.

## Peso

El fixture son 600 kB y vive en el **fragmento diferido** del simulador, el que
carga el `import('./handlers')` del interceptor. El paquete inicial sigue en
252 kB, igual que antes.
