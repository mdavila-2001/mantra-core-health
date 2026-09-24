/**
 * Forma del entorno. Vive aparte de los dos archivos que la implementan porque
 * `fileReplacements` sustituye `environment.ts` entero al compilar: si el tipo
 * viviera ahí, el archivo de desarrollo no podría importarlo sin quedar
 * atado al que va a ser reemplazado.
 *
 * Anotar ambos con este tipo es lo que impide que se separen sin que nadie se
 * entere.
 *
 * **Todo campo de esta interfaz es público.** Termina literal en el JavaScript
 * que descarga el navegador, legible con abrir las herramientas de desarrollo.
 * Agregar acá una clave de API, una contraseña o un token no es una filtración
 * potencial: es publicarlo. Lo que necesite secreto se resuelve en la API, que
 * es donde hay dónde guardarlo.
 *
 * Los valores concretos no se escriben en los archivos de entorno: los inyecta
 * `scripts/generate-env.mjs` desde el entorno del proceso y `.env` (ver
 * `env.generated.ts`), que además rechaza lo que tenga forma de credencial.
 */
/**
 * Identidad del artefacto que se está ejecutando.
 *
 * Existe para responder la primera pregunta de cualquier incidente: **qué
 * código está corriendo**. Sin ella no se puede correlacionar un reporte con un
 * commit, ni saber a qué versión volver al revertir.
 *
 * La rellena `scripts/generate-env.mjs` antes de cada build. Es información
 * pública —igual que el resto del paquete— y a propósito no lleva nada más:
 * el nombre de quien construyó, la rama o el entorno serían datos de la
 * organización viajando al navegador de cualquiera.
 */
export interface BuildInfo {
  /** La de `package.json`. */
  readonly version: string;
  /** Commit corto, o `'desconocido'` si el build no corrió dentro de un repo. */
  readonly commit: string;
  /** Momento del build, en ISO 8601. */
  readonly builtAt: string;
}

/**
 * Configuración pública de la telemetría del navegador.
 *
 * **Todo lo de acá es público**, igual que el resto de esta interfaz. Por eso
 * no hay ninguna credencial: el endpoint de trazas no lleva clave de API, y no
 * puede llevarla. Una clave incrustada en el paquete no autentica a nadie
 * —cualquiera la lee y la usa—, así que la protección del endpoint es del lado
 * del servidor: mismo origen, límite de tamaño y límite de tasa. Ver
 * `docs/observability/angular/01-architecture-design.md`.
 *
 * La versión y el commit **no están acá**: salen de {@link BuildInfo}, que ya
 * responde «qué código está corriendo». Duplicarlos sería garantizar que un día
 * digan cosas distintas.
 */
export interface TelemetryEnvironment {
  /**
   * Con `false` no se descarga el SDK, no se abre ningún span y no sale ninguna
   * petición. Es el valor por defecto en los dos entornos: la telemetría se
   * enciende de forma explícita en el despliegue que la quiera.
   */
  readonly enabled: boolean;
  /**
   * `service.name` del navegador. Distinto del servidor a propósito: Jaeger
   * agrupa por este campo, y con uno solo un render de 30 ms y una sesión de
   * veinte minutos quedarían en la misma estadística.
   */
  readonly serviceName: string;
  /** `service.namespace`. Agrupa los servicios del mismo producto. */
  readonly namespace: string;
  /** `deployment.environment.name`: `development`, `staging`, `production`. */
  readonly environment: string;
  /**
   * A dónde se mandan las trazas.
   *
   * Relativo a propósito: el navegador manda al mismo origen desde el que se
   * sirvió y el servidor reenvía al Collector. Así la política de seguridad de
   * contenido se queda en `connect-src 'self'` y no hay preflight que negociar.
   */
  readonly tracesEndpoint: string;
  /**
   * Proporción de trazas que se conservan, entre 0 y 1.
   *
   * La decisión se toma una vez por traza y la hereda toda su descendencia, así
   * que una traza muestreada llega completa hasta la base de datos del backend
   * en vez de quedar cortada a la mitad.
   */
  readonly sampleRatio: number;
}

export interface Environment {
  /**
   * Raíz de la API.
   *
   * Vacío significa **rutas relativas**, que es lo correcto cuando algo delante
   * de la aplicación resuelve el destino: en desarrollo lo hace el proxy del
   * servidor de Angular (`proxy.conf.json`), y en un despliegue de mismo origen
   * lo hace el servidor web.
   *
   * Se define por entorno con `PUBLIC_API_BASE_URL`. El generador la valida:
   * absoluta con http/https, sin query ni fragmento y sin `usuario:contraseña@`
   * embebidos —esa forma de autenticación acabaría en el paquete y en el
   * historial de peticiones—.
   *
   * Ningún componente ni servicio arma una URL absoluta a mano: siempre sale de
   * acá.
   */
  readonly apiBaseUrl: string;

  /**
   * Raíz del servicio de triage por IA (AlovidaAIService): convierte lo que el
   * paciente escribe o dicta en síntomas, partes del cuerpo y especialistas.
   *
   * Relativa por defecto (`/ai`), igual que las trazas: el navegador le habla
   * al mismo origen desde el que se sirvió, así la política de seguridad de
   * contenido se queda en `connect-src 'self'` y no hay CORS que negociar. En
   * el despliegue la resuelve Traefik; en `yarn start`, `proxy.conf.mjs`.
   *
   * Se define por entorno con `PUBLIC_AI_BASE_URL`. El servicio es público y
   * no lleva credencial: no hay nada que filtrar desde acá.
   */
  readonly aiBaseUrl: string;

  /** Ver {@link TelemetryEnvironment}. */
  readonly telemetry: TelemetryEnvironment;

  /**
   * Enciende la barra de casos de demostración de la ficha clínica.
   *
   * Es un interruptor de despliegue, no de compilación: un entorno de staging
   * armado para una demo lo enciende con `PUBLIC_DEMO_PRESETS=true` sin
   * recompilar distinto. En producción queda apagado por defecto para que
   * ningún médico cargue datos de demostración en una historia real.
   */
  readonly demoPresets: boolean;

  /**
   * Enciende la pestaña «QR» SIMULADA de la pantalla de pago del pedido de
   * farmacia (carril FAR-I5).
   *
   * La pasarela de pago real no existe: con este interruptor la demo muestra
   * el ciclo completo (QR con el monto → «simular pago aprobado» →
   * comprobante) siempre con el chip «DEMO» fijo. Apagado, la pestaña no se
   * renderiza y queda sólo el camino real de hoy: pagar en el mostrador.
   * Mismo carácter que `demoPresets`: interruptor de despliegue, no de
   * compilación.
   */
  readonly paymentDemo: boolean;

  /**
   * Siembra los datos de demostración de la billetera de puntos (carril
   * FAR-I6): una membresía con saldo, nivel y movimientos.
   *
   * **No decide si la pantalla existe** — el cliente pidió que el módulo esté
   * disponible, y lo está. Decide si hay algo sembrado que mostrar. Apagado, la
   * billetera se pinta igual y dice la verdad: que todavía no hay un programa
   * de puntos activo. Lo que no hace nunca es inventar un saldo sin marca.
   *
   * Se apaga solo cuando existan las lecturas reales del backend (el pedido
   * está en `COORDINACION-AGENTES.md`): ahí los datos vienen de la API y este
   * interruptor se retira.
   */
  readonly loyaltyDemo: boolean;

  /**
   * Siembra las campañas de farmacia (carril FAR-I7) y enciende su chip
   * «DEMO».
   *
   * A diferencia de `loyaltyDemo`, acá el interruptor **sí decide si hay
   * secciones**: sin campañas no se pinta una sección vacía decorativa, ni en
   * la ficha de la farmacia ni en el pedido. Es la regla del carril, no una
   * consecuencia del apagado.
   *
   * Va con chip y no en silencio porque una promoción promete un precio, y hoy
   * ningún backend lo honra: `promotions` y `marketing` no publican una sola
   * lectura, y el modelo todavía no relaciona campaña con productos (el pedido
   * a Marcelo está en `COORDINACION-AGENTES.md`). Un descuento sin marca sería
   * exactamente la pantalla que finge que algo real ocurrió.
   */
  readonly campaignsDemo: boolean;

  /**
   * Rama `mockup`: la aplicación no habla con ninguna API. Un interceptor
   * responde cada petición desde datos de prueba en memoria, con todas las
   * pantallas pobladas. Ver `src/app/core/mock/`.
   */
  readonly mockBackend: boolean;
}

/**
 * Lo que el generador puede aportar: cada campo puede faltar, y lo que falte lo
 * completa el archivo de entorno con su valor por defecto.
 *
 * Es un tipo aparte y no `Partial<Environment>` porque `telemetry` también
 * tiene que ser parcial: definir `PUBLIC_TELEMETRY_ENABLED` en el `.env` no
 * obliga a definir las otras cinco.
 */
export interface EnvironmentOverrides {
  readonly apiBaseUrl?: string;
  readonly aiBaseUrl?: string;
  readonly telemetry?: Partial<TelemetryEnvironment>;
  readonly demoPresets?: boolean;
  readonly paymentDemo?: boolean;
  readonly loyaltyDemo?: boolean;
  readonly campaignsDemo?: boolean;
  readonly mockBackend?: boolean;
}
