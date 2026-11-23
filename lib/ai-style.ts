// Normas de estilo para TODO lo que escribe la IA de PAWS.
// Se añaden al final de cada instrucción (prompt) de las rutas de IA.
// Si algún día se quiere cambiar el estilo, se cambia solo aquí.

export type AiWritingLocale = "es" | "en";

const STYLE_ES = `Estilo de escritura (obligatorio):
- Escribe en español claro y natural de España, como hablaría un buen adiestrador con alguien que no sabe de adiestramiento. Aunque te dirijas a un profesional, que se entienda a la primera.
- NO uses anglicismos. Usa siempre la palabra en español: por ejemplo «implicación» o «atención» en vez de engagement, «reiniciar» o «ajustar» en vez de resetear, «excitación» o «nerviosismo» en vez de arousal, «premio» en vez de reward, «señal» en vez de cue.
- Evita la jerga técnica y las expresiones rebuscadas (por ejemplo: tiración, disfunción motor-impulsiva, compuertas obligatorias, nudo gordiano, variables ambientales, discriminación de estímulos). Dilo con palabras sencillas: «tira de la correa», «le cuesta controlar los impulsos», «distracciones del entorno».
- Si un término técnico es realmente necesario, explícalo en pocas palabras la primera vez que lo uses.
- Frases cortas y directas. Nada de frases largas encadenadas.`;

const STYLE_EN = `Writing style (mandatory):
- Write in clear, natural, everyday English, the way a good dog trainer would talk to someone with no training background. Even when addressing a professional, it must be understood at first read.
- Avoid technical jargon and convoluted expressions (for example: motor-impulsive dysfunction, mandatory gateways, environmental variables, stimulus discrimination). Say it simply: «pulls on the lead», «struggles to control impulses», «distractions around him».
- If a technical term is truly needed, explain it in a few words the first time you use it.
- Short, direct sentences. No long chained sentences.`;

// Normas de estilo en el idioma en el que tiene que escribir la IA
export function getWritingStyle(locale: string): string {
  return locale === "en" ? STYLE_EN : STYLE_ES;
}