# Motor del Nivel 4 «Leyenda» y simulador de torneos

El juego Solo (`index.html`) carga `motor/nivel4.js` para el Nivel 4 · Leyenda. El simulador sirve para comparar niveles con miles de partidas.

```
motor/
  reglas.js        Reglas copiadas tal cual del juego (V1.03.29): capturas, escalera, suma y conteo.
  nivel4.js        Nivel 4 «Leyenda». Funciona en el navegador y en Node.
simulador/
  niveles-actuales.js   Niveles 1, 2 y 3 copiados del juego, sin cambios de lógica.
  partida.js            Partida completa entre dos bots (ciclos, ronda, caída, limpia, conteo, 38 y 4 de falta).
  torneo.js             Torneo en paralelo, con los mismos repartos para los dos bots.
```

## Cómo juega el Nivel 4

1. Don **no mira tus cartas**. Arma muchas manos posibles para ti usando solo las cartas que todavía no se han visto.
2. Descarta las manos que no encajan con lo que ya pasó:
   - si reclamaste ronda, tu mano tenía un trío;
   - nadie tenía cuatro iguales (si no, la partida habría terminado);
   - si soltaste una carta sin levantar nada teniendo otra que sí levantaba, esa mano es poco creíble (se acepta solo 1 de cada 4 veces).
3. Con cada mano posible calcula **la sección completa hasta el final**: prueba todas las jugadas de los dos, suponiendo que ambos juegan lo mejor posible.
4. Mide cada jugada en **puntos reales**: caídas, limpias, bono de ronda, 4 de falta, conteo de cartas (exacto en la sección 4) y la posibilidad de llegar a 40.
5. Elige la jugada con mejor promedio. Piensa como máximo 1,2 s, y para antes si la mejor jugada ya está clara.

En el juego el cálculo va por tandas de 30 ms, así que la pantalla no se traba.

## Resultados del torneo (Nivel 4 contra Nivel 3)

Cada par de partidas usa el mismo reparto, con los bots cambiando de asiento.

| Prueba | Partidas | Gana el Nivel 4 | Intervalo 95 % |
|---|---|---|---|
| **Configuración final** | **1000** | **61,5 %** | **58,5 – 64,5 %** |
| Con «38 que no juegan» y «4 de falta» | 200 | 55,5 % | 48,6 – 62,4 % |

Referencia de los niveles actuales (300 partidas cada una): Nivel 3 gana al 2 el 70 % y al 1 el 83 %.

Lo que se aprendió al ajustar:
- **Más tiempo casi no ayuda.** Con 64 manos simuladas en vez de 24 ganó lo mismo (59 % frente a 60 %). La mejora viene de calcular la mano completa, no de pensar más.
- El valor de cada carta para el conteo va mejor entre 0,25 y 0,5. Con 0,1 baja al 52 %.
- Estimar el conteo final con una binomial no rindió mejor que un valor fijo por carta.
- Deducir tus cartas por tus jugadas sumó un poco (de 58,5 % a 59,8 % con los mismos repartos).

## Uso

```bash
cd simulador
node torneo.js 4 3 1000 '{"muestrasFijas":24}'          # Nivel 4 contra Nivel 3
R38=1 F4=1 node torneo.js 4 3 200 '{"muestrasFijas":24}' # con las reglas opcionales
node torneo.js 4 3 400 '{"muestrasFijas":24,"pesoCarta":0.25}'  # probar otro ajuste
```

## Niveles abiertos (V1.03.84)

Al empezar solo está abierto Normal. Cada as abre el nivel siguiente: Bronce → Avanzado, Plata → Experto, Oro → Leyenda.
Un as alto abre también los niveles de abajo, pero no regala los ases que faltan. Leyenda no da ni quita estrellas.
Con la clave de dueño todos los niveles están abiertos.

## Pendiente

- `index.html` todavía tiene su propia copia de las reglas de captura; `motor/reglas.js` es una copia para el simulador.
  Si cambian las reglas del juego, hay que copiarlas también aquí.
- El resultado de una partida en Leyenda se guarda sin nivel, porque la base solo acepta Normal, Avanzado y Experto.
- El torneo es contra el Nivel 3; contra personas el resultado puede variar. La deducción por jugadas está
  pensada sobre todo para personas, que casi nunca sueltan carta pudiendo levantar.
