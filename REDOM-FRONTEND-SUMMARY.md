# REDOM — FRONTEND SUMMARY

> **Fecha:** 10 de agosto de 2026
> **Versión:** 0.10.1
> **Proyecto:** `redom-chile-backoffice-front` (display: "Redom")
> **Propósito:** Análisis del estado actual del frontend y guía para incorporar funcionalidades REDOM utilizando los componentes y patrones existentes.

---

# 1. RESUMEN EJECUTIVO

## Stack

| Tecnología | Versión | Notas |
|-----------|---------|-------|
| Angular | 19.1.4 | Standalone bootstrap, NgModule para features |
| TypeScript | 5.7.3 | Strict mode |
| Tailwind CSS | 4.0.5 | Configuración nativa CSS (sin tailwind.config.js) |
| Angular Material | 19.1.4 | Diálogos, form fields, progress bar |
| Angular CDK | 19.1.4 | Instalado, poco usado |
| ApexCharts | 4.0.0 | Gráficos (ng-apexcharts wrapper) |
| RxJS | 7.4.0 | Signals + Observables híbrido |
| Karma/Jasmine | 3.10 / 6.3 | Unit tests |
| Playwright | 1.50.1 | E2E tests |
| Netlify | — | Deploy + SPA redirects |

## Arquitectura resumida

- **Bootstrap standalone** (`bootstrapApplication`)
- **Lazy loading** en todos los módulos de feature
- **Core module** con guards funcionales, interceptor funcional, servicios singleton
- **UI library** con Atomic Design (97 archivos en `src/ui/`)
- **Feature modules** con estructura `pages/`, `data-access/`, `features/`, `ui/`
- **Service-per-endpoint**: cada operación HTTP tiene su propia clase servicio con signals
- **Estado**: Signals + RxJS BehaviorSubjects, sin NgRx/Akita

## Estado producción

- Desplegado en **Netlify** con Node 22
- Backend serverless en **AWS API Gateway** (us-east-1)
- 3 ambientes: local, develop, production
- Autenticación JWT con refresh token
- RBAC completo implementado en backend y parcialmente en frontend
- 44 unit tests (Karma), 3 E2E tests (Playwright)
- 0 tests en UI library y data-access services

---

# 2. ARQUITECTURA FRONTEND

## 2.1 Estructura de carpetas

```
src/
├── app/
│   ├── app.component.ts                 # Standalone root component
│   ├── app-routing.module.ts            # Root routing (3 lazy children)
│   ├── core/                            # Singletons
│   │   ├── constants/menu.ts            # Menú lateral estático
│   │   ├── guards/                      # authGuard, permissionGuard, roleGuard
│   │   ├── interceptor/auth.interceptor.ts  # JWT + auto-refresh
│   │   ├── models/                      # MenuItem, Theme
│   │   ├── services/                    # ThemeService, WhoamiService, AvatarService, Address
│   │   └── standarized-response/        # StandardizedPagination<T>, PaginationMeta
│   ├── modules/                         # Feature modules (lazy)
│   │   ├── auth/                        # Login, registro, recuperación
│   │   ├── dashboard/                   # Admin dashboard + NFT demo
│   │   ├── error/                       # 404, 500
│   │   ├── layout/                      # Shell (sidebar + navbar + footer)
│   │   ├── profile/                     # Perfil de usuario
│   │   ├── restaurante/                 # Gestión de negocios
│   │   ├── roles-and-permissions/       # RBAC admin (7 sub-páginas)
│   │   ├── uikit/                       # UI Kit demo (tabla reutilizable)
│   │   └── uim/                         # UI Module demo
│   ├── shared/                          # Código compartido
│   │   ├── components/responsive-helper/
│   │   ├── directives/check-permission.directive.ts
│   │   ├── enums/permissions.enum.ts    # Catálogo de permisos
│   │   ├── models/chart-options.ts
│   │   ├── utils/ckassnames.ts          # Utilidad cx() (typo en nombre)
│   │   ├── dummy/user.dummy.ts          # Datos dummy para uikit
│   │   └── pipes/ (vacío), validators/ (vacío)
│   ├── ui/                              # Atomic Design library (97 archivos)
│   │   ├── atoms/       (6)             # badge, divider, icon, progress-bar, skeleton, toggle
│   │   ├── molecules/   (9)             # alert, bottom-navbar, button, confirm-modal, filters-table, header-dashboard, inactive-table-skeleton, pagination-table, toast
│   │   ├── organisms/   (1)             # terms-and-conditions/sign-up
│   │   ├── templates/   (6)             # area-chart, express-table, modal, modal-card, single-card, table
│   │   └── utils/       (5)             # case-transform, click-outside, rut-format, slot (directives) + slot-as-record (pipe)
│   ├── assets/                          # Imágenes, iconos, SVGs
│   ├── environments/                    # 4 archivos (local, develop, prod, default) + api-path.enum.ts
│   ├── styles.css                       # Tailwind v4 + theme + glassmorphism + custom forms
│   ├── index.html                       # Entry point con Material Icons/Symbols
│   └── main.ts                          # bootstrapApplication
```

## 2.2 Boot sequence

```
main.ts
  → bootstrapApplication(AppComponent, {
      providers: [
        BrowserModule, AppRoutingModule,
        provideAnimations(),
        provideHttpClient(withInterceptors([AuthInterceptor])),
      ]
    })

AppComponent
  → imports: RouterOutlet, ResponsiveHelperComponent, NgxSonnerToaster, ToastComponent
  → constructor: ThemeService (signal effect para aplicar tema), WhoamiService (inicia polling)

AppRoutingModule
  → path: ''      → LayoutModule (lazy)
  → path: 'auth'  → AuthModule (lazy)
  → path: 'errors'→ ErrorModule (lazy)

LayoutModule
  → LayoutComponent (sidebar + navbar + footer + bottom-navbar)
  → LayoutRoutingModule (lazy children):
      /dashboard             → DashboardModule
      /business              → RestauranteModule
      /roles-and-permissions → RolesAndPermissionsModule
      /profile               → ProfileModule
      /components            → UikitModule
      /components/table      → UimModule
```

## 2.3 Patrones de diseño identificados

| Patrón | Evidencia | Dónde |
|--------|-----------|-------|
| **Service-per-endpoint** | Cada operación HTTP es una clase independiente | `modules/**/data-access/*.service.ts` |
| **Signals + RxJS híbrido** | `BehaviorSubject` + `Subject` para flujos, `toSignal()` para templates | Todos los data-access services |
| **Feature-based folders** | `pages/`, `data-access/`, `features/`, `ui/` | Todos los feature modules |
| **Smart/Dumb components** | Pages orquestan, features/ui reciben `input()` y emiten `output()` | `BusinessComponent` → `BusinessTableComponent` |
| **Barrel exports** | `index.ts` en cada carpeta | Todo el proyecto |
| **Functional guards** | `CanActivateFn` (funciones, no clases) | `auth.guard.ts`, `permission.guard.ts`, `role.guard.ts` |
| **Functional interceptor** | `HttpInterceptorFn` | `auth.interceptor.ts` |
| **NgModule per feature** | Cada feature tiene su `.module.ts` + `-routing.module.ts` | `restaurante.module.ts`, `auth.module.ts`, etc. |
| **Standalone leaf components** | Componentes hoja usan `imports: [...]` en decorador | `AdminComponent`, `UsersTableComponent`, `Step1BasicInfoFormComponent` |
| **Modal pattern** | Angular Material `MatDialog` + `ModalCardComponent` wrapper | `CreateNewBusinessModalComponent`, todos los modales RBAC |
| **Form pattern** | `FormBuilder` + signals de servicio para loading/error/success | `step1-basic-info-form.component.ts`, `create-new-business-modal.component.ts` |
| **Pagination pattern** | `StandardizedPagination<T>` interface + `PaginationMeta` + `setParams()` | `get-all-users.service.ts` |
| **Filter pattern** | Componentes `FiltersTable` con `output()` de búsqueda | `filters-table-user`, `filters-table-role`, etc. |
| **Multi-step wizard** | `signal(currentStep)` + `@switch` + `(completed)` output | `setup-business-modal.component.ts` |

## 2.4 Manejo de estado

```
┌─────────────────────────────────────────────────────┐
│ ESTADO GLOBAL (Signals)                             │
│ ThemeService.theme: Signal<Theme>                    │
│ MenuService._showSidebar/_showMobileMenu: Signal    │
│ WhoamiService.$whoami: Signal<WhoamiDto>            │
│ WhoamiService.$permissionsSet: Signal<Set<string>>  │
│ MenuService.#filteredPagesMenu: computed Signal     │
├─────────────────────────────────────────────────────┤
│ ESTADO DE AUTENTICACIÓN (BehaviorSubjects)          │
│ AuthService.currentUserLoginOn: BehaviorSubject     │
│ AuthService.currentUserData: BehaviorSubject        │
│ AuthService.$isLoading/$error: toSignal()           │
├─────────────────────────────────────────────────────┤
│ ESTADO POR ENDPOINT (Signals en cada servicio)      │
│ Cada data-access service expone:                    │
│   $data: toSignal() del resultado HTTP              │
│   $isLoading: toSignal(BehaviorSubject<boolean>)    │
│   $hasError: toSignal(error$.pipe(map(...)))        │
│   $success: toSignal(Subject<boolean>) (mutation)   │
│   retry()/execute()/reset(): métodos públicos       │
└─────────────────────────────────────────────────────┘
```

---

# 3. SISTEMA VISUAL

> **El sistema visual actual está completo y es reutilizable para REDOM. No requiere reemplazo.**

## 3.1 Theme System

**ThemeService** (`src/app/core/services/theme.service.ts`):
- Signal reactivo `theme: Signal<{ mode, color, direction }>`
- Persistencia en `localStorage` key `'theme'`
- Efecto automático que aplica clase `.dark` al `<html>` y atributo `data-theme`

**Modos:**
- Light (default)
- Dark (`class="dark"` en `<html>`)

**7 paletas de color:**

| Tema | Color primario | Selector CSS |
|------|---------------|-------------|
| Base | `#E11D48` (rose) | `:root` |
| Violet | `#6E56CF` | `[data-theme='violet']` |
| Red | `#CC0033` | `[data-theme='red']` |
| Blue | `#2490FF` | `[data-theme='blue']` |
| Orange | `#EA580C` | `[data-theme='orange']` |
| Yellow | `#FACC15` | `[data-theme='yellow']` |
| Green | `#22C55E` | `[data-theme='green']` |

Cada paleta define overrides light y dark vía CSS custom properties.

## 3.2 CSS Custom Properties (Tokens)

Definidas en `@theme` de Tailwind v4:

```
--font-poppins, --font-nunito
--color-border, --color-background, --color-foreground
--color-primary, --color-primary-foreground
--color-destructive, --color-destructive-foreground
--color-muted, --color-muted-foreground
--color-card, --color-card-foreground
```

Estas variables son consumidas por TODOS los componentes del UI kit y por las clases de Tailwind.

## 3.3 Tipografía

- **Principal:** Poppins (100-900, italic) — Google Fonts
- **Secundaria:** Nunito — Google Fonts
- **Iconos:** Material Icons + Material Symbols — Google Fonts CDN
- Aplicación: `body { font-family: 'Poppins' }` vía clase `font-poppins`

## 3.4 Glassmorphism

Sistema completo de utilidades glass con variantes dark:

```css
.glass            /* Fondo translúcido base */
.glass-card       /* Cards con efecto vidrio */
.glass-header     /* Headers con glass */
.glass-overlay    /* Overlays */
.glass-row        /* Filas de tabla */
.glass-input      /* Inputs */
.glass-footer     /* Footers de tabla */
```

Cada una tiene su variante `.dark .glass-*`. Usadas extensivamente en layout, sidebar, navbar, tablas y modales.

## 3.5 Responsive

- **Breakpoints:** Tailwind v4 defaults (`sm`, `md`, `lg`, `xl`, `2xl`)
- **Layout responsivo:**
  - Desktop: sidebar visible + navbar horizontal
  - Tablet: sidebar colapsable + navbar
  - Mobile: sidebar overlay + navbar hamburguesa + bottom navbar
- **Grid system:** Tailwind grid con columnas responsivas
- **Componente helper:** `ResponsiveHelperComponent` muestra breakpoint actual en desarrollo

## 3.6 Animaciones

Keyframes en `@theme`:
- `wiggle`, `fade-in-down`, `fade-out-down`, `fade-in-up`, `fade-out-up`
- Dropdown utilities con animaciones
- Skeleton loading animation

## 3.7 Componentes principales — Inventario completo

### ATOMS (6) — Bloques indivisibles

| Componente | Selector | Inputs/API | Reutilizable para REDOM |
|-----------|----------|-----------|------------------------|
| `BadgeComponent` | `<app-badge>` | `text`, `type` (info/dark/error/success/warning/purpe), `glass`, `rounded` | Estados de pedidos, estados de mesa, roles, categorías |
| `DividerComponent` | `<app-divider>` | — | Separadores visuales |
| `IconComponent` | `<app-icon>` | `(clicked)` output | Todos los iconos de la app — Material Icons |
| `ProgressBarComponent` | `<app-progress-bar>` | `mode` (indeterminate/determinate), `value` | Loading de operaciones |
| `SkeletonComponent` | `<app-skeleton>` | `size` (xs/sm/md/lg/xl) | Loading states en cards y tablas |
| `ToggleComponent` | `<app-toggle>` | `checked`, `disabled`, `(changed)` | Activar/desactivar productos, mesas, features |

### MOLECULES (9) — Combinación de átomos

| Componente | Selector | Inputs/API | Reutilizable para REDOM |
|-----------|----------|-----------|------------------------|
| `AlertComponent` | `<app-alert>` | `type` (danger/warning/success/info) | Mensajes de error en formularios |
| `BottomNavbarComponent` | `<app-bottom-navbar>` | — | Navegación mobile |
| **`ButtonComponent`** | `<app-button>` | `isLoading`, `icon`, `impact` (bold/light/none), `size`, `shape`, `tone` (primary/danger/success/warning/info/light), `shadow`, `type`, `full`, `disabled`, `(buttonClick)` | **Componente estrella** — todas las acciones: crear, editar, eliminar, guardar, pagar, imprimir, etc. |
| `ConfirmModalComponent` | `<app-confirm-modal>` | Usa `MatDialog` con `MAT_DIALOG_DATA` | Confirmaciones de eliminación, anulación de pedidos |
| `FiltersTableComponent` | `<app-filters-table>` | DTOs de filtros, `(searchChange)` | Búsqueda en todas las tablas |
| `HeaderDashboardComponent` | `<app-header-dashboard>` | `title`, `subtitle`, slots para acciones | Encabezado de todas las páginas |
| `InactiveTableSkeletonComponent` | `<app-inactive-table-skeleton>` | — | Skeleton cuando no hay datos |
| `PaginationTableComponent` | `<app-pagination-table>` | `pagination` (PaginationMeta), `(pageChange)` | Paginación en todas las tablas |
| `ToastComponent` + `ToastService` | `<app-toast>` + servicio | `show(message, type)`, `$isVisible`, `$message`, `$type` | Notificaciones toast globales |

### ORGANISMS (1) — Secciones complejas

| Componente | Selector | Reutilizable |
|-----------|----------|-------------|
| `SignUpTermsAndConditionsComponent` | `<app-sign-up-terms-and-conditions>` | Solo registro |

### TEMPLATES (6) — Layouts de página

| Componente | Selector | Inputs/API | Reutilizable para REDOM |
|-----------|----------|-----------|------------------------|
| `AreaChartComponent` | `<app-area-chart>` | Datos de chart vía input | Dashboard, analytics, reportes |
| `ExpressTableComponent` | `<app-express-table>` | Slots (header, head, default) | Tablas con header personalizado |
| `ModalComponent` | `<app-modal>` | Slots | Modales genéricos |
| **`ModalCardComponent`** | `<app-modal-card>` | Slots (header, default, footer) + botón close | **Todos los modales de REDOM** (crear/editar producto, mesa, pedido, etc.) |
| `SingleCardComponent` | `<app-card>` | `addBottomLine`, slots | Cards contenedoras para indicadores, gráficos, widgets |
| **`TableComponent`** | `<app-table>` | Slots (filters, head, default, footer) | **Todas las tablas de REDOM** (productos, pedidos, mesas, clientes, etc.) |

### UTILS (5) — Directivas y pipes

| Utilidad | Tipo | Reutilizable |
|----------|------|-------------|
| `CaseTransformDirective` | Directiva | Transformación de texto |
| `ClickOutsideDirective` | Directiva | Cerrar dropdowns al click fuera |
| `RutFormatDirective` | Directiva | Formateo de RUT chileno |
| `SlotDirective` | Directiva | Sistema de slots para templates |
| `SlotAsRecordPipe` | Pipe | Conversión de slots |

---

# 4. AUTENTICACIÓN

## 4.1 Flujo completo

```
┌──────────────────────────────────────────────────┐
│ LOGIN                                            │
│ POST /auth/api/login/authenticate-user           │
│ Body: { email, password }                        │
│ Response: { token, refreshToken, userData }      │
│ ↓                                                │
│ AuthService.login() guarda en localStorage:      │
│   - token (JWT access)                           │
│   - refreshToken                                 │
│   - userData (JSON)                              │
│   - lastActivity (timestamp)                     │
│ ↓                                                │
│ currentUserLoginOn.next(true)                    │
│ WhoamiService.refetch()                          │
│ Redirect → /dashboard/admin                      │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ SESSION MANAGEMENT                               │
│ AuthService.loadSession() en constructor         │
│ - Recupera tokens de localStorage                │
│ - Si lastActivity > 24h → borra sesión           │
│ WhoamiService:                                   │
│ - GET /auth/api/users/whoami cada 60s (con foco) │
│ - Actualiza lastActivity en cada fetch           │
│ - Expone roles$ y permissions$                   │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ TOKEN REFRESH                                    │
│ AuthInterceptor recibe 401                       │
│ → POST /auth/api/auth/refresh-token              │
│   Body: { refreshToken }                         │
│   Response: { token, refreshToken }              │
│ → Guarda nuevos tokens en localStorage           │
│ → Reintenta request original                     │
│ → Si falla: logout() + redirect /auth/sign-in    │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ LOGOUT                                           │
│ POST /auth/api/login/logout                      │
│ → Limpia localStorage (token, refreshToken,      │
│   userData, lastActivity)                        │
│ → Resetea BehaviorSubjects                       │
│ → currentUserLoginOn.next(false)                 │
└──────────────────────────────────────────────────┘
```

## 4.2 Guards

| Guard | Tipo | Estado | Acción |
|-------|------|--------|--------|
| `authGuard` | `CanActivateFn` | ACTIVO en rutas protegidas | Si no `isLogin()` → redirect `/auth/sign-in` |
| `permissionGuard` | `CanActivateFn` | DEFINIDO pero NO usado | Verifica `route.data['viewPermission']` |
| `roleGuard` | `CanActivateFn` | DEFINIDO pero NO usado | Verifica `route.data['roles']` |

## 4.3 Mecanismo de permisos en UI

**Directiva `*appCheckPermission`:**
```html
<app-button *appCheckPermission="'users:delete-user'" ... />
<app-table *appCheckPermission="'users:get-all-users'">
```
La directiva consulta `AuthService.hasPermission()` y remueve/agrega el elemento del DOM según el resultado.

**Filtrado de menú lateral:**
`MenuService.#filteredPagesMenu` es un `computed` signal que filtra los items del menú basado en los permisos del usuario (obtenidos vía `WhoamiService.$permissionsSet`).

## 4.4 Catálogo de permisos

```typescript
Permission = {
  AUTH: {
    MODULES:        { SEE_MODULE, GET_ALL_MODULES, UPDATE_MODULE, DELETE_MODULE, CREATE_MODULE }
    PERMISSIONS:    { SEE_MODULE, GET_ALL_PERMISSIONS, CREATE_PERMISSION, DELETE_PERMISSION, UPDATE_PERMISSION }
    ROLES:          { SEE_MODULE, UPDATE_ROLE, CREATE_ROLE, DELETE_ROLE, GET_ALL_ROLES }
    ROLES_PERMISSIONS: { SEE_MODULE, ASSIGN_PERMISSION }
    USER_ROLES:     { SEE_MODULE, ASSIGN_ROLE }
    USERS:          { CREATE_USER, DELETE_USER, UPDATE_USER, SEE_MODULE, GET_ALL_USERS }
  }
}
```

> **Para REDOM será necesario extender este catálogo** con permisos para: products, categories, menu, tables, orders, reservations, inventory, customers, reports, pos, kitchen, etc.

---

# 5. INTEGRACIÓN API

## 5.1 Configuración

```typescript
// api-path.enum.ts
ApiPathEnum.AUTH      = `${baseUrl}/auth/api`
ApiPathEnum.RESTAURANT = `${baseUrl}/restaurant/api`

// baseUrl por ambiente:
// local:  http://localhost:3000
// dev:    https://zvwuixec9i.execute-api.us-east-1.amazonaws.com/
// prod:   https://3rns8qoa8g.execute-api.us-east-1.amazonaws.com/
```

## 5.2 Endpoints consumidos actualmente

### Authentication (AUTH)
| Endpoint | Method | Service |
|----------|--------|---------|
| `/auth/api/login/authenticate-user` | POST | `AuthService.login()` |
| `/auth/api/login/logout` | POST | `AuthService.logout()` |
| `/auth/api/auth/refresh-token` | POST | `AuthService.refreshAccessToken()` |
| `/auth/api/auth/forgot-password` | POST | `ForgotPasswordService` |
| `/auth/api/login/reset-password` | PUT | `ResetPasswordService` |
| `/auth/api/login/new-password-validate` | POST | `TemporaryPasswordService` |
| `/auth/api/login/external-deactivate-user-for-password` | PUT | `ExternalDeactivateUserForPasswordService` |

### Users & RBAC (AUTH)
| Endpoint | Method | Service |
|----------|--------|---------|
| `/auth/api/users/whoami` | GET | `WhoamiService` |
| `/auth/api/users` | GET | `GetAllUsersService` (paginated + filters) |
| `/auth/api/internal-user` | POST | `CreateUserService` |
| `/auth/api/users/${userId}` | PATCH | `UpdateUserService` |
| `/auth/api/users/${userId}` | DELETE | `DeleteUserService` |
| `/auth/api/users/users-with-roles` | GET | `GetAllUsersWithRolesService` (paginated) |
| `/auth/api/users/${userId}/roles` | POST | `AssignRoleToUserService` |
| `/auth/api/roles-and-permissions/roles` | GET | `GetAllRolesService` (paginated) |
| `/auth/api/roles-and-permissions/roles` | POST | `CreateRoleService` |
| `/auth/api/roles-and-permissions/roles/${id}` | PATCH | `UpdateRoleService` |
| `/auth/api/roles-and-permissions/roles/${id}` | DELETE | `DeleteRoleService` |
| `/auth/api/roles-and-permissions/permissions` | GET | `GetAllPermissionsService` |
| `/auth/api/roles-and-permissions/permissions` | POST | `CreatePermissionService` |
| `/auth/api/roles-and-permissions/permissions/${id}` | PATCH | `UpdatePermissionService` |
| `/auth/api/roles-and-permissions/permissions/${id}` | DELETE | `DeletePermissionService` |
| `/auth/api/roles-and-permissions/modules` | GET | `GetAllModulesService` (paginated) |
| `/auth/api/roles-and-permissions/modules` | POST | `CreateModuleService` |
| `/auth/api/roles-and-permissions/modules/${id}/update` | PUT | `UpdateModuleService` |
| `/auth/api/roles-and-permissions/modules/${id}/delete` | PUT | `DeleteModuleService` |
| `/auth/api/roles-and-permissions/roles/${roleId}/permissions` | GET | `GetRolePermissionsService` |
| `/auth/api/roles-and-permissions/roles/${roleId}/permissions` | POST | `AssignPermissionsService` |
| `/auth/api/profile/${userId}/user` | GET | `GetProfileService` |
| `/auth/api/contacts/${id}` | PATCH | `UpdateContactProfileService` |
| `/auth/api/address/regions` | GET | `GetRegionsService` |
| `/auth/api/address/provinces/${regionId}` | GET | `GetProvincesByRegionIdService` |
| `/auth/api/address/comunes/${communeId}` | GET | `GetCommunesByProvincesIdService` |

### Business (RESTAURANT)
| Endpoint | Method | Service |
|----------|--------|---------|
| `/restaurant/api/business/my-businesses` | GET | `FindMyBusinessesService` |
| `/restaurant/api/business` | POST | `CreateBusinessService` |
| `/restaurant/api/business/${id}/activate` | POST | `ActivateBusinessService` |
| `/restaurant/api/business/${bizId}/setup/steps` | GET | `FindBusinessSetupStepsService` |
| `/restaurant/api/business/${bizId}/setup/steps/${step}` | POST | `CompleteBusinessSetupStepService` |
| `/restaurant/api/currencies` | GET | `FindAllCurrenciesService` |

## 5.3 Patrón de implementación de servicios

**Servicio de consulta (GET paginado con filtros):**

```typescript
@Injectable({ providedIn: 'root' })
export class GetAllUsersService {
  readonly #httpClient = inject(HttpClient);
  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $hasError = toSignal(this.#error$.pipe(map(code => code !== undefined)));

  readonly #params$ = new BehaviorSubject<{ page: number; perPage: number; name?: string }>({ page: 1, perPage: 10 });

  setParams(params: Partial<...>) { /* merge params y trigger fetch */ }

  readonly $data = toSignal(
    this.#params$.pipe(
      tap(() => this.#isLoading$.next(true)),
      switchMap(params => this.#httpClient.get<StandardizedPagination<T>>(url, { params }).pipe(
        catchError(err => { this.#error$.next(err.status); return EMPTY; }),
        tap(() => this.#isLoading$.next(false)),
      )),
    ),
  );
}
```

**Servicio de mutación (POST/PUT/PATCH/DELETE):**

```typescript
@Injectable({ providedIn: 'root' })
export class CreateUserService {
  readonly #httpClient = inject(HttpClient);
  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #submit$ = new Subject<CreateDto>();
  readonly #success$ = new Subject<boolean>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $hasError = toSignal(this.#error$.pipe(map(code => code !== undefined)));
  readonly $success = toSignal(this.#success$);

  constructor() {
    this.#submit$.pipe(
      tap(() => this.#isLoading$.next(true)),
      switchMap(input => this.#httpClient.post(url, input).pipe(
        tap(() => { this.#success$.next(true); this.#isLoading$.next(false); }),
        catchError(err => { this.#error$.next(err.status); return EMPTY; }),
      )),
    ).subscribe();
  }

  execute(input: CreateDto) { this.#submit$.next(input); }
  reset() { /* limpiar estado */ }
}
```

**Patrón de uso en componentes:**
```typescript
// Inyectar servicio
readonly $service = inject(SomeService);

// Leer signals en template
@let data = $service.$data();
@let isLoading = $service.$isLoading();

// Disparar acciones
$service.execute(input);

// Reaccionar a efectos
effect(() => { if ($service.$success()) { toast.show('OK'); } });
```

## 5.4 Interfaces de respuesta

```typescript
// Respuesta paginada estándar
interface StandardizedPagination<T> {
  data: T[];
  pagination: PaginationMeta;
}

interface PaginationMeta {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}
```

---

# 6. FEATURES ACTUALES — ESTADO DETALLADO

## 6.1 Authentication Module

| Aspecto | Estado |
|---------|--------|
| Rutas | `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/new-password`, `/auth/two-steps`, `/auth/temporary-password` |
| Login funcional | COMPLETO — JWT + refresh token + redirect |
| Registro | PARCIAL — Form con validación, endpoint no verificado |
| Recuperación | IMPLEMENTADO — 3 flujos (forgot, reset, temporary password) |
| Google OAuth | Botón presente pero redirige a `/dashboard` (placeholder) |
| Custom validators | 4 validators (email format, password strength, password match) |
| Layout auth | Componente `AuthComponent` con fondo `auth.png` |

## 6.2 Dashboard Module

| Aspecto | Estado |
|---------|--------|
| Ruta | `/dashboard/admin` |
| Indicadores | PLACEHOLDER — 4 indicadores hardcoded con nombres genéricos |
| Gráfico | `AreaChartComponent` — no se verificó fuente de datos |
| Tabla usuarios | PLACEHOLDER — datos NFT de subastas, no datos reales |
| Botones | Labels placeholder ("hola mundo", "Hola mundo") |
| Página NFT | `/dashboard/nft` — completamente placeholder, datos ficticios |
| **Conclusión** | El dashboard requiere reconstrucción completa con datos reales |

## 6.3 Business / Restaurante Module

| Aspecto | Estado |
|---------|--------|
| Ruta | `/business` |
| Listar negocios | COMPLETO — tabla con nombre, zona horaria, estado |
| Crear negocio | COMPLETO — modal con formulario (nombre, moneda, timezone, formatos) |
| Activar negocio | COMPLETO — toggle con confirmación |
| Desactivar | STUB — toast "en construcción" |
| Actualizar | STUB — toast "en construcción" |
| Eliminar | STUB — toast "en construcción" |
| Setup wizard | COMPLETO — 5 pasos (basic info, tax, accounting, inventory, POS) |
| Monedas | COMPLETO — select desde GET `/currencies` |
| Multi-business | IMPLEMENTADO — `FindMyBusinessesService` devuelve array |

## 6.4 Roles & Permissions Module

| Aspecto | Estado |
|---------|--------|
| Rutas | 7 sub-rutas (dashboard, modules, roles, permissions, roles-permissions, roles-user, users) |
| Users CRUD | COMPLETO — tabla paginada + filtros + modales crear/editar/eliminar |
| Roles CRUD | COMPLETO — tabla paginada + filtros + modales |
| Permissions CRUD | COMPLETO — tabla + filtros + modales + skeleton |
| Modules CRUD | COMPLETO — tabla + filtros + modales |
| Roles-User | COMPLETO — tabla de usuarios con roles + modal de asignación |
| Roles-Permissions | COMPLETO — selector de rol + cards de permisos + skeleton |
| Dashboard RBAC | IMPLEMENTADO — página de resumen |
| Permission directive | IMPLEMENTADO — `*appCheckPermission` en botones de acción |
| Menu filtering | IMPLEMENTADO — menú lateral se filtra por permisos |

## 6.5 Profile Module

| Aspecto | Estado |
|---------|--------|
| Ruta | `/profile` |
| Vista | COMPLETO — 3 cards (contact, personal info, tarjet) |
| Update contact | COMPLETO — modal con formulario |
| Skeletons | COMPLETO — 3 skeleton components |
| Avatar | `AvatarService` genera avatares vía ui-avatars.com |

## 6.6 Layout Module

| Aspecto | Estado |
|---------|--------|
| Sidebar | COMPLETO — colapsable, menú dinámico filtrado por permisos |
| Navbar desktop | COMPLETO — búsqueda, notificaciones, perfil, tema |
| Navbar mobile | COMPLETO — hamburguesa, menú overlay |
| Bottom navbar | COMPLETO — navegación inferior mobile |
| Footer | COMPLETO |
| Profile menu | COMPLETO — dropdown con opciones |
| Scroll to top | COMPLETO — en navegación |
| Responsive | COMPLETO — sidebar/navbar/bottom-navbar responsive |

## 6.7 Error Module

| Aspecto | Estado |
|---------|--------|
| 404 | COMPLETO — ilustración SVG + botón volver |
| 500 | COMPLETO — ilustración SVG + botón volver |

---

# 7. ESTADO REDOM

## 7.1 Matriz de funcionalidades

| Funcionalidad | Estado | Componentes reutilizables | API existente | Trabajo necesario |
|--------------|--------|--------------------------|---------------|-------------------|
| **Dashboard** | 🟡 PARCIAL | `HeaderDashboard`, `Card`, `AreaChart`, `Button`, `Icon` | No (datos placeholder) | Reconstruir con endpoints reales de métricas |
| **Auth** | 🟢 COMPLETO | `AuthService`, `authGuard`, `AuthInterceptor`, forms, validators | Sí (login, register, reset) | Extender catálogo de permisos REDOM |
| **Usuarios** | 🟢 COMPLETO | `Table`, `PaginationTable`, `FiltersTable`, `ModalCard`, `Button`, `ConfirmModal` | Sí (CRUD completo) | Nada — ya implementado |
| **Roles** | 🟢 COMPLETO | Mismos que usuarios | Sí (CRUD completo) | Nada — ya implementado |
| **Negocio** | 🟡 PARCIAL | `Table`, `ModalCard`, `Button`, `Toggle`, forms, setup wizard | Sí (CRUD parcial) | Completar update/delete + multi-negocio |
| **Configuración** | 🟡 PARCIAL | `ModalCard`, `Button`, `Toggle`, forms, wizard multi-step | Sí (setup steps) | Extender wizard con más pasos |
| **Carta** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `Icon`, `Badge`, `Toggle`, `ConfirmModal`, `FiltersTable`, `PaginationTable`, `Toast` | No | Crear módulo completo |
| **Categorías** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `ConfirmModal`, `FiltersTable`, `PaginationTable`, `Badge`, `Toast` | No | Crear módulo completo |
| **Productos** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `Toggle`, `Badge`, `ConfirmModal`, `FiltersTable`, `PaginationTable`, `Toast`, form pattern | No | Crear módulo completo |
| **Extras** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `Toggle`, `ConfirmModal`, `Badge`, `Toast` | No | Crear sub-módulo de productos |
| **Destacados** | 🔴 NO EXISTE | `Toggle`, `Badge`, `Card` | No | Extender productos |
| **Carta pública** | 🔴 NO EXISTE | `Card`, `Badge`, `Button`, `Icon`, `Skeleton` | No | Nueva app o módulo público |
| **Sectores** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `Badge`, `ConfirmModal`, `Toast` | No | Crear módulo |
| **Mesas** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `Badge`, `Toggle`, `ConfirmModal`, `Icon`, `Toast` | No | Crear módulo con floor plan |
| **QR** | 🔴 NO EXISTE | `ModalCard`, `Button`, `Icon` | No | Generación/descarga QR por mesa |
| **Pedidos** | 🔴 NO EXISTE | `Table`, `Badge`, `Button`, `Icon`, `ModalCard`, `ConfirmModal`, `PaginationTable`, `FiltersTable`, `Toast` | No | **Módulo principal** — flujo completo |
| **POS** | 🔴 NO EXISTE | `Table`, `Card`, `Button`, `Icon`, `Badge`, `ModalCard`, `Toast`, `Toggle` | No | Interfaz POS (productos + carrito + cobro) |
| **Clientes** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `FiltersTable`, `PaginationTable`, `Badge`, `Toast` | No | Crear módulo CRM |
| **Pagos** | 🔴 NO EXISTE | `ModalCard`, `Button`, `Icon`, `Toast` | No | Integrar pasarela de pago |
| **Split de cuentas** | 🔴 NO EXISTE | `ModalCard`, `Button`, `Icon`, `Badge` | No | Extender módulo de pedidos |
| **Reservas** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `Badge`, `Calendar`, `Toast` | No | Crear módulo con calendario |
| **Cocina/KDS** | 🔴 NO EXISTE | `Table`, `Badge`, `Button`, `Icon`, `Card`, `Toast` | No | Vista de cocina en tiempo real |
| **Impresión** | 🔴 NO EXISTE | `Button`, `Icon`, `Toast` | No | Integración impresora térmica |
| **Inventario** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `Toggle`, `Badge`, `FiltersTable`, `PaginationTable`, `Toast` | No | Crear módulo completo |
| **Costos** | 🔴 NO EXISTE | `Card`, `AreaChart`, `Table`, `Badge` | No | Extender módulo de inventario |
| **Proveedores** | 🔴 NO EXISTE | `Table`, `ModalCard`, `Button`, `FiltersTable`, `PaginationTable`, `Toast` | No | Crear módulo |
| **CRM** | 🔴 NO EXISTE | `Table`, `Card`, `Button`, `Badge`, `FiltersTable`, `PaginationTable`, `Toast` | No | Extender módulo clientes |
| **Fidelización** | 🔴 NO EXISTE | `Card`, `Badge`, `Table`, `AreaChart` | No | Extender módulo clientes |
| **Analytics** | 🔴 NO EXISTE | `Card`, `AreaChart`, `HeaderDashboard`, `Badge` | No | Crear dashboard analytics |
| **IA** | ⚪ NO APLICA | — | No | Planificación futura |

---

# 8. ROUTING

## 8.1 Árbol completo de rutas existentes

```
/                                               → LayoutModule (lazy)
├── /dashboard                                  → DashboardModule (lazy)
│   ├── /dashboard                              → redirect /dashboard/admin
│   ├── /dashboard/admin                        → AdminComponent [authGuard]
│   └── /dashboard/**                           → redirect errors/404
├── /components/table                           → UimModule (lazy)
│   └── /components/table                       → TablePage
├── /components                                 → UikitModule (lazy)
│   ├── /components                             → redirect
│   └── /components/table                       → TableComponent
├── /roles-and-permissions                      → RolesAndPermissionsModule (lazy)
│   ├── /roles-and-permissions                  → DashboardComponent [authGuard]
│   ├── /roles-and-permissions/modules          → ModulesComponent [authGuard]
│   ├── /roles-and-permissions/roles            → RolesComponent [authGuard]
│   ├── /roles-and-permissions/permissions      → PermissionsComponent [authGuard]
│   ├── /roles-and-permissions/roles-permissions→ RolesPermissionsComponent [authGuard]
│   ├── /roles-and-permissions/roles-user       → RolesUserComponent [authGuard]
│   └── /roles-and-permissions/users            → UsersComponent [authGuard]
├── /business                                   → RestauranteModule (lazy)
│   └── /business                               → BusinessComponent [authGuard]
├── /profile                                    → ProfileModule (lazy)
│   └── /profile                                → ProfileComponent [authGuard]
├── /                                           → redirect /dashboard
└── /**                                         → redirect error/404

/auth                                           → AuthModule (lazy)
├── /auth                                       → redirect /auth/sign-in
├── /auth/sign-in                               → SignInComponent (público)
├── /auth/sign-up                               → SignUpComponent (público)
├── /auth/forgot-password                       → ForgotPasswordComponent (público)
├── /auth/new-password                          → NewPasswordComponent (público)
├── /auth/two-steps                             → TwoStepsComponent (público)
├── /auth/temporary-password                    → TemporaryPasswordComponent (público)
└── /auth/**                                    → redirect /auth/sign-in

/errors                                         → ErrorModule (lazy)
├── /errors                                     → redirect /errors/404
├── /errors/404                                 → Error404Component (público)
├── /errors/500                                 → Error500Component (público)
└── /errors/**                                  → redirect /errors/404

/**                                             → redirect /errors/404
```

## 8.2 Layout por zona

| Zona | Layout | Sidebar | Navbar | Footer |
|------|--------|---------|--------|--------|
| Feature modules | `LayoutComponent` (full shell) | Sí | Sí | Sí |
| Auth pages | `AuthComponent` (minimal) | No | No | No |
| Error pages | `ErrorComponent` (minimal) | No | No | No |

## 8.3 Guards aplicados

| Ruta | Guard | Tipo |
|------|-------|------|
| `/dashboard/**` | `authGuard` | `canActivate` + `canActivateChild` |
| `/business/**` | `authGuard` | `canActivate` + `canActivateChild` |
| `/roles-and-permissions/**` | `authGuard` | `canActivate` + `canActivateChild` |
| `/profile/**` | `authGuard` | `canActivate` + `canActivateChild` |

> **Pendiente:** Activar `permissionGuard` en rutas específicas con `data: { viewPermission: '...' }`

---

# 9. RESPONSIVE

## 9.1 Estrategia actual

| Dispositivo | Sidebar | Navbar | Bottom Navbar | Grid |
|------------|---------|--------|---------------|------|
| **Desktop** (>1024px) | Visible, colapsable | Horizontal con menú | Oculto | Multi-columna |
| **Tablet** (768-1024px) | Colapsado, toggle | Horizontal simplificado | Oculto | 2 columnas |
| **Mobile** (<768px) | Overlay, hamburguesa | Hamburguesa + título | Visible (4 items) | 1 columna |

## 9.2 Componentes responsive existentes

| Componente | Desktop | Tablet | Mobile | REDOM-ready |
|-----------|---------|--------|--------|-------------|
| `SidebarComponent` | ✅ | ✅ | ✅ | Sidebar lateral para backoffice |
| `NavbarComponent` | ✅ | ✅ | ✅ | Barra superior |
| `NavbarMobileComponent` | N/A | N/A | ✅ | Navegación mobile |
| `BottomNavbarComponent` | N/A | N/A | ✅ | **Ideal para POS y app móvil** |
| `TableComponent` | ✅ | ✅ | ✅ (scroll H) | Tablas de datos |
| `ModalCardComponent` | ✅ | ✅ | ✅ (90% width) | Modales |
| `HeaderDashboardComponent` | ✅ | ✅ | ✅ | Encabezados |
| `PaginationTableComponent` | ✅ | ✅ | ✅ | Paginación |
| `FiltersTableComponent` | ✅ | ✅ | ✅ | Filtros |
| `ToastComponent` | ✅ | ✅ | ✅ | Notificaciones |

## 9.3 REDOM — Requisitos responsive

| Contexto | Dispositivo | Layout necesario |
|----------|------------|-----------------|
| Backoffice admin | Desktop/Tablet | Sidebar + navbar (existente) |
| POS (punto de venta) | Tablet horizontal / Desktop | Full-screen sin sidebar |
| Cocina (KDS) | Tablet / Monitor | Full-screen, orientación landscape |
| Foodtruck | Tablet / Mobile | App-like, bottom navbar |
| Cliente (carta QR) | Mobile | PWA ligera, sin navbar admin |
| Mesero (toma pedidos) | Tablet / Mobile | App-like, catálogo de productos |

> **El sistema responsive actual cubre backoffice. Para POS y KDS se requiere layout full-screen sin sidebar. Para app móvil se reutiliza BottomNavbarComponent.**

---

# 10. RIESGOS

## 10.1 Deuda técnica

| Riesgo | Severidad | Impacto REDOM |
|--------|-----------|---------------|
| **Tokens en localStorage** | CRITICAL | XSS — tokens accesibles desde cualquier script. Migrar a HttpOnly cookies o BFF |
| **0 tests en UI library** | HIGH | Sin cobertura en 97 archivos. Riesgo de regresiones al extender |
| **0 tests en data-access services** | HIGH | Sin cobertura en ~30 servicios. Riesgo al crear nuevos |
| **Guards de permisos no activos** | HIGH | `permissionGuard` y `roleGuard` definidos pero no usados en rutas |
| **Dashboard placeholder** | MEDIUM | Indicadores fake y datos NFT irrelevantes |
| **Password en sessionStorage** | MEDIUM | `PasswordTransferService` almacena credenciales |
| **RxJS 7.4 vs 7.8** | LOW | Versión antigua — posible incompatibilidad futura |
| **Tipos sin fallback** | LOW | `font-poppins` sin `sans-serif` |
| **Carpetas vacías** | LOW | `shared/pipes/`, `shared/validators/`, `core/utils/` con `.gitkeep` |
| **A11y ausente** | MEDIUM | Sin ARIA labels, focus trap, skip-to-content |

## 10.2 Problemas de arquitectura

| Problema | Detalle | Riesgo REDOM |
|----------|---------|-------------|
| **Organisms sub-poblada** | 1 componente vs 6 templates | Nuevas features requerirán más organisms |
| **Sin store centralizado** | Estado disperso en servicios — consistencia depende de disciplina | Puede haber divergencia entre features |
| **Nombres inconsistentes** | `restaurante` (es) / `roles-and-permissions` (en) / `uikit`/`uim` | Mantener consistencia al nombrar nuevos módulos |
| **Sin shared forms** | Cada feature define sus propios formularios — sin componentes de form reutilizables | Duplicación de código de formularios |
| **Sin i18n** | Textos hardcodeados en español — no hay `@angular/localize` | Bloquea internacionalización |

## 10.3 Problemas de multi-tenancy

| Problema | Detalle |
|----------|---------|
| **Business ID implícito** | `WhoamiDto` devuelve `restaurantId` y `branchId` — el frontend no los usa en requests |
| **Sin selector de negocio** | La UI no permite cambiar entre múltiples negocios |
| **Datos mezclados** | No hay segregación de datos por `restaurantId` en las llamadas API actuales |

## 10.4 Problemas de UX

| Problema | Detalle |
|----------|---------|
| **Botones placeholder** | "hola mundo", "Hola mundo" en dashboard admin |
| **Datos incorrectos** | Tabla "Usuarios" muestra NFTs con columna "Open Price" mostrando nombre |
| **Actualización en tiempo real** | No hay WebSockets — solo polling (whoami cada 60s) |
| **Sin confirmación en toggle** | Desactivar negocio no tiene confirmación |
| **Modales con width fijo** | `width: '90%'` sin breakpoints |

---

# 11. RECOMENDACIONES

> **Principio fundamental:** Reutilizar todo el sistema visual, componentes y patrones existentes. No rediseñar.

## 11.1 Qué reutilizar (EXISTENTE y FUNCIONAL)

| Recurso | Para REDOM |
|---------|-----------|
| `AppTable` + slots | Todas las tablas (productos, pedidos, mesas, clientes, inventario) |
| `AppModalCard` + `MatDialog` | Todos los modales CRUD |
| `AppButton` (tonos/sizes/iconos) | Todas las acciones (crear, editar, eliminar, pagar, imprimir) |
| `AppBadge` | Estados (pedido, mesa, pago, producto activo/inactivo) |
| `AppToggle` | Activar/desactivar productos, disponibilidad, features |
| `AppToast/ToastService` | Notificaciones globales |
| `AppConfirmModal` | Confirmaciones de eliminación, anulación |
| `AppHeaderDashboard` | Encabezados de página con acciones |
| `AppPaginationTable` | Paginación en todas las listas |
| `AppFiltersTable` | Filtros de búsqueda en tablas |
| `AppProgressBar` | Indicadores de carga en tablas y formularios |
| `AppSkeleton` | Loading states |
| `AppAreaChart` | Gráficos de dashboard y analytics |
| `AppCard` | Contenedores de widgets y KPIs |
| `AppIcon` | Todos los iconos |
| `LayoutComponent` (sidebar+navbar) | Shell de backoffice |
| `BottomNavbarComponent` | Navegación mobile para POS/app |
| `ThemeService` | Dark/light mode + 7 colores — usar en TODAS las vistas REDOM |
| `AuthService` + guards + interceptor | Autenticación completa |
| `WhoamiService` | Datos de usuario, roles, permisos |
| `CheckPermissionDirective` | Control de acceso en UI |
| Patrón `data-access/` service-per-endpoint | TODOS los nuevos endpoints |
| Patrón `StandardizedPagination<T>` | Todas las respuestas paginadas |
| `ApiPathEnum` | Extender con nuevos paths de API |
| Glassmorphism utilities | Consistencia visual en todos los componentes |

## 11.2 Qué extender

| Extensión | Motivo |
|-----------|--------|
| `Permission` enum | Agregar permisos REDOM (products, orders, tables, inventory, etc.) |
| `Menu.pages` en `menu.ts` | Agregar items de menú para nuevas features |
| `ApiPathEnum` | Agregar paths de API (`PRODUCTS`, `ORDERS`, `TABLES`, etc.) |
| `LayoutComponent` | Soportar layout alternativo (full-screen sin sidebar para POS/KDS) |
| `AuthService` | Agregar `hasBusinessAccess(businessId)` para multi-tenancy |
| `WhoamiDto` | Si el backend retorna más datos (businesses, branches) |

## 11.3 Qué agregar (nuevo)

| Nuevo | Propósito |
|-------|-----------|
| `modules/products/` | CRUD productos, categorías, extras, destacados |
| `modules/tables/` | Gestión de mesas con floor plan + QR |
| `modules/orders/` | Flujo completo de pedidos (crear, estados, historial) |
| `modules/pos/` | Punto de venta (layout full-screen, carrito, cobro) |
| `modules/kitchen/` | KDS — vista de cocina en tiempo real |
| `modules/reservations/` | Calendario de reservas |
| `modules/inventory/` | Inventario, stock, recetas, costos |
| `modules/customers/` | CRM, fidelización |
| `modules/reports/` | Analytics, reportes, exportación |
| `modules/public-menu/` | Carta pública (QR) — posiblemente app separada |
| `shared/components/business-selector/` | Selector de negocio activo (multi-tenancy) |
| `shared/components/form-field/` | Componente de formulario reutilizable |
| WebSocket service | Actualización en tiempo real para pedidos y cocina |
| Print service | Integración con impresora térmica |
| Layout full-screen | Para POS y KDS (sin sidebar, sin navbar estándar) |
| `src/ui/organisms/` | Poblar con organisms reales (order-card, table-grid, product-card) |

## 11.4 Qué refactorizar (solo si es estrictamente necesario)

| Refactor | Justificación |
|----------|--------------|
| Dashboard admin | Reconstruir con datos reales — eliminar NFT y placeholders |
| Nombres de archivo | `ckassnames.ts` → `classnames.ts`, `navbar-mobilecomponent.ts` → `navbar-mobile.component.ts` |
| Token storage | `localStorage` → evaluar `HttpOnly` cookies o BFF |
| Activar `permissionGuard` | Agregar `data: { viewPermission }` a todas las rutas protegidas |
| Carpeta `organisms/` | Mover componentes complejos desde templates a organisms si corresponde |

---

# 12. ROADMAP REDOM

> **Última actualización:** 2026-11-15 (revisado contra el código, las rutas, el menú, `plan-routes.ts`, `git log` de todas las ramas, `PENDIENTES.md`, `BACKEND-REQUESTS.md` y `docs/plan-carta-personalizada.md`).
>
> **Estados:** ✅ hecho · 🟡 parcial (se dice qué falta) · ⬜ pendiente.
> **Dónde está:** salvo que se diga otra cosa, todo lo ✅ está **en master (producción)**. Casi nada está probado de punta a punta (ver `PENDIENTES.md` § 2.4 y "Pruebas pendientes").
>
> **Trabajo fuera de master:**
> - Rama `GR-39-parte-2` (y `GR-39-parte-2_master`, mismo cambio sobre master): **etapa 10.2** (panel de clientes, módulo `messaging`, `/carta/encuesta` y `/carta/baja`), **sin fusionar**. El resto de sus commits (etapas 8–11 y legal) ya están en master con otro hash.
> - Rama actual `fix/pos-impresion-carta-master` (4 commits, sin fusionar): venta directa sin cocina en el POS, tamaño del texto de los tickets por equipo, comprobante de pago al terminar el cobro y arreglo del scroll en Diseño de la carta.
> - `GR-39` y `feat/brand-logo` no tienen nada nuevo: sus commits ya están en master (cherry-pick). Las ramas `*_dev` / `develop` solo suman commits de ambiente.

## FASE 1 — MVP COMERCIAL

> **Objetivo:** un restaurante recibe un pedido, lo procesa, lo envía a sus estaciones, lo imprime, lo cobra y lo ve en sus indicadores.

| # | Funcionalidad | Estado | Nota |
|---|---|---|---|
| 1.1 | Activar `permissionGuard` en rutas | ✅ | Por mapa de rutas (`core/permissions/permission-routes.ts`) en vez de `data.viewPermission`; `enforcePermissions` encendido en todos los ambientes |
| 1.2 | Catálogo de permisos extendido | ✅ | Constantes por servicio (auth / restaurant / billing), igual que el backend. #16 (ver todas las reservas) sigue abierto |
| 1.3 | Selector de negocio activo | 🟡 | "Mis negocios" en Mi negocio y Perfil; un cambio de negocio desde el navbar: por verificar |
| 1.4 | Categorías | ✅ | `/products/categories`, orden manual (#68) |
| 1.5 | Productos | ✅ | Imágenes, disponibilidad, variedades, etiquetas; "Agotados de hoy" |
| 1.6 | Sectores | ✅ | `/sectors` |
| 1.7 | Mesas | ✅ | `/tables` con pestañas por sector. Vista de plano (floor plan): por verificar |
| 1.8 | QR por mesa | ✅ | Modal con QR descargable. #29/#54: la URL del QR debe apuntar a la landing (`redom.cl/carta`) en cada ambiente |
| 1.9 | POS | ✅ | `/pos` + terminal de salón (`/settings/terminal`). 🟡 Venta directa sin cocina solo en rama `fix/pos-impresion-carta-master` |
| 1.10 | Pedidos — crear | ✅ | `/orders/new`, modificadores en el pedido |
| 1.11 | Pedidos — estados | ✅ | Badges y cambio de estado |
| 1.12 | Cocina / KDS | 🟡 | `/kitchen` con estaciones; se refresca por intervalo (sin WebSocket ni sonido) |
| 1.13 | Impresión | 🟡 | Impresoras, estación de impresión (`/settings/print-station`), comanda, precuenta (con opción sin IVA, #70) y reporte Z en master. Falta: token de dispositivo (#15), prueba en térmica real de 58 mm, y lo de la rama actual (tamaño de texto, comprobante de pago) |
| 1.14 | Pagos | ✅ | Efectivo/tarjeta/medios configurables, dividir la cuenta y pagar por producto (#40), propina sugerida (#41 abierto). Falta E2E de "dividir por productos" |
| 1.15 | Dashboard real | ✅ | KPIs, pedidos recientes, más vendidos y "primeros pasos". Sin placeholders NFT |

## FASE 2 — OPERACIÓN

| # | Funcionalidad | Estado | Nota |
|---|---|---|---|
| 2.1 | Carta digital (administración) | ✅ | Productos, orden, destacados, visibilidad; ver "Carta pública" abajo |
| 2.2 | Extras y modificadores | 🟡 | `/products/modifiers`. Falta: eliminar opciones guardadas (#34) y que `GET /products` traiga los sets (#35) |
| 2.3 | Split de cuentas | ✅ | Por producto y por partes (ver 1.14) |
| 2.4 | Reservas | 🟡 | `/bookings`, reservas desde la carta (#53). Falta asignar mesero/encargado (#71) y horario del local (#62) |
| 2.5 | Historial de pedidos | ✅ | `/orders` y `/payments` con filtros |
| 2.6 | Clientes básicos | ✅ | `/customers` (listado y ficha). Panel y actividad: rama `GR-39-parte-2` |
| 2.7 | Notificaciones en tiempo real | ⬜ | No hay WebSocket/SSE; KDS, pedidos de clientes y caja se refrescan por intervalo o al volver a la ventana |
| 2.8 | Caja y turnos *(no estaba)* | 🟡 | `/cash`, `/settings/registers`, reporte Z (80 mm). Ajustes del backend #43 |
| 2.9 | Onboarding *(no estaba)* | ✅ | Alta del negocio en pocos pasos y configuración del POS (#42) |
| 2.10 | Horarios del local *(no estaba)* | ✅ | `/settings/schedules` |

## FASE 3 — INVENTARIO Y RENTABILIDAD

| # | Funcionalidad | Estado | Nota |
|---|---|---|---|
| 3.1 | Inventario | 🟡 | Fases 1–5: stock, ajustes, conteos, transferencias, kardex, unidades, lotes. Solo fase 1 probada E2E. Abiertos #31–#33, #36–#38, #66 |
| 3.2 | Recetas | ✅ | Editor de recetas, descuento automático por venta, producción/preparaciones |
| 3.3 | Costos | ✅ | Food cost y consumo |
| 3.4 | Proveedores | 🟡 | Se crean desde la compra (modal); sin pantalla propia. #49: crear proveedor pide el permiso de clientes |
| 3.5 | Compras | ✅ | Compras y órdenes de compra con detalle |
| 3.6 | Finanzas *(no estaba)* | 🟡 | Gastos, recurrentes, categorías, cuentas por pagar, propinas y reparto, "Plata por llegar" (comisiones de medios de pago). Ajustes #44, #45 |

## FASE 4 — CLIENTES Y CRECIMIENTO

| # | Funcionalidad | Estado | Nota |
|---|---|---|---|
| 4.1 | CRM | 🟡 | Clientes reconocidos por correo (etapa 10) en master. **Panel de clientes (segmentos, CSV, actividad) en rama `GR-39-parte-2`, sin fusionar** |
| 4.2 | Fidelización | ✅ | `/loyalty`, canje en el POS. #61 abierto (descuento canjeado editable) |
| 4.3 | Carta pública (QR) | ✅ | Etapas 1–11 en master (detalle abajo). Vive en la landing (`projects/landing`, `redom.cl/carta`) |
| 4.4 | Pedidos desde QR | ✅ | Etapa 3 (mesa) y 5 (retiro y delivery con comprobante); bandeja `/customer-orders` |
| 4.5 | Marketing | 🟡 | Marketing de la carta (promos, banners, packs) en master. **Mensajería por correo (automáticos y campañas) en rama `GR-39-parte-2`, sin fusionar; bloqueada por #81**. WhatsApp ⬜ |

### Carta pública e innovación (`docs/plan-carta-personalizada.md`) *(no estaba)*

| Etapa | Contenido | Estado |
|---|---|---|
| 1–7 | Carta por local, marketing, pedidos en mesa y packs, mesero/cuenta/reservas/encuesta, retiro y delivery, API pública/webhooks/widget, idiomas con IA y fidelización | ✅ master (sin E2E contra la API real) |
| 8 | Diseño (plantillas, tipografías, historia, chef) | ✅ master. Arreglo de scroll en rama actual |
| 9 | Contenido con IA (`/products/improve`) | ✅ master (sin fotos con IA: etapa 9b ⬜) |
| 10 | Cliente reconocido por correo | ✅ master |
| 10.1 | Módulo legal global (términos, privacidad, consentimientos; Plataforma → Legal) | ✅ master. #79 abierto; textos por revisar con abogado |
| 10.2 | Mensajería y panel de clientes | 🟡 rama `GR-39-parte-2`, sin fusionar ni probar; #81 bloqueante |
| 11 | Carta dinámica (momentos, temporadas, plato del día, clima, sugerencias) | ✅ master |
| 12 | Mesa compartida (+ pago online, Mercado Pago OAuth) | ⬜ |
| 13 | Comunidad y juegos | ⬜ |
| 14 | Mesero virtual con IA | ⬜ |

## FASE 5 — INTELIGENCIA

| # | Funcionalidad | Estado | Nota |
|---|---|---|---|
| 5.1 | Analytics avanzado | 🟡 | Dashboard con KPIs básicos; estadísticas de la carta y del asistente. Sin tendencias ni forecast |
| 5.2 | Reportes | 🟡 | Reporte Z, exportación CSV en Plataforma (pagos) y legal (CSV/PDF). Sin reportes exportables de ventas/inventario (inventario "sin exportar a Excel/CSV") |
| 5.3 | Predicción de demanda | ⬜ | |
| 5.4 | Optimización de menú | 🟡 | Sugerencias de precio y promociones con IA (etapa 9); sin análisis de rentabilidad por producto más allá de food cost |
| 5.5 | Centro de ayuda y asistente con IA *(no estaba)* | ✅ | `/help`, administración de artículos, revisión y uso/costos. Falta recargar artículos con el menú nuevo |

## FASE 6 — ECOSISTEMA

| # | Funcionalidad | Estado | Nota |
|---|---|---|---|
| 6.1 | Multi-sucursal | 🟡 | Sucursales (`/business/location`), transferencias entre locales (`multiLocation`). Sin consolidación de datos entre sucursales |
| 6.2 | Marketplace (Uber Eats, Rappi, PedidosYa) | ⬜ | La API pública y los webhooks (etapa 6) son la base |
| 6.3 | App móvil / PWA | ⬜ | Sin service worker; la carta y la terminal son responsive |
| 6.4 | White label | 🟡 | Por negocio: logo, colores y diseño de la carta (`menu_branding`, `menu_design`). Color de marca del restaurante en el backoffice pendiente (#30) |
| 6.5 | Facturación electrónica (SII) | ⬜ | No hay integración |
| 6.6 | Planes, suscripciones y Plataforma (superadmin) *(no estaba)* | ✅ | Entitlements por plan (`plan-routes.ts`, candados en menú), Mi suscripción, pago manual y con Flow, proceso diario; Plataforma: negocios, planes, cobros, descuentos, accesos de soporte, legal, ajustes. Abiertos #47, #48, precios de planes por definir |
| 6.7 | Landing *(no estaba)* | ✅ | `projects/landing` (SSR): planes desde el API, asistente con IA y la carta pública |
| 6.8 | Pagos online desde la carta | ⬜ | Junto con la etapa 12 (Mercado Pago OAuth); comisión de Redom por decidir |

## Próximos pasos (por prioridad)

1. **Probar y fusionar la etapa 10.2** (rama `GR-39-parte-2` → master). Antes, el backend debe resolver **#81** (los enlaces de encuesta y baja de los correos apuntan al backoffice; se pide `PUBLIC_MENU_URL`, que además cierra #54).
2. **Cerrar la rama actual** `fix/pos-impresion-carta-master` (venta directa, tickets, comprobante) y probar en impresora térmica real.
3. **Backend bloqueante o con más impacto:** #39 (token renovado responde 401; la sesión dura 2 h) · #71 (asignar mesero/encargado a reservas) · #79 (ajustes del módulo legal) · #15 (token de dispositivo para impresión) · #29/#54 (URLs públicas de la carta por ambiente) · #48 (CORS con varios orígenes).
4. **Resto de solicitudes abiertas** (`BACKEND-REQUESTS.md`): #16, #28, #30–#38, #41, #43–#45, #47, #49, #51, #52, #55–#57, #59–#62, #65, #66; #25 por decidir.
5. **Pruebas de punta a punta** de la carta (etapas 1–11) contra la API real, Safari iOS, fidelización, variedades, inventario fases 2–5, caja y finanzas.
6. **Etapa 12 · Mesa compartida** (con pago online desde la carta).
7. **Etapa 13 · Comunidad y juegos.**
8. **Etapa 14 · Mesero virtual con IA.**
9. **Más adelante:** WhatsApp como canal de mensajería · tiempo real (WebSocket/SSE) · reportes exportables · facturación electrónica (SII) · PWA · integración con apps de delivery.

---

# APÉNDICE A: Patrón para crear un nuevo feature module REDOM

```text
src/app/modules/products/
├── products.module.ts              # NgModule vacío, importa routing
├── products-routing.module.ts      # Routes con authGuard + permissionGuard
├── products.component.ts           # Componente wrapper (opcional)
├── products.component.html
├── pages/
│   ├── index.ts
│   ├── product-list/
│   │   ├── index.ts
│   │   ├── product-list.component.ts      # Página smart — orquesta
│   │   ├── product-list.component.html
│   │   ├── data-access/
│   │   │   ├── index.ts
│   │   │   ├── get-all-products.service.ts    # GET paginado
│   │   │   ├── create-product.service.ts      # POST
│   │   │   ├── update-product.service.ts      # PATCH
│   │   │   ├── delete-product.service.ts      # DELETE
│   │   │   └── dtos/
│   │   │       ├── index.ts
│   │   │       ├── product.dto.ts
│   │   │       ├── create-product.dto.ts
│   │   │       └── update-product.dto.ts
│   │   ├── features/
│   │   │   ├── index.ts
│   │   │   ├── products-table/               # Tabla — dumb component
│   │   │   │   ├── index.ts
│   │   │   │   ├── products-table.component.ts
│   │   │   │   └── products-table.component.html
│   │   │   ├── create-product-modal/         # Modal crear
│   │   │   │   ├── index.ts
│   │   │   │   ├── create-product-modal.component.ts
│   │   │   │   └── create-product-modal.component.html
│   │   │   ├── update-product-modal/         # Modal editar
│   │   │   │   ├── index.ts
│   │   │   │   ├── update-product-modal.component.ts
│   │   │   │   └── update-product-modal.component.html
│   │   │   └── delete-product-modal/         # Modal confirmar eliminar
│   │   │       ├── index.ts
│   │   │       ├── delete-product-modal.component.ts
│   │   │       └── delete-product-modal.component.html
│   │   └── ui/
│   │       ├── index.ts
│   │       ├── filters-product-table/        # Filtros específicos
│   │       │   ├── index.ts
│   │       │   ├── filters-product-table.component.ts
│   │       │   └── filters-product-table.component.html
│   │       └── product-list-skeleton/        # Skeleton
│   │           ├── index.ts
│   │           └── product-list-skeleton.component.ts
│   └── product-detail/                       # Página de detalle (opcional)
│       └── ...
```

**Registro en routing:**

```typescript
// layout-routing.module.ts
{
  path: 'products',
  component: LayoutComponent,
  canActivate: [authGuard, permissionGuard],
  data: { viewPermission: 'products:see-module' },
  loadChildren: () => import('../products/products.module').then(m => m.ProductsModule),
}
```

**Registro en menú:**

```typescript
// core/constants/menu.ts
{
  icon: 'restaurant_menu',
  label: 'Productos',
  route: '/products',
  children: [
    { label: 'Carta', route: '/products', permission: 'products:see-module' },
    { label: 'Categorías', route: '/products/categories', permission: 'categories:see-module' },
  ],
}
```

**Registro en permisos:**

```typescript
// shared/enums/permissions.enum.ts
PRODUCTS: {
  SEE_MODULE: 'products:see-module',
  GET_ALL: 'products:get-all',
  CREATE: 'products:create',
  UPDATE: 'products:update',
  DELETE: 'products:delete',
}
```

**Servicio data-access (patrón a replicar):**

```typescript
// Tomar como template: get-all-users.service.ts (para GET paginados)
// Tomar como template: create-user.service.ts (para POST/PATCH/DELETE)
```

---

**Fin del análisis REDOM Frontend Summary.**
