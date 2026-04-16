# Word Complet

**El teclado AI inverso. Deja de teclear letra a letra.**

👉 **[Pruébalo ahora en gamogestionweb.github.io/word-complet](https://gamogestionweb.github.io/word-complet/)**

---

## La idea

Llevamos veinte años tecleando letra por letra en una pantalla de cristal. Los autocorrectores predicen **la siguiente letra**. Los teclados predictivos predicen **la siguiente palabra**. Pero seguimos pulsando letra a letra como si fuese 2007.

**Word Complet le da la vuelta.** En tu pantalla aparecen **32 palabras o expresiones** que una IA cree que puedes querer decir. Tú pulsas las que encajan con tu idea. Tras dos o tres taps, la IA te devuelve la frase completa, natural, escrita.

No es corrección. No es sugerencia. Es **predicción inversa**: la IA lee tu intención, tú confirmas con un tap.

```
Pantalla:   [hola]  [necesito]  [te aviso]  [luego]  [gracias]  ...
Tú tocas:   necesito → ordenar → casa → ahora
IA escribe: "Necesito ordenar la casa ahora, gracias."
```

Cada idea que tenías en la cabeza sale por el móvil en segundos, no en minutos. Personas con movilidad reducida, mayores que sufren con los teclados diminutos, o cualquiera que quiera comunicar una idea a la velocidad a la que la piensa: esto es para vosotros.

---

## Probarlo

**Online** — nada que instalar: <https://gamogestionweb.github.io/word-complet/>

Abre la URL en el móvil y toca **Compartir → Añadir a pantalla de inicio** para usarla como app nativa (iPhone y Android).

---

## ¿Cómo funciona por dentro?

- **Frontend**: HTML/CSS/JavaScript puro. Sin frameworks, sin build step.
- **Modelo**: `gpt-5.4-nano` (con fallback automático a `gpt-4.1-nano` y `gpt-4o-mini`).
- **Prompt de sistema** estable en cada llamada: le explica al modelo que su rol es *motor de predicción*, no asistente de chat. El texto puede ser mensaje, nota, email formal, lista o cualquier otra cosa — el modelo adapta el registro.
- **Cache LRU** de 25 contextos en memoria del navegador, para que pulsar la misma secuencia dos veces no repita la llamada.
- **Fallback offline**: ~400 palabras en español en 7 categorías temáticas, que aparecen si la IA cae o no hay API key.

El código del cliente está en [`docs/`](./docs) y se sirve directamente desde GitHub Pages.

## Estructura del repo

```
word-complet/
├── docs/                      ← GitHub Pages (la app en producción)
│   ├── index.html             ← Landing + UI
│   ├── style.css
│   ├── app.js                 ← Estado, render, debounces, AbortControllers
│   ├── api-client.js          ← Cliente OpenAI (prompts, cache LRU, fallback)
│   ├── config.js              ← API key + lista de modelos
│   ├── word-pools.js          ← Pools offline en español
│   ├── manifest.webmanifest
│   ├── sw.js                  ← Service worker (cache del shell)
│   └── icons/
├── README.md
└── LICENSE
```

## Correr en local

Cualquier servidor estático vale:

```bash
cd docs
python3 -m http.server 8000
# luego abre http://localhost:8000
```

O si tienes Node:

```bash
npx serve docs
```

---

## API key

La API key vive en [`docs/config.js`](./docs/config.js) y se ejecuta en el navegador del visitante. Cualquiera con DevTools puede leerla. Mitigaciones que recomendamos encarecidamente a quien clone esto:

1. Crear un **proyecto aislado** en [platform.openai.com](https://platform.openai.com/organization/projects) con **límite de gasto mensual** (p. ej. 5 €).
2. Restringir los modelos permitidos a: `gpt-5.4-nano`, `gpt-4.1-nano`, `gpt-4o-mini`.
3. Rotar la key si el gasto se dispara. Borrar la key hace que la app caiga al pool offline — sigue funcionando, solo que sin IA.

## Accesibilidad e intención

Word Complet nace con una idea fuerte en mente: la próxima generación de interfaces no será más rápida tecleando. Será *no tecleando*. Ayudar a comunicar ideas completas con 5 taps en lugar de 50 pulsaciones — especialmente a quien hoy pelea con los teclados — es el objetivo.
Si eres capaz de hacer escalar ésta tecnología RÓBAMELA, yo creo para que el mundo avance y el permitir expresar ideas en vez de tecla a tecla es algo que será épico en breve periodo de tiempo, y la gente dejará la interfaz teclado por interfaz palabra.

## Licencia

MIT — ver [LICENSE](./LICENSE).
