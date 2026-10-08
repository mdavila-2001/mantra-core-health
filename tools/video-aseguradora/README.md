# Video del módulo de aseguradora (Alianza Seguros)

Graba una interacción continua sobre el app real de la rama `mockup`: la aseguradora se registra, entra con su cuenta y recorre el módulo, presentada como **Alianza Seguros y Reaseguros S.A.**:

1. **Registro.** Desde el inicio de sesión entra a «Registrá tu organización · Aseguradoras» y completa las 7 páginas del alta: la empresa, sus datos, los cinco documentos legales, el representante legal con su poder notariado, y las tres gerencias. El representante legal es el único que inicia sesión: su correo y su contraseña son los de la cuenta, no hay un paso «Tu cuenta» aparte.
2. **Login.** Tras «¡Bienvenido a AloVida!», entra con el correo y la contraseña que acaba de registrar.
3. **Mi perfil.** Muestra lo registrado: razón social, NIT, sigla y dirección.
4. **Mis productos.** Recorre los siete planes.
5. **Solicitudes recibidas.** Muestra la tarjeta del paciente, **aprueba** una solicitud abierta («Aprobar y facturar», que emite la factura) y **rechaza** otra con su motivo.
6. **Siniestralidad.** Solo la pestaña «Por persona»: genera el informe.
7. **Directorio de pacientes.** Hace una búsqueda.

## Cómo se corre

```sh
yarn start:dev                            # el app en http://localhost:4200, con el backend simulado
node tools/video-aseguradora/grabar.mjs   # --base <url> si el app corre en otro lado
node tools/video-aseguradora/grabar.mjs --hasta perfil   # ensayo: corta en «Mi perfil»
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

### 3. El alta y el login

Los datos del alta están en `datos-alta.mjs`. Todo se escribe en la pantalla real (`/auth/register/organization`); no hay pantallas ni handlers nuevos.

- **Subida de documentos (simulada).** Cada documento va por la zona de arrastre real: el script hace clic en ella, atiende el selector de archivos y entrega un PDF de ejemplo generado en memoria (`pdfDeEjemplo`). Es un PDF válido de una página que dice «DOCUMENTO DE EJEMPLO», con un peso creíble (100 a 430 KB). El handler existente `POST /iam/auth/upload-registration-document` lo acepta. Los seis (cinco legales y el poder) quedan «subidos» con su marca de verificación.
- **El login con la cuenta recién creada.** El simulador no crea usuarios al registrar: `buscarUsuario` (`mock-session.ts`) resuelve el login por la parte local del correo. Por eso el representante legal (que es el owner de la cuenta) se registra como `aseguradora@mail.com` y entra con ese mismo correo; el simulador lo reconoce como la cuenta de la aseguradora de prueba. Sin esto, el login respondería 401.
- **Coincidencia con «Mi perfil».** El NIT (`1020347028`, ficticio) y la sigla (`ALIANZA`, de la que la pantalla deriva el código `ALIANZA`) se reescriben en la capa de respuesta, para que «Mi perfil» muestre lo que se escribió en el registro. La pantalla usa el mismo campo para el NIT y para el «Registro ante el regulador», así que ese valor sale en los dos lugares.
- **Sin recargar.** Entre el registro y «Mi perfil» no hay `goto`: se navega solo con clics.
- **Fuera del video.** El alta real deja la organización pendiente de aprobación y manda un correo de verificación. El video no muestra ninguno de los dos pasos.

### 4. Solo para el video

- Oculta los botones flotantes «Datos de prueba» y «Ver componentes».
- Dibuja un cursor visible, con una onda en cada clic.

## Qué es exacto y qué es inventado

| Dato | Origen |
|---|---|
| Emisión Rápida, planes 1 a 4: cuota mensual Bs 90 / 120 / 180 / 250; muerte o invalidez Bs 3.000 / 5.000 / 10.000 / 15.000; beneficio educacional o canasta Bs 3.600 / 6.000 / 12.000 / 18.000; telemedicina ilimitada sin costo; consulta presencial con copago Bs 20 | **Publicado por la aseguradora** (`fuente: 'oficial'`) |
| Salud Mundial Plus: maternidad hasta Bs 700.000 | Publicado por la aseguradora |
| Cuotas de Plan Silver (Bs 380), Salud Mundial Plus (Bs 1.250) y Asistencia Familiar Integral (Bs 65); porcentajes, deducibles y topes de esos tres | **Referencial, inventado para la demo** (`fuente: 'referencial'`) |
| Personas, médicos, consultorios, pólizas, montos, dirección, NIT, contactos, gerencias, representante legal y los seis PDF del alta | Ficticios |

Quedan fuera Auto Alianza y TU Hogar. La pantalla muestra «Prima mensual» sin moneda y la analítica suma primas, así que una prima anual en dólares quedaría mal.

## Limitaciones conocidas

- **Mapa de la casa matriz.** El alta lo ofrece como opcional y el video no lo toca (pide teselas a internet).
- **Desplegables.** «Tipo societario» es un `<select>` nativo: en la grabación se ve el valor elegido, no la lista abierta.
- **Logo.** «Mi perfil» muestra «Sin logo»: no se usa la marca real de la aseguradora.
- **Calidad de imagen.** El video de Playwright sale en VP8 con una tasa de bits modesta. El texto se lee, pero puede verse un leve fantasma de compresión.
- **Filtro «Sexo» del directorio.** Solo ofrece «Todos»: el catálogo de la maqueta usa `GEN-F`/`GEN-M` y la pantalla espera `GENDER_*`.
