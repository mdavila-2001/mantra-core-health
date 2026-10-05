# Video del módulo de aseguradora (Alianza Seguros)

Graba una interacción continua sobre el app real de la rama `mockup`, iniciando sesión como la aseguradora y presentándola como **Alianza Seguros y Reaseguros S.A.**:

1. **Mi perfil.**
2. **Mis productos.** Recorre los siete planes.
3. **Solicitudes recibidas.** Muestra la tarjeta del paciente, **aprueba** una solicitud abierta («Aprobar y facturar», que emite la factura) y **rechaza** otra con su motivo.
4. **Siniestralidad.** Solo la pestaña «Por persona»: genera el informe.
5. **Directorio de pacientes.** Hace una búsqueda.

## Cómo se corre

```sh
yarn start:dev                            # el app en http://localhost:4200, con el backend simulado
node tools/video-aseguradora/grabar.mjs   # --base <url> si el app corre en otro lado
```

Necesita ffmpeg con libx264. Instalalo con `winget install Gyan.FFmpeg` o indicá la ruta del ejecutable en `FFMPEG_PATH`. El ffmpeg que trae Playwright no sirve: solo escribe WebM.

La salida va a `artifacts/video-aseguradora/`, que git ignora:

| Archivo | Qué es |
|---|---|
| `alianza-aseguradora-1080p.mp4` | El video: H.264, 1920×1080. |
| `portada.png` | La portada. |
| `marcas.json` | El segundo en que empieza cada pantalla. |
| `NN-<pantalla>.png` | Una captura por pantalla, como evidencia. |

El script falla (salida 1) en cualquiera de estos casos:

- aparece «Andina» o un dominio `.mock` en pantalla;
- hay un error de página;
- el simulador responde `[mock] sin manejador`.

## Qué cambia y qué no

**Los datos de Alianza viven solo en este script.** La maqueta del repo (cuenta, handlers y fixtures de Seguros Andina) no cambia, y fuera del video el app se sigue viendo como siempre. El script hace tres cosas.

### 1. Siembra

Antes de que cargue el app, escribe en `sessionStorage` tres colecciones del simulador, con el sello `buildInfo.commit`. Es el mismo formato que usa `Coleccion.persistirEn`.

| Clave | Contenido |
|---|---|
| `mock-insurance-administration` | El catálogo. |
| `mock.insurerReceivedClaims` | Las solicitudes. |
| `mock.insurance.patients` | El directorio. |

Si el sello no coincide con el build que sirve `ng serve`, el simulador descarta la siembra sin avisar. Por eso el script lee el sello de `src/environments/env.generated.ts`.

### 2. Capa de respuesta

El simulador entrega cada respuesta con `structuredClone` (función `desconectar` en `mock-backend.interceptor.ts`). El script envuelve esa función y reescribe solo lo que la siembra no alcanza:

- el nombre de la cuenta dentro del JWT;
- la organización que muestra «Mi perfil»;
- los correos `@….mock`, que pasan a `@mail.com`;
- `messaging.available` de las personas del video, porque en la maqueta no tienen perfil de mensajería. El video no pulsa «Enviar Mensaje»: si alguien lo hiciera, el simulador respondería 412.

Es el equivalente a interceptar la red, que en la maqueta no existe. Los componentes pintan lo que reciben: no se edita texto del DOM.

### 3. Solo para el video

- Oculta los botones flotantes «Datos de prueba» y «Ver componentes».
- Dibuja un cursor visible, con una onda en cada clic.

## Qué es exacto y qué es inventado

| Dato | Origen |
|---|---|
| Emisión Rápida, planes 1 a 4: cuota mensual Bs 90 / 120 / 180 / 250; muerte o invalidez Bs 3.000 / 5.000 / 10.000 / 15.000; beneficio educacional o canasta Bs 3.600 / 6.000 / 12.000 / 18.000; telemedicina ilimitada sin costo; consulta presencial con copago Bs 20 | **Publicado por la aseguradora** (`fuente: 'oficial'`) |
| Salud Mundial Plus: maternidad hasta Bs 700.000 | Publicado por la aseguradora |
| Cuotas de Plan Silver (Bs 380), Salud Mundial Plus (Bs 1.250) y Asistencia Familiar Integral (Bs 65); porcentajes, deducibles y topes de esos tres | **Referencial, inventado para la demo** (`fuente: 'referencial'`) |
| Personas, médicos, consultorios, pólizas, montos, dirección, NIT y contactos | Ficticios |

Quedan fuera Auto Alianza y TU Hogar. La pantalla muestra «Prima mensual» sin moneda y la analítica suma primas, así que una prima anual en dólares quedaría mal.

## Limitaciones conocidas

- **Logo.** «Mi perfil» muestra «Sin logo»: no se usa la marca real de la aseguradora.
- **Calidad de imagen.** El video de Playwright sale en VP8 con una tasa de bits modesta. El texto se lee, pero puede verse un leve fantasma de compresión.
- **Filtro «Sexo» del directorio.** Solo ofrece «Todos»: el catálogo de la maqueta usa `GEN-F`/`GEN-M` y la pantalla espera `GENDER_*`.
