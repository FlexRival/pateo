-- ============================================================================
-- MIGRACIÓN: XP POR PASOS + CURVA DE NIVEL PROGRESIVA — Pateo
--
-- Reabre una decisión que estaba documentada como cerrada (`SCHEMA.md` §7,
-- `CLAUDE.md`): "el XP solo se gana ganando un duelo". A partir de aquí los
-- pasos diarios TAMBIÉN dan XP, ADEMÁS de los duelos — no se toca
-- `resolve_duel`, que sigue exactamente igual.
--
-- DOS CAMBIOS, EN LA MISMA MIGRACIÓN PORQUE SON LA MISMA PIEZA DE PRODUCTO:
--
--   1. `level_for_xp` deja de ser una curva PLANA (`1 + xp/1000`, mismo coste
--      todos los niveles) y pasa a ser PROGRESIVA: el coste de cada nivel
--      crece LINEALMENTE con el nivel, así que el XP acumulado necesario
--      crece en CUADRÁTICA — más caro cada vez, sin ser exponencial. Un
--      jugador de nivel 300 no sube de nivel cada día aunque cumpla su meta
--      de pasos a diario.
--
--   2. `sync_daily_steps` —el único sitio por el que el cliente escribe
--      `step_logs` (`20260906130000_step_sync_anticheat.sql`)— otorga XP en
--      vivo: `floor(pasos_del_día / 10)`, mismo ratio que el XP de duelos.
--
-- POR QUÉ EN VIVO SIN DUPLICAR XP: la columna nueva `step_logs.xp_granted`
-- recuerda cuánto XP ya se le dio a ESE día. Cada sync recalcula el total que
-- LE CORRESPONDE a los pasos guardados ahora mismo y solo suma la diferencia
-- con lo ya otorgado — nunca la resta. Sincronizar el mismo día tres veces en
-- una tarde (la app en primer plano, mientras se anda) no triplica el XP;
-- volver a sincronizar un día viejo con menos pasos que los ya guardados
-- tampoco lo quita (`steps_count` ya es monótono por el `GREATEST` del
-- anti-cheat, así que el XP que deriva de él también lo es).
--
-- POR QUÉ AQUÍ Y NO EN UNA RPC NUEVA: es el mismo argumento anti-cheat que ya
-- documenta la migración de pasos — un solo choque de escritura es un solo
-- sitio que auditar. Otorgar XP en una función aparte que el cliente pudiera
-- llamar directo reabriría el mismo agujero que cerró esa migración.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Curva de nivel progresiva
--
-- PLACEHOLDERS tuneables (mismo espíritu que el `/10` de resolve_duel y el
-- `daily_step_cap()` de pasos): `LEVEL_BASE_XP` = coste del nivel 1 -> 2 (se
-- deja igual que la curva plana anterior, para no romper la sensación de las
-- primeras horas); `LEVEL_XP_STEP` = cuánto sube ese coste en cada nivel
-- siguiente. Con estos dos números, el nivel 300 cuesta 15.950 XP solo para
-- ESE salto (`xp_for_level(301) - xp_for_level(300)`) — con el ritmo típico
-- de un día cumpliendo la meta de pasos (~600 XP/día a este ratio), son
-- semanas, no un día.
--
-- Espejo exacto en `src/lib/xp.ts` (`LEVEL_BASE_XP`, `LEVEL_XP_STEP`,
-- `xpForLevel`), comprobado por `scripts/check-xp-formula.mjs`
-- (`pnpm check:xp`). Si cambian estos dos literales, cambian también allí.
--
-- cost(n)        = LEVEL_BASE_XP + LEVEL_XP_STEP * (n - 1)   -- nivel n -> n+1
-- xp_for_level(L) = suma de cost(n) para n de 1 a L-1
--                 = LEVEL_BASE_XP*(L-1) + LEVEL_XP_STEP*(L-1)*(L-2)/2
--
-- `(L-1)*(L-2)` es siempre par (dos enteros consecutivos), así que la
-- división entera por 2 no pierde nada. Se calcula en BIGINT y se recorta a
-- INT al final: un nivel que necesitara más XP del que cabe en `profiles.xp`
-- (también INT) ya sería un valor fuera de lo que el esquema puede guardar.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.xp_for_level(p_level INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_level <= 1 THEN 0
    ELSE (
      1000::BIGINT * (p_level - 1)                                   -- LEVEL_BASE_XP
      + (50::BIGINT * (p_level - 1) * (p_level - 2)) / 2              -- LEVEL_XP_STEP
    )::INT
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.xp_for_level(INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.xp_for_level(INT) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- `level_for_xp`: inversa de `xp_for_level`, por búsqueda binaria en vez de
-- una fórmula cerrada. Con la curva plana anterior bastaba una división; con
-- la cuadrática haría falta invertir con `sqrt()`, y hacerlo bit a bit igual
-- en Postgres y en TypeScript es frágil. La búsqueda binaria solo necesita
-- que `xp_for_level` sea monótona creciente —lo es por construcción— y no
-- duplica NINGÚN literal de la curva: toda ella vive en `xp_for_level`, que es
-- lo único que `check-xp-formula.mjs` necesita comparar contra TypeScript.
-- Misma firma y tipo de retorno que la versión plana anterior, así que no
-- hace falta `DROP FUNCTION`: los `GRANT`/`REVOKE` ya existentes
-- (`20260903140914_duel_rpcs.sql`) se conservan tal cual.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.level_for_xp(p_xp INT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_xp  INT := GREATEST(p_xp, 0);
  v_lo  INT := 1;
  v_hi  INT := 2;
  v_mid INT;
BEGIN
  WHILE public.xp_for_level(v_hi) <= v_xp LOOP
    v_lo := v_hi;
    v_hi := v_hi * 2;
  END LOOP;

  WHILE v_hi - v_lo > 1 LOOP
    v_mid := (v_lo + v_hi) / 2;
    IF public.xp_for_level(v_mid) <= v_xp THEN
      v_lo := v_mid;
    ELSE
      v_hi := v_mid;
    END IF;
  END LOOP;

  RETURN v_lo;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. `step_logs.xp_granted` — cuánto XP ya se le dio a un día concreto.
--
-- `NOT NULL DEFAULT 0`, a diferencia de `source`/`reported_steps`
-- (nullables porque las filas viejas no tienen procedencia que inventar):
-- aquí "no se ha otorgado nada todavía" SÍ es un valor real y conocido para
-- toda fila, vieja o nueva.
-- ----------------------------------------------------------------------------
ALTER TABLE public.step_logs
  ADD COLUMN IF NOT EXISTS xp_granted INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'step_logs_xp_granted_positive'
  ) THEN
    ALTER TABLE public.step_logs
      ADD CONSTRAINT step_logs_xp_granted_positive
      CHECK (xp_granted >= 0);
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. `sync_daily_steps`: además de guardar el marcador (igual que antes),
-- ahora también otorga el XP que le corresponda a la diferencia.
--
-- Mismo nombre, firma y tipo de retorno que la versión anterior — no hace
-- falta tocar sus grants (`20260906130000_step_sync_anticheat.sql`) ni los
-- de `sync_daily_steps_batch`, que la envuelve sin cambios.
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
AS $$
DECLARE
  v_user     UUID := (SELECT auth.uid());
  v_capped   INT;
  v_earliest DATE;
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
  -- América, cada madrugada de UTC). El margen es de un día POR LOS DOS LADOS:
  -- sin el de atrás, quien sincroniza desde Los Ángeles manda un día que el
  -- servidor considera demasiado viejo y lo pierde.
  v_earliest := CURRENT_DATE - (public.step_sync_backfill_days() + 1);
  IF p_date > CURRENT_DATE + 1 OR p_date < v_earliest THEN
    RAISE EXCEPTION
      'Fecha fuera de la ventana sincronizable (% .. %)', v_earliest, CURRENT_DATE + 1
      USING ERRCODE = 'STP01';
  END IF;

  v_capped := LEAST(p_steps, public.daily_step_cap());

  -- El alias `sl` es la fila que YA está guardada; `EXCLUDED`, la que se
  -- intentaba insertar. Sin alias habría que escribir `public.step_logs.col`,
  -- que es válido pero se lee fatal justo donde importa entender cuál es cuál.
  INSERT INTO public.step_logs AS sl (user_id, date, steps_count, source, reported_steps, synced_at)
  VALUES (v_user, p_date, v_capped, p_source, p_steps, NOW())
  ON CONFLICT (user_id, date) DO UPDATE
    SET steps_count    = GREATEST(sl.steps_count, EXCLUDED.steps_count),
        -- El origen tiene que describir la lectura que GANA, no la última que
        -- llegó: si el podómetro reporta menos que lo ya guardado por Health
        -- Connect, la fila seguiría diciendo `pedometer` sobre unos pasos que
        -- midió Health Connect, y la columna de auditoría mentiría.
        source         = CASE
                           WHEN EXCLUDED.steps_count >= sl.steps_count THEN EXCLUDED.source
                           ELSE sl.source
                         END,
        reported_steps = GREATEST(COALESCE(sl.reported_steps, 0), EXCLUDED.reported_steps),
        -- Siempre la última: es "cuándo se sincronizó por última vez", no
        -- "cuándo se guardó el valor que hay". Una sincronización que no cambia
        -- nada sigue siendo una sincronización.
        synced_at      = EXCLUDED.synced_at
  RETURNING * INTO v_row;

  -- XP POR PASOS: floor(steps_count_del_día / 10), mismo ratio que
  -- resolve_duel. `xp_granted` es cuánto de ese XP YA se otorgó para este
  -- día, así que solo se suma la diferencia — repetir un sync, o vivir el
  -- día en varias sesiones, no vuelve a contar lo ya contado. No puede salir
  -- negativa: `steps_count` es monótono (el `GREATEST` de arriba), y
  -- `v_xp_total` con él.
  v_xp_total := v_row.steps_count / 10;
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
$$;
