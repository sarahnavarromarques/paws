import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Pet = {
  id: number;
  name: string;
  breed: string | null;
  age: string | null;
  sex: string | null;
  weight: string | null;
  color: string | null;
  objective: string | null;
  level: string | null;
};

type Training = {
  id: number;
  pet_id: number;
  title: string;
  date: string | null;
  time: string | null;
  duration: number | null;
  status: string;
  notes: string | null;
};

function findPet(message: string, pets: Pet[]): Pet | null {
  const text = message.toLowerCase();

  const namedPet = pets.find((pet) =>
    text.includes(pet.name.toLowerCase())
  );

  if (namedPet) return namedPet;
  if (pets.length === 1) return pets[0];

  return null;
}

function getPetTrainingData(
  pet: Pet,
  trainings: Training[]
) {
  const petTrainings = trainings.filter(
    (training) => training.pet_id === pet.id
  );

  const completed = petTrainings.filter(
    (training) => training.status === "completed"
  );

  const pending = petTrainings.filter(
    (training) => training.status !== "completed"
  );

  const totalMinutes = petTrainings.reduce(
    (total, training) => total + (training.duration ?? 0),
    0
  );

  return {
    total: petTrainings.length,
    completed: completed.length,
    pending: pending.length,
    totalMinutes,
    trainings: petTrainings,
  };
}

function findTraining(
  message: string,
  pet: Pet,
  trainings: Training[]
): Training | null {
  const text = message.toLowerCase();

  const petTrainings = trainings.filter(
    (training) => training.pet_id === pet.id
  );

  return (
    petTrainings.find((training) =>
      text.includes(training.title.toLowerCase())
    ) ?? null
  );
}

function findPendingTraining(
  message: string,
  pet: Pet,
  trainings: Training[]
): Training | null {
  const text = message.toLowerCase();

  const pendingTrainings = trainings.filter(
    (training) =>
      training.pet_id === pet.id &&
      training.status !== "completed"
  );

  return (
    pendingTrainings.find((training) =>
      text.includes(training.title.toLowerCase())
    ) ?? null
  );
}

function isCompleteCommand(message: string): boolean {
  const text = message.toLowerCase();

  return (
    text.includes("completa") ||
    text.includes("completar") ||
    text.includes("marcar como completado") ||
    text.includes("marcar como completada") ||
    text.includes("termina el entrenamiento") ||
    text.includes("terminar el entrenamiento")
  );
}

function isDeleteCommand(message: string): boolean {
  const text = message.toLowerCase();

  return (
    text.includes("elimina") ||
    text.includes("eliminar") ||
    text.includes("borra") ||
    text.includes("borrar") ||
    text.includes("quita el entrenamiento") ||
    text.includes("quitar el entrenamiento")
  );
}

function isCreateCommand(message: string): boolean {
  const text = message.toLowerCase();

  return (
    text.includes("crea un entrenamiento") ||
    text.includes("crear un entrenamiento") ||
    text.includes("añade un entrenamiento") ||
    text.includes("anade un entrenamiento") ||
    text.includes("añadir un entrenamiento") ||
    text.includes("anadir un entrenamiento") ||
    text.includes("nuevo entrenamiento")
  );
}

function isUpdateCommand(message: string): boolean {
  const text = message.toLowerCase();

  return (
    text.includes("modifica el entrenamiento") ||
    text.includes("modificar el entrenamiento") ||
    text.includes("cambia el entrenamiento") ||
    text.includes("cambiar el entrenamiento") ||
    text.includes("actualiza el entrenamiento") ||
    text.includes("actualizar el entrenamiento")
  );
}

function extractTrainingTitle(message: string): string {
  const patterns = [
    /entrenamiento\s+(?:llamado|llamada|de)\s+["“]?([^"”]+)["”]?/i,
    /entrenamiento\s+["“]?([^"”]+)["”]?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1]) {
      return match[1]
        .replace(/\s+para\s+(mi\s+)?perro.*$/i, "")
        .replace(/\s+para\s+\w+.*$/i, "")
        .replace(/\s+de\s+\d+\s*(?:min|minuto|minutos).*$/i, "")
        .trim();
    }
  }

  return "";
}

function extractDuration(message: string): number {
  const match = message.match(
    /(\d+)\s*(?:min|minuto|minutos)/i
  );

  if (match?.[1]) {
    return Number(match[1]);
  }

  return 5;
}

function answerQuestion(
  message: string,
  pet: Pet,
  trainings: Training[]
): string {
  const text = message.toLowerCase();
  const data = getPetTrainingData(pet, trainings);
  const petName = pet.name;

  if (
    text.includes("qué debería entrenar") ||
    text.includes("que deberia entrenar") ||
    text.includes("qué entrenar") ||
    text.includes("que entrenar") ||
    text.includes("entrenar hoy") ||
    text.includes("entrenamiento de hoy") ||
    text.includes("qué hago hoy") ||
    text.includes("que hago hoy")
  ) {
    const pending = data.trainings.filter(
      (training) => training.status !== "completed"
    );

    if (pending.length > 0) {
      const pendingList = pending
        .slice(0, 5)
        .map(
          (training) =>
            `• ${training.title} — ${
              training.duration ?? 5
            } min`
        )
        .join("\n");

      return `Para hoy, empezaría con los entrenamientos que ${petName} tiene pendientes:

${pendingList}

Después haría una sesión corta de repaso de una habilidad que ya conozca.

Como ${petName} está en nivel ${
        pet.level ?? "Principiante"
      }, recomiendo una sesión de unos 5 minutos, con refuerzo positivo y terminando mientras todavía mantiene la atención.`;
    }

    return `Ahora mismo ${petName} no tiene entrenamientos pendientes.

Te recomiendo hacer hoy una sesión corta de repaso de una habilidad que ya conozca y después introducir una pequeña progresión.

⭐ Nivel: ${pet.level ?? "Principiante"}
📊 Entrenamientos completados: ${data.completed}
⏱️ Tiempo acumulado: ${data.totalMinutes} minutos

Una buena opción sería trabajar durante unos 5 minutos una habilidad conocida y terminar con éxito.`;
  }

  if (
    text.includes("información") ||
    text.includes("informacion") ||
    text.includes("datos") ||
    text.includes("cómo está") ||
    text.includes("como esta")
  ) {
    return `Estos son los datos de ${petName}:

🐶 Nombre: ${petName}
🐕 Raza: ${pet.breed ?? "Sin datos"}
🎂 Edad: ${pet.age ?? "Sin datos"}
⚖️ Peso: ${pet.weight ?? "Sin datos"}
⭐ Nivel: ${pet.level ?? "Principiante"}
🎯 Objetivo: ${pet.objective ?? "Sin datos"}

📊 Entrenamientos: ${data.total}
✅ Completados: ${data.completed}
⏳ Pendientes: ${data.pending}
⏱️ Tiempo entrenado: ${data.totalMinutes} minutos`;
  }

  if (
    text.includes("entrenamiento") &&
    (
      text.includes("historial") ||
      text.includes("hecho") ||
      text.includes("realizado") ||
      text.includes("tiene") ||
      text.includes("cuántos") ||
      text.includes("cuantos")
    )
  ) {
    if (data.total === 0) {
      return `${petName} todavía no tiene entrenamientos registrados.`;
    }

    const list = data.trainings
      .slice(0, 10)
      .map((training) => {
        const status =
          training.status === "completed"
            ? "✅ Completado"
            : "⏳ Pendiente";

        return `• ${training.title} — ${status} — ${
          training.duration ?? 0
        } min`;
      })
      .join("\n");

    return `Este es el historial reciente de ${petName}:

${list}

📊 Total de entrenamientos: ${data.total}
✅ Completados: ${data.completed}
⏳ Pendientes: ${data.pending}
⏱️ Tiempo total: ${data.totalMinutes} minutos`;
  }

  if (
    text.includes("progreso") ||
    text.includes("avanzado") ||
    text.includes("mejorado")
  ) {
    return `El progreso registrado de ${petName} actualmente es:

📊 Entrenamientos: ${data.total}
✅ Completados: ${data.completed}
⏳ Pendientes: ${data.pending}
⏱️ Tiempo total: ${data.totalMinutes} minutos

⭐ Nivel actual: ${
      pet.level ?? "Principiante"
    }

🎯 Objetivo:
${
      pet.objective ?? "Sin objetivo definido"
    }`;
  }

  if (
    text.includes("sentarse") ||
    text.includes("sentado") ||
    text.includes("siéntate") ||
    text.includes("sientate")
  ) {
    return `Para enseñar a ${petName} a sentarse:

1. Ten un premio preparado.
2. Acércalo a su hocico.
3. Muévelo lentamente hacia arriba y ligeramente hacia atrás.
4. Cuando se siente, di "sentado".
5. Dale el premio inmediatamente.
6. Repite en sesiones cortas.

Como ${petName} tiene actualmente nivel ${
      pet.level ?? "Principiante"
    }, empezaría con sesiones sencillas de unos 5 minutos.`;
  }

  if (
    text.includes("tumbarse") ||
    text.includes("tumbado") ||
    text.includes("túmbate") ||
    text.includes("tumbate")
  ) {
    return `Para enseñar a ${petName} a tumbarse:

1. Pídele que se siente.
2. Acerca un premio a su hocico.
3. Baja lentamente el premio hacia el suelo.
4. Muévelo hacia delante.
5. Cuando se tumbe, di "tumbado".
6. Premia inmediatamente.

Haz sesiones cortas y positivas.`;
  }

  if (
    text.includes("venir") ||
    text.includes("llamada") ||
    text.includes("aquí") ||
    text.includes("aqui")
  ) {
    return `Para trabajar la llamada con ${petName}:

1. Empieza en un lugar tranquilo.
2. Di su nombre y después "aquí".
3. Cuando venga, prémialo inmediatamente.
4. Empieza con distancias cortas.
5. Aumenta progresivamente la distancia y las distracciones.

No utilices la llamada para regañarlo. Queremos que acudir cuando lo llamas sea algo positivo.`;
  }

  if (
    text.includes("quieto") ||
    text.includes("espera") ||
    text.includes("quedarse")
  ) {
    return `Para enseñar "quieto" a ${petName}:

1. Pídele que se siente.
2. Di "quieto".
3. Espera uno o dos segundos.
4. Prémialo si permanece quieto.
5. Aumenta poco a poco el tiempo.
6. Después aumenta la distancia.

No aumentes tiempo, distancia y distracciones a la vez.`;
  }

  if (
    text.includes("paseo") ||
    text.includes("correa") ||
    text.includes("tirar")
  ) {
    return `Para trabajar el paseo con ${petName}:

1. Empieza en un lugar tranquilo.
2. Premia cuando camine con la correa floja.
3. Si tira, evita avanzar mientras mantiene la tensión.
4. Cuando vuelva a estar tranquilo, continúa.
5. Aumenta progresivamente las distracciones.

Su objetivo registrado es:

${
      pet.objective ?? "Sin objetivo definido"
    }`;
  }

  if (
    text.includes("sesión") ||
    text.includes("sesiones") ||
    text.includes("minutos") ||
    text.includes("duración") ||
    text.includes("duracion") ||
    text.includes("cuánto tiempo") ||
    text.includes("cuanto tiempo")
  ) {
    return `En el caso de ${petName}, actualmente tienes registrados:

📊 ${data.total} entrenamientos
✅ ${data.completed} completados
⏳ ${data.pending} pendientes
⏱️ ${data.totalMinutes} minutos totales

Para el entrenamiento diario empezaría con sesiones cortas de unos 5 minutos y aumentaría progresivamente según su respuesta.`;
  }

  if (
    text.includes("premio") ||
    text.includes("premiar") ||
    text.includes("refuerzo")
  ) {
    return `Los premios son una herramienta de refuerzo.

La regla básica es:

Comportamiento deseado → premio inmediatamente.

El premio debe aparecer justo después del comportamiento que quieres reforzar para que ${petName} pueda relacionarlos.

No siempre tiene que ser comida: también pueden funcionar juguetes, juego, atención o acceso a algo que le guste.`;
  }

  if (
    text.includes("ladr") ||
    text.includes("ladra") ||
    text.includes("ladrar")
  ) {
    return `Para trabajar los ladridos de ${petName}, primero hay que identificar qué los provoca.

Observa:

• Cuándo ladra.
• Qué ocurre justo antes.
• Qué hace después.
• Qué consigue con el ladrido.

Puede tratarse de excitación, miedo, frustración, atención u otros motivos.

Con esa información podemos diseñar un entrenamiento específico.`;
  }

  if (
    text.includes("morder") ||
    text.includes("muerde") ||
    text.includes("mordisquear")
  ) {
    return `Si ${petName} muerde durante el juego:

1. Evita jugar con las manos directamente.
2. Redirige hacia un juguete.
3. Si muerde demasiado fuerte, detén brevemente el juego.
4. Cuando interactúe correctamente, continúa jugando.
5. Refuerza los momentos de calma.

Si se trata de agresividad, miedo intenso o mordidas peligrosas, es mejor consultar con un profesional cualificado.`;
  }

  if (
    text.includes("cachorro") ||
    text.includes("cachorra") ||
    text.includes("2 meses") ||
    text.includes("dos meses")
  ) {
    return `Con ${petName} conviene priorizar sesiones muy cortas y positivas.

Puedes trabajar:

• Responder a su nombre.
• Venir cuando lo llamas.
• Sentarse.
• Manipulación tranquila.
• Caminar contigo.
• Hábitos de higiene.
• Exposición progresiva a diferentes ambientes.

Evita sesiones largas y haz que el aprendizaje sea gradual y positivo.`;
  }

  if (
    text.includes("hola") ||
    text.includes("buenas") ||
    text.includes("hey")
  ) {
    return `¡Hola! 👋 Soy PAWS IA.

Puedo ayudarte con el entrenamiento de ${petName}.

Puedes preguntarme, por ejemplo:

• ¿Cómo le enseño a sentarse?
• ¿Cómo trabajo la llamada?
• ¿Cómo evito que tire de la correa?
• ¿Cuántos entrenamientos tiene?
• ¿Cuánto tiempo hemos entrenado?
• ¿Qué debería entrenar hoy?
• ¿Cómo va su progreso?`;
  }

  return `Puedo ayudarte con el entrenamiento de ${petName}.

Por ejemplo, puedes preguntarme:

• ¿Cómo le enseño a sentarse?
• ¿Cómo trabajo la llamada?
• ¿Cómo consigo que no tire de la correa?
• ¿Cuántos entrenamientos tiene?
• ¿Cuánto tiempo hemos entrenado?
• ¿Qué debería entrenar hoy?
• ¿Cómo va su progreso?

También puedo consultar sus datos registrados en PAWS.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        {
          error: "No se ha recibido ninguna pregunta.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Usuario no autenticado.",
        },
        { status: 401 }
      );
    }

    const { data: pets, error: petsError } =
      await supabase
        .from("pets")
        .select(
          "id, name, breed, age, sex, weight, color, objective, level"
        )
        .eq("user_id", user.id)
        .order("id", { ascending: true });

    if (petsError) {
      console.error("ERROR PETS:", petsError);

      return NextResponse.json(
        {
          error: petsError.message,
        },
        { status: 500 }
      );
    }

    const { data: trainings, error: trainingsError } =
      await supabase
        .from("trainings")
        .select(
          "id, pet_id, title, date, time, duration, status, notes"
        )
        .eq("user_id", user.id)
        .order("date", { ascending: false });

    if (trainingsError) {
      console.error(
        "ERROR TRAININGS:",
        trainingsError
      );

      return NextResponse.json(
        {
          error: trainingsError.message,
        },
        { status: 500 }
      );
    }

    const petList = (pets ?? []) as Pet[];
    const trainingList = (trainings ?? []) as Training[];

    if (petList.length === 0) {
      return NextResponse.json({
        message:
          "Todavía no tienes ninguna mascota registrada en PAWS. Añade una mascota y podré ayudarte con sus datos.",
      });
    }

    const selectedPet = findPet(message, petList);

    if (!selectedPet && petList.length > 1) {
      const names = petList
        .map((pet) => pet.name)
        .join(", ");

      return NextResponse.json({
        message: `Tienes varias mascotas registradas: ${names}.

Dime con cuál quieres trabajar y adaptaré la respuesta a sus datos.`,
      });
    }

    const pet = selectedPet ?? petList[0];

    /*
     * CREAR ENTRENAMIENTO
     */

    if (isCreateCommand(message)) {
      const title = extractTrainingTitle(message);
      const duration = extractDuration(message);

      if (!title) {
        return NextResponse.json({
          message: `Dime qué entrenamiento quieres crear.

Por ejemplo:
"Crea un entrenamiento Quieto para ${pet.name} de 5 minutos".`,
        });
      }

      const today = new Date()
        .toISOString()
        .split("T")[0];

      const { data: newTraining, error: insertError } =
      await supabase.from("trainings")
        .insert({
          user_id: user.id,
          pet_id: pet.id,
          title,
          date: today,
          time: null,
          duration,
          status: "pending",
          notes: null,
        })
          .select()
          .single();

      if (insertError) {
        console.error(
          "ERROR CREANDO ENTRENAMIENTO:",
          insertError
        );

        return NextResponse.json(
          {
            error:
              "No se ha podido crear el entrenamiento.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `✅ Hecho.

He creado el entrenamiento "${newTraining.title}" para ${pet.name}.

📅 Fecha: ${today}
⏱️ Duración: ${duration} minutos
⏳ Estado: Pendiente`,
      });
    }

    /*
     * MODIFICAR ENTRENAMIENTO
     */

    if (isUpdateCommand(message)) {
      const training = findTraining(
        message,
        pet,
        trainingList
      );

      if (!training) {
        return NextResponse.json({
          message: `No he encontrado el entrenamiento que quieres modificar de ${pet.name}.

Por ejemplo:
"Modifica el entrenamiento Quieto de Tobyyyy a 10 minutos".`,
        });
      }

      const durationMatch = message.match(
        /(?:a|en|duración(?: de)?)\s*(\d+)\s*(?:min|minuto|minutos)/i
      );

      const newDuration = durationMatch
        ? Number(durationMatch[1])
        : null;

      const titleMatch = message.match(
        /(?:llámalo|llamalo|nombre|título|titulo)\s+["“]?([^"”]+)["”]?/i
      );

      const newTitle = titleMatch?.[1]?.trim() ?? null;

      if (!newDuration && !newTitle) {
        return NextResponse.json({
          message: `Dime qué quieres modificar.

Por ejemplo:
"Modifica el entrenamiento Quieto de Tobyyyy a 10 minutos".`,
        });
      }

      const updates: {
        duration?: number;
        title?: string;
      } = {};

      if (newDuration) {
        updates.duration = newDuration;
      }

      if (newTitle) {
        updates.title = newTitle;
      }

      const { data: updatedTraining, error: updateError } =
      await supabase.from("trainings")
        .update(updates)
        .eq("id", training.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        console.error(
          "ERROR MODIFICANDO ENTRENAMIENTO:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "No se ha podido modificar el entrenamiento.",
          },
          { status: 500 }
        );
      }

      const changes: string[] = [];

      if (newDuration) {
        changes.push(
          `⏱️ Duración: ${newDuration} minutos`
        );
      }

      if (newTitle) {
        changes.push(
          `📝 Nombre: ${newTitle}`
        );
      }

      return NextResponse.json({
        message: `✏️ Hecho.

He modificado "${training.title}" de ${pet.name}.

${changes.join("\n")}`,
      });
    }

    /*
     * COMPLETAR ENTRENAMIENTO
     */

    if (isCompleteCommand(message)) {
      const training =
        findPendingTraining(
          message,
          pet,
          trainingList
        );

      if (!training) {
        return NextResponse.json({
          message: `No he encontrado un entrenamiento pendiente que coincida con tu petición para ${pet.name}.`,
        });
      }

      const { error: updateError } =
        await supabase
          .from("trainings")
          .update({
            status: "completed",
          })
          .eq("id", training.id)
          .eq("user_id", user.id);

      if (updateError) {
        console.error(
          "ERROR COMPLETANDO ENTRENAMIENTO:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              "No se ha podido completar el entrenamiento.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `✅ Hecho.

He marcado "${training.title}" de ${pet.name} como completado.

⏱️ Duración: ${
          training.duration ?? 0
        } minutos`,
      });
    }

    /*
     * ELIMINAR ENTRENAMIENTO
     */

    if (isDeleteCommand(message)) {
      const training = findTraining(
        message,
        pet,
        trainingList
      );

      if (!training) {
        return NextResponse.json({
          message: `No he encontrado un entrenamiento que coincida con tu petición para ${pet.name}.`,
        });
      }

      const { error: deleteError } =
        await supabase
          .from("trainings")
          .delete()
          .eq("id", training.id)
          .eq("user_id", user.id);

      if (deleteError) {
        console.error(
          "ERROR ELIMINANDO ENTRENAMIENTO:",
          deleteError
        );

        return NextResponse.json(
          {
            error:
              "No se ha podido eliminar el entrenamiento.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `🗑️ Hecho.

He eliminado "${training.title}" de ${pet.name}.`,
      });
    }

    const answer = answerQuestion(
      message,
      pet,
      trainingList
    );

    return NextResponse.json({
      message: answer,
    });
  } catch (error) {
    console.error("ERROR PAWS IA:", error);

    return NextResponse.json(
      {
        error:
          "No se ha podido procesar la pregunta.",
      },
      { status: 500 }
    );
  }
}