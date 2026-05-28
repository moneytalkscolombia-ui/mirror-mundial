# Mirror Mundial — Supabase

Guía de referencia rápida para operar el backend durante el torneo.

---

## Estructura de carpetas

```
supabase/
├── migrations/
│   ├── 20260101000001_schema.sql   # Tablas, función calculate_points, leaderboard
│   └── 20260101000002_rls.sql      # Row Level Security policies
├── functions/
│   ├── submit_prediction/          # Edge Function: recibir predicciones
│   ├── resolve_match/              # Edge Function: ingresar resultado + calcular puntos
│   └── lock_matches/               # Edge Function: bloquear predicciones (cron)
├── templates/
│   └── magic_link.html             # Template del email de acceso (copiado al dashboard)
├── seed.sql                        # 4 partidos garantizados (semis, tercero, final)
├── config.toml                     # Config local para Supabase CLI
└── README.md                       # Este archivo
```

---

## Aplicar migraciones a un proyecto nuevo

Las migraciones se aplican **en este orden exacto**. Saltear el orden rompe referencias entre tablas.

### Orden de aplicación

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `migrations/20260101000001_schema.sql` | Crea las 3 tablas, la función `calculate_points` y la vista `leaderboard` |
| 2 | `migrations/20260101000002_rls.sql` | Activa RLS y define las políticas de acceso |
| 3 | `seed.sql` | Inserta los 4 partidos garantizados |

### Opción A — SQL Editor del dashboard (más simple)

1. Ir a [supabase.com/dashboard](https://supabase.com/dashboard) → tu proyecto → **SQL Editor**
2. Abrir `migrations/20260101000001_schema.sql`, copiar todo el contenido, pegarlo en el editor y ejecutar
3. Repetir con `migrations/20260101000002_rls.sql`
4. Repetir con `seed.sql`

### Opción B — Supabase CLI

```bash
# Instalar CLI si no está instalado
npm install -g supabase

# Autenticarse
supabase login

# Vincular al proyecto (obtener el project-id del dashboard → Settings → General)
supabase link --project-ref TU_PROJECT_ID

# Aplicar migraciones (schema + RLS, en orden por nombre de archivo)
supabase db push

# Correr el seed manualmente (db push no incluye seed.sql automáticamente)
supabase db execute --file supabase/seed.sql
```

---

## Configuración de Auth en el dashboard

Estos pasos ya fueron ejecutados en producción. Documentados aquí para si se necesita reconfigurar (proyecto nuevo, cambio de cuenta, etc.).

**1 — Activar magic link**
`Authentication` → `Providers` → `Email` → activar provider → desactivar "Confirm email" → guardar

**2 — SMTP con Resend**
`Authentication` → `Settings` → `SMTP Settings` → activar "Enable Custom SMTP"

| Campo | Valor |
|---|---|
| Sender name | `Mirror Mundial` |
| Sender email | `mundial@mail.mirror.com.co` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | API key de Resend (ver nota de credenciales abajo) |

Usar "Send test email" para verificar antes de salvar.

**3 — Template del magic link**
`Authentication` → `Email Templates` → `Magic Link`
- Subject: `Tu acceso a Mirror Mundial`
- Body: copiar el contenido de `templates/magic_link.html`

**4 — URLs de redirección**
`Authentication` → `URL Configuration`
- Site URL: `https://mirror.com.co`
- Redirect URLs: `https://mirror.com.co/**` + URL del widget en Vercel (agregar en Sesión 3)

---

## Credenciales SMTP de Resend

**Dónde están:** en el dashboard de Supabase únicamente (`Authentication → Settings → SMTP`). No están en variables de entorno ni en el repo.

**Si la API key de Resend se compromete:**
1. Ir a [resend.com](https://resend.com) → API Keys → revocar la key comprometida
2. Crear una nueva key
3. Actualizar el campo Password en `Authentication → Settings → SMTP` del dashboard de Supabase
4. Enviar test email para confirmar que funciona

---

## Notas operativas durante el torneo

- **Agregar un partido de Colombia:** admin panel → Partidos → Nuevo partido → activar "Partido de Colombia"
- **Ingresar resultado:** admin panel → Partidos → Resolver → ingresar score_a y score_b
- **Si `resolve_match` falla a mitad:** es idempotente, se puede volver a ejecutar sin problema
- **Equipo "Por definir" en las semis/final:** editar desde admin panel cuando el bracket avance, no requiere correr migrations ni seed de nuevo
- **Apagar el juego de emergencia:** Shopify admin → Metafields → `mirror.banner_active` → false
