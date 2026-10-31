# Recorrido completo de AloVida: mapa de la aplicación

Este documento describe la aplicación tal como funciona hoy. Sale de un recorrido automático
hecho el **2026-10-31** sobre la rama `dev` (commit `b4de5c8c`). El recorrido se hizo con el
**simulador** (`yarn start:demo`): todos los datos son sintéticos y ninguna petición sale a la
red. Para ver pantalla por pantalla, por rol, ver [atlas-pantallas.md](atlas-pantallas.md).
Los problemas encontrados están en [hallazgos.md](hallazgos.md). Las oportunidades de
marketing están en [../marketing/oportunidades-alovida.md](../marketing/oportunidades-alovida.md).

## Cómo se recorrió

| | |
|---|---|
| Rutas que declara el router (leídas en ejecución) | **414** únicas: 366 sin identificador y 46 con identificador |
| Rutas alcanzadas y pintadas | **392 de 414**, más 15 fichas por identificador en una pasada dirigida |
| Visitas totales | **1.274** en escritorio (1440×900), con las 12 cuentas, y **515** en móvil (390×844), con el visitante sin cuenta, la paciente, la médica y la farmacia |
| Cuentas | Visitante sin sesión y las 11 cuentas del simulador |
| Alta de usuario | De punta a punta en escritorio y móvil; `carril-03-alta-paciente.spec.ts` 3/3 en verde |
| Por cada visita se guardó | Captura, título, texto, botones, errores de consola, excepciones, llamadas que el simulador no sabe responder y desborde horizontal |

Las rutas que no se alcanzaron son de dos tipos:

- **Contenedores que solo redirigen a una pantalla hija:** `/`, `/people`, `/vocabulary`,
  `/shared-data`, `/access-control` y `/provider-directory`.
- **Rutas que no tienen enlace navegable en el simulador:**
  - `/medical-center-setup` devuelve al panel a la cuenta de administración.
  - `/p/:slug/post/:postId`: las publicaciones se abren con botones, no con enlaces.
  - `/verify/portability/:manifestHash`

Cómo repetirlo está en [herramientas/](herramientas/).

> **Aviso.** Lo que muestra el simulador **no** prueba que la API real funcione. Este
> recorrido demuestra qué pinta y cómo navega el front. Las altas, las reservas y los pedidos
> se guardan en el `sessionStorage` de la pestaña.

## Las tres caras del producto

### 1. Cara pública, sin cuenta

El visitante sin cuenta tiene un **riel lateral de iconos** con estas entradas:

- Publicaciones
- Buscar
- Profesionales
- ¿A quién consulto?
- Medicamentos
- Hospitales y clínicas
- Laboratorios e imagen
- Aseguradoras

En la barra superior tiene el buscador global, el botón rojo **Emergencia**, el tema
claro/oscuro, **Entrar** y **Crear cuenta**.

| Ruta | Qué es | Renderizado |
|---|---|---|
| `/posts` (portada) | Red social: «Doctores en tendencia esta semana», publicaciones de profesionales y un bloque **«ESPACIO PAGADO»** (anuncio de una clínica) | Cliente |
| `/search` | «Busque salud cerca de usted»: profesionales, medicamentos, hospitales, laboratorios y aseguradoras. No pide cuenta | **SSR** |
| `/search/symptoms` | «Consulte sus síntomas»: mapa del cuerpo en 3 vistas o texto libre y dictado. Orienta hacia una especialidad y aclara que «no es un diagnóstico» | Cliente |
| `/search/practitioners` | Directorio de profesionales con sello de verificación de matrícula e identidad | **SSR** |
| `/search/medications` | «Mire dónde conseguirlo, antes de salir de su casa»: precio y stock por farmacia, «desde Bs», distancia. Aclara que «**AloVida no vende medicamentos ni cobra comisión**» | **SSR** |
| `/search/hospitals` · `/search/diagnostics` · `/search/insurers` | Centros, laboratorios e imagen (con requisitos previos y precio), aseguradoras y su red de prestadores | **SSR** |
| `/search/map` | «Cerca mío»: farmacias abiertas, emergencias y laboratorios, con consentimiento de ubicación | Cliente |
| `/home` | **Landing B2B** «Toda la operación de su red de salud… en una sola historia». Tiene las secciones Historia, Plataforma, Cómo funciona, En el teléfono, Confianza y Preguntas, con CTA **«Solicitar acceso»** | Cliente |
| `/directory`, `/clinics-directory`, `/pharmacies-directory`, `/laboratory-directory`, `/insurers-directory` y sus fichas `/:slug` | Directorios con ficha | Cliente |
| `/p/:slug` · `/o/:slug` · `/f/:slug` · `/l/:slug` · `/s/:slug` | Perfiles públicos cortos de profesional, organización, farmacia, laboratorio y aseguradora. Llevan `og:*` y JSON-LD | **SSR** |
| `/promotions/:campaignId` | Detalle público de una promoción | Cliente |

### 2. Alta de usuario e ingreso

- **`/auth` (login).** Se entra con correo o con documento de identidad, más la contraseña. Si
  la persona pertenece a varias organizaciones, pasa por `/auth/organization` para elegir con
  cuál entra.
- **`/auth/register`: «¿Qué tipo de cuenta necesita?».** Ofrece dos cuentas:
  - **Paciente**: «Su historia clínica, sus citas y sus estudios, siempre con usted».
  - **Médico**: «Atienda, recete y lleve su agenda. Necesita matrícula y colegio».
- **Altas de organización** (`/auth/register/organization`, `organization-type`, `pharmacy`,
  `laboratory`, `imaging-center`, y centro médico).
  - Laboratorio e imagenología dejan una **solicitud**, no una cuenta (ver
    `.agents/product-marketing.md`).
- **Alta de paciente: 5 pasos** con barra de progreso.
  1. Identidad y ocupación: nombre, apellidos, CI con departamento de emisión, fecha de
     nacimiento y género.
  2. Lugares donde vive: mapa Leaflet, se marca el punto y se confirma la dirección.
  3. Datos de contacto y emergencia: celulares (con «+» para sumar más) y contactos de
     emergencia con parentesco.
  4. Empresa y lugar de trabajo: opcional, con un segundo mapa.
  5. Resto de datos: correo, contraseña, seguros y facturación (NIT y razón social).
- **Cierre del alta.** Muestra «¡Bienvenido a AloVida! Su salud en un solo lugar · Le enviamos
  un correo para confirmar su dirección».
- **Cuenta nueva sin confirmar.** Hasta que no confirma el correo no entra: el login responde
  «Las credenciales no son válidas».
- **Rutas de recuperación:** `/auth/forgot-password`, `reset-password`, `verify-email`,
  `resend-verification` y `activate`.

### 3. Área con sesión

**Estructura común a todas las pantallas:**

- **Marco:** barra lateral azul con degradé y logo AloVida. Arriba, «Mi perfil» y
  «Notificaciones»; debajo, las secciones de cada rol.
- **Barra superior:** selector de organización, «Red social», chats, solicitudes, ajustes,
  campana con contador, tema y avatar.
- **Miga de pan y estados:** cada pantalla lleva miga de pan («Panel / … »). Los estados de
  carga, vacío y error son contrato (`ViewState`, nueve estados M34).
- **Responsive:** en móvil la barra lateral pasa a un menú hamburguesa y la barra superior se
  compacta. Aparece un botón rojo de llamada de emergencia.

## Qué ve cada rol

Los menús que siguen son los reales, leídos en ejecución.

### Paciente

**Menú:** Mi perfil · Notificaciones · Directorios · Dependientes · Mi privacidad · Mis citas ·
Farmacia · Mi historia clínica · Mis resultados · Mis órdenes · Cotizaciones · Red social ·
Chats · Mis encuestas · Mis solicitudes · Mis gastos · Carrito · Ajustes.

- **Panel:** saludo según la hora, «Conozca AloVida en 1 minuto» (tutorial) y «¿Cómo se
  siente?» (mapa corporal → especialidad). Tiene un acceso a líneas de contención emocional.
  Debajo, citas e historia.
- **Citas:** busca en el directorio → abre la ficha del profesional → elige un cupo
  (`/my-account/appointments/book/:slotId`) → retiene el cupo → la reserva queda como
  **solicitud**, porque «el paciente solicita; el mostrador confirma».
- **Farmacia:**
  - «¿Dónde comprar mi receta?» (`/my-account/medical-record/where-to-buy/:requestId`).
  - Mis recetas, carrito, confirmar pedido, entrega y pago.
  - Pedido con su estado en palabras, comprobante y factura.
- **Historia clínica, resultados y órdenes:** órdenes con las indicaciones para hacerse el
  estudio, resultados validados por un profesional, y gastos.
- **Privacidad y dependientes:** consentimientos, quién accede a su historia, solicitudes de
  vínculo y personas a cargo.
- **Social:** red social, chats y encuestas o cuestionarios (`/my-account/questionnaires`).
  También hay una sección de promociones (`/my-account/promotions`) que no figura en el menú.

### Médica o médico

**Menú:** Directorios · Grupos y foros · Consultas médicas · Archivo clínico · Mis pacientes de
cabecera · Glosario · Formularios · Mis servicios · Cotizaciones · Grupos médicos ·
Contabilidad · Mis organizaciones · Red social · Chats · Mis facturas · Mis solicitudes.

- **Consultas médicas (`/schedule`):** agenda por día y semana, con reservas en todos los
  estados. La médica del simulador atiende los siete días en dos sedes.
- **Expediente (`/medical-records/:id`):**
  - Consulta clínica en `/consultation`.
  - Solicitud de vinculación con el paciente en `/request-access`.
- **Glosario clínico:** atlas anatómico 3D, mapa de relaciones entre términos y comparador.
- **Su vitrina:** artículos médicos (`/my-account/articles`), servicios propios con
  importación del arancel, y grupos médicos.
- **Gestión:** contabilidad y facturas.
- **Médico recién registrado:** tiene el mismo menú. Además pasa por `/onboarding` («Complete
  su perfil»).

### Farmacia (encargada y mostrador)

**Menú:** Resumen · Catálogo · Horario y turnos · Solicitudes de retiro · Promociones ·
Sucursales.

- **Solicitudes de retiro:** bandeja del mostrador con alarma sonora, sede y pedidos «Nuevos /
  Pendiente / Recojo en mostrador».
- **Catálogo:** alta, carga masiva por CSV, «sin stock», edición y retiro de productos.
- **Promociones:** campañas de tipo Precio, Cantidad, Total, Combos o Puntos, con vigencia.
  - En el simulador el cartel dice «**DEMO** — Las campañas viven en esta sesión: todavía no
    hay dónde guardarlas».
  - Las campañas se ven en la ficha y en el pedido del paciente.
- **Chat con el paciente:** desde cada pedido, escribiendo **como la farmacia**.

### Laboratorio clínico

**Menú:** Resumen · Recepción de muestras · Cola de trabajo · Resultados · Precios ·
Sucursales.

### Aseguradora (administración y personal)

**Menú:** Mis productos · Solicitudes de seguro · Siniestralidad y analítica · Solicitudes
recibidas · Pacientes de la aseguradora · **Campañas preventivas** · Mi organización.

- **Campañas preventivas:** campañas junto con laboratorios e importadoras, con bonificación
  (100 %, 80 %, 50 %), vigencia y diagnóstico que previenen. Estados: Activa, Borrador,
  Pausada y Vencida.
  - Ejemplos del simulador: Chequeo cardiovascular, Despistaje de diabetes tipo 2, Mamografía
    y Vacunación antigripal.

### Visitador médico (laboratorio farmacéutico)

**Menú:** Grupos y foros · Mis visitas médicas · Glosario, más la consola de farmacia (ver
hallazgos). Gestiona solicitudes de visita a médicos, una agenda de visitas y sus registros.

### Administración y superadministración

**Menú:** Pacientes · Admisiones · Usuarios · Organizaciones · Brokers · Acceso delegado ·
Proveedores de identidad · Verificación de identidad · Terminología · Paquetes de contenido
(solo superadmin) · Moderación · Catálogo de servicios · Formularios clínicos · Contexto
sanitario · Geolocalización · Laboratorio médico · Laboratorio farmacéutico · Facturación ·
Contabilidad · Observabilidad · Catálogo de datos · Portal de inventario · Catálogo de flujos ·
Orquestación de pruebas · **Analítica web** · Operación · Sistema de diseño.

- **Analítica web (`/superadmin/web-analytics`):** pestañas Resumen, Rendimiento, Embudos,
  Altas y Deserción, Sesiones y Pipeline.
  - Mide eventos, sesiones, sujetos seudónimos con consentimiento y vistas de página.
  - Tablas «rutas con más actividad» y «eventos más frecuentes» (`page_view`,
    `search_performed`, `booking_started`).
- **Pantallas de referencia de diseño:** el superadmin tiene más de 120 maquetas portadas (por
  ejemplo, `/people/*`, `/vocabulary/*`, `/shared-data/*`, `/access-control/*`,
  `/provider-directory/*`, `/superadmin/*`). Llevan el rótulo «Referencia de diseño, no la
  aplicación».
  - Solo están encendidas con `designMockups: true` (configuración demo).

### Aprobador de admisiones

Revisa las admisiones en `/administration/admissions/...`. Su menú mezcla secciones de
paciente y de aseguradora (ver hallazgos).

## Lo que el front no muestra pero existe detrás

Esta sección resume el backend, la app móvil y el servicio de IA. El detalle, con rutas de
archivo, está en la sección «Capacidades de backend» de
[../marketing/oportunidades-alovida.md](../marketing/oportunidades-alovida.md).

- **API `mantra-core-health-api`:** NestJS, 70 módulos. Cuenta con módulos de marketing
  (segmentos, campañas, journeys, enlaces rastreados, atribución), ads, crm,
  promotions/loyalty/referrals, community, messaging, telemetry, surveys y education.
  - **Mensajería real:** in-app, correo por Gmail API (requiere OAuth) y web push con VAPID
    (apagado por omisión).
  - **No hay SMS, WhatsApp ni push nativo.**
- **App móvil Flutter:** solo existe el sistema de diseño y una pantalla de inicio de relleno.
  No tiene red, ni sesión, ni push.
- **AlovidaAIService:** triage por texto hacia una de 36 especialidades, con 12 síntomas de
  alarma que derivan a emergencias. Además sugiere diagnósticos tentativos al profesional y
  tiene un asistente clínico con citas.
  - Es público, limitado a 30 peticiones por minuto, y no guarda el texto.
