export const faqs = [
  {
    question: "¿Puedo empezar gratis y sin tarjeta?",
    answer:
      "Sí. Puedes crear tu cuenta, escribir tu diario, transcribir audio y probar los chats sin introducir una tarjeta. Los chats tienen una cuota mensual; puedes consultar los límites y la disponibilidad de los planes en Precios.",
  },
  {
    question: "¿Mis datos están seguros y privados?",
    answer:
      "Tu diario está asociado a tu cuenta y el acceso se restringe por usuario. Al usar una función de IA, el contenido necesario se envía a OpenAI para procesar la petición. No hay cifrado de extremo a extremo. Puedes eliminar tu cuenta desde Configuración y consultar los detalles en la política de privacidad.",
  },
  {
    question: "¿Cómo me ayuda la IA a reflexionar?",
    answer:
      "Puedes preguntarle por experiencias de tu diario, pedir una propuesta de redacción o revisar las personas que aparecen en tus entradas. Sus respuestas pueden equivocarse: revísalas antes de aceptarlas. LumaDiary es una herramienta de reflexión, no un servicio de terapia o diagnóstico.",
  },
  {
    question: "¿Cómo funciona el diario de voz?",
    answer:
      "Guarda una entrada para la fecha elegida, permite el acceso al micrófono y graba desde la app. La transcripción convierte el audio en texto que puedes revisar. Necesitas conexión y un navegador compatible; la precisión depende del sonido y puede haber errores.",
  },
  {
    question: "¿Puedo usarlo en móvil y ordenador?",
    answer:
      "Sí. Es una aplicación web que puedes abrir en el navegador de móvil u ordenador. Accede con la misma cuenta para consultar las entradas guardadas. No necesitas instalar una aplicación y se requiere conexión a internet.",
  },
  {
    question: "¿Qué incluyen los informes de estadísticas?",
    answer:
      "Los planes con acceso a estadísticas incluyen un resumen con IA, una cita para reflexionar, menciones de personas y gráficas de los análisis disponibles. Generar un informe nuevo consume un acceso; cambiar el periodo de una gráfica no consume otro.",
  },
  {
    question: "¿Cuándo se renuevan los límites?",
    answer:
      "Las cuotas se renuevan el primer día de cada mes a las 00:00 UTC. El consumo del mes se conserva al cambiar de plan. Puedes ver el uso y la fecha de renovación en Configuración.",
  },
  {
    question: "¿Cómo cancelo una suscripción?",
    answer:
      "Cuando los pagos estén disponibles, podrás gestionar la suscripción y solicitar la cancelación desde la app. Una cancelación al final del periodo mantiene el acceso hasta su fecha de vencimiento. Antes de contratar, revisa el precio y las condiciones que muestra el pago.",
  },
];
export const guides = [
  {
    slug: "diario-personal-con-ia",
    title: "Diario personal con IA: cómo usarlo para reflexionar",
    description:
      "Qué puede hacer un diario con inteligencia artificial, cómo empezar y qué revisar antes de confiar en sus respuestas.",
    intro:
      "Un diario personal con IA combina tus propias entradas con herramientas para revisar lo vivido. Tú escribes la historia; la IA puede ayudarte a encontrar preguntas y conexiones, sin decidir por ti.",
    sections: [
      {
        title: "Empieza por tus palabras",
        paragraphs: [
          "Escribe qué ha pasado, cómo te has sentido y qué te gustaría recordar. No necesitas una entrada larga ni una redacción perfecta. Una situación concreta da más contexto que una etiqueta como «mal día».",
          "En LumaDiary puedes guardar entradas por fecha, escribir desde el móvil o transcribir una grabación. Si pides una propuesta de redacción, compárala con lo que querías decir antes de guardarla.",
        ],
      },
      {
        title: "Haz preguntas concretas al chat",
        paragraphs: [
          "Una pregunta útil puede ser: «¿Qué situaciones he descrito como agradables esta semana?» o «¿Qué dudas se repiten cuando escribo sobre mi trabajo?». Utiliza la respuesta como punto de partida y compruébala con tus entradas.",
          "El chat por persona centra la conversación en alguien que aparece en tu diario. Evita convertir una interpretación de la IA en una afirmación sobre las intenciones de otra persona.",
        ],
      },
      {
        title: "Lee las estadísticas con contexto",
        paragraphs: [
          "Las gráficas reflejan análisis disponibles de las entradas, no una evaluación clínica. Un día sin análisis no equivale a un estado de ánimo neutro. Revisa el texto original y el periodo seleccionado antes de sacar conclusiones.",
          "En los planes con estadísticas, generar un informe consume un acceso. Cambiar de semana a mes o año en una gráfica no genera otra respuesta de IA.",
        ],
      },
      {
        title: "Decide qué contenido quieres procesar",
        paragraphs: [
          "Tu cuenta limita el acceso a tus entradas. Las funciones de IA envían el contenido necesario al proveedor para responder. No es un diario con cifrado de extremo a extremo; revisa la política de privacidad antes de incluir información sensible.",
          "La IA puede omitir contexto o interpretar algo de forma equivocada. LumaDiary sirve para escribir y reflexionar; no sustituye atención profesional ni ofrece diagnóstico.",
        ],
      },
    ],
    prompt: "¿Qué he aprendido hoy y qué quiero mirar con más calma mañana?",
  },
  {
    slug: "diario-de-voz",
    title: "Diario de voz: convierte tus reflexiones en texto",
    description:
      "Aprende a grabar un diario de voz, revisar su transcripción y guardar una entrada con tus propias palabras.",
    intro:
      "Si te resulta más fácil hablar que escribir, un diario de voz puede ayudarte a empezar. Cuenta lo que quieras recordar y después revisa el texto, a tu ritmo.",
    sections: [
      {
        title: "Elige la fecha y guarda una entrada",
        paragraphs: [
          "Abre LumaDiary con tu cuenta, selecciona la fecha y guarda una entrada. La grabación se asocia a una entrada existente para que el audio y su transcripción tengan un lugar en tu diario.",
          "Puedes empezar con una frase, por ejemplo «Hoy quiero recordar la conversación de esta tarde». No hace falta preparar un discurso.",
        ],
      },
      {
        title: "Graba con un sonido claro",
        paragraphs: [
          "Permite el acceso al micrófono cuando el navegador lo solicite. Busca un lugar con poco ruido, habla a un ritmo cómodo y detén la grabación cuando termines. Necesitas conexión a internet para transcribir.",
          "La app funciona en navegadores compatibles de móvil y ordenador. Si el micrófono no aparece, revisa los permisos del navegador y que otra aplicación no lo esté utilizando.",
        ],
      },
      {
        title: "Revisa la transcripción",
        paragraphs: [
          "El audio se envía a OpenAI para convertirlo en texto. El ruido, los nombres propios o varias personas hablando pueden producir errores. Comprueba especialmente nombres, fechas y frases importantes.",
          "Puedes revisar la transcripción antes de utilizarla en tu entrada. Una propuesta de estilización con IA es opcional: tu significado y tus palabras tienen prioridad.",
        ],
      },
      {
        title: "Crea una rutina que puedas mantener",
        paragraphs: [
          "Prueba con una nota breve al terminar el día o después de una experiencia que quieras recordar. La duración no mide el valor de la reflexión: basta con describir un momento y una idea.",
          "Evita grabar a otras personas sin su permiso. Si prefieres no enviar audio a un proveedor de IA, puedes escribir directamente en el diario.",
        ],
      },
    ],
    prompt: "¿Qué momento quiero recordar de hoy y por qué me ha importado?",
  },
  {
    slug: "como-empezar-un-diario",
    title: "Cómo empezar un diario personal sin quedarte en blanco",
    description:
      "Una guía práctica con preguntas y una plantilla breve para escribir tu primera entrada de diario personal.",
    intro:
      "Empezar un diario no exige escribir todos los días ni contar toda tu vida. Elige un momento concreto, ponlo en palabras y guarda lo que te gustaría recordar.",
    sections: [
      {
        title: "Empieza con una situación, no con un resumen de tu vida",
        paragraphs: [
          "Piensa en algo que haya ocurrido hoy: una conversación, una decisión o un rato tranquilo. Describe qué pasó y qué detalles te llamaron la atención. Puedes separar lo que observaste de lo que interpretaste.",
          "Por ejemplo: «Hoy hablé con una amiga al salir del trabajo. Me sentí escuchado y me gustaría repetir ese rato». Una entrada breve también sirve.",
        ],
      },
      {
        title: "Usa tres preguntas cuando no sepas qué escribir",
        paragraphs: [
          "¿Qué ha pasado? ¿Cómo lo he vivido? ¿Qué quiero recordar o probar después? Responder a estas tres preguntas suele ser suficiente para una primera entrada.",
          "Si una pregunta no te ayuda, déjala. Puedes escribir una lista, una frase o una reflexión más larga. El formato tiene que encajar contigo.",
        ],
      },
      {
        title: "Elige un ritmo sostenible",
        paragraphs: [
          "Prueba a escribir en un momento reconocible, como después de cenar. Si prefieres hablar, graba una nota y revisa su transcripción. No necesitas recuperar todos los días que hayas dejado pasar.",
          "De vez en cuando, vuelve a una entrada anterior y observa qué ha cambiado. Evita juzgarla solo por cómo te sientes ahora; era una descripción de aquel momento.",
        ],
      },
      {
        title: "Usa la IA como una segunda lectura",
        paragraphs: [
          "Después de escribir, puedes pedir una propuesta de redacción o una pregunta que te ayude a profundizar. Revisa siempre el resultado: una respuesta convincente puede contener errores.",
          "Con LumaDiary empiezas con una cuenta gratuita y sin tarjeta. Conserva el control de lo que escribes y revisa los límites del chat y la privacidad del procesamiento antes de usarlo.",
        ],
      },
    ],
    prompt:
      "Hoy ha ocurrido… Me he sentido… Me gustaría recordar… Mi próximo paso puede ser…",
  },
] as const;
