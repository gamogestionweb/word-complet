// Word pools — Spanish fallback used when OpenAI is unreachable.
// Ported verbatim from the original Android DeepSeekApi.kt:76-83.

export const ACCIONES = ["quiero","necesito","pon","apaga","enciende","recoge","compra","llama","deja","trae","lleva","abre","cierra","sube","baja","mira","dame","espera","para","ven","sal","entra","limpia","friega","cocina","plancha","tiende","dobla","guarda","saca","busca","coge","suelta","mueve","cambia","prepara","pide","paga","corta","mezcla","hierve","calienta","enfría","ordena","barre","aspira","riega","pasea","baña","viste","peina","despierta","acuesta","sienta","levanta","cuelga","descuelga","enchufa","desenchufa","reserva","cancela","confirma","avisa","pregunta","contesta","escribe","lee","canta","juega","dibuja"];

export const OBJETOS = ["tele","luz","ropa","comida","cena","coche","puerta","ventana","platos","basura","agua","leche","pan","café","mesa","silla","cama","baño","ducha","llave","móvil","bolsa","dinero","lavadora","horno","micro","nevera","armario","cajón","toalla","manta","almohada","sábana","cortina","espejo","lámpara","enchufe","mando","cargador","wifi","aire","calefacción","grifo","fregadero","escoba","aspiradora","plancha","tendedero","perchero","estante","sofá","alfombra","cubo","bayeta","jabón","champú","pasta","arroz","verdura","fruta","carne","pescado","huevos","aceite","sal","azúcar","medicina","receta","factura","carta","paquete","regalo","juguete","libro","periódico","gafas","paraguas","abrigo","zapatos","llaves","cartera","mochila"];

export const TIEMPOS = ["hoy","mañana","ahora","luego","ya","después","antes","tarde","pronto","rápido","despacio","siempre","nunca","otra","vez","ayer","noche","mediodía","temprano","enseguida","todavía","mientras","cuando","lunes","martes","fin","semana","mes","hora","minuto","segundo"];

export const RESPUESTAS = ["no","sí","vale","bien","mal","mucho","poco","más","menos","todo","nada","también","tampoco","claro","venga","genial","fatal","perfecto","imposible","fácil","difícil","mejor","peor","igual","bastante","demasiado","suficiente","justo","exacto","obvio","seguro","quizás","depende","verdad","mentira","gracias","perdón","disculpa","porfa","ojalá"];

export const PERSONAS = ["niños","mamá","papá","hijo","hija","hermano","hermana","abuelo","abuela","vecino","amigo","amiga","jefe","médico","profesor","bebé","perro","gato","familia","primo","prima","tío","tía","suegra","suegro","cuñado","novio","novia","compañero","fontanero","electricista","cartero"];

export const LUGARES = ["casa","cocina","salón","habitación","garaje","jardín","tienda","cole","trabajo","hospital","parque","calle","plaza","super","farmacia","banco","bar","restaurante","cine","gimnasio","piscina","playa","montaña","pueblo","ciudad","centro","mercado","panadería","carnicería","frutería","peluquería","dentista","veterinario","correos","comisaría","aeropuerto","estación","gasolinera","taller","iglesia"];

export const ESTADOS = ["cansado","hambre","sed","frío","calor","sueño","dolor","fiebre","enfermo","contento","triste","enfadado","nervioso","tranquilo","aburrido","ocupado","libre","listo","sucio","limpio","roto","nuevo","viejo","grande","pequeño","lleno","vacío","abierto","cerrado","encendido","apagado","mojado","seco","crudo","hecho","quemado","congelado","caducado","caro","barato"];


/**
 * Returns default words ordered by best guess given the current context.
 * Port of DeepSeekApi.kt:124-133.
 */
export function contextualDefaults(currentText, usedSet) {
  const ct = (currentText || "").toLowerCase();
  let pools;
  if (!ct.trim()) {
    pools = [ACCIONES, OBJETOS, TIEMPOS, RESPUESTAS, ESTADOS, PERSONAS, LUGARES];
  } else if (ACCIONES.some(w => ct.includes(w))) {
    pools = [OBJETOS, TIEMPOS, LUGARES, RESPUESTAS, ESTADOS, PERSONAS, ACCIONES];
  } else if (OBJETOS.some(w => ct.includes(w))) {
    pools = [ACCIONES, TIEMPOS, RESPUESTAS, LUGARES, ESTADOS, PERSONAS, OBJETOS];
  } else if (TIEMPOS.some(w => ct.includes(w))) {
    pools = [ACCIONES, OBJETOS, RESPUESTAS, ESTADOS, PERSONAS, LUGARES, TIEMPOS];
  } else {
    pools = [ACCIONES, OBJETOS, TIEMPOS, RESPUESTAS, ESTADOS, PERSONAS, LUGARES];
  }
  const out = [];
  const seen = new Set();
  for (const pool of pools) {
    for (const w of pool) {
      if (usedSet.has(w) || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}
