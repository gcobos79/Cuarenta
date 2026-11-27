# CUARENTA · Don Barajón — Contexto: Nivel 4 «Leyenda» y niveles por ases

Resumen de la conversación del 27-11-2026 para continuar el trabajo en el proyecto Cuarenta.

## Estado actual

- **Pull request:** https://github.com/gcobos79/Cuarenta/pull/2, en la rama `nivel4-leyenda`, sin unir a `main`.
- **Versión:** Solo **V1.03.84**. Parte de la V1.03.83 de `main`.
- **Archivos tocados:** `index.html`. **Nuevos:** `motor/nivel4.js`, `motor/reglas.js`, `motor/LEEME.md` y `simulador/` (con `niveles-actuales.js`, `partida.js` y `torneo.js`).
- **Copia de prueba en claude.ai:** existe un artefacto «CUARENTA Don Barajón» basado en una versión vieja (V1.03.29 → V1.03.34). Tiene un sistema de ases propio, de una victoria por as, que **no** se llevó al repositorio. La fuente válida es el repositorio.

## Por qué existe el Nivel 4

- La pregunta inicial fue si Don juega mejor con más tiempo. **No:** los niveles 1 y 2 son fórmulas instantáneas, y el 3 simula siempre 128 manos posibles a un solo turno de profundidad.
- En el torneo, pasar de 24 a 64 manos simuladas no cambió el resultado (59 % frente a 60 %). Lo que da fuerza es calcular la mano completa, no pensar más.

## Cómo juega Leyenda (`motor/nivel4.js`)

1. **Manos posibles del rival:** Don nunca lee la mano real del rival, solo su tamaño. Arma manos posibles con las cartas no vistas.
2. **Filtro de coherencia** con lo observado en la sección:
   - nadie tenía cuatro iguales;
   - si el rival reclamó ronda, su mano tenía un trío;
   - si soltó una carta sin levantar teniendo otra que levantaba, la mano se acepta solo el 25 % de las veces (`creerSoltar`).
3. **Cálculo completo** hasta el final de la sección, con minimax y poda alfa-beta, para cada mano posible.
4. **Evaluación en puntos reales:**
   - caída, limpia, bono de ronda (+4) y 4 de falta;
   - «38 que no juegan»;
   - conteo de cartas exacto en la sección 4, y 0,5 por carta de ventaja en las demás;
   - llegar a 40 vale 100.
5. **Tiempo:** como máximo 1,2 s, por tandas de 30 ms. Para antes si la mejor jugada ya está clara.
6. **En el juego:** `donNivel4Turn()` y el historial público `donSecHist`. Si algo falla, Don juega con el motor del Nivel 3.

## Resultados de los torneos (`simulador/torneo.js`)

Cada par de partidas usa el mismo reparto, con los bots cambiando de asiento.

| Prueba | Partidas | Resultado |
|---|---|---|
| Leyenda contra Nivel 3 | 1000 | **61,5 %** (intervalo 95 %: 58,5–64,5) |
| Ídem, con 38 y 4 de falta activados | 200 | 55,5 % |
| Referencia: Nivel 3 contra 2 / contra 1 | 300 c/u | 70 % / 83 % |

- `pesoCarta`: entre 0,25 y 0,5 rinde bien; 0,1 es peor (52 %).
- La estimación binomial del conteo no mejoró.
- Deducir cartas por las jugadas sumó poco (+1,3 puntos).
- Comando: `cd simulador && node torneo.js 4 3 1000 '{"muestrasFijas":24}'` (con `R38=1 F4=1` se activan las reglas opcionales).

## Decisiones del dueño

- **Nombre:** el Nivel 4 se llama **Leyenda**. Se descartaron Maestro, As de Ases, Rey de la Baraja e Imbatible.
- **Niveles abiertos por ases** (los ases del juego, con estrellas y el Palco de Honor):
  - al empezar solo está abierto Normal;
  - el As de Bronce abre Avanzado, el de Plata abre Experto y el de Oro abre Leyenda;
  - un as alto abre los niveles de abajo, pero **no regala** los ases que faltan. Por ejemplo, quien tiene la Plata sin el Bronce juega hasta Experto y su Bronce sigue pendiente;
  - cada jugador se gana sus ases por su cuenta: **sin claves de regalo** y sin usar la hoja de Google para validar;
  - los ases **no** se muestran en la pantalla principal.
- **Leyenda no da ni quita estrellas,** para no tocar las de Experto. Su reverso es negro con dorado (`html[data-nivel="4"]`).
- **Con la clave de dueño** (`ownerUnlocked`), todos los niveles están abiertos.
- **La propuesta de subir de nivel al ganar** solo aparece si el siguiente nivel está abierto. Si no, Don dice qué as falta.

## Cambios en `index.html`, por si hay que revisarlos

- `maxOpenLevel()`, `lockedLevelMsg()` y `renderLevelLocks()` van junto a `guardarRachas`.
- **Bloqueo de niveles cerrados:**
  - el selector `#aiLevel`, el panel rápido y el gesto de deslizar usan `oninput`;
  - `prepareNewGame()` limita el nivel guardado a los niveles abiertos.
- **Estrellas:** `registrarRacha` no se llama en el nivel 4, ni en `finish` ni en el abandono de una partida pendiente. `renderStarsMeter` no muestra estrellas en Leyenda.
- **Textos con 4 niveles:**
  - nombres, `NIVEL_NOMBRE[4]`, marcas del selector y gesto de deslizar;
  - la Ayuda («Los cuatro niveles») y `showLevelUp`.
- **Motor:** se carga con `<script src="motor/nivel4.js?v=V1.03.84">`.

## Pendiente o para decidir

- **PR #2:** unido a `main` y publicado.
- **Jugadores sin ases:** quien juega hoy en Avanzado o Experto sin tener los ases correspondientes queda limitado a sus niveles abiertos.
- **Base de resultados (Supabase):** resuelto. La base acepta cualquier nivel; el juego ahora envía «Leyenda» y los gráficos del administrador la incluyen.
- **Reglas duplicadas:** `index.html` tiene su propia copia de las reglas de captura y `motor/reglas.js` es una copia para el simulador. Hay que mantenerlas iguales.
- **Ideas no hechas:** un premio propio para cada as (por ejemplo, un reverso especial) y una vista del administrador con partidas por nivel que incluya Leyenda.
