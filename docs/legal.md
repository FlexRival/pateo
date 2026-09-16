# Lo legal: borrado de cuenta, textos y trámites de tienda

Cubre KAN-53 (borrado de cuenta), KAN-56 (textos públicos), KAN-54 (los tres
formularios) y KAN-84 (cerrar lo que de todo esto bloqueaba publicar). Está en
un solo sitio porque las cuatro cosas se contestan con la misma información y
contradecirse entre ellas es motivo de rechazo.

> ✅ **KAN-74 cerrado el 15-sep-2026.** `LEGAL_CONTACT.site` tiene ya el
> dominio real, `https://pateo.es`, propagado también a `SITE_ORIGIN` en
> `build-legal.mjs` y a `index.html`/`robots.txt`/`sitemap.xml`; las tres
> páginas generadas se han vuelto a construir con `pnpm build:legal`. Lo
> único que queda antes de enviar la app a revisión es **desplegar la
> carpeta `landing/` en un hosting real** que sirva ese dominio — el repo ya
> no tiene ningún placeholder pendiente.

**Regla que lo ordena todo:** lo que dice el código, lo que dice la política de
privacidad y lo que se marca en los formularios tiene que ser **la misma
respuesta**. Un revisor que encuentre que la app lee un dato que el formulario
no declara rechaza; uno que vea una política que promete algo que el código no
hace, también.

---

## 1. Qué se hizo (código, ya en el repo)

### Borrado de cuenta — KAN-53

| Pieza | Dónde |
| --- | --- |
| Traspaso de liderazgo antes del borrado | `supabase/migrations/20260907130000_account_deletion.sql` → `prepare_account_deletion()` |
| Borrado real (Auth + Storage) | `supabase/functions/delete-account/` |
| Contrato | `ProfileRepository.deleteAccount()` |
| Implementación | `src/repositories/supabase/profile-repository.ts` |
| Interfaz | `src/app/settings.tsx` → Ajustes → Cuenta → Borrar cuenta |

Lo que hay que entender del diseño: **casi todo lo borra el `ON DELETE
CASCADE`**. `profiles.id` referencia `auth.users(id)` con cascade, y el resto de
tablas cuelgan de `profiles`, así que borrar el usuario de Auth se lleva pasos,
duelos, amistades, membresías y suscripción sin un solo `DELETE` escrito a mano.

Solo hay dos cosas que el cascade haría mal, y son las dos que el código trata
aparte:

1. **El liderazgo de clan.** `clans.leader_id` también es cascade: borrar al
   líder borraría **el clan entero y a todos sus miembros**. Por eso el mando se
   traspasa antes (oficial más antiguo; si no hay oficiales, miembro más
   antiguo). A diferencia de `leave_clan()`, aquí no se puede lanzar una
   excepción: el borrado es un derecho, no una negociación.
2. **La foto de perfil.** Los objetos de Storage no cuelgan de ninguna foreign
   key, así que el cascade no los toca. Se borran a mano, y **antes** que el
   usuario: si se hiciera después y fallara, quedarían huérfanos para siempre.

Decisiones que conviene no revertir sin pensarlo:

- **Los duelos activos no se resuelven a favor del superviviente.** Regalar la
  victoria convertiría «creo cuenta, reto a mi amigo, la borro» en una fábrica
  de XP gratis. Desaparecen y nadie gana nada.
- **Los eventos de facturación sobreviven sin dueño** (`subscription_events`
  es `ON DELETE SET NULL`). Es la retención por obligación fiscal, y está
  declarada en el apartado 7 de la política.
- **Borrar la cuenta no cancela la suscripción.** No podemos: la gestiona la
  tienda. Se avisa en el texto de confirmación y en los términos.

### Textos legales — parte de KAN-56

Fuente única en `src/lib/legal/`, en español e inglés:

- `privacy-policy.ts`, `terms.ts` — el contenido, como datos estructurados.
- `types.ts` — el tipo y `LEGAL_CONTACT`. Ver el estado real de cada campo en
  el comentario del propio archivo; en resumen: `email` y `hostingRegion`
  estaban resueltos desde antes, `entity` se resolvió en KAN-84 (con un riesgo
  aceptado explícitamente, ver más abajo) y **solo `site` sigue pendiente**,
  por falta de dominio, no de decisión.
- Se pintan en `/privacy` y `/terms` con `LegalDocumentView`.

Son datos y no JSX a propósito: la landing pública puede generarse del mismo
objeto sin reescribir el texto, y así las dos versiones no pueden divergir.

Están enganchados en cuatro sitios, y los cuatro son exigencias de tienda:

- Ajustes → Cuenta → Política de privacidad / Términos de uso.
- Pie del paywall (Apple no aprueba una suscripción sin estos dos enlaces).
- **Android, desde fuera de la app:** el diálogo de permisos de Health Connect
  tiene un enlace de privacidad que abre Pateo con el intent
  `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`. El plugin de
  `react-native-health-connect` escribe ese intent-filter en el manifiesto
  (y su alias `ViewPermissionUsageActivity` para Android 14+), apuntando a la
  MainActivity. **Resuelto en KAN-84:** `plugins/with-health-connect-privacy-link.js`
  parchea `MainActivity.kt` (en `onCreate` y en `onNewIntent`, porque la
  Activity es `singleTask` y con la app ya abierta el intent llega por ahí) para
  ponerle al intent la URI `proof://privacy` cuando no trae ninguna — a partir
  de ahí, el deep-linking de Expo Router ya sabe resolverla sin código nuevo en
  JS. Solo sabe parchear Kotlin (lo único que genera este proyecto hoy); si
  algún día `MainActivity` se generase en Java, el plugin falla alto en vez de
  no hacer nada.
- `/delete-account`: cómo borrar la cuenta **sin tener la app instalada**.
  Nueva en KAN-84 (`src/app/delete-account.tsx`). No dispara ningún borrado —
  `deleteAccount()` exige sesión de Supabase, así que una pantalla pública no
  puede llamarla — solo explica el camino de dentro de la app y ofrece
  escribir a `LEGAL_CONTACT.email` con un botón que abre el cliente de correo.

Por eso `/privacy`, `/terms` y `/delete-account` viven **fuera de los dos
`Stack.Protected`**: hay que poder leerlas sin cuenta.

---

## 2. Lo que falta y solo puedes hacer tú

### 2.1 `LEGAL_CONTACT` — estado a 13-sep-2026 (KAN-84)

En `src/lib/legal/types.ts`. De los cuatro campos:

| Campo | Estado | Nota |
| --- | --- | --- |
| `email` | Resuelto | Ya lo estaba antes de KAN-84 |
| `hostingRegion` | Resuelto | Ya lo estaba antes de KAN-84 (UE, Fráncfort) |
| `entity` | Resuelto, **con riesgo aceptado** | Se puso `"Pateo"` — el nombre del producto, no una persona física ni una sociedad constituida. El equipo (proyecto de hackatón de cuatro personas sin entidad legal propia) aceptó conscientemente que esto no identifica a un responsable en el sentido del RGPD art. 13, y que un revisor podría señalarlo. Si en algún momento se constituye una sociedad o se nombra una persona física responsable, hay que volver a este campo. |
| `site` | Resuelto (15-sep-2026) | `https://pateo.es`, dominio comprado. Ya propagado a `build-legal.mjs`, `index.html`, `robots.txt` y `sitemap.xml`. Lo que sigue faltando no es este campo, sino desplegar `landing/` en un hosting que responda a ese dominio. |

### 2.2 Landing pública — resto de KAN-56, sigue bloqueando

Ambas tiendas piden una **URL pública, no un PDF, no geobloqueada**. Google Play
exige además una **ruta web de borrado de cuenta** accesible sin instalar la app.

**El HTML ya no falta.** Las tres páginas existen como ficheros estáticos en
`landing/` — `privacy.html`, `terms.html` y `delete-account.html` — generadas
por `landing/scripts/build-legal.mjs` (`pnpm build:legal`) a partir de las
mismas fuentes que pinta la app: `src/lib/legal/` para las dos primeras y las
cadenas `deleteAccount.*` del i18n para la tercera. Se generan y no se
escriben a mano justamente por la regla del principio de este documento: así
la versión web y la de dentro de la app no pueden decir cosas distintas.

El dominio, `https://pateo.es`, ya está comprado y puesto en los cuatro
sitios (`LEGAL_CONTACT.site`, `SITE_ORIGIN` de `build-legal.mjs`,
`index.html`, `robots.txt`, `sitemap.xml`), y las tres páginas se han
regenerado con `pnpm build:legal`. Lo que **sigue bloqueando** es lo que no
es código: **subir la carpeta `landing/` a un hosting real** que sirva ese
dominio. Hasta entonces esas tres páginas existen en el repo pero no tienen
URL pública, que es lo que piden las tiendas. Ojo: la landing es HTML plano y
se sirve subiendo la carpeta tal cual — no hace falta `npx expo export -p
web`, que es otra cosa (el build web de la app).

### 2.3 Los tres formularios — KAN-54

**Ojo al orden:** la *Health apps declaration* es obligatoria **también para
pruebas cerradas**, no solo para producción. Es decir, **bloquea el closed test
de 12 testers de KAN-46**, que es el camino crítico hacia el 30 de septiembre.

#### a) Play Console → Contenido de la app → Health apps declaration

| Pregunta | Respuesta |
| --- | --- |
| ¿Ofrece funciones de salud? | Sí |
| Categoría | Fitness / bienestar. **No** es producto sanitario |
| Caso de uso | «Juego con mecánicas basadas en fitness» — está en la lista de casos aprobados, y es literalmente lo que es Pateo |
| Tipos de dato de Health Connect | **Solo `READ_STEPS`.** Nada más |
| Justificación | Los pasos diarios del usuario son la puntuación de duelos 1v1 y guerras de clanes, y lo que da XP. Sin ellos el juego no tiene mecánica |

Pedir más tipos de dato de los que se usan es motivo de rechazo. `app.json`
declara únicamente `android.permission.health.READ_STEPS`: no añadas ninguno más
sin actualizar este formulario y la política a la vez.

> Hasta KAN-84, `app.json` declaraba también `android.permission.RECORD_AUDIO`
> sin que ninguna línea de código lo usara — nadie sabe por qué se añadió (llegó
> en el mismo commit que `eas.json`, sin explicación). Es exactamente el tipo de
> permiso sensible sin justificar que la regla del principio de este documento
> prohíbe: ni el código lo usaba, ni la política lo mencionaba, ni este
> formulario lo declaraba. Se retiró. Si algún día se necesita audio de verdad,
> se añade junto con el código que lo use y su fila en Data safety — nunca
> antes.

#### b) Play Console → Data safety

- Se recoge: correo, nombre de usuario, foto (opcional), información de salud y
  forma física (recuento de pasos), estado de compra.
- ¿Se comparte con terceros? No. (Supabase y RevenueCat son **encargados del
  tratamiento**, no destinatarios en el sentido del formulario.)
- ¿Cifrado en tránsito? Sí.
- ¿Se puede pedir el borrado de los datos? **Sí, desde la app y por la web** —
  aquí es donde se pega la URL de `/delete-account`.

#### c) App Store Connect → App Privacy

- Datos recogidos y **vinculados a la identidad**: correo, nombre de usuario,
  foto, salud y forma física, información de compra. Los pasos se declaran en
  **Salud y forma física → Forma física** aunque no vengan de HealthKit: en iOS
  salen del sensor de movimiento (CoreMotion), y eso sigue siendo dato de forma
  física.
- Uso: funcionalidad de la app. **Ni seguimiento, ni publicidad, ni analítica de
  terceros** — marcar «no se usa para seguimiento».
- La norma 5.1.3 de App Review prohíbe usar datos de salud y forma física para
  publicidad o cederlos a terceros con ese fin, y cubre **también «Movimiento y
  forma física»**, no solo HealthKit. Pateo no tiene anuncios, así que hoy no
  hay conflicto; **si algún día entran anuncios, esto se rompe.**
- En el portal de Apple Developer (Identifiers → capacidades del App ID)
  **HealthKit va desmarcado**: la app no lo usa, y declararlo sin usarlo es
  motivo de rechazo. La única capacidad necesaria es In-App Purchase.

#### d) Cadenas de permiso en `app.json`

Aquí hay una diferencia con lo que asumía KAN-54: **iOS no usa HealthKit
todavía**. Los pasos vienen de CoreMotion vía `expo-sensors`, así que la cadena
que hace falta es la de movimiento —ya está puesta, en el plugin `expo-sensors`—
y **`NSHealthShareUsageDescription` no aplica**. El día que se añada HealthKit
(está fuera del alcance de la v1, ver `docs/conteo-de-pasos.md`), hay que añadir
esa cadena y volver a este documento.

### 2.4 Revisión humana

Estos textos los ha redactado un modelo de lenguaje a partir de los requisitos
de Apple, Google y el RGPD, ajustados a lo que el código hace de verdad. Cubren
lo que las tiendas comprueban, pero **no son asesoramiento jurídico**. Si algo
va a mirarlo un abogado, que sea la política de privacidad.

---

## 3. Antes de dar KAN-53 por cerrado

El código está escrito pero **no se ha ejecutado nunca contra un Postgres
real**: la migración y la Edge Function siguen sin desplegar, igual que las
otras seis pendientes (ver KAN-48). Hay que:

1. `supabase db push` y `supabase functions deploy delete-account`.
2. Probar el camino feliz: cuenta nueva → borrarla → intentar entrar con ella.
3. Probar **el caso que rompe cosas**: crear un clan con dos cuentas, borrar la
   del líder, y comprobar que el clan sigue vivo y el otro miembro es el nuevo
   líder. Es el único camino donde un fallo daña a un tercero.
4. Comprobar que la foto desaparece del bucket `avatars`.
