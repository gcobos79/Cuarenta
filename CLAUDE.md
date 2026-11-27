# Cuarenta · Don Barajón — instrucciones para Claude

- **Este repositorio es el juego real** (se publica en https://gcobos79.github.io/Cuarenta/). Trabaja siempre aquí.
  Las copias del juego en artefactos de claude.ai están desactualizadas: no las edites. Si alguien pide cambios
  sobre una copia, avisa primero y compara su `GAME_VERSION` con la de `index.html`.
- **Solo** = `index.html` (un solo archivo). **Amigos** = `amigos/` (página aparte, con su `LEEME.txt` y pruebas en `amigos/pruebas`).
- Cada cambio publicado sube el último número de `GAME_VERSION` en `index.html` (V1.03.84 → V1.03.85…).
- Todo el texto para el jugador va en español.
- **Niveles:** Normal, Avanzado, Experto y Leyenda. Al empezar solo está abierto Normal. El As de Bronce abre Avanzado,
  el de Plata abre Experto y el de Oro abre Leyenda. Un as alto abre los de abajo, pero nunca se regalan ases.
  Leyenda no da ni quita estrellas. Con la clave de dueño todo está abierto.
- **Motor del Nivel 4:** `motor/nivel4.js` (explicado en `motor/LEEME.md`; historia y decisiones en `motor/CONTEXTO.md`).
- **Antes de cambiar la dificultad** de un nivel, mídela con el simulador: `cd simulador && node torneo.js 4 3 1000 '{"muestrasFijas":24}'`.
  `motor/reglas.js` es una copia de las reglas de `index.html`: si cambian las reglas, actualiza las dos.
- **Resultados:** Supabase, proyecto `cuarenta-amigos`, tabla `partidas`.
