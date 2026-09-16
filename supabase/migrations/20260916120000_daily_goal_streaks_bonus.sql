-- ============================================================================
-- MIGRACIÓN: RETO DIARIO POR USUARIO, RACHAS QUE SE ACTUALIZAN SOLAS Y
--            BONUS DE XP POR CUMPLIR EL RETO — Pateo
--
-- Tres cambios que son la misma pieza de producto: el «reto diario de pasos»
-- deja de ser un número global escrito en el servidor y pasa a elegirlo cada
-- usuario; la racha se mide contra ESE número; y cumplirlo da un pequeño
-- bonus de XP encima del XP por pasos que ya daba `sync_daily_steps`.
--
-- ══════════════════════════════════════════════════════════════════════════
-- 1. POR QUÉ LA META VA EN `profiles` Y NO SIGUE EN `daily_step_goal()`
-- ══════════════════════════════════════════════════════════════════════════
--
-- `daily_step_goal()` (20260903141500_streaks.sql) devuelve 6000 para todo el
-- mundo. Se queda, pero cambia de papel: pasa a ser el **valor por defecto**
-- de la columna nueva y el respaldo de las filas de `step_logs` anteriores a
-- esta migración. Quien decide la racha a partir de aquí es
-- `profiles.daily_step_goal`.
--
-- La columna NO se le concede al cliente (`GRANT UPDATE`) como se hizo con
-- `username`/`avatar_url`. Dos motivos: cambiar la meta obliga a recalcular
-- la racha en la misma operación, y los límites tienen que comprobarse en un
-- solo sitio. Por eso se escribe por `set_daily_step_goal()`.
--
-- ══════════════════════════════════════════════════════════════════════════
-- 2. POR QUÉ `step_logs` GUARDA LA META DEL DÍA (`goal_steps`)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Sin esto, la racha se recalcularía SIEMPRE contra la meta de HOY, y bajar
-- la meta reescribiría el pasado: alguien con 30 días de 3.000 pasos y meta
-- 6.000 (racha 0) se pondría meta 2.000 y despertaría con una racha de 30
-- días — que además desbloquea marcos de foto (§18). Es una escalada real,
-- no un detalle estético.
--
-- `goal_steps` es la meta que estaba en vigor cuando ese día se registró. Se
-- sella al INSERTAR la fila y **no se reescribe** en los `ON CONFLICT`: un
-- sync de los últimos 7 días no puede volver a sellar días ya cerrados. La
-- única forma de cambiarla es `set_daily_step_goal()`, y solo para HOY —
-- cambiar tu reto a mitad del día se aplica a ese día, no a la semana.
--
-- ══════════════════════════════════════════════════════════════════════════
-- 3. LA CURVA DEL BONUS: POR QUÉ SATURA
-- ══════════════════════════════════════════════════════════════════════════
--
-- El XP por pasos ya es `floor(pasos/10)`, o sea PROPORCIONAL a lo andado: a
-- una meta baja le corresponde de por sí poco XP, porque se anda poco. El
-- bonus solo tiene que cumplir dos condiciones para no romper nada:
--
--   a) CRECER con la meta — que ponerse un reto mayor nunca dé menos XP
--      total que ponerse uno menor. Si no, lo óptimo sería lowballear.
--   b) SATURAR — que una meta enorme no dispare el XP. Es «un pequeño
--      bonus», no una segunda fuente de progresión.
--
-- Una hipérbola cumple las dos con un solo literal cada una:
--
--      bonus(meta) = floor(GOAL_BONUS_MAX_XP * meta / (meta + GOAL_BONUS_HALF_STEPS))
--
-- `GOAL_BONUS_HALF_STEPS` es la meta a la que se cobra la MITAD del máximo.
-- Con 300 / 10.000 sale esta tabla (y al lado, el XP base que ya daban esos
-- mismos pasos, para ver que el bonus es la guinda y no el pastel):
--
--      meta     bonus    XP base por andarla    bonus / base
--      2.000       50                    200            25 %
--      6.000      112                    600            19 %
--     10.000      150                  1.000            15 %
--     20.000      200                  2.000            10 %
--     30.000      225                  3.000             7,5 %
--
-- Placeholders tuneables, igual que `LEVEL_BASE_XP` o el `/10` de
-- `resolve_duel`. Espejo exacto en `src/lib/xp.ts`, comprobado por
-- `scripts/check-xp-formula.mjs` (`pnpm check:xp`).
--
-- ══════════════════════════════════════════════════════════════════════════
-- 4. POR QUÉ HACE FALTA UN CRON DE RACHAS
-- ══════════════════════════════════════════════════════════════════════════
--
-- Hasta hoy `profiles.streak_days` solo se recalculaba desde el trigger de
-- `step_logs`: es decir, **solo cuando el usuario sincronizaba pasos**. Quien
-- dejaba de abrir la app se quedaba con su última racha congelada en el
-- perfil para siempre — la veían sus amigos, y servía para desbloquear
-- marcos. La racha solo bajaba si volvías, que es justo al revés de lo que
-- significa una racha.
--
-- `recompute_all_streaks()` + `pg_cron` la recalculan para todo el mundo una
-- vez al día. A las 03:00 UTC a propósito: el público de la v1 es España
-- (UTC+1/+2), así que a esa hora el día local ya ha cambiado con seguridad y
-- `CURRENT_DATE` (que es UTC) coincide con la fecha local del usuario, que es
-- la que usa `step_logs.date`. El día de gracia que ya tenía
-- `recompute_streak` absorbe el desfase restante.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. LÍMITES DE LA META
--
-- Funciones y no literales sueltos por el mismo motivo que `daily_step_cap()`:
-- el cliente los lee para construir el selector, y así no hay dos verdades.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.min_daily_step_goal()
RETURNS INT LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$ SELECT 2000; $fn$;

CREATE OR REPLACE FUNCTION public.max_daily_step_goal()
RETURNS INT LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$ SELECT 30000; $fn$;

GRANT EXECUTE ON FUNCTION public.min_daily_step_goal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.max_daily_step_goal() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. COLUMNAS NUEVAS
-- ----------------------------------------------------------------------------

-- La meta del usuario. `NOT NULL DEFAULT 6000` para que las filas que ya
-- existen queden exactamente con la meta que tenían en vigor (la global).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_step_goal INT NOT NULL DEFAULT 6000;

-- Los dos literales del CHECK duplican `min_daily_step_goal()` /
-- `max_daily_step_goal()` a propósito. Un CHECK que llamara a una función
-- quedaría atado a que esa función no cambie nunca —Postgres no revalida la
-- tabla cuando cambia el cuerpo de la función, así que el constraint pasaría a
-- mentir en silencio—, y eso es peor que la duplicación. Este CHECK es el
-- último muro; quien valida de verdad y da el mensaje legible es
-- `set_daily_step_goal()`. Si se tunean los límites, hay que tocar los dos
-- sitios y revalidar la tabla.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_daily_step_goal_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_daily_step_goal_range
      CHECK (daily_step_goal BETWEEN 2000 AND 30000);
  END IF;
END;
$do$;

-- Cuándo terminó el usuario el alta guiada (nombre, foto y reto). `NULL` = no
-- la ha hecho todavía, y el layout raíz de la app le enseña esa pantalla en
-- vez de las pestañas. Es una marca de tiempo y no un booleano por el mismo
-- criterio que el resto del esquema: un `TIMESTAMPTZ` responde «¿lo hizo?» y
-- además «¿cuándo?», que es lo que hará falta para medir el embudo de alta.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Las cuentas que ya existen no pueden despertar en una pantalla de alta que
-- nunca pidieron: se marcan como hechas con su propia fecha de creación.
UPDATE public.profiles SET onboarded_at = created_at WHERE onboarded_at IS NULL;

-- La meta en vigor el día que se registró esa fila de pasos. Ver bloque 2 de
-- la cabecera: es lo que impide reescribir rachas pasadas bajando la meta.
ALTER TABLE public.step_logs
  ADD COLUMN IF NOT EXISTS goal_steps INT;

-- Las filas anteriores a esta migración se midieron contra la meta global.
UPDATE public.step_logs
SET goal_steps = public.daily_step_goal()
WHERE goal_steps IS NULL;

-- ----------------------------------------------------------------------------
-- 3. BONUS DE XP POR CUMPLIR EL RETO
--
-- Los dos literales van marcados con el comentario que busca
-- `scripts/check-xp-formula.mjs`. Si cambian aquí, cambian en `src/lib/xp.ts`.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_goal_bonus_xp(p_goal INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT CASE
    WHEN p_goal IS NULL OR p_goal <= 0 THEN 0
    ELSE (
      (300::BIGINT * p_goal)                  -- GOAL_BONUS_MAX_XP
      / (p_goal + 10000::BIGINT)              -- GOAL_BONUS_HALF_STEPS
    )::INT
  END;
$fn$;

GRANT EXECUTE ON FUNCTION public.daily_goal_bonus_xp(INT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. `recompute_streak`: ahora mide cada día contra la meta DE ESE DÍA.
--
-- Mismo nombre, firma y tipo de retorno que la versión de
-- `20260903141500_streaks.sql`, así que `CREATE OR REPLACE` conserva sus
-- grants (solo `service_role`) y el trigger que ya la llama.
--
-- El cambio es de una línea conceptual: donde antes comparaba contra
-- `daily_step_goal()` —una constante global— ahora compara contra
-- `sl.goal_steps`, la meta sellada en la propia fila. `COALESCE` cubre
-- cualquier fila que se colara sin sellar.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_streak(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_streak INT  := 0;
  v_cursor DATE := CURRENT_DATE;
  v_met    BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.step_logs sl
    WHERE sl.user_id = p_user_id
      AND sl.date = CURRENT_DATE
      AND sl.steps_count >= COALESCE(sl.goal_steps, public.daily_step_goal())
  ) INTO v_met;

  -- Día de gracia: un día EN CURSO que todavía no llega a la meta no rompe la
  -- racha que se traía de ayer. Sin esto, la racha valdría 0 cada mañana.
  IF NOT v_met THEN
    v_cursor := CURRENT_DATE - 1;
  END IF;

  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.step_logs sl
      WHERE sl.user_id = p_user_id
        AND sl.date = v_cursor
        AND sl.steps_count >= COALESCE(sl.goal_steps, public.daily_step_goal())
    ) INTO v_met;

    EXIT WHEN NOT v_met;

    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  END LOOP;

  UPDATE public.profiles
  SET streak_days = v_streak
  WHERE id = p_user_id
    AND streak_days IS DISTINCT FROM v_streak;

  RETURN v_streak;
END;
$fn$;

-- ----------------------------------------------------------------------------
-- 5. `recompute_all_streaks`: la pasada diaria.
--
-- Recorre solo a quien tiene algo que perder (`streak_days > 0`) o algo que
-- ganar (pasos registrados en los dos últimos días): recalcular la racha de
-- una cuenta que lleva meses a cero y sin pasos no puede cambiar nada, y este
-- job crecerá con el padrón entero.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_all_streaks()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_user UUID;
  v_n    INT := 0;
BEGIN
  FOR v_user IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.streak_days > 0
       OR EXISTS (
            SELECT 1 FROM public.step_logs sl
            WHERE sl.user_id = p.id AND sl.date >= CURRENT_DATE - 1
          )
  LOOP
    PERFORM public.recompute_streak(v_user);
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$fn$;

-- Solo la llama el cron (que corre como `postgres`). Ni el cliente ni `anon`
-- tienen nada que hacer aquí: recorre el padrón entero.
REVOKE EXECUTE ON FUNCTION public.recompute_all_streaks() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.recompute_all_streaks() TO service_role;

-- ----------------------------------------------------------------------------
-- 6. `sync_daily_steps`: sella la meta del día y suma el bonus al cumplirla.
--
-- Mismo nombre, firma y retorno que en
-- `20260915120000_steps_xp_progressive_level.sql`, así que conserva sus
-- grants y `sync_daily_steps_batch` la sigue envolviendo sin cambios.
--
-- Lo único que cambia respecto a esa versión:
--   * el INSERT sella `goal_steps` con la meta actual del usuario, y el
--     `ON CONFLICT` NO la toca (ver bloque 2 de la cabecera);
--   * `v_xp_total` pasa a ser «XP por pasos + bonus si ese día cumplió su
--     meta», en vez de solo lo primero.
--
-- La idempotencia es la misma y por el mismo motivo: `xp_granted` recuerda lo
-- ya otorgado y solo se suma la diferencia cuando es positiva. Que el bonus
-- entre en esa misma cuenta es lo que hace que cruzar la meta a media tarde
-- lo pague al instante, y que volver a sincronizar ese día no lo repita.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_daily_steps(
  p_date   DATE,
  p_steps  INT,
  p_source TEXT
)
RETURNS public.step_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_user     UUID := (SELECT auth.uid());
  v_capped   INT;
  v_earliest DATE;
  v_goal     INT;
  v_row      public.step_logs;
  v_xp_total INT;
  v_xp_delta INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;

  IF p_date IS NULL OR p_steps IS NULL THEN
    RAISE EXCEPTION 'Fecha y pasos son obligatorios';
  END IF;

  IF p_steps < 0 THEN
    RAISE EXCEPTION 'Los pasos no pueden ser negativos';
  END IF;

  IF p_source IS NULL OR p_source NOT IN ('healthkit', 'health-connect', 'pedometer') THEN
    RAISE EXCEPTION 'Origen de datos no reconocido: %', p_source
      USING ERRCODE = 'STP02';
  END IF;

  -- El cliente manda su fecha LOCAL y `CURRENT_DATE` es UTC, así que el día del
  -- usuario puede ir uno por delante (UTC+14 existe) o uno por detrás (toda
  -- América, cada madrugada de UTC). El margen es de un día POR LOS DOS LADOS.
  v_earliest := CURRENT_DATE - (public.step_sync_backfill_days() + 1);
  IF p_date > CURRENT_DATE + 1 OR p_date < v_earliest THEN
    RAISE EXCEPTION
      'Fecha fuera de la ventana sincronizable (% .. %)', v_earliest, CURRENT_DATE + 1
      USING ERRCODE = 'STP01';
  END IF;

  v_capped := LEAST(p_steps, public.daily_step_cap());

  SELECT COALESCE(p.daily_step_goal, public.daily_step_goal())
  INTO v_goal
  FROM public.profiles p
  WHERE p.id = v_user;

  INSERT INTO public.step_logs AS sl
    (user_id, date, steps_count, source, reported_steps, synced_at, goal_steps)
  VALUES (v_user, p_date, v_capped, p_source, p_steps, NOW(), v_goal)
  ON CONFLICT (user_id, date) DO UPDATE
    SET steps_count    = GREATEST(sl.steps_count, EXCLUDED.steps_count),
        source         = CASE
                           WHEN EXCLUDED.steps_count >= sl.steps_count THEN EXCLUDED.source
                           ELSE sl.source
                         END,
        reported_steps = GREATEST(COALESCE(sl.reported_steps, 0), EXCLUDED.reported_steps),
        synced_at      = EXCLUDED.synced_at
        -- `goal_steps` NO se toca a propósito: la meta de un día ya registrado
        -- es la que estaba en vigor entonces, no la de ahora.
  RETURNING * INTO v_row;

  -- XP del día = XP por pasos + bonus por haber cumplido SU reto ese día.
  v_xp_total := v_row.steps_count / 10;

  IF v_row.steps_count >= COALESCE(v_row.goal_steps, public.daily_step_goal()) THEN
    v_xp_total := v_xp_total
      + public.daily_goal_bonus_xp(COALESCE(v_row.goal_steps, public.daily_step_goal()));
  END IF;

  v_xp_delta := v_xp_total - v_row.xp_granted;

  IF v_xp_delta > 0 THEN
    UPDATE public.profiles
    SET xp    = xp + v_xp_delta,
        level = public.level_for_xp(xp + v_xp_delta)
    WHERE id = v_user;

    UPDATE public.step_logs
    SET xp_granted = v_xp_total
    WHERE user_id = v_user AND date = p_date;

    v_row.xp_granted := v_xp_total;
  END IF;

  RETURN v_row;
END;
$fn$;

-- ----------------------------------------------------------------------------
-- 7. RPCs DEL CLIENTE
-- ----------------------------------------------------------------------------

-- Leer MI meta. No vale `daily_step_goal()` (esa es la global): se expone como
-- RPC para que el cliente tenga un único sitio del que sacar la cifra que
-- decide su racha, igual que antes.
CREATE OR REPLACE FUNCTION public.my_daily_step_goal()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT COALESCE(
    (SELECT p.daily_step_goal FROM public.profiles p WHERE p.id = (SELECT auth.uid())),
    public.daily_step_goal()
  );
$fn$;

REVOKE EXECUTE ON FUNCTION public.my_daily_step_goal() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_daily_step_goal() TO authenticated;

-- Cambiar MI meta. Hace las tres cosas que no pueden separarse:
--   1. valida contra los límites (y devuelve un error legible, no un fallo de
--      CHECK que el cliente no sabría explicar);
--   2. resella la meta de HOY —cambiar tu reto se aplica al día en curso, no
--      a la semana pasada;
--   3. recalcula la racha, que acaba de cambiar de criterio.
CREATE OR REPLACE FUNCTION public.set_daily_step_goal(p_goal INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_user UUID := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;

  IF p_goal IS NULL
     OR p_goal < public.min_daily_step_goal()
     OR p_goal > public.max_daily_step_goal() THEN
    RAISE EXCEPTION 'La meta diaria debe estar entre % y % pasos',
      public.min_daily_step_goal(), public.max_daily_step_goal()
      USING ERRCODE = 'STP03';
  END IF;

  UPDATE public.profiles SET daily_step_goal = p_goal WHERE id = v_user;

  UPDATE public.step_logs
  SET goal_steps = p_goal
  WHERE user_id = v_user AND date = CURRENT_DATE;

  PERFORM public.recompute_streak(v_user);

  RETURN p_goal;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.set_daily_step_goal(INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_daily_step_goal(INT) TO authenticated;

-- Cerrar el alta guiada. Solo avanza de NULL a NOW(): volver a llamarla no
-- reescribe la fecha, y no hay forma de marcarse como «sin dar de alta» otra
-- vez para que la pantalla vuelva a salir.
CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_user UUID := (SELECT auth.uid());
  v_at   TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Autenticación requerida';
  END IF;

  UPDATE public.profiles
  SET onboarded_at = COALESCE(onboarded_at, NOW())
  WHERE id = v_user
  RETURNING onboarded_at INTO v_at;

  RETURN v_at;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. CRON DIARIO DE RACHAS
--
-- Igual que el de suscripciones: función SQL, sin `pg_net` ni secretos en
-- Vault. LIMITACIÓN CONOCIDA: `pg_cron` no existe en el Postgres efímero
-- (PGlite) con el que se validan las demás migraciones; esto solo se puede
-- validar contra un proyecto Supabase real.
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA cron TO postgres;

SELECT cron.schedule(
  'recompute-all-streaks',
  '0 3 * * *', -- 03:00 UTC = 04:00/05:00 en España: el día local ya cambió
  $job$ SELECT public.recompute_all_streaks(); $job$
);
