package com.example.wordcomplet

import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class DeepSeekApi(private val apiKey: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val baseUrl = "https://api.openai.com/v1/chat/completions"
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val wordCache = LinkedHashMap<String, List<String>>(30, 0.75f, true)

    private val models = listOf("gpt-4.1-nano", "gpt-4o-mini")
    var lastError: String? = null
        private set

    fun clearCache() {
        wordCache.clear()
    }

    data class Message(val role: String, val content: String)
    data class ChatRequest(
        val model: String,
        val messages: List<Message>,
        val temperature: Double = 0.8,
        val max_tokens: Int = 150
    )
    data class Choice(val message: Message)
    data class ChatResponse(val choices: List<Choice>)

    private fun callApi(messages: List<Message>, temp: Double = 0.8, tokens: Int = 150): String? {
        for (model in models) {
            try {
                val request = ChatRequest(model = model, messages = messages, temperature = temp, max_tokens = tokens)
                val body = gson.toJson(request).toRequestBody(jsonMediaType)
                val httpRequest = Request.Builder()
                    .url(baseUrl)
                    .addHeader("Authorization", "Bearer $apiKey")
                    .post(body)
                    .build()
                val response = client.newCall(httpRequest).execute()
                val responseBody = response.body?.string() ?: continue
                if (!response.isSuccessful) {
                    try {
                        val err = gson.fromJson(responseBody, JsonObject::class.java)
                        lastError = "[$model] ${err.getAsJsonObject("error")?.get("message")?.asString ?: response.code.toString()}"
                    } catch (e: Exception) {
                        lastError = "[$model] HTTP ${response.code}"
                    }
                    continue
                }
                lastError = null
                val chatResponse = gson.fromJson(responseBody, ChatResponse::class.java)
                return chatResponse.choices.firstOrNull()?.message?.content?.trim()
            } catch (e: Exception) {
                lastError = "[$model] ${e.message}"
                continue
            }
        }
        return null
    }

    // Pools de palabras organizados por prioridad segun contexto
    private val acciones = listOf("quiero","necesito","pon","apaga","enciende","recoge","compra","llama","deja","trae","lleva","abre","cierra","sube","baja","mira","dame","espera","para","ven","sal","entra","limpia","friega","cocina","plancha","tiende","dobla","guarda","saca","busca","coge","suelta","mueve","cambia","prepara","pide","paga","corta","mezcla","hierve","calienta","enfría","ordena","barre","aspira","riega","pasea","baña","viste","peina","despierta","acuesta","sienta","levanta","cuelga","descuelga","enchufa","desenchufa","reserva","cancela","confirma","avisa","pregunta","contesta","escribe","lee","canta","juega","dibuja")
    private val objetos = listOf("tele","luz","ropa","comida","cena","coche","puerta","ventana","platos","basura","agua","leche","pan","café","mesa","silla","cama","baño","ducha","llave","móvil","bolsa","dinero","lavadora","horno","micro","nevera","armario","cajón","toalla","manta","almohada","sábana","cortina","espejo","lámpara","enchufe","mando","cargador","wifi","aire","calefacción","grifo","fregadero","escoba","aspiradora","plancha","tendedero","perchero","estante","sofá","alfombra","cubo","bayeta","jabón","champú","pasta","arroz","verdura","fruta","carne","pescado","huevos","aceite","sal","azúcar","medicina","receta","factura","carta","paquete","regalo","juguete","libro","periódico","gafas","paraguas","abrigo","zapatos","llaves","cartera","mochila")
    private val tiempos = listOf("hoy","mañana","ahora","luego","ya","después","antes","tarde","pronto","rápido","despacio","siempre","nunca","otra","vez","ayer","noche","mediodía","temprano","enseguida","todavía","mientras","cuando","lunes","martes","fin","semana","mes","hora","minuto","segundo")
    private val respuestas = listOf("no","sí","vale","bien","mal","mucho","poco","más","menos","todo","nada","también","tampoco","claro","venga","genial","fatal","perfecto","imposible","fácil","difícil","mejor","peor","igual","bastante","demasiado","suficiente","justo","exacto","obvio","seguro","quizás","depende","verdad","mentira","gracias","perdón","disculpa","porfa","ojalá")
    private val personas = listOf("niños","mamá","papá","hijo","hija","hermano","hermana","abuelo","abuela","vecino","amigo","amiga","jefe","médico","profesor","bebé","perro","gato","familia","primo","prima","tío","tía","suegra","suegro","cuñado","novio","novia","compañero","fontanero","electricista","cartero")
    private val lugares = listOf("casa","cocina","salón","habitación","garaje","jardín","tienda","cole","trabajo","hospital","parque","calle","plaza","super","farmacia","banco","bar","restaurante","cine","gimnasio","piscina","playa","montaña","pueblo","ciudad","centro","mercado","panadería","carnicería","frutería","peluquería","dentista","veterinario","correos","comisaría","aeropuerto","estación","gasolinera","taller","iglesia")
    private val estados = listOf("cansado","hambre","sed","frío","calor","sueño","dolor","fiebre","enfermo","contento","triste","enfadado","nervioso","tranquilo","aburrido","ocupado","libre","listo","sucio","limpio","roto","nuevo","viejo","grande","pequeño","lleno","vacío","abierto","cerrado","encendido","apagado","mojado","seco","crudo","hecho","quemado","congelado","caducado","caro","barato")

    suspend fun getNextWords(currentText: String, lastWords: List<String>): List<String> {
        wordCache[currentText]?.let { return it }

        return withContext(Dispatchers.IO) {
            val used = lastWords.toSet()

            // 1. Pedir ~40 a la API (las mas probables, ordenadas)
            val apiWords = mutableListOf<String>()
            val noRepeat = if (lastWords.isNotEmpty()) {
                " Evita: ${lastWords.takeLast(8).joinToString(",")}"
            } else ""

            val prompt = if (currentText.isBlank()) {
                "Una persona coge el móvil para decirle algo a alguien. ¿Qué quiere decir? Predice las 40 palabras más probables con las que empezaría su idea. Piensa: ¿qué mensajes envía la gente más? Peticiones, avisos, preguntas, planes, estados. Ordena de más probable a menos. Solo palabras sueltas separadas por comas.$noRepeat"
            } else {
                "Una persona está escribiendo un mensaje y ha puesto: \"$currentText\". PREDICE qué idea quiere transmitir. ¿Qué palabra pondría AHORA para completar su pensamiento lo más rápido posible? Dame 40 palabras ordenadas de más probable a menos. Piensa en las 5-10 frases completas más probables que querría decir y dame las palabras clave que las completarían. Solo comas.$noRepeat"
            }

            val content = callApi(listOf(Message("user", prompt)))
            if (content != null) {
                apiWords.addAll(
                    content.split(",")
                        .map { it.trim().replace("\"", "").replace(".", "").replace("\n", "").lowercase() }
                        .filter { w -> w.isNotBlank() && w.length in 2..14 && !w.contains("  ") && w !in used }
                        .distinct()
                )
            }

            // 2. Completar con defaults contextuales hasta 200
            val defaults = getContextualDefaults(currentText, used + apiWords.toSet())
            val combined = apiWords + defaults

            val result = combined.distinct().take(200)
            wordCache[currentText] = result
            if (wordCache.size > 25) wordCache.remove(wordCache.keys.first())
            result
        }
    }

    private fun getContextualDefaults(currentText: String, used: Set<String>): List<String> {
        val prioritized = when {
            currentText.isBlank() -> acciones + objetos + tiempos + respuestas + estados + personas + lugares
            acciones.any { currentText.contains(it) } -> objetos + tiempos + lugares + respuestas + estados + personas + acciones
            objetos.any { currentText.contains(it) } -> acciones + tiempos + respuestas + lugares + estados + personas + objetos
            tiempos.any { currentText.contains(it) } -> acciones + objetos + respuestas + estados + personas + lugares + tiempos
            else -> acciones + objetos + tiempos + respuestas + estados + personas + lugares
        }
        return prioritized.filter { it !in used }.distinct()
    }

    suspend fun polishText(rawWords: List<String>): String {
        if (rawWords.size < 2) return rawWords.joinToString(" ")
        return withContext(Dispatchers.IO) {
            val rawText = rawWords.joinToString(" ")
            val content = callApi(
                listOf(Message("user",
                    "Una persona seleccionó estas palabras para transmitir una idea: \"$rawText\". Interpreta su INTENCIÓN real. ¿Qué mensaje quería enviar? Escríbelo como un WhatsApp natural y corto. Usa las palabras como pistas de su idea, reordena si hace falta. SOLO el mensaje."
                )),
                temp = 0.2,
                tokens = 100
            )
            content ?: rawText
        }
    }
}
