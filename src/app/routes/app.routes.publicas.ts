import type { Routes } from '@angular/router';
import { perfilPublicoResolver } from '../features/public-profile/public-profile.resolver';

/** Dirección vieja → dirección nueva. Absolutas para no depender del padre. */
export const RUTAS_HEREDADAS: Readonly<Record<string, string>> = {
  'my-account/notification-preferences': '/settings',
  ajustes: '/settings',
  panel: '/dashboard',
  agenda: '/schedule',
  clinico: '/medical-records',
  facturacion: '/billing',
  contabilidad: '/administration/accounting',
  'assets-liabilities': '/administration/accounting/assets-liabilities',
  'administration/accounting/libros': '/administration/accounting/books',
  'laboratorio/recepcion': '/administration/laboratory-orders',
  'laboratorio/cola': '/administration/laboratory-orders',
  'my-account/cotizaciones': '/my-account/quotations',
  'mi-cuenta': '/my-account',
  'mi-cuenta/turnos': '/my-account/appointments',
  'identidad/verificar': '/my-account/identity',
  'identidad/casos': '/my-account/identity',
  'my-account/identity/verify': '/my-account/identity',
  'administracion/pacientes': '/administration/patients',
  'administracion/usuarios': '/administration/users',
  'administracion/organizaciones': '/administration/organizations',
  'administracion/acceso-delegado': '/administration/delegated-access',
  'administracion/proveedores-identidad': '/administration/identity-providers',
  'administracion/verificacion-identidad': '/administration/identity-assurance',
  'administracion/terminologia': '/administration/terminology',
  'nearby-places': '/my-account/pharmacy',
  superadmin: '/superadmin/observability',
};

/**
 * Las cinco fichas públicas por slug, bajo el marco público del buscador.
 */
export function rutasDeFichasPublicas(): Routes {
  const TIPOS = [
    ['p', 'PRACTITIONER'],
    ['o', 'ORGANIZATION'],
    ['f', 'PHARMACY'],
    ['l', 'DIAGNOSTIC_UNIT'],
    ['s', 'INSURER'],
  ] as const;

  return TIPOS.map(([prefijo, kind]) => ({
    path: prefijo,
    loadComponent: () =>
      import('../features/alovida/shell/alovida-public-shell').then((m) => m.AlovidaPublicShell),
    children: [
      ...(prefijo === 'p'
        ? [
            {
              path: ':slug/post/:postId',
              data: { kind, pantallaReal: true },
              resolve: { perfil: perfilPublicoResolver },
              loadComponent: () =>
                import('../features/public-profile/public-post-detail/public-post-detail').then(
                  (m) => m.PublicPostDetail,
                ),
            },
          ]
        : []),
      {
        path: ':slug',
        data: { kind, pantallaReal: true },
        resolve: { perfil: perfilPublicoResolver },
        loadComponent: () =>
          import('../features/public-profile/public-profile').then((m) => m.PublicProfile),
      },
    ],
  }));
}

/**
 * Las rutas públicas del buscador, con las URL que la ficha V65 declara.
 */
export function rutasDeBusquedaPublica(): Routes {
  return [
    {
      path: 'posts',
      loadComponent: () =>
        import('../features/alovida/shell/alovida-public-shell').then((m) => m.AlovidaPublicShell),
      children: [
        {
          path: '',
          pathMatch: 'full',
          title: 'Lo último de los profesionales — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('../features/alovida/buscar/feed-publicaciones/feed-publicaciones').then(
              (m) => m.FeedPublicaciones,
            ),
        },
      ],
    },
    {
      path: 'search',
      loadComponent: () =>
        import('../features/alovida/shell/alovida-public-shell').then((m) => m.AlovidaPublicShell),
      children: [
        {
          path: '',
          pathMatch: 'full',
          title: 'Buscar en AloVida — profesionales, medicamentos y centros de salud',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('../features/alovida/buscar/buscador-listado/buscador-listado').then(
              (m) => m.BuscarBuscadorListado,
            ),
        },
        {
          path: 'symptoms',
          title: '¿A qué especialista consultar? — AloVida',
          data: { arquetipo: 'formulario', pantallaReal: true },
          loadComponent: () =>
            import('../features/alovida/buscar/sintomas-publico/sintomas-publico').then(
              (m) => m.SintomasPublico,
            ),
        },
        {
          path: 'practitioners',
          title: 'Profesionales de salud — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('../features/alovida/buscar/profesionales-listado/profesionales-listado').then(
              (m) => m.BuscarProfesionalesListado,
            ),
        },
        {
          path: 'medications',
          title: 'Medicamentos y farmacias — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('../features/alovida/buscar/medicamentos-listado/medicamentos-listado').then(
              (m) => m.BuscarMedicamentosListado,
            ),
        },
        {
          path: 'hospitals',
          title: 'Hospitales y clínicas — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('../features/alovida/buscar/hospitales-listado/hospitales-listado').then(
              (m) => m.BuscarHospitalesListado,
            ),
        },
        {
          path: 'diagnostics',
          title: 'Laboratorios e imagen — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('../features/alovida/buscar/laboratorios-listado/laboratorios-listado').then(
              (m) => m.BuscarLaboratoriosListado,
            ),
        },
        {
          path: 'insurers',
          title: 'Aseguradoras y convenios — AloVida',
          data: { arquetipo: 'listado', pantallaReal: true },
          loadComponent: () =>
            import('../features/alovida/buscar/aseguradoras-listado/aseguradoras-listado').then(
              (m) => m.BuscarAseguradorasListado,
            ),
        },
        {
          path: 'map',
          title: 'Cerca mío — AloVida',
          data: { arquetipo: 'detalle', pantallaReal: true },
          loadComponent: () =>
            import('../features/alovida/buscar/cercania-detalle/cercania-detalle').then(
              (m) => m.BuscarCercaniaDetalle,
            ),
        },
      ],
    },
    {
      path: 'promotions/:campaignId',
      loadComponent: () =>
        import('../features/alovida/shell/alovida-public-shell').then((m) => m.AlovidaPublicShell),
      children: [
        {
          path: '',
          pathMatch: 'full',
          title: 'Promoción — AloVida',
          data: { arquetipo: 'detalle', pantallaReal: true },
          loadComponent: () =>
            import('../features/campaigns/campaign-detail/campaign-detail').then(
              (m) => m.CampaignDetail,
            ),
        },
      ],
    },
  ];
}
