# 🎲 Random Game Generator

Extensión de Chrome (Manifest V3) que convierte tu backlog en algo jugable: registras tu
biblioteca, aplicas filtros y dejas que un sorteo *de verdad* aleatorio decida a qué juegas hoy.

Tiene dos mitades que se alimentan entre sí:

- **Tu biblioteca** — gestor de backlog con sorteo inteligente, modos de selección y estadísticas.
  Funciona **100 % offline**: no sale nada del navegador.
- **Descubrir** — le dices géneros, rango de precio y plataformas, y busca en Steam, Epic, GOG,
  Nintendo y Xbox un juego que todavía no tienes. Lo que te guste pasa a tu wishlist con un clic.
  Es la única parte que usa red, y solo cuando la pides.

---

## Puesta en marcha

```bash
npm install
npm run build
```

Después, en Chrome:

1. `chrome://extensions` → activa **Modo de desarrollador**.
2. **Cargar descomprimida** → selecciona la carpeta `dist/chrome`.

Para desarrollo con recarga en caliente:

```bash
npm run dev
```

### Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Extension.js en modo desarrollo, con recarga automática |
| `npm run build` | Compila la extensión a `dist/chrome` |
| `npm run typecheck` | `tsc --noEmit` sobre todo el proyecto |
| `npm test` | Suite completa (88 tests, `node:test`): núcleo, recomendador y backend |
| `npm run api:dev` | Backend de Descubrir en local, en `http://localhost:8787` |
| `npm run api:typecheck` | Tipos del backend |

Para inspeccionar la UI sin cargar la extensión en Chrome:

```bash
node tools/preview-server.mjs
```

Sirve `dist/chrome` en `http://localhost:5599`. Fuera del contexto de extensión no existe
`chrome.storage`, así que la capa de persistencia cae automáticamente a `localStorage` y el
dashboard y el popup siguen funcionando igual.

---

## Qué hace

### Biblioteca

Alta manual con nombre, plataforma, géneros, estado, horas estimadas, horas jugadas, nota
personal (0-10), tags, portada, notas, modo de juego (un jugador / multi / ambos), favorito y
exclusión del sorteo. Estados: **Backlog, Jugando, Completado, Abandonado, Wishlist**.

También hay importación y exportación por fichero (JSON o CSV), con deduplicación por
`nombre@plataforma` —o por `origen:externalId` cuando viene de una tienda— y fusión que **no
pisa** lo que hayas editado a mano.

Si arrancas de cero, el botón **🎁 Cargar biblioteca de ejemplo** —en el randomizador vacío, en
la biblioteca vacía y en Ajustes— siembra 20 fichas elegidas para que los nueve modos tengan
candidatos (hay un test que lo garantiza). Van marcadas con el tag `Ejemplo`, así que buscar por
él las agrupa para borrarlas; y como pasan por la misma deduplicación, cargarlas dos veces no
duplica nada.

### Descubrir

Pestaña que recomienda juegos **que no tienes** a partir de:

- **Plataformas**: PC, Switch, Xbox (PlayStation aparece desactivada, ver limitaciones).
- **Géneros**: 16 géneros canónicos que significan lo mismo en todas las tiendas.
- **Rango de precio** en la moneda de tu región, **nota mínima**, **modos de juego**
  (un jugador, multijugador, cooperativo), **solo con descuento** e **incluir gratuitos**.
- **Ocultar lo que ya tengo**: descarta lo que esté en tu biblioteca, en cualquier estado.

Muestra portada, géneros, nota, descripción, la oferta más barata y la comparativa entre tiendas
cuando el mismo juego está en varias. *Otra sugerencia* reutiliza la búsqueda (no vuelve a llamar a
las tiendas) y no repite mientras queden alternativas; *Guardar en wishlist* lo convierte en ficha
de biblioteca con el tag `Descubierto`, el precio del momento y el enlace a la tienda.

| Tienda | Catálogo | Precio | Fuente |
| --- | --- | --- | --- |
| Steam, Epic, GOG, Humble, Fanatical | ✅ | ✅ Steam en tu moneda; el resto en USD | CheapShark + Steam appdetails |
| Nintendo eShop | ✅ | ⚠️ Solo en países europeos | Índice Solr del eShop + API oficial de precios |
| Microsoft Store (Xbox) | ✅ | ✅ En tu moneda | StoreEdge + DisplayCatalog |
| PlayStation Store | ❌ | ❌ | — |

**Limitaciones verificadas, no supuestas:**

- **PlayStation** rechaza toda consulta que no lleve un hash de *persisted query* en su lista
  blanca, y Sony los rota en cada despliegue. El proveedor está declarado en estado `planned` y la
  respuesta lo explica en vez de omitirlo.
- **Nintendo** solo publica precio para su catálogo europeo en países europeos (en México y EE. UU.
  responde `not_found`). Fuera de Europa se muestra el precio de España **como referencia en EUR**,
  y la interfaz avisa de que esos juegos no pueden entrar en un rango de precio en tu moneda.
- **Nunca se convierten monedas.** Una oferta en USD no cuenta para un tope en MXN: comparar sin
  tipo de cambio sería inventarse la respuesta.

### Randomizador

Botón **🎲 ¿QUÉ JUGAMOS?** con animación de carrusel y ficha de resultado: portada, nombre,
plataforma, género, duración, horas jugadas, nota y estado, más las acciones *Jugar*, *Volver a
girar*, *Favorito* y *Marcar como Jugando*.

### Modos de selección

| Modo | Qué acota |
| --- | --- |
| 🎲 Completamente aleatorio | Todo lo que tienes y no has completado |
| ⚡ Partida corta | ≤ 15 h estimadas |
| 🏔️ Aventura larga | ≥ 40 h estimadas |
| 💀 Backlog Killer | Backlog de más de 90 días; pesa más cuanto más antiguo |
| 🆕 Nunca jugado | 0 horas jugadas |
| 🎯 Termina lo que empezaste | Empezados sin acabar; pesa más cuanto más avanzados |
| 💎 Joya oculta | Meses en la estantería y apenas tocados; bonus si están bien valorados |
| ❤️ Favoritos | Solo los marcados |
| 🗡️ RPG aleatorio | Solo RPG / JRPG |

### Filtros

Plataforma, género, tags, estado, duración, un jugador / multijugador, nota mínima, nunca
jugados, abandonados, empezados sin terminar, antigüedad en biblioteca y solo favoritos.

Los filtros del usuario y los del modo se combinan: **el modo manda en los campos que declara**
y el resto de tus filtros se respetan tal cual. Cada modo muestra cuántos juegos tendría
disponibles antes de que gastes un giro.

### Estadísticas

Totales por estado, horas jugadas, horas pendientes, porcentaje de completado (la wishlist no
entra en el denominador: son juegos que aún no tienes), nunca jugados, favoritos, nota media y
top de plataformas y géneros.

---

## Reglas que el código garantiza

Están cubiertas por tests, no son solo intenciones:

- **El sorteo es realmente aleatorio.** Se usa `crypto.getRandomValues` con rechazo de muestras
  para enteros uniformes, no `Math.random()`.
- **Nunca sale un juego excluido.** Es la primera comprobación del filtro y no hay forma de
  saltársela desde un modo.
- **El resultado siempre pertenece al pool filtrado.**
- **No repetir es un intento, no una restricción.** Si al descartar los N últimos sorteados el
  pool se queda vacío, se reutiliza el pool completo en vez de devolver "sin resultados".
- **La pertenencia al pool se decide con filtros; los pesos solo ajustan las probabilidades.**
  Por eso el contador de cada modo coincide con lo que realmente puede salir.
- **Los datos persisten** en `chrome.storage.local` (con `unlimitedStorage`) y se sincronizan en
  vivo entre popup y dashboard.

---

## Arquitectura

```
src/
├── core/                  # Núcleo sin React ni DOM: ejecutable y testeable en Node
│   ├── types/             # Game, FilterCriteria y sus normalizadores
│   ├── storage/           # kv-store (chrome.storage | localStorage) + repositorio + esquema
│   ├── filters/           # Predicado único de filtrado y facetas
│   ├── random/            # RNG criptográfico y motor de sorteo
│   ├── modes/             # Registro de modos de selección
│   ├── stats/             # Cálculo de estadísticas
│   ├── importers/         # Contrato de proveedores, registro e importación por fichero
│   ├── messaging/         # Contrato de mensajes entre contextos
│   └── discover/          # Contrato compartido con el backend + cliente del recomendador
├── shared/                # React compartido por popup y dashboard
│   ├── hooks/             # use-library (estado global), use-spin (máquina del sorteo)
│   ├── components/        # ResultCard, SpinButton, ModeSelector, FiltersPanel, átomos
│   └── styles/            # Tokens de diseño y componentes
├── background/            # Service worker MV3
├── popup/                 # Popup compacto (380 px)
└── dashboard/             # Página completa (options_ui, open_in_tab)

server/                    # Backend de Descubrir (Vercel, sin framework)
├── api/discover.ts        # GET /api/discover — firma estándar Request -> Response
├── dev.ts                 # El mismo handler servido en local
└── src/
    ├── discover.ts        # Orquestación, filtrado puro y caché de catálogos
    ├── genres.ts          # Traducción de la taxonomía de cada tienda
    └── providers/         # pc · nintendo · xbox · playstation (planned)
```

Tres decisiones que explican el resto:

1. **El núcleo no sabe que es una extensión.** `src/core` no importa React ni toca el DOM y la
   persistencia está detrás de la interfaz `KeyValueStore`, así que los tests corren en Node
   sin simular Chrome.
2. **La UI nunca habla con `chrome.storage`.** Todo pasa por `libraryRepository`, que normaliza
   entidades y emite cambios; popup y dashboard abiertos a la vez ven siempre lo mismo.
3. **El service worker es deliberadamente delgado**: migraciones al instalar, menú contextual y
   badge del icono. Ninguna lógica de negocio vive ahí.

### Desplegar el backend de Descubrir

La extensión apunta por defecto a `http://localhost:8787` (`npm run api:dev`). Para usarla sin tener
el servidor local abierto:

1. Crea un proyecto en Vercel desde este repositorio con **Root Directory = `server`** y deja
   activado *Include source files outside of the Root Directory*: el backend importa el contrato
   compartido de `src/core/discover/types.ts`.
2. Copia la URL del despliegue en **Ajustes → Descubrir → Servidor de recomendaciones**.

El endpoint no guarda estado ni credenciales: sirve datos públicos de catálogo con CORS abierto y
cabeceras de caché de borde (10 min, 1 h de `stale-while-revalidate`).

### Añadir un modo de selección

Una entrada en `SELECTION_MODES` (`src/core/modes/selection-modes.ts`). Nada más: el selector de
modos, los contadores y el sorteo se generan a partir de esa lista.

```ts
{
  id: 'coop-night',
  label: 'Noche de coop',
  emoji: '🎮',
  description: 'Algo para jugar acompañado y que no sea eterno.',
  criteria: { playerModes: ['multi'], maxHours: 20 },
  weight: (game) => (game.favorite ? 3 : 1),
}
```

### Añadir un importador de tienda

La arquitectura ya está preparada para Steam, Epic, GOG, Xbox, PlayStation y Nintendo: cada uno
está declarado en `src/core/importers/providers/store-providers.ts` con su descripción, los
campos que pedirá y los `host_permissions` que necesitará. Hoy están en estado `planned` y su
`fetchGames` lanza `ProviderNotImplementedError`.

Implementar uno es:

1. Cambiar su `status` a `'available'` y escribir `fetchGames()` devolviendo `GameDraft[]`.
2. Añadir sus `host_permissions` al `manifest.json`.

No hay que tocar ni el repositorio ni la UI: la deduplicación, la fusión y el alta masiva ya
viven en `libraryRepository.importGames`, y la pantalla de ajustes se genera desde el registro.

---

## Privacidad

Tu biblioteca se guarda solo en el almacenamiento local del navegador y nunca sale de él. La única
petición de red es la de **Descubrir**, y solo envía los criterios de búsqueda (géneros, precio,
plataformas, región): ni tu biblioteca ni ningún dato personal. "Ocultar lo que ya tengo" se
resuelve en tu navegador. Sin analítica y sin permisos de host. Desde **Ajustes → Datos y privacidad** puedes
exportar una copia, vaciar la biblioteca o borrar el historial de sorteos.
