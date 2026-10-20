# Registro de alegaciones

Seguimiento privado de las alegaciones de una organización: qué se ha enviado, con qué documentos,
qué plazo corre y qué ha respondido la Administración. Es la cara interna del
[Observatorio de alegaciones](https://asensio94.github.io/observatorio-alegaciones/): el observatorio
detecta los anuncios y este registro lleva lo que el equipo hace con ellos. La página es pública; los
datos de cada organización se quedan en su carpeta compartida.
Web: <https://asensio94.github.io/registro-alegaciones/>

> **Estado: activo.** Prototipo en desarrollo, aún sin probar con una organización. No tiene robot:
> la página cambia cuando cambia el código, y los datos, cuando el equipo los toca.

## Cómo funciona

1. **Bandeja.** Lee el estado público del observatorio (`data/estado.json`) y muestra los anuncios
   con plazo abierto que aún no tienen expediente ni decisión. Cada uno se abre como expediente, se
   descarta con motivo o se pospone hasta una fecha. Los títulos del BOE se acortan al nombre del
   proyecto; el título oficial se guarda en el expediente.
2. **Avisos por correo.** Lo que llega al buzón antes del BOE (consultas a personas interesadas,
   avisos de notificación de la DEHú) entra en la misma bandeja: se arrastra el `.eml`, el `.msg` de
   Outlook o el PDF a la página, o una regla del buzón (Power Automate) lo deja en `entrada/`.
   `app/mail.js` lo lee en el navegador (MIME y el formato binario de Outlook, sin librerías), guarda
   el original y los adjuntos, reconoce el tipo de aviso y el número de expediente y propone el
   expediente al que parece pertenecer. Cuando el proyecto sale después en el BOE, la bandeja lo
   empareja con el expediente ya abierto.
3. **Expediente = cronología.** Publicación, consulta, aviso de notificación, presentación, solicitud de información, ampliación,
   respuesta, requerimiento, resolución, recurso y notas. Cada documento cuelga del hecho al que
   pertenece y se versiona si se sube otra vez con el mismo nombre.
4. **Plazos deducidos.** Cada hecho abre su plazo y el hecho que lo contesta lo cierra
   (`app/deadlines.js`: Ley 39/2015, Ley 21/2013, Ley 27/2006, LJCA). El calendario suma los festivos
   nacionales, los autonómicos comprobados de la sede y del órgano (art. 30.6 Ley 39/2015) y los que
   añada el equipo.
5. **Fase automática.** Presentar pasa el expediente a «Presentada» y una resolución a «Seguimiento».
   Las tareas tipo del procedimiento se marcan solas cuando el hecho las cumple.
6. **Prueba del envío.** Cada presentación guarda el canal, el número de registro, la fecha y hora
   oficial, el órgano y su DIR3, el CSV y la huella SHA-256 del escrito y del justificante. Un envío
   sin justificante queda marcado en la cabecera y en la ficha.
7. **Vistas.** «Hoy» abre la herramienta con una frase de resumen y tres tarjetas: lo que nos toca
   hacer esta semana, lo que está por decidir y lo que la Administración ya debería haber
   contestado. Después, la bandeja (avisos del correo, anuncios del BOE y decididos, en pestañas),
   «Plazos» (vencido, hoy, esta semana, les toca a ellos, más adelante), expedientes en lista,
   tablero por fases o calendario, e informe anual con exportación CSV y JSON. Paleta de comandos
   (`Ctrl K`) y atajos, siempre con su botón. Tema claro fijo.
8. **Guía.** Una guía rápida dentro de la página (`#/guia`, también sin abrir carpeta): qué es cada
   parte, primeros pasos, cómo leer los colores, la rutina, atajos y preguntas frecuentes.
9. **Guardar.** Un fichero por registro en la carpeta elegida (tabla de abajo): dos personas que
   tocan expedientes distintos nunca se pisan. Si tocan el mismo, antes de escribir se relee y el
   cambio se reaplica sobre la versión del otro (`app/store.js`). Las copias en conflicto que creen
   OneDrive o Dropbox se señalan en Ajustes. Al abrir una carpeta del formato anterior
   (`registro.json`), se reparte en ficheros y el original se guarda en `copias/`.
10. **Instalable.** Chrome y Edge la instalan como aplicación (manifest y service worker, que solo
   guarda la propia página para abrirla sin conexión; nunca los datos).

La investigación de mercado y las decisiones de diseño están en [INVESTIGACION.md](INVESTIGACION.md).

## Contraste / validación

- Motor de plazos: 15 pruebas con casos calculados a mano (`tests/deadlines.test.js`): festivos
  nacionales, festivo autonómico de una de las partes, meses que acaban en fin de semana, agosto y
  Navidad en el contencioso, ampliación de la respuesta de información, consultas a interesados,
  notificación electrónica y cierre por el hecho que contesta.
- Lectura de correos: 4 pruebas (`tests/mail.test.js`) con un correo MIME construido en la prueba
  (codificaciones, adjuntos, tipo de aviso, número de expediente). La de `.msg` reales de Outlook
  solo corre con `MSG_FIXTURES` apuntando a una carpeta de ejemplos, que no se suben al repositorio.
- Guardado: 7 pruebas (`tests/store.test.js`) sobre una carpeta simulada: un fichero por registro,
  dos personas en expedientes distintos sin conflicto, el mismo expediente con conflicto y
  reaplicación, borrado, copias en conflicto de OneDrive, migración de `registro.json` y lectura de
  `entrada/`.
- El plazo de alegaciones coincide con el que publica el observatorio para los anuncios abiertos
  probados (por ejemplo, BOE-B-2026-29433: 26 de octubre de 2026).
- Pendiente: probarlo con el equipo de SEO/BirdLife sobre expedientes reales de 2025 y 2026.

## Límites

- Calcula plazos, no los certifica: manda lo que digan el anuncio y el pie de recursos.
- Festivos autonómicos: solo los fijos comprobados (por ahora, Cantabria). Los demás y los locales se
  añaden en Ajustes. Fuera de 2026–2028 el plazo se marca como estimado.
- El contencioso aplica agosto y del 24 al 31 de diciembre de forma simplificada: compruébalo con el
  pie de recursos.
- La carpeta compartida necesita Chrome o Edge (File System Access API). En otros navegadores solo
  funciona la demostración.
- No presenta nada: presentar se hace en la sede electrónica y aquí se anota el justificante.
- No lee el buzón por sí sola: los avisos entran arrastrándolos o por una regla que los deje en
  `entrada/`. Desde Outlook de escritorio hay que soltar el correo antes en el escritorio.
- Sin servidor, cada persona necesita la carpeta sincronizada en su equipo y no hay permisos por
  equipo: quien ve la carpeta lo ve todo. La etapa con servidor está en
  [INVESTIGACION.md](INVESTIGACION.md#7-arquitectura-por-etapas).

## Pendiente

- Probarlo con SEO/BirdLife y ajustar fases, motivos de descarte y listas de tareas a su forma de
  trabajar.
- Plantillas de escrito por familia de proyecto (eólica, fotovoltaica, líneas, hidráulica…).
- Etapa con servidor (Supabase en la UE o el Microsoft 365 de la organización): usuarios con
  credenciales, permisos por equipo, buzón leído solo y aviso diario de plazos.
- Comprobar `mail.js` con `.msg` reales de los avisos que recibe SEO/BirdLife.
- Festivos autonómicos completos de 2026–2028.

## Uso

Con la web: abrir <https://asensio94.github.io/registro-alegaciones/> en Chrome o Edge, pulsar
«Abrir carpeta…» y elegir la carpeta compartida del equipo, o «Abrir la demostración».
La [guía rápida](https://asensio94.github.io/registro-alegaciones/#/guia) explica cada parte y los
primeros pasos.

Para desarrollar:

```bash
node --test tests/*.test.js
python build.py
python -m http.server 8793 -d docs
```

`build.py` incrusta `estilo/common.css`, el logo y los ficheros de `app/` en un solo `docs/index.html`
y genera el manifest, el service worker y los iconos (el petirrojo de `estilo/logo.py`, con Pillow).

## Datos que se guardan

En el repositorio, ninguno: solo código. En la carpeta de la organización:

| Fichero | Contenido |
|---|---|
| `organizacion.json` | Nombre, comunidad autónoma, festivos añadidos, fuente de la bandeja y equipo (nombres o roles) |
| `expedientes/<id>.json` | Un expediente: cronología, tareas y metadatos de documentos |
| `bandeja/<id>.json` | Una decisión de la bandeja (descartado con motivo, pospuesto hasta una fecha) |
| `avisos/<id>.json` | Un aviso recibido: asunto, remitente, fecha, tipo, número de expediente y extracto del texto |
| `documentos/<id>/` | Escritos, justificantes, informes y resoluciones de cada expediente; el correo original y los adjuntos de cada aviso |
| `entrada/` | Donde una regla del buzón deja correos; la herramienta los lee y los quita |
| `copias/registro-AAAA-MM-DD.json` | Una copia completa por día con cambios |

Cada fichero lleva un número de revisión, la fecha y quién lo guardó por última vez.

La demostración guarda datos inventados en el navegador (`localStorage`) y los ficheros solo en
memoria.

## Fuentes y licencias

- Anuncios y resoluciones: [Observatorio de alegaciones](https://github.com/Asensio94/observatorio-alegaciones),
  a partir del BOE (CC BY 4.0).
- Código: MIT (`LICENSE`). Estilo común y logo: `estilo/`, copiados literal de los proyectos hermanos.

Forma parte de un conjunto de proyectos hermanos: [Observatorio de alegaciones](https://asensio94.github.io/observatorio-alegaciones/) · [Vigía de incendios](https://asensio94.github.io/vigia-incendios/) · [Centinela Natura](https://asensio94.github.io/centinela-natura/) · [Vigilancia de humedales](https://asensio94.github.io/vigilancia-humedales/) · [Sub Nocte](https://asensio94.github.io/sub-nocte/) · [Riesgo de tendidos para aves](https://asensio94.github.io/riesgo-tendidos-aves/) · [Grafo de promotores](https://asensio94.github.io/grafo-promotores/) · [Cartera de las cotizadas](https://asensio94.github.io/cartera-cotizadas/) · [Cuaderno de campo](https://asensio94.github.io/cuaderno-campo/) · [Caudal ecológico](https://asensio94.github.io/caudal-ecologico/) · [Estado de las IBA](https://asensio94.github.io/estado-iba/) · [Acuíferos de Francia](https://asensio94.github.io/acuiferos-francia/)
