/*
 * Modelo C4 del frontend Mantra Core Health.
 *
 * Fuente oficial de los diagramas de arquitectura. Los Mermaid de `docs/` son
 * su lectura, no su origen: si los dos se contradicen, manda este archivo.
 *
 * Se renderiza con Structurizr Lite, que NO es una dependencia del proyecto y
 * no hace falta instalar para trabajar en el frontend:
 *
 *   docker run --rm -p 8080:8080 -v "$PWD/structurizr:/usr/local/structurizr" \
 *     structurizr/lite
 *
 * Todo lo declarado acá está verificado contra el código. Lo que no existe
 * todavía —la imagen de producción, el CDN— NO se modela: un diagrama que
 * dibuja lo que no hay es peor que uno incompleto.
 */
workspace "Mantra Core Health — Frontend" "Ecosistema ALOVIDA · aplicación web de salud" {

    model {
        paciente = person "Paciente" "Entra con su documento de identidad. El correo es opcional."
        profesional = person "Profesional de salud" "Entra con su correo. Necesita matrícula y número de colegio para registrarse."
        administrador = person "Administrador de organización" "Da de alta usuarios."

        correo = softwareSystem "Correo electrónico" "Lo envía la API. Los enlaces vuelven al frontend con un token en el query string." {
            tags "Externo"
        }

        api = softwareSystem "API ALOVIDA" "NestJS. Autoridad de autenticación, autorización y datos. Repositorio mantra-core-health-redesa-api." {
            tags "Externo"
        }

        frontend = softwareSystem "Frontend Mantra Core Health" "Aplicación Angular 21 con renderizado en servidor." {

            spa = container "Aplicación Angular" "Signals, standalone, sin store externo. 516,70 kB iniciales." "Angular 21 / TypeScript 5.9" {

                # --- capa core ---------------------------------------------
                sessionStore = component "SessionStore" "Estado de la sesión en memoria. Dos señales de escritura, diez derivadas del token." "@Injectable providedIn root"
                authService = component "AuthService" "Caso de uso de la sesión: abrir, cerrar, recuperar." "@Injectable"
                refreshStorage = component "RefreshTokenStorage" "Persiste SOLO el refresh token en localStorage. Degrada si el navegador lo bloquea." "@Injectable"
                authGuard = component "authGuard" "S1 del M34: autoriza la ruta ANTES de pedir datos. Tres caminos." "CanActivateFn"
                authInterceptor = component "authInterceptor" "Añade Authorization y X-Tenant-Id. Refresca una sola vez ante un 401." "HttpInterceptorFn"
                tokenRefresh = component "TokenRefreshService" "Garantiza una sola petición de refresco en vuelo." "@Injectable"
                errorMapper = component "errorToViewState" "Traduce un fallo de la API a uno de los 9 estados del M34. Ramifica por code, nunca por message." "función"
                viewState = component "ViewState<T>" "Los 9 estados de UX del M34, como unión discriminada. 14 importadores." "tipos + constructores"
                themeService = component "ThemeService" "Preferencia de tema. Estampa data-theme en el documento." "@Injectable"
                breakpoints = component "Breakpoints" "Mide la ventana para decidir si el nav es cajón o columna." "@Injectable"

                # --- clientes de API ---------------------------------------
                iamClient = component "IamClient" "11 operaciones: sesión y alta de cuentas." "@Injectable"
                publicClient = component "PublicClient" "1 operación. El único módulo legible sin sesión." "@Injectable"
                identityClient = component "IdentityClient" "4 operaciones. Sin pantalla que las llame todavía." "@Injectable"
                profilesClient = component "ProfilesClient" "3 operaciones. Sin pantalla que las llame todavía." "@Injectable"
                terminologyClient = component "TerminologyClient" "1 operación. Sin pantalla que la llame todavía." "@Injectable"
                filesClient = component "FilesClient" "1 operación. Sin pantalla que la llame todavía." "@Injectable"

                # --- capa shared -------------------------------------------
                designSystem = component "Sistema de diseño" "48 componentes en tres niveles: 15 átomos, 19 moléculas, 14 organismos." "standalone components"
                formContext = component "FORM_CONTROL_CONTEXT" "Contrato de accesibilidad entre un campo y el control que envuelve. 19 importadores." "InjectionToken"
                viewStateHost = component "ViewStateHost" "Traduce un ViewState a interfaz: esqueleto, vacío, error, reintento." "organismo"

                # --- capa features -----------------------------------------
                login = component "Login" "Un solo campo de identificador: la arroba decide si es correo o documento." "pantalla"
                registro = component "RegisterPatient" "Dos formularios distintos: paciente y profesional." "pantalla"
                recuperar = component "ForgotPassword / ResetPassword" "Acuse idéntico exista o no la cuenta." "pantallas"
                verificar = component "VerifyEmail" "Landing del enlace del correo." "pantalla"
                tenantSel = component "TenantSelection" "Aparece solo si el token trae más de una organización." "pantalla"
                shellLayout = component "ShellLayout" "Armazón de todo lo que tiene sesión. Arma el menú con los roles del token." "layout"
                dashboard = component "Dashboard" "Sesión (del token, sin peticiones) + una lectura real de la API." "pantalla"
                vitrina = component "DesignSystemSample" "Vitrina del sistema de diseño. Diferida: 181,73 kB." "pantalla"
            }

            ssr = container "Servidor SSR" "Express 5 + @angular/ssr. Sirve estáticos con maxAge 1 año y delega el resto al motor de Angular. Sin endpoints propios." "Node 24 / Express 5"

            almacenamiento = container "localStorage" "mantra.refresh-token y mantra-core-health.theme. El access token NUNCA se persiste." "Navegador" {
                tags "Almacén"
            }
        }

        # --- relaciones de nivel 1 y 2 ---------------------------------------
        paciente -> spa "Consulta su historia, turnos y estudios"
        profesional -> spa "Atiende y consulta"
        administrador -> spa "Da de alta usuarios"

        paciente -> ssr "Primera carga" "HTTPS"
        profesional -> ssr "Primera carga" "HTTPS"
        administrador -> ssr "Primera carga" "HTTPS"

        ssr -> spa "Entrega HTML prerenderizado (4 rutas) o el cascarón"
        spa -> api "20 operaciones" "HTTPS/JSON · Bearer + X-Tenant-Id"
        spa -> almacenamiento "Lee y escribe el refresh token y el tema"
        api -> correo "Envía verificación y recuperación"
        correo -> spa "El enlace vuelve con ?token=…"

        # --- relaciones de nivel 3 -------------------------------------------
        login -> authService "login()"
        registro -> authService "registerPatient()"
        registro -> iamClient "registerPractitioner()"
        verificar -> iamClient "verifyEmail()"
        recuperar -> iamClient "forgotPassword() / resetPassword()"
        tenantSel -> authService "selectTenant()"
        shellLayout -> authService "logout() / selectTenant()"
        dashboard -> publicClient "searchDirectory()"
        dashboard -> authService "Lee la sesión del token"

        authService -> iamClient "Habla con la API"
        authService -> sessionStore "Abre y cierra la sesión"
        authService -> refreshStorage "Persiste solo el refresh token"
        authGuard -> sessionStore "Decide con lo que hay en memoria. No consulta la API"
        authInterceptor -> sessionStore "Lee la credencial; la invalida ante un 401 irrecuperable"
        authInterceptor -> tokenRefresh "Refresca una sola vez"
        tokenRefresh -> iamClient "POST /iam/auth/token/refresh"
        tokenRefresh -> sessionStore "renew() — no toca el tenant elegido"

        iamClient -> api "11 operaciones"
        publicClient -> api "GET /public/directory"
        identityClient -> api "4 operaciones"
        profilesClient -> api "3 operaciones"
        terminologyClient -> api "GET value-sets/:id/\$expand"
        filesClient -> api "POST /common/files/upload"

        errorMapper -> viewState "Construye el estado del M34"
        dashboard -> errorMapper "Traduce el fallo"
        login -> errorMapper "Traduce el fallo, salvo UNAUTHENTICATED"
        viewStateHost -> viewState "Pinta cada estado"
        dashboard -> viewStateHost "Delega el pintado del estado"

        designSystem -> formContext "Todo control de formulario lo consume"
        login -> designSystem "Compone la pantalla"
        registro -> designSystem "Compone la pantalla"
        shellLayout -> designSystem "Monta app-shell"
        shellLayout -> breakpoints "Recibe el ancho; el shell no mide"
        vitrina -> designSystem "Exhibe los 48 componentes"
        spa -> themeService "Se instancia al arrancar (provideAppInitializer)"
    }

    views {
        systemContext frontend "Contexto" {
            include *
            autoLayout tb
            description "Quién usa el frontend y con qué habla. La API es la única integración."
        }

        container frontend "Contenedores" {
            include *
            autoLayout tb
            description "Piezas en ejecución. No hay imagen de producción todavía."
        }

        component spa "Componentes" {
            include *
            autoLayout lr
            description "Las tres capas: core, shared y features."
        }

        component spa "Sesion" {
            include sessionStore authService refreshStorage authGuard authInterceptor tokenRefresh iamClient login tenantSel shellLayout almacenamiento api
            autoLayout lr
            description "El ciclo de autenticación completo."
        }

        component spa "Errores" {
            include errorMapper viewState viewStateHost dashboard login publicClient api
            autoLayout lr
            description "Cómo un fallo de la API llega a la pantalla como uno de los 9 estados del M34."
        }

        styles {
            element "Person" {
                shape person
                background #0B557E
                color #ffffff
            }
            element "Software System" {
                background #0B557E
                color #ffffff
            }
            element "Externo" {
                background #7D8786
                color #ffffff
            }
            element "Container" {
                background #4FB3A9
                color #000000
            }
            element "Almacén" {
                shape cylinder
                background #CDD9D5
                color #000000
            }
            element "Component" {
                background #9FD8D0
                color #000000
            }
        }

        theme default
    }
}
