# Fase 0: qué tiene que tener una herramienta de alegaciones

Investigación previa al prototipo. Pregunta: ¿qué herramientas del mercado resuelven bien «saber qué
hemos enviado, con qué documentos y qué plazo corre», cuál tiene mejor funcionalidad y experiencia
de uso, y cómo se aplica a las alegaciones de una ONG como SEO/BirdLife?

## 1. El trabajo que hay que cubrir

Un equipo pequeño (técnicos de conservación, jurídico, delegaciones) que:

1. **Detecta** anuncios de información pública. Ya lo hace el
   [Observatorio de alegaciones](https://asensio94.github.io/observatorio-alegaciones/), cada día y
   desde el BOE.
2. **Decide** si alega, y deja constancia de por qué no cuando no lo hace.
3. **Redacta y revisa** un escrito, a menudo con informes técnicos y anexos.
4. **Presenta** en un registro electrónico y guarda el justificante, que es la única prueba de que
   presentó y de cuándo.
5. **Sigue** el expediente durante meses o años: pide información, recibe requerimientos y
   resoluciones, recurre o no.
6. **Rinde cuentas**: memoria anual, socios, financiadores.

Hoy eso suele vivir repartido en hojas de cálculo, carpetas y correos. Lo que falla es siempre lo
mismo: un plazo que nadie veía, un justificante que no aparece y la pregunta «¿esto ya lo alegamos?».

## 2. Familias de herramientas revisadas

| Familia | Ejemplos | Qué hacen bien | Por qué no bastan solas |
|---|---|---|---|
| Gestores de expedientes jurídicos | Clio, Filevine, MyCase, PracticePanther | Plazos encadenados a un hecho y calculados con un calendario de días hábiles; documentos versionados por asunto; un único registro de actividad por expediente | Pensados para despachos que facturan horas; calendarios judiciales de EE. UU.; de pago por usuario; los datos se quedan en su nube |
| Seguimiento de solicitudes de acceso a la información | MuckRock, Alaveteli (WhatDoTheyKnow; en España lo usó Tu Derecho a Saber) | Una cronología por solicitud; el estado lo mueven las comunicaciones, no un desplegable; avisos de «fuera de plazo» y «muy fuera de plazo»; panel de lo que toca hacer | Están pensados para que las solicitudes sean públicas; no cubren alegaciones ni recursos |
| Gestores de incidencias y proyectos | Linear, Jira, GitHub Projects | Bandeja de entrada con decisión rápida; «lo mío»; la misma lista vista como tabla, tablero o calendario; paleta de comandos y atajos; URL propia para cada elemento | No saben de plazos legales ni de justificantes de registro |
| Bases de datos genéricas | Airtable, Notion, hojas de cálculo | Flexibles y conocidas | Cada equipo reinventa el modelo; los plazos se teclean a mano y no se recalculan; no hay prueba de qué fichero se presentó |
| Plataformas de consultas públicas | Citizen Space y similares | Están del lado de la Administración: recogen respuestas | Lado equivocado del mostrador |

## 3. La elegida: Linear para la experiencia, con el modelo de Filevine y MuckRock

**Mejor experiencia de uso: Linear.** De las revisadas, es la que hace que un equipo pequeño
mantenga los datos al día, porque cada acción cuesta un clic o una tecla:

- **Bandeja (triage)**: lo nuevo entra en un sitio aparte y se resuelve con una sola decisión
  (aceptar, descartar con motivo, posponer). No contamina la lista de trabajo.
- **«Mis asuntos»** agrupados por urgencia, no por proyecto.
- **Una sola lista con varias vistas** (lista, tablero por fases, calendario) y filtros guardados.
- **Ficha con cronología**: propiedades a un lado, actividad en el centro.
- **Teclado y paleta de comandos** (Ctrl K), con un botón visible para todo lo que hace un atajo.
- **Pocos campos obligatorios**: el resto se rellena cuando hace falta.

**Mejor modelo de dominio: Filevine (plazos) + MuckRock/Alaveteli (cronología).**

- *Cadenas de plazos*: el plazo no se escribe, se deduce del hecho que lo abre. Si se corrige la
  fecha de la publicación, se mueve todo lo que cuelga de ella.
- *El estado sigue a las comunicaciones*: presentar mueve el expediente a «Presentada», y una
  resolución lo pasa a «Seguimiento». Cada plazo se cierra solo cuando llega el hecho que lo
  contesta.
- *Fuera de plazo y muy fuera de plazo* para lo que le toca a la Administración. A partir de 30 días
  es cuando conviene reclamar o recurrir el silencio.

## 4. Lo que exige el derecho español (y la herramienta modela)

| Requisito | Norma | En la herramienta |
|---|---|---|
| Días hábiles: sin sábados, domingos ni festivos; desde el día siguiente | art. 30.2 Ley 39/2015 | Motor de plazos con calendario |
| Meses de fecha a fecha; sin día equivalente, el último del mes | art. 30.4 Ley 39/2015 | Ídem |
| Si vence en inhábil, el siguiente hábil | art. 30.5 Ley 39/2015 | Ídem |
| Festivo en la sede del interesado **o** del órgano: inhábil | art. 30.6 Ley 39/2015 | Calendario de la organización + comunidad del órgano + festivos que añada el equipo |
| Información pública del estudio de impacto: 30 días hábiles como mínimo | art. 36.1 Ley 21/2013 | Plazo por defecto, editable según el anuncio |
| Consulta a personas interesadas: 30 días hábiles (plan, proyecto ordinario), 20 (simplificada, alcance) | arts. 19.1, 30.2, 34.4, 37.4 y 46.2 Ley 21/2013 | Hecho «consulta recibida», con el subtipo; los días del propio oficio mandan |
| Notificación electrónica: rechazada si no se abre en 10 días naturales | art. 43.2 Ley 39/2015 | Hecho «aviso de notificación» |
| Subsanación: 10 días | art. 68.1 Ley 39/2015 | Hecho «requerimiento» |
| Información ambiental: 1 mes, 2 si se amplía | art. 10.2.c Ley 27/2006 | Hecho «solicitud de información» + «ampliación» |
| Alzada y reposición: 1 mes; resolver en 3 y en 1 mes | arts. 122 y 124 Ley 39/2015 | Pie de recursos de la resolución |
| Contencioso: 2 meses, agosto inhábil | arts. 46 y 128.2 LJCA | Regla propia; 24-31 de diciembre inhábiles (art. 183 LOPJ) |
| La DIA y el informe de impacto no se recurren por separado | arts. 41.4 y 47.5 Ley 21/2013 | Aviso en el formulario de resolución |
| Caducidad de la DIA a los 4 años | art. 43.1 Ley 21/2013 | Plazo de vigilancia |
| Prueba de la presentación | art. 16 Ley 39/2015 (recibo con fecha y hora) | Número, fecha y hora oficial, órgano, DIR3, CSV y huella SHA-256 del escrito y del justificante |
| Condición de interesado | art. 4 Ley 39/2015 | Tarea tipo en la lista del procedimiento |

## 5. Decisiones de diseño

- **El código es público y los datos no salen de la organización.** La página (GitHub Pages) solo
  trae el código. Los expedientes viven en una carpeta que el equipo ya comparte (unidad de red,
  OneDrive, SharePoint, Drive para escritorio), abierta desde el navegador con la File System Access
  API. No hay servidor, cuentas ni cuotas.
- **Concurrencia sin servidor.** Un fichero por registro: `organizacion.json`, uno por expediente,
  uno por decisión de la bandeja y uno por aviso. Cada cambio es una función sobre los datos que se
  aplica en el momento y queda en cola hasta que se escribe. Antes de escribir se comprueba que los
  ficheros tocados no han cambiado en disco; si alguno sí, se relee todo y la cola se reaplica sobre
  la versión del otro. Dos personas solo pueden chocar si tocan el mismo expediente, y entonces
  ninguna pierde su cambio. Cada día se guarda una copia completa.
- **Enlace con el observatorio por el identificador del BOE.** La bandeja lee su estado público, y
  las resoluciones que el observatorio empareja con un anuncio aparecen como novedad del expediente.
- **Acento** `#c03a55` / `#f590a5`: un tono más claro del rojo del observatorio, porque esta
  herramienta es su cara privada. Es el más claro de esa familia que sigue pasando el contraste AA
  como color de enlace (4,5:1 sobre el fondo).

## 6. Qué queda fuera de esta fase

- Presentar por la herramienta: no hay API pública del Registro Electrónico General para terceros.
  Presentar se sigue haciendo en la sede electrónica.
- Festivos autonómicos y locales completos: se cargan a mano en Ajustes.
- Leer el buzón solo y mandar avisos de plazos por correo: necesitan algo que corra sin nadie
  delante, es decir, la etapa 2 (sección 7).
- Plantillas de escritos: el siguiente paso natural, con los argumentos tipo de SEO por familia de
  proyecto.

## 7. Arquitectura por etapas

La pregunta de partida: que no se pierdan los datos, que varios equipos trabajen sobre lo mismo con
sus credenciales y que entre fácil lo que ya les llega, como los avisos al buzón antes del BOE.

### Qué tecnología y dónde funciona

- **Una aplicación web instalable (PWA)**, no un programa de escritorio. Chrome y Edge la instalan
  con su icono y su ventana, se actualiza sola y funciona igual en Windows y Mac. Un instalable
  (Electron, Tauri) obliga a firmar el código, distribuir cada versión y que informática lo apruebe
  en cada equipo, y no resuelve lo que importa: dónde viven los datos. El service worker solo guarda
  la propia página para abrirla sin conexión, nunca los datos.
- **El código, en GitHub Pages**; los datos, nunca ahí.

### Etapa 1 (ya hecha): la carpeta compartida

- Los datos viven en una carpeta que la organización ya tiene y ya respalda: OneDrive, SharePoint,
  una unidad de red o Google Drive para escritorio. Perder datos exige perder esa carpeta.
- Un fichero por registro (sección 5), legible sin la herramienta: si mañana se abandona, los
  expedientes siguen ahí en JSON y los documentos con su nombre.
- **Desviación de lo que se propuso** («un fichero por cambio»). Los cambios son funciones sobre los
  datos, no datos, y guardarlos como diario obligaría a reconstruir el estado leyendo todo el
  historial. Un fichero por registro da la misma seguridad ante la sincronización (dos personas solo
  escriben el mismo fichero si tocan el mismo expediente) y se lee a simple vista. El historial ya
  está en la cronología de cada expediente y en las copias diarias.
- Límites: cada persona necesita la carpeta sincronizada en su equipo, Chrome o Edge, y no hay
  permisos por equipo (quien ve la carpeta lo ve todo).

### Etapa 2: servidor privado con usuarios

Dos caminos, y cuál conviene depende de lo que ya use SEO:

| | Supabase en la UE | Microsoft 365 de la organización |
|---|---|---|
| Qué es | Postgres gestionado con usuarios, ficheros y funciones programadas; región Fráncfort o París | SharePoint como almacén y Microsoft Graph para leer el buzón |
| Usuarios y equipos | Cuentas propias o entrada con Microsoft o Google; permisos por equipo con reglas en la base de datos (RLS) | Las cuentas que ya tienen; permisos de SharePoint |
| Buzón | Reenvío a una dirección de entrada o lectura por IMAP desde una función | Graph lee el buzón compartido directamente |
| Aviso diario de plazos | Función programada que reutiliza `deadlines.js` tal cual | Power Automate o una función de Azure |
| Coste | Gratis para probar, pero el plan gratuito se pausa tras 7 días sin uso; el de pago, unos 25 $/mes | Incluido si ya tienen las licencias |
| De quién es | La cuenta puede ser de SEO y Supabase se puede alojar en un servidor propio (es código abierto) | De SEO |

Lo que cambia en la herramienta es poco: `app/store.js` ya separa el almacén del resto, así que la
etapa 2 es otro almacén con las mismas operaciones (`read`, `save`, `attach`, `open`, `incoming`). El
formato de los registros es el mismo y la migración es copiar ficheros a filas.

### Los avisos que llegan al buzón

- Lo que reciben las ONG antes del BOE son, sobre todo, **consultas a personas interesadas**: el
  órgano ambiental pide opinión sobre el documento inicial o de alcance de un plan o proyecto
  (arts. 19, 30, 34, 37 y 46 Ley 21/2013), con 20 o 30 días hábiles. Si la organización está dada de
  alta, también llegan **avisos de notificación** de la DEHú o de una sede, que se tienen por
  rechazados a los 10 días naturales sin abrirlos (art. 43.2 Ley 39/2015).
- Tres maneras de meterlos, de menos a más automática:
  1. Arrastrar el correo (`.eml`, `.msg`) o el PDF a la página. Funciona ya.
  2. Una regla del buzón (Power Automate: «cuando llega un correo de…, guardar el `.eml` en la
     carpeta») que lo deje en `entrada/`. La herramienta lo recoge al abrirse y cada 20 segundos.
     Funciona ya; falta montar la regla en su buzón.
  3. En la etapa 2, el servidor lee el buzón solo.
- Cada aviso se lee en el navegador, se guarda con su original y sus adjuntos, y se le deduce el
  tipo, el número de expediente y el plazo. Cuando ese proyecto sale después en el BOE, la bandeja
  propone unirlo al expediente que ya estaba abierto.

### Preguntas para SEO/BirdLife

1. ¿Qué correo usan: Microsoft 365, Google Workspace u otro? ¿Tienen Power Automate?
2. ¿Cuántos equipos o delegaciones lo usarían y deben ver solo lo suyo o todo?
3. ¿Quién administraría el servidor y quién sería el titular de la cuenta?
4. ¿Pueden pasar tres o cuatro avisos reales (consultas, avisos de la DEHú) para probar la lectura?
5. ¿Su responsable de protección de datos tiene algo que decir? Los correos traen nombres de
   personas de la Administración y de los promotores, y se quedan en la carpeta de la organización.
