# Word Complet - The Reverse AI Keyboard

**Stop typing. Start thinking.**

Word Complet flips how we write on phones. Instead of typing letter by letter, AI predicts what you **want to say** and shows you complete words to tap. You just tap-tap-tap your idea, and AI assembles the perfect message.

## The Problem

Typing on a phone is slow, tedious, and boring. SwiftKey and other keyboards predict the **next word** — but you still type letter by letter. We're in 2026 and still pecking at tiny letters like it's 2007.

## The Solution

Word Complet uses **reverse AI generation**. Instead of AI generating text, AI predicts your **intention** — what idea you want to transmit — and gives you the words to build it as fast as possible.

### How it works

1. You see ~200 predicted words on screen, ordered by probability
2. Tap the words that match your idea (e.g., `turn off` `TV` `now`)
3. AI interprets your intention and writes the natural message: *"Turn off the TV now, please"*
4. You can tap multiple words rapidly — words stay on screen, no reload needed
5. After you pause, AI refreshes predictions based on your evolving idea

### The key insight

Traditional keyboards: **you write** → AI corrects
Word Complet: **AI predicts your idea** → you confirm with taps

It's like the AI is reading your mind. You transmit complete ideas faster than any keyboard because you never type a single letter.

## Features

- **Reverse AI prediction**: AI doesn't suggest next words — it predicts your entire intention
- **200 words on screen**: Scrollable grid, most probable words first
- **Multi-tap**: Tap several words rapidly without waiting for reload
- **Smart polish**: AI interprets disordered words and writes the natural message
- **Regenerate**: Don't see what you need? One tap for fresh predictions
- **Context-aware**: Each word you tap reshapes predictions for your evolving idea
- **Offline fallback**: ~300 contextual words available without internet
- **Dark UI**: Clean, distraction-free interface

## Architecture

- **Android** native app (Kotlin)
- **OpenAI API** (gpt-4.1-nano) for word prediction and message polishing
- **OkHttp** for API calls
- **Kotlin Coroutines** for async operations
- **Material Design** chips for word display

## Build

```bash
./gradlew assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`

## Vision

This is not a keyboard replacement — it's a **communication paradigm shift**. The future of mobile text input isn't faster typing. It's not typing at all.

Imagine: people with motor disabilities communicating at full speed. Elderly people sending messages without struggling with tiny keys. Anyone transmitting complex ideas with 5 taps instead of 50 keystrokes.

**Word Complet: Write at the speed of thought.**

## License

MIT
