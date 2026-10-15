# Física en acción

Laboratorio web interactivo para explorar conceptos de física mediante simulaciones y herramientas de cálculo. El proyecto aplica fundamentos de desarrollo de software —interfaz, lógica de dominio, visualización y validación de entradas— a problemas de mecánica y electricidad.

## Simuladores y herramientas

- **Movimiento parabólico:** trayectoria con condiciones iniciales configurables, gravedad planetaria y resistencia del aire.
- **Péndulo y masa-resorte:** animación, periodo, posición-tiempo y energías en función de sus parámetros.
- **Vectores:** edición gráfica, operaciones vectoriales y ejercicios aleatorios.
- **Circuitos eléctricos:** crea redes propias en serie o paralelo con resistencias y focos; simula el interruptor, el flujo de corriente, voltajes y potencias. También incluye leyes de Kirchhoff, ley de Ohm y problemas.

## Ejecutar

No requiere instalación de dependencias ni proceso de compilación. Abre `index.html` en un navegador moderno. Para publicar el sitio, sirve los archivos estáticos desde la raíz del proyecto, por ejemplo mediante GitHub Pages.

## Tecnologías y conceptos de desarrollo

- HTML semántico para estructurar las vistas y controles.
- CSS adaptable a escritorio y móvil, con temas claro y oscuro según el sistema.
- JavaScript para los modelos físicos, validación de parámetros y navegación entre simuladores.
- Canvas 2D para las animaciones, los diagramas y las gráficas.

## Modelo de oscilaciones

El péndulo usa la aproximación de ángulo pequeño: `T = 2π√(L/g)` y `θ(t) = θ₀ cos(√(g/L)t)`. El sistema masa-resorte ideal usa `T = 2π√(m/k)` y `x(t) = A cos(√(k/m)t)`. Las energías cinética y potencial se calculan durante la simulación para observar la transformación entre ambas.

## Constructor de circuitos

En «Circuitos eléctricos» → «Crear circuito», agrega hasta seis resistencias y focos, configura el voltaje de la pila y elige una conexión en serie o en paralelo. Pulsa «Simular circuito» para ver la resistencia equivalente y los valores de voltaje, corriente y potencia de cada componente. El interruptor abre o cierra el circuito; al cerrarlo, puedes activar la animación de la corriente convencional. Los focos se representan como elementos resistivos ideales.

## Presentación

En la feria, invita al público a cambiar una sola variable a la vez y predecir qué ocurrirá con el periodo, la posición o la energía. Luego pueden ejecutar la simulación y comparar el resultado con su predicción.

**Integrantes:** completar con los nombres del equipo.
