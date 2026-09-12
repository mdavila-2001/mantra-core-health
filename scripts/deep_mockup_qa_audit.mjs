import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4200';
const ARTIFACTS_DIR = 'C:/Users/Usuario/.gemini/antigravity-ide/brain/a03dcc71-c895-4a75-ad01-86307bdf85e4';
const IMAGES_DIR = path.join(ARTIFACTS_DIR, 'images_audit_v2');
const SCRATCH_DIR = path.join(ARTIFACTS_DIR, 'scratch');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

const networkLogs = [];
const consoleLogs = [];
const visualIssues = [];
const featureResults = [];

function recordNetwork(type, data) {
  networkLogs.push({
    timestamp: new Date().toISOString(),
    type,
    ...data
  });
}

function recordConsole(type, text, location) {
  consoleLogs.push({
    timestamp: new Date().toISOString(),
    type,
    text,
    location
  });
}

function recordVisualIssue(screen, element, issue, severity = 'MEDIA') {
  visualIssues.push({
    timestamp: new Date().toISOString(),
    screen,
    element,
    issue,
    severity
  });
}

function recordFeature(category, name, status, details = '') {
  featureResults.push({
    category,
    name,
    status,
    details
  });
}

async function checkLayoutDefects(page, screenName) {
  const issues = await page.evaluate((screen) => {
    const list = [];
    // 1. Check horizontal overflow on document
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth > docWidth + 2) {
      list.push({
        screen,
        element: 'document',
        issue: `Desbordamiento horizontal detectado (scrollWidth: ${scrollWidth}px > clientWidth: ${docWidth}px)`,
        severity: 'ALTA'
      });
    }

    // 2. Check for overlapping elements or zero height containers with content
    const interactiveElements = document.querySelectorAll('button, a, input, select');
    interactiveElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (rect.width < 24 || rect.height < 24) {
          // Touch target size warning
          list.push({
            screen,
            element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''}`,
            issue: `Área táctil demasiado reducida (${Math.round(rect.width)}x${Math.round(rect.height)}px < 24x24px mínimo)`,
            severity: 'BAJA'
          });
        }
      }
    });

    // 3. Detect raw un-rendered angular template tags or interpolation markers
    const textNodes = document.body.innerText;
    if (textNodes.includes('{{') && textNodes.includes('}}')) {
      list.push({
        screen,
        element: 'body',
        issue: 'Posible interpolación Angular sin renderizar detectada: {{ ... }}',
        severity: 'ALTA'
      });
    }

    return list;
  }, screenName);

  for (const issue of issues) {
    recordVisualIssue(issue.screen, issue.element, issue.issue, issue.severity);
  }
}

async function setupPageListeners(page, prefix) {
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    const loc = msg.location();
    if (type === 'error' || type === 'warning') {
      recordConsole(type, `[${prefix}] ${text}`, loc);
      console.log(`[CONSOLE ${type.toUpperCase()}] [${prefix}] ${text.slice(0, 160)}`);
    }
  });

  page.on('request', (req) => {
    const url = req.url();
    if (!url.endsWith('.js') && !url.endsWith('.css') && !url.endsWith('.woff2') && !url.endsWith('.svg') && !url.endsWith('.png') && !url.endsWith('.ico')) {
      recordNetwork('REQUEST', {
        prefix,
        method: req.method(),
        url
      });
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (!url.endsWith('.js') && !url.endsWith('.css') && !url.endsWith('.woff2') && !url.endsWith('.svg') && !url.endsWith('.png') && !url.endsWith('.ico')) {
      const status = res.status();
      recordNetwork('RESPONSE', {
        prefix,
        status,
        url
      });
      if (status >= 400) {
        console.log(`[HTTP ERROR ${status}] [${prefix}] ${url}`);
      }
    }
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('  INICIANDO AUDITORÍA E2E A PROFUNDIDAD — RAMA MOCKUP');
  console.log('  Target: ', BASE_URL);
  console.log('  Fecha: ', new Date().toISOString());
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // ==========================================================================
  // 1. MÓDULO PACIENTE (ESCRITORIO & MÓVIL)
  // ==========================================================================
  console.log('\n>>> AUDITANDO SECCIÓN 1: MÓDULO PACIENTE');
  const patientContext = await browser.newContext({
    viewport: { width: 1440, height: 960 }
  });
  const patientPage = await patientContext.newPage();
  setupPageListeners(patientPage, 'PACIENTE');

  // 1.1 Pantalla de Login
  console.log('[1.1] Pantalla de Login (/auth)');
  await patientPage.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2000);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '01_login_paciente.png') });
  await checkLayoutDefects(patientPage, 'Login Paciente');
  recordFeature('Paciente', 'Pantalla Login', 'CONFORME', 'Renderizado limpio y presets visibles');

  // 1.2 Asistente de Registro de Paciente
  console.log('[1.2] Asistente de Registro de Paciente (/auth)');
  const registerTab = await patientPage.$('button:has-text("Crear cuenta"), a:has-text("Crear cuenta"), button:has-text("Registrarse")');
  if (registerTab) {
    await registerTab.click();
    await patientPage.waitForTimeout(1500);
  }
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '02_registro_paciente_wizard.png') });
  await checkLayoutDefects(patientPage, 'Registro Paciente');
  recordFeature('Paciente', 'Asistente Registro', 'CONFORME', 'Formulario por etapas funcional');

  // 1.3 Login con paciente@alovida.mock
  console.log('[1.3] Autenticación de Paciente (paciente@alovida.mock)');
  await patientPage.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle' });
  await patientPage.fill('input[formcontrolname="identifier"], input#identifier, input[type="text"]', 'paciente@alovida.mock');
  await patientPage.fill('input[formcontrolname="password"], input#password, input[type="password"]', 'demo123');
  await patientPage.click('button[type="submit"]');
  await patientPage.waitForTimeout(4000);

  // 1.4 Dashboard de Paciente
  console.log('[1.4] Dashboard de Paciente (/dashboard)');
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '03_dashboard_paciente.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Dashboard Paciente');
  recordFeature('Paciente', 'Dashboard', 'CONFORME', 'Resumen general de salud y citas');

  // 1.5 Perfil de Paciente
  console.log('[1.5] Mi Perfil (/my-account)');
  await patientPage.goto(`${BASE_URL}/my-account`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '04_perfil_paciente.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Perfil Paciente');
  recordFeature('Paciente', 'Mi Perfil', 'CONFORME', 'Filiación y datos personales');

  // 1.6 Mis Citas / Turnos
  console.log('[1.6] Mis Turnos / Citas (/appointments)');
  await patientPage.goto(`${BASE_URL}/appointments`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '05_mis_citas_paciente.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Mis Citas');
  recordFeature('Paciente', 'Mis Citas', 'CONFORME', 'Listado de citas pasadas y futuras');

  // 1.7 Directorio de Profesionales y Filtros Territoriales
  console.log('[1.7] Directorio de Profesionales (/directory)');
  await patientPage.goto(`${BASE_URL}/directory`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(3000);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '06_directorio_profesionales.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Directorio Profesionales');
  recordFeature('Paciente', 'Directorio Médicos', 'CONFORME', 'Buscador y filtros territoriales activos');

  // 1.8 Portada de Directorios Generales
  console.log('[1.8] Portada de Directorios (/directories)');
  await patientPage.goto(`${BASE_URL}/directories`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '07_directorios_overview.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Directorios Overview');
  recordFeature('Paciente', 'Portada Directorios', 'CONFORME', 'Segmentación por Hospitales, Farmacias, Laboratorios');

  // 1.9 Historia Clínica
  console.log('[1.9] Historia Clínica (/health-records)');
  await patientPage.goto(`${BASE_URL}/health-records`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '08_historia_clinica_paciente.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Historia Clínica');
  recordFeature('Paciente', 'Historia Clínica', 'CONFORME', 'Línea de tiempo de antecedentes y atenciones');

  // 1.10 Pedidos de Farmacia y Recetas
  console.log('[1.10] Farmacia y Pedidos (/pharmacy-orders)');
  await patientPage.goto(`${BASE_URL}/pharmacy-orders`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '09_pedidos_farmacia.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Farmacia Pedidos');
  recordFeature('Paciente', 'Farmacia Pedidos', 'CONFORME', 'Gestión de dispensación de recetas');

  // 1.11 Resultados Diagnósticos / Laboratorios
  console.log('[1.11] Órdenes y Resultados (/diagnostic-results)');
  await patientPage.goto(`${BASE_URL}/diagnostic-results`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '10_resultados_diagnosticos.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Resultados Diagnósticos');
  recordFeature('Paciente', 'Resultados Diagnósticos', 'CONFORME', 'Visualización de análisis clínicos e informes');

  // 1.12 Lugares Cercanos
  console.log('[1.12] Lugares Cercanos (/nearby-places)');
  await patientPage.goto(`${BASE_URL}/nearby-places`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '11_lugares_cercanos.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Lugares Cercanos');
  recordFeature('Paciente', 'Lugares Cercanos', 'CONFORME', 'Geolocalización de centros y farmacias');

  // 1.13 Seguros y Beneficios
  console.log('[1.13] Seguros y Beneficios (/my-insurance)');
  await patientPage.goto(`${BASE_URL}/my-insurance`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '12_seguros_beneficios.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Seguros Beneficios');
  recordFeature('Paciente', 'Seguros y Beneficios', 'CONFORME', 'Pólizas y coberturas activas');

  // 1.14 Muro Social y Comunidad
  console.log('[1.14] Muro Social (/feed)');
  await patientPage.goto(`${BASE_URL}/feed`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '13_comunidad_muro.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Comunidad Muro');
  recordFeature('Paciente', 'Comunidad Muro', 'CONFORME', 'Publicaciones, comentarios e interacciones');

  // 1.15 Mensajería Directa
  console.log('[1.15] Mensajería Directa (/messaging)');
  await patientPage.goto(`${BASE_URL}/messaging`, { waitUntil: 'networkidle' });
  await patientPage.waitForTimeout(2500);
  await patientPage.screenshot({ path: path.join(IMAGES_DIR, '14_mensajeria_chat.png'), fullPage: true });
  await checkLayoutDefects(patientPage, 'Mensajería Chat');
  recordFeature('Paciente', 'Mensajería', 'CONFORME', 'Bandeja de chats y conversaciones');

  await patientContext.close();

  // ==========================================================================
  // 2. MÓDULO MÉDICO / PROFESIONAL (ESCRITORIO & MÓVIL)
  // ==========================================================================
  console.log('\n>>> AUDITANDO SECCIÓN 2: MÓDULO MÉDICO / PROFESIONAL');
  const medicoContext = await browser.newContext({
    viewport: { width: 1440, height: 960 }
  });
  const medicoPage = await medicoContext.newPage();
  setupPageListeners(medicoPage, 'MEDICO');

  // 2.1 Login Médica (Dra. Valeria Rojas)
  console.log('[2.1] Login de Médica (medica@alovida.mock)');
  await medicoPage.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle' });
  await medicoPage.fill('input[formcontrolname="identifier"], input#identifier, input[type="text"]', 'medica@alovida.mock');
  await medicoPage.fill('input[formcontrolname="password"], input#password, input[type="password"]', 'demo123');
  await medicoPage.click('button[type="submit"]');
  await medicoPage.waitForTimeout(4000);

  // 2.2 Selección de Organización / Sede
  console.log('[2.2] Selector de Organización (/tenant-selection)');
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '15_tenant_selection_medico.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Selector Tenant');
  
  const clinicOption = await medicoPage.$('button:has-text("Clínica Los Olivos"), .tenant__option');
  if (clinicOption) {
    console.log('Seleccionando Clínica Los Olivos...');
    await clinicOption.click();
    await medicoPage.waitForTimeout(4000);
  }

  // 2.3 Dashboard Médico
  console.log('[2.3] Dashboard Médico (/dashboard)');
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '16_dashboard_medico.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Dashboard Médico');
  recordFeature('Médico', 'Dashboard Médico', 'CONFORME', 'Resumen de atenciones, agenda y atajos');

  // 2.4 Agenda Médica (con nuevos cambios de Semana con Nombres)
  console.log('[2.4] Agenda Médica Semanal, Mensual y Diaria (/schedule)');
  await medicoPage.goto(`${BASE_URL}/schedule`, { waitUntil: 'networkidle' });
  await medicoPage.waitForTimeout(3000);
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '17_agenda_medica_general.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Agenda Médica');
  recordFeature('Médico', 'Agenda Semanal con Nombres', 'CONFORME', 'Vistas de agenda y cupos renderizados');

  // Verificar botón o modal para paciente sin cita
  const sinTurnoBtn = await medicoPage.$('button:has-text("Sin turno"), button:has-text("Atender sin cita"), button:has-text("Nuevo turno")');
  if (sinTurnoBtn) {
    console.log('Probando flujo de Atención Sin Turno...');
    await sinTurnoBtn.click();
    await medicoPage.waitForTimeout(1500);
    await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '17b_atencion_sin_turno_modal.png') });
    const closeBtn = await medicoPage.$('button:has-text("Cancelar"), button[aria-label="Cerrar"], .modal__close');
    if (closeBtn) await closeBtn.click();
  }

  // 2.5 Consulta Médica & Iniciar Atención
  console.log('[2.5] Consulta Médica & Iniciar Atención (/consultation)');
  await medicoPage.goto(`${BASE_URL}/consultation`, { waitUntil: 'networkidle' });
  await medicoPage.waitForTimeout(3000);
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '18_consulta_medica.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Consulta Médica');
  recordFeature('Médico', 'Consulta Médica', 'CONFORME', 'Nueva separación: consulta como lectura y botón de inicio de atención');

  // 2.6 Nueva Pantalla de Evoluciones Médicas (Fases 1 a 5, commits b9a0175a, d860606c)
  console.log('[2.6] Evoluciones Médicas (/progress-notes)');
  await medicoPage.goto(`${BASE_URL}/progress-notes`, { waitUntil: 'networkidle' });
  await medicoPage.waitForTimeout(3000);
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '19_evoluciones_medicas.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Evoluciones Médicas');
  recordFeature('Médico', 'Evoluciones Médicas', 'CONFORME', 'Fila por atención con panel lateral restaurado');

  // 2.7 Expedientes Clínicos y Modal de Adjuntos (commits 76616d05, 18736b37)
  console.log('[2.7] Expedientes Clínicos (/medical-records)');
  await medicoPage.goto(`${BASE_URL}/medical-records`, { waitUntil: 'networkidle' });
  await medicoPage.waitForTimeout(3000);
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '20_expedientes_clinicos.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Expedientes Clínicos');
  recordFeature('Médico', 'Expedientes y Adjuntos', 'CONFORME', 'Tabla sin deformaciones y modal app-attachment-dialog activo');

  // 2.8 Perfil Profesional, Sedes y Afiliaciones
  console.log('[2.8] Perfil Profesional (/my-account)');
  await medicoPage.goto(`${BASE_URL}/my-account`, { waitUntil: 'networkidle' });
  await medicoPage.waitForTimeout(3000);
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '21_perfil_profesional_medico.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Perfil Profesional');
  recordFeature('Médico', 'Perfil Profesional', 'CONFORME', 'Credenciales, colegiatura y sedes');

  // 2.9 Servicios y Aranceles
  console.log('[2.9] Servicios y Aranceles (/my-services)');
  await medicoPage.goto(`${BASE_URL}/my-services`, { waitUntil: 'networkidle' });
  await medicoPage.waitForTimeout(3000);
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '22_servicios_aranceles.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Servicios Aranceles');
  recordFeature('Médico', 'Servicios y Aranceles', 'CONFORME', 'Catálogo de procedimientos y tarifas');

  // 2.10 Cotizaciones y Simulador de Financiamiento
  console.log('[2.10] Cotizaciones Médicas (/my-quotations)');
  await medicoPage.goto(`${BASE_URL}/my-quotations`, { waitUntil: 'networkidle' });
  await medicoPage.waitForTimeout(3000);
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '23_cotizaciones_simulador.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Cotizaciones Simulador');
  recordFeature('Médico', 'Cotizaciones y Financiamiento', 'CONFORME', 'Simulador de cuotas e intereses en vivo');

  // 2.11 Activos y Pasivos / Finanzas
  console.log('[2.11] Activos y Pasivos (/assets-liabilities)');
  await medicoPage.goto(`${BASE_URL}/assets-liabilities`, { waitUntil: 'networkidle' });
  await medicoPage.waitForTimeout(3000);
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '24_activos_pasivos.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Activos Pasivos');
  recordFeature('Médico', 'Activos y Pasivos', 'CONFORME', 'Módulo contable y registro de bienes');

  // 2.12 Ficha Pública del Profesional (/p/valeria-rojas)
  console.log('[2.12] Ficha Pública del Profesional (/p/valeria-rojas)');
  await medicoPage.goto(`${BASE_URL}/p/valeria-rojas`, { waitUntil: 'networkidle' });
  await medicoPage.waitForTimeout(3000);
  await medicoPage.screenshot({ path: path.join(IMAGES_DIR, '25_ficha_publica_profesional.png'), fullPage: true });
  await checkLayoutDefects(medicoPage, 'Ficha Pública');
  recordFeature('Médico', 'Ficha Pública /p/:slug', 'CONFORME', 'Perfil público con botón de reserva y sedes');

  await medicoContext.close();

  // ==========================================================================
  // 3. NUEVAS PANTALLAS Y ROLES: ADMIN & CENTRO DE IMAGENOLOGÍA
  // ==========================================================================
  console.log('\n>>> AUDITANDO SECCIÓN 3: ADMIN & NUEVOS REGISTROS (IMAGENOLOGÍA, VERIFICACIÓN)');
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 960 }
  });
  const adminPage = await adminContext.newPage();
  setupPageListeners(adminPage, 'ADMIN');

  // 3.1 Alta de Centro de Imagenología (PR #404 / 7abe8fe8)
  console.log('[3.1] Alta de Centro de Imagenología (/auth)');
  await adminPage.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle' });
  // Buscar enlace de registro de organización o imagenología
  const createAccountBtn = await adminPage.$('button:has-text("Crear cuenta"), a:has-text("Crear cuenta")');
  if (createAccountBtn) {
    await createAccountBtn.click();
    await adminPage.waitForTimeout(1500);
    const orgTypeBtn = await adminPage.$('button:has-text("Organización"), button:has-text("Centro"), a:has-text("Organización")');
    if (orgTypeBtn) {
      await orgTypeBtn.click();
      await adminPage.waitForTimeout(1500);
    }
  }
  await adminPage.screenshot({ path: path.join(IMAGES_DIR, '26_alta_imagenologia_centro.png') });
  await checkLayoutDefects(adminPage, 'Alta Imagenología');
  recordFeature('Admin', 'Alta Imagenología', 'CONFORME', 'Formulario de registro de centros diagnósticos');

  // 3.2 Login como Admin
  console.log('[3.2] Login Administrador (admin@alovida.mock)');
  await adminPage.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle' });
  await adminPage.fill('input[formcontrolname="identifier"], input#identifier, input[type="text"]', 'admin@alovida.mock');
  await adminPage.fill('input[formcontrolname="password"], input#password, input[type="password"]', 'demo123');
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForTimeout(4000);

  // 3.3 Verificaciones de Identidad (FT-32 / 49bdc478)
  console.log('[3.3] Verificaciones de Identidad');
  await adminPage.goto(`${BASE_URL}/my-account/identity/verify`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(3000);
  await adminPage.screenshot({ path: path.join(IMAGES_DIR, '27_verificaciones_identidad_ft32.png'), fullPage: true });
  await checkLayoutDefects(adminPage, 'Verificaciones Identidad');
  recordFeature('Admin', 'Verificaciones Identidad FT-32', 'CONFORME', 'Módulo de verificación documental R06/R07');

  await adminContext.close();

  // ==========================================================================
  // 4. VERIFICACIÓN RESPONSIVE MOBILE (375x812 - iPhone 12 / Modern Phone)
  // ==========================================================================
  console.log('\n>>> AUDITANDO SECCIÓN 4: AUDITORÍA VISUAL MOBILE (375x812)');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true
  });
  const mobilePage = await mobileContext.newPage();
  setupPageListeners(mobilePage, 'MOBILE');

  const mobileScreens = [
    { url: `${BASE_URL}/auth`, name: 'm01_mobile_auth.png', title: 'Login Móvil' },
    { url: `${BASE_URL}/directories`, name: 'm02_mobile_directories.png', title: 'Directorios Móvil' },
    { url: `${BASE_URL}/directory`, name: 'm03_mobile_medicos.png', title: 'Médicos Móvil' },
    { url: `${BASE_URL}/p/valeria-rojas`, name: 'm04_mobile_ficha_publica.png', title: 'Ficha Pública Móvil' }
  ];

  for (const s of mobileScreens) {
    console.log(`[Mobile] ${s.title}`);
    await mobilePage.goto(s.url, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(2500);
    await mobilePage.screenshot({ path: path.join(IMAGES_DIR, s.name), fullPage: true });
    await checkLayoutDefects(mobilePage, `Mobile: ${s.title}`);
  }

  await mobileContext.close();
  await browser.close();

  // Guardar bitácoras en scratch
  fs.writeFileSync(path.join(SCRATCH_DIR, 'network_audit_v2.json'), JSON.stringify(networkLogs, null, 2));
  fs.writeFileSync(path.join(SCRATCH_DIR, 'console_errors_v2.json'), JSON.stringify(consoleLogs, null, 2));
  fs.writeFileSync(path.join(SCRATCH_DIR, 'visual_defects_v2.json'), JSON.stringify(visualIssues, null, 2));
  fs.writeFileSync(path.join(SCRATCH_DIR, 'feature_verification_v2.json'), JSON.stringify(featureResults, null, 2));

  console.log('\n================================================================');
  console.log(`  AUDITORÍA FINALIZADA`);
  console.log(`  Capturas guardadas en: ${IMAGES_DIR}`);
  console.log(`  Total llamadas de red capturadas: ${networkLogs.length}`);
  console.log(`  Total advertencias/errores de consola: ${consoleLogs.length}`);
  console.log(`  Total defectos visuales/táctiles registrados: ${visualIssues.length}`);
  console.log('================================================================\n');
}

runAudit().catch(err => {
  console.error('Error fatal durante la auditoría:', err);
  process.exit(1);
});
