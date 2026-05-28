# Mirror Mundial — Especificación técnica completa

> Juego de predicciones del Mundial FIFA 2026 embebido como banner en mirror.com.co (Shopify). Las personas predicen marcadores de partidos seleccionados, acumulan puntos y compiten por premios físicos de la marca Mirror.

---

## 1. Contexto del producto

**Marca operadora:** Mirror — marca colombiana de tenis, ropa y accesorios premium.
**Sitio host:** mirror.com.co (tienda Shopify).
**Audiencia:** clientes de Mirror, mayoritariamente mobile (~80%).
**Idioma:** español (es-CO), hardcodeado, sin internacionalización.
**Ventana de operación:** desde el lanzamiento hasta una semana después de la final (19 de julio de 2026).

---

## 2. Calendario de partidos cubiertos

El sistema cubre dos categorías de partidos:

1. **Todos los partidos de Colombia** desde su próximo partido en adelante (octavos, cuartos, semi, final o tercer puesto según hasta dónde llegue).
2. **Garantizados independiente de Colombia:** semifinal 1, semifinal 2, partido por el tercer puesto, final.

**Fechas garantizadas (UTC):**
- Semifinal 1: 14 de julio de 2026 (Arlington)
- Semifinal 2: 15 de julio de 2026 (Atlanta)
- Tercer puesto: 18 de julio de 2026 (Miami)
- Final: 19 de julio de 2026 (MetLife, New Jersey)

Los partidos de Colombia se agregan dinámicamente desde el admin panel conforme avance el torneo.

---

## 3. Reglas del juego

### 3.1 Registro y onboarding
- Identidad: email + magic link (Supabase Auth).
- Después del magic link, onboarding inline de 2 campos en una sola pantalla:
  1. **Nombre de jugador** (display name): auto-sugerido desde el email, editable. 3-20 caracteres alfanuméricos + guion bajo. Único.
  2. **Predicción de campeón**: dropdown con la lista actual de equipos vivos en el torneo. Una sola elección, no editable después de confirmar.

### 3.2 Predicción por partido
- Una predicción por usuario por partido: marcador exacto (dos enteros entre 0 y 20).
- Editable hasta **15 minutos antes del kickoff**. Después: bloqueada server-side.
- La validación del cierre se hace en cada llamada con `kickoff_at - now() > interval '15 minutes'` en la Edge Function, no en cron.

### 3.3 Sistema de puntos

Aplicado por partido sobre la predicción del usuario contra el resultado oficial al final de **90 minutos + tiempo extra** (los penales no cuentan):

| Caso | Puntos base |
|---|---|
| Marcador exacto (ej: predijo 2-1, fue 2-1) | 5 |
| Empate predicho con marcador errado (ej: predijo 1-1, fue 2-2) | 2 |
| Ganador + diferencia de goles correcta (ej: predijo 2-1, fue 3-2) | 3 |
| Solo ganador correcto sin diferencia | 1 |
| Errado | 0 |

**Multiplicador Colombia:** los partidos donde juega Colombia (`is_colombia = true`) tienen puntos × 2.

**Marca `is_exact`:** se setea en `true` cuando el caso es "marcador exacto". Se usa para desempate.

### 3.4 Desempate final

Cuando dos o más usuarios quedan empatados en puntos totales:
1. Gana quien acertó al campeón del Mundial (predicción inicial).
2. Si empate persiste: gana quien tenga más predicciones marcadas como `is_exact`.
3. Si empate persiste: gana quien tenga más predicciones totales (premia a quien jugó completo).
4. Si empate persiste: gana quien se registró primero (`profiles.created_at` más antiguo).

### 3.5 Premios
- **1° puesto:** outfit completo de Mirror.
- **2° puesto:** un par de tenis de Mirror.
- **3° puesto:** dos camisetas de Mirror.

Los premios se entregan después de la verificación de identidad del ganador (a definir en términos y condiciones).

---

## 4. Arquitectura técnica

### 4.1 Stack

- **Frontend del banner:** Web Component standalone construido con Preact + Vite, hosteado en Vercel como bundle estático en CDN.
- **Section Shopify:** un único archivo `sections/mirror-mundial.liquid` que solo monta el web component con atributos data-*.
- **Backend:** Supabase (Postgres + Auth + Realtime + Edge Functions Deno).
- **Admin panel:** Next.js 14 (app router) hosteado en Vercel, ruta `/admin`, protegido con autenticación de admin específica.
- **Email transaccional:** Resend con dominio verificado de Mirror.
- **Toggle global de activación:** Shopify shop metafield (`mirror.banner_active`) leído desde el Liquid.

### 4.2 Estructura de carpetas del repositorio

```
mirror-mundial/
├── widget/                    # Web component del banner (Preact + Vite)
│   ├── src/
│   │   ├── index.ts          # Entry point, registra <mirror-mundial>
│   │   ├── components/
│   │   ├── states/           # Un archivo por estado de UI
│   │   ├── lib/supabase.ts
│   │   └── styles.css        # CSS dentro de Shadow DOM
│   ├── vite.config.ts
│   └── package.json
├── admin/                     # Next.js admin panel
│   ├── app/
│   │   ├── admin/
│   │   │   ├── matches/
│   │   │   ├── resolve/
│   │   │   └── dashboard/
│   │   └── api/
│   └── package.json
├── supabase/
│   ├── migrations/           # SQL versionado
│   ├── functions/            # Edge functions Deno
│   │   ├── submit_prediction/
│   │   ├── resolve_match/
│   │   └── lock_matches/
│   └── seed.sql              # Partidos garantizados
└── shopify/
    └── sections/
        └── mirror-mundial.liquid
```

### 4.3 Esquema de base de datos

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text unique not null,
  display_name text unique not null check (length(display_name) between 3 and 20),
  champion_pick text,
  created_at timestamptz default now()
);

create table matches (
  id serial primary key,
  team_a text not null,
  team_b text not null,
  team_a_flag text,
  team_b_flag text,
  kickoff_at timestamptz not null,
  stage text not null check (stage in ('octavos','cuartos','semi','tercero','final','grupo')),
  status text not null default 'scheduled' check (status in ('scheduled','locked','live','resolved','postponed')),
  score_a int,
  score_b int,
  is_colombia boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table predictions (
  id serial primary key,
  user_id uuid not null references profiles on delete cascade,
  match_id int not null references matches on delete cascade,
  pred_a int not null check (pred_a between 0 and 20),
  pred_b int not null check (pred_b between 0 and 20),
  points_awarded int not null default 0,
  is_exact boolean not null default false,
  submitted_at timestamptz default now(),
  last_edited_at timestamptz default now(),
  unique(user_id, match_id)
);

create materialized view leaderboard as
select
  p.id as user_id,
  p.display_name,
  p.champion_pick,
  coalesce(sum(pr.points_awarded), 0)::int as total_points,
  coalesce(sum(case when pr.is_exact then 1 else 0 end), 0)::int as exact_predictions,
  count(pr.id)::int as total_predictions,
  p.created_at,
  rank() over (order by coalesce(sum(pr.points_awarded), 0) desc) as rank
from profiles p
left join predictions pr on pr.user_id = p.id
group by p.id, p.display_name, p.champion_pick, p.created_at;

create unique index on leaderboard(user_id);
```

### 4.4 Row Level Security

```sql
alter table profiles enable row level security;
alter table predictions enable row level security;
alter table matches enable row level security;

create policy "profiles select all" on profiles for select using (true);
create policy "profiles update own" on profiles for update using (auth.uid() = id);
create policy "profiles insert own" on profiles for insert with check (auth.uid() = id);
create policy "predictions own" on predictions for all using (auth.uid() = user_id);
create policy "matches select all" on matches for select using (true);
```

Las operaciones de admin (insert/update de `matches`, refresh del leaderboard) se hacen exclusivamente desde Edge Functions con service_role JWT.

### 4.5 Edge Functions

**`submit_prediction`** — recibe `{ match_id, pred_a, pred_b }` con JWT del usuario:
1. Validar autenticación.
2. SELECT match WHERE id = match_id; verificar que `status IN ('scheduled', 'locked')`.
3. Verificar `kickoff_at - now() > interval '15 minutes'`. Si no, responder 403 con mensaje claro.
4. Validar `pred_a` y `pred_b` entre 0 y 20.
5. UPSERT en predictions con `ON CONFLICT (user_id, match_id) DO UPDATE`.
6. Responder con la predicción guardada.

**`resolve_match`** — recibe `{ match_id, score_a, score_b }` con service_role JWT:
1. Validar que viene de admin (chequear que el JWT es service_role).
2. UPDATE match con scores, `status = 'resolved'`, `resolved_at = now()`.
3. Para cada predicción de ese match: calcular puntos según función `calculate_points`, aplicar ×2 si `is_colombia`, UPDATE prediction con `points_awarded` y `is_exact`.
4. `REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard`.
5. Broadcast en canal Realtime `leaderboard:updates`.
6. Responder con resumen: total predicciones procesadas, cuántos acertaron exacto, etc.

**Idempotencia:** `resolve_match` debe poder ejecutarse múltiples veces sobre el mismo partido (en caso de corrección). El paso 3 reemplaza puntos previos, no acumula.

**`lock_matches`** — opcional, cron cada 5 minutos:
1. UPDATE matches SET status = 'locked' WHERE status = 'scheduled' AND kickoff_at - now() < interval '15 minutes'.
2. Esto es solo cosmético para la UI; la validación dura está en `submit_prediction`.

### 4.6 Función de cálculo de puntos (SQL)

```sql
create or replace function calculate_points(
  pred_a int, pred_b int, score_a int, score_b int, is_colombia boolean
) returns table(points int, is_exact boolean) language plpgsql as $$
begin
  if pred_a = score_a and pred_b = score_b then
    points := 5; is_exact := true;
  elsif pred_a = pred_b and score_a = score_b then
    points := 2; is_exact := false;
  elsif sign(pred_a - pred_b) = sign(score_a - score_b) then
    if (pred_a - pred_b) = (score_a - score_b) then
      points := 3;
    else
      points := 1;
    end if;
    is_exact := false;
  else
    points := 0; is_exact := false;
  end if;

  if is_colombia then points := points * 2; end if;
  return next;
end; $$;
```

---

## 5. Estados de UI del banner

El web component renderiza uno de 7 estados según contexto:

| ID | Disparador | Contenido principal |
|---|---|---|
| `anonymous` | Usuario no logueado | Hero headline + premios + próximo partido + CTA "PREDECIR GRATIS" |
| `onboarding` | Logueado sin display_name o champion_pick | Onboarding inline 2 campos: nombre + campeón + CTA "EMPEZAR A JUGAR" |
| `prediction_open` | Logueado + hay partido con `kickoff_at - now() > 15min` | Inputs editables + countdown + leaderboard top 3 + posición propia |
| `prediction_locked` | Mismo partido pero `kickoff_at - now() <= 15min` y no resuelto | Predicción read-only + "Empieza en X min" + posición propia |
| `match_live` | Partido con `status = 'live'` (manual) | Predicción del usuario + indicador rojo "EN VIVO" |
| `match_resolved` | Partido `status = 'resolved'` (mostrado por X horas después) | Resultado real + puntos ganados destacados + cambio de posición |
| `tournament_done` | Final ya resuelta | Podio top 3 + posición final del usuario |
| `no_upcoming` | Sin partidos futuros pero torneo en curso (variante de resolved) | Último resultado + próximo partido con countdown largo |

### 5.1 Reglas de coherencia desktop ↔ mobile

- **Mobile (<768px):** stack vertical único, todo full-width, leaderboard debajo del bloque del partido.
- **Desktop (≥768px):** dos columnas — bloque del partido a la izquierda (~60%), leaderboard a la derecha (~40%).
- Mismo contenido en ambos, solo cambia layout. No hay decisiones de UX diferentes entre mobile y desktop.

### 5.2 Paleta de colores

- Fondo principal del banner: `#1B3FA0` (azul Mirror).
- Acento amarillo: `#FFD400` (botones CTA, highlights de premios, partido de Colombia).
- Acento rojo: `#CE1126` (franja decorativa lateral, usuario destacado en leaderboard, indicador "en vivo").
- Texto principal: `#FFFFFF`.
- Texto secundario: `rgba(255,255,255,0.7)`.
- Texto terciario: `rgba(255,255,255,0.5)`.
- Verde de éxito: `#00E676` (solo para indicadores "en vivo" y "subiste X puestos").

### 5.3 Tipografía

- Familia: hereda del tema Shopify de Mirror para consistencia. Fallback a `system-ui, -apple-system, sans-serif`.
- Pesos: 400 (regular) y 500 (medium). Nunca usar 700+.
- Headline hero: 32px desktop / 24px mobile.
- Sub-headlines: 18px desktop / 16px mobile.
- Body: 14px desktop / 13px mobile.
- Labels y metadatos: 10-11px con letter-spacing aumentado.

### 5.4 Alto del banner

- Desktop: mínimo 500px, máximo 700px (scroll interno si excede).
- Mobile: mínimo 540px, máximo 800px (scroll interno si excede).
- Importante: el alto del banner debe matchear aproximadamente el alto del banner del estadio actual para no romper el layout de la home cuando se activa/desactiva.

---

## 6. Componente clave: MatchCard

El bloque central de banderas + marcadores + acción se renderiza con un único componente reutilizable que recibe props:

```typescript
interface MatchCardProps {
  match: Match;                    // datos del partido
  prediction?: Prediction;          // predicción del usuario si existe
  variant: 'editable' | 'locked' | 'live' | 'resolved';
  showColombiaBadge: boolean;      // muestra "Partido de Colombia · puntos ×2"
  onSubmit?: (predA: number, predB: number) => void;
}
```

Esto evita duplicar layout entre los estados `prediction_open`, `prediction_locked`, `match_live` y `match_resolved` — todos comparten la misma estructura visual con distintos modos.

---

## 7. Realtime y leaderboard

- Cada cliente se suscribe al canal Supabase Realtime `leaderboard:updates` al cargar el banner (si está autenticado).
- Cuando `resolve_match` corre, hace un broadcast en ese canal.
- El cliente recibe el broadcast → hace un fetch de las nuevas filas del leaderboard (top 3 + fila del usuario) → actualiza la UI con una animación suave.
- No usar polling. Si el cliente pierde conexión, el SDK de Supabase reconecta automáticamente.

---

## 8. Operación

### 8.1 Quién mete los resultados
- Andrés y Carolina, ambos con acceso al admin panel.
- Política: el resultado se ingresa apenas suena el pitido final del partido.
- Si hay error en el resultado ingresado, se puede corregir desde el admin; el sistema recalcula puntos automáticamente.

### 8.2 Toggle de emergencia
- Metafield `mirror.banner_active` en Shopify (boolean).
- Si está en `false`, el Liquid no monta el web component y se muestra el banner original del estadio.
- Permite apagar el juego instantáneamente desde el admin de Shopify sin redeploy.

### 8.3 Comunicaciones automáticas (vía Resend)
- **Email 1 — Magic link:** asunto "Tu acceso a Mirror Mundial". Diseño con branding Mirror.
- **Email 2 — Después de cada partido resuelto:** asunto "Acabas de [ganar X puntos / mantener tu posición]". Contiene puntos ganados y posición actual. Solo se envía a quienes predijeron ese partido.
- **Email 3 — Ganadores anunciados:** asunto "Mirror Mundial terminó". Se envía 24 horas después de la final con los 3 ganadores y la posición del destinatario.

---

## 9. Términos y condiciones (resumen, redacción legal pendiente)

- Participación gratuita, sin compra obligatoria.
- Premios entregados en producto Mirror, no en efectivo.
- Plazo de reclamación: 15 días desde el anuncio.
- Verificación de identidad requerida para entrega: el ganador debe presentar documento de identidad y dirección de envío en Colombia.
- Tratamiento de datos personales bajo Ley 1581 de 2012 (Habeas Data).
- Mirror se reserva el derecho de descalificar cuentas duplicadas o fraudulentas.
- No es juego de azar: la mecánica es de destreza (predicción), no de fortuna; por tanto no aplica regulación de Coljuegos.

Los T&C completos se publican como página de Shopify antes del primer registro y se aceptan vía checkbox en el formulario de registro.

---

## 10. Testing pre-lanzamiento

Lista de pruebas obligatorias antes de abrir al público:

1. **Cálculo de puntos:** 5 casos (exacto, ganador+dif, solo ganador, empate-no-exacto, errado) × 2 (con y sin multiplicador Colombia).
2. **Cierre de predicciones:** intentar predecir a 16min antes (acepta), a 14min antes (rechaza), a 5min antes (rechaza).
3. **Edición:** enviar predicción, editar 3 veces, verificar que solo queda la última.
4. **Idempotencia de resolve_match:** resolver con 2-1, verificar puntos, re-resolver con 3-1, verificar que puntos se reemplazaron correctamente.
5. **Realtime:** abrir banner en 2 navegadores, resolver un partido en uno, verificar que el otro actualiza sin refresh.
6. **Mobile real:** iPhone Safari, Chrome Android, Samsung Internet.
7. **Magic link:** registro con Gmail, Outlook, iCloud, Yahoo, hotmail.com, verificar que llega.
8. **Display name único:** intentar registrar dos cuentas con el mismo display name → segundo falla con mensaje claro.
9. **Toggle de emergencia:** apagar metafield, refrescar home, verificar que vuelve el banner del estadio.

---

## 11. Plan de sesiones para Claude Code

Cinco sesiones, en orden, cada una termina con algo testeado:

**Sesión 1 — Supabase setup (2-3h estimadas)**
- Crear migraciones SQL: schema, RLS, vista materializada, función `calculate_points`.
- Seed de los 4 partidos garantizados.
- Configurar Auth con magic link + Resend SMTP custom.
- Test manual desde Supabase Studio.

**Sesión 2 — Edge Functions (3-4h)**
- `submit_prediction` con validación de cierre y upsert.
- `resolve_match` con cálculo idempotente y broadcast Realtime.
- Tests con curl o equivalente.

**Sesión 3 — Web Component (4-5h)**
- Setup Vite + Preact + web component config.
- Componente `<MatchCard>` reutilizable con sus 4 variantes.
- Los 7 estados de UI.
- Integración con Supabase JS SDK.
- Realtime subscription al leaderboard.
- Deploy a Vercel.

**Sesión 4 — Admin panel (3-4h)**
- Next.js app con auth de admin.
- CRUD de partidos.
- Form de ingreso de resultados que llama a `resolve_match`.
- Dashboard simple con métricas: total usuarios, total predicciones, partidos resueltos.

**Sesión 5 — Integración Shopify + QA (2h)**
- Crear `sections/mirror-mundial.liquid`.
- Crear metafield de toggle.
- Activar en tema preview de Shopify.
- Recorrer la lista de testing pre-lanzamiento completa.

**Total estimado:** 14-18 horas de Claude Code, distribuidas en 5 sesiones de 2-5h cada una.
