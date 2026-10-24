import { MenuItem } from '../models/menu.model';

export class Menu {
  /**
   * Agrupado por tarea: el día a día primero, después la carta y los clientes, la administración y el negocio.
   * Lo de la plataforma (SUPERADMIN) y los ítems de la plantilla van al final.
   */
  public static pages: MenuItem[] = [
    {
      group: 'Día a día',
      separator: false,
      items: [
        {
          icon: 'dashboard',
          label: 'Resumen',
          route: '/dashboard/admin',
        },
        {
          icon: 'point_of_sale',
          label: 'Ventas',
          route: '/pos',
          children: [
            { label: 'Tomar pedido', route: '/pos' },
            { label: 'Pedidos', route: '/orders' },
            { label: 'Pedidos de clientes', route: '/customer-orders' },
            { label: 'Pagos', route: '/payments' },
            { label: 'Turnos de caja', route: '/cash' },
          ],
        },
        {
          icon: 'table_bar',
          label: 'Salón',
          route: '/tables',
          children: [
            { label: 'Mesas', route: '/tables' },
            { label: 'Reservas', route: '/bookings' },
            { label: 'Sectores', route: '/sectors' },
          ],
        },
        {
          icon: 'restaurant',
          label: 'Cocina',
          route: '/kitchen',
        },
      ],
    },
    {
      group: 'Carta y clientes',
      separator: true,
      items: [
        {
          icon: 'menu_book',
          label: 'Carta',
          route: '/products',
          children: [
            { label: 'Productos', route: '/products' },
            { label: 'Categorías', route: '/products/categories' },
            { label: 'Modificadores', route: '/products/modifiers' },
            { label: 'Mejorar con IA', route: '/products/improve' },
            { label: 'Agotados de hoy', route: '/settings/public-menu/sold-out' },
          ],
        },
        {
          icon: 'qr_code_2',
          label: 'Carta online',
          route: '/settings/public-menu',
          children: [
            { label: 'Carta pública', route: '/settings/public-menu' },
            { label: 'Diseño', route: '/settings/public-menu/design' },
            { label: 'Marketing', route: '/settings/public-menu/marketing' },
            { label: 'Idiomas', route: '/settings/menu-translations' },
            { label: 'API y widget', route: '/settings/public-api' },
          ],
        },
        {
          icon: 'groups',
          label: 'Clientes',
          route: '/customers',
          children: [
            { label: 'Clientes', route: '/customers' },
            { label: 'Fidelización', route: '/loyalty' },
          ],
        },
      ],
    },
    {
      group: 'Administración',
      separator: true,
      items: [
        {
          icon: 'inventory',
          label: 'Inventario',
          route: '/inventory',
          feature: 'inventory',
          children: [
            { label: 'Stock', route: '/inventory' },
            { label: 'Compras', route: '/inventory/purchases' },
            { label: 'Órdenes de compra', route: '/inventory/purchase-orders' },
            { label: 'Ajustes', route: '/inventory/adjustments' },
            { label: 'Conteos', route: '/inventory/counts' },
            // Solo si el negocio tiene más de un local.
            { label: 'Transferencias', route: '/inventory/transfers', feature: 'multiLocation' },
            { label: 'Lotes', route: '/inventory/lots' },
            { label: 'Kardex', route: '/inventory/kardex' },
            { label: 'Unidades', route: '/inventory/units' },
          ],
        },
        {
          icon: 'blender',
          label: 'Recetas y costos',
          route: '/inventory/recipes',
          feature: 'inventory',
          children: [
            { label: 'Ingredientes', route: '/inventory/ingredients', feature: 'ingredients' },
            { label: 'Recetas', route: '/inventory/recipes', feature: 'ingredients' },
            { label: 'Producción', route: '/inventory/productions', feature: 'ingredients' },
            { label: 'Food cost', route: '/inventory/food-cost' },
            { label: 'Consumo', route: '/inventory/consumption' },
          ],
        },
        {
          icon: 'account_balance_wallet',
          label: 'Finanzas',
          route: '/finance',
          children: [
            { label: 'Gastos', route: '/finance/expenses' },
            { label: 'Cuentas por pagar', route: '/finance/payables' },
            { label: 'Propinas', route: '/finance/tips' },
            { label: 'Plata por llegar', route: '/finance/settlements' },
            { label: 'Gastos recurrentes', route: '/finance/recurring' },
            { label: 'Categorías de gasto', route: '/finance/categories' },
          ],
        },
      ],
    },
    {
      group: 'Negocio',
      separator: true,
      items: [
        {
          icon: 'storefront',
          label: 'Mi negocio',
          route: '/business',
          children: [
            { label: 'Mi negocio', route: '/business' },
            { label: 'Sucursales', route: '/business/location' },
            { label: 'Horarios', route: '/settings/schedules' },
          ],
        },
        {
          icon: 'admin_panel_settings',
          label: 'Equipo y permisos',
          route: '/roles-and-permissions',
          children: [
            { label: 'Usuarios', route: '/roles-and-permissions/users' },
            { label: 'Usuarios y roles', route: '/roles-and-permissions/roles-user' },
            { label: 'Roles', route: '/roles-and-permissions/roles' },
            { label: 'Roles y permisos', route: '/roles-and-permissions/roles-permissions', icon: 'home' },
            { label: 'Módulos', route: '/roles-and-permissions/modules' },
            { label: 'Permisos', route: '/roles-and-permissions/permissions' },
          ],
        },
        {
          icon: 'settings',
          label: 'Equipos y pagos',
          route: '/settings',
          children: [
            { label: 'Medios de pago', route: '/settings/payment-methods' },
            { label: 'Cajas', route: '/settings/registers' },
            { label: 'Impresoras', route: '/settings/printers' },
            { label: 'Estación de impresión', route: '/settings/print-station' },
            { label: 'Estaciones de cocina', route: '/settings/stations' },
            { label: 'Terminal de salón', route: '/settings/terminal' },
          ],
        },
        {
          icon: 'workspace_premium',
          label: 'Plan y facturación',
          route: '/billing',
          children: [
            { label: 'Mi suscripción', route: '/billing/subscription', role: 'OWNER' },
            { label: 'Planes', route: '/billing/plans' },
          ],
        },
        {
          icon: 'help',
          label: 'Ayuda',
          route: '/help',
        },
      ],
    },
    {
      group: 'Plataforma',
      separator: true,
      items: [
        {
          icon: 'admin_panel_settings',
          label: 'Plataforma',
          route: '/platform',
          role: 'SUPERADMIN',
          children: [
            { label: 'Resumen', route: '/platform/summary' },
            { label: 'Negocios', route: '/platform/businesses' },
            { label: 'Planes', route: '/platform/plans' },
            { label: 'Pagos por revisar', route: '/platform/payments-review' },
            { label: 'Cobros', route: '/platform/invoices' },
            { label: 'Descuentos', route: '/platform/discounts' },
            { label: 'Accesos de soporte', route: '/platform/support-access' },
            { label: 'Ajustes', route: '/platform/settings' },
          ],
        },
        {
          icon: 'support_agent',
          label: 'Centro de ayuda',
          route: '/help/admin',
          role: 'SUPERADMIN',
          children: [
            { label: 'Artículos', route: '/help/admin/articles' },
            { label: 'Categorías', route: '/help/admin/categories' },
            { label: 'Revisión del asistente', route: '/help/admin/review' },
            { label: 'Uso y costos', route: '/help/admin/usage' },
          ],
        },
      ],
    },
    {
      // Ítems de la plantilla (solo los ve el SUPERADMIN, ver PENDIENTES): por confirmar si se eliminan.
      group: 'Plantilla',
      separator: true,
      items: [
        {
          icon: 'assets/icons/heroicons/outline/exclamation-triangle.svg',
          label: 'Errors',
          route: '/errors',
          children: [
            { label: '404', route: '/errors/404' },
            { label: '500', route: '/errors/500' },
          ],
        },
        {
          icon: 'assets/icons/heroicons/outline/cube.svg',
          label: 'Components',
          route: '/components',
          children: [{ label: 'Table', route: '/components/table' }],
        },
        {
          icon: 'download',
          label: 'Download',
          route: '/download',
        },
        {
          icon: 'credit_card',
          label: 'Gift Card',
          route: '/gift',
        },
        {
          icon: 'groups',
          label: 'Users',
          route: '/users',
        },
        {
          icon: 'notifications',
          label: 'Notifications',
          route: '/gift',
        },
        {
          icon: 'folder',
          label: 'Folders',
          route: '/folders',
          children: [
            { label: 'Current Files', route: '/folders/current-files' },
            { label: 'Downloads', route: '/folders/download' },
            { label: 'Trash', route: '/folders/trash' },
          ],
        },
      ],
    },
  ];
}
