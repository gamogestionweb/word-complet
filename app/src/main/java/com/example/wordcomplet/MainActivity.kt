package com.example.wordcomplet

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {

    private lateinit var tvPolishedText: TextView
    private lateinit var tvRawWords: TextView
    private lateinit var chipGroup: ChipGroup
    private lateinit var progressBar: ProgressBar
    private lateinit var scrollText: ScrollView

    private val api = DeepSeekApi(BuildConfig.OPENAI_API_KEY)
    private val selectedWords = mutableListOf<String>()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var polishJob: Job? = null
    private var refreshJob: Job? = null

    private val chipBg = ColorStateList.valueOf(0xFF1A1A36.toInt())
    private val chipBgUsed = ColorStateList.valueOf(0xFF0D0D1A.toInt())
    private val textColor = 0xFFEEEEFF.toInt()
    private val textColorUsed = 0x44FFFFFF

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvPolishedText = findViewById(R.id.tvPolishedText)
        tvRawWords = findViewById(R.id.tvRawWords)
        chipGroup = findViewById(R.id.chipGroupWords)
        progressBar = findViewById(R.id.progressBar)
        scrollText = findViewById(R.id.scrollText)

        findViewById<ImageButton>(R.id.btnUndo).setOnClickListener { undoLastWord() }
        findViewById<ImageButton>(R.id.btnClear).setOnClickListener { clearAll() }
        findViewById<ImageButton>(R.id.btnCopy).setOnClickListener { copyText() }
        findViewById<ImageButton>(R.id.btnRefresh).setOnClickListener { regenerateWords() }

        loadWords()
    }

    private fun onWordSelected(chip: Chip, word: String) {
        selectedWords.add(word)
        updateRawWordsDisplay()
        tvPolishedText.text = selectedWords.joinToString(" ")
        scrollText.post { scrollText.fullScroll(View.FOCUS_DOWN) }

        // Marcar chip como usada visualmente
        chip.chipBackgroundColor = chipBgUsed
        chip.setTextColor(textColorUsed)
        chip.isClickable = false

        // Programar recarga de palabras (espera a que dejes de pulsar)
        scheduleRefresh()
        schedulePolish()
    }

    private fun scheduleRefresh() {
        refreshJob?.cancel()
        refreshJob = scope.launch {
            delay(1500) // Si no pulsas en 1.5s, recarga con nuevo contexto
            loadWords()
        }
    }

    private fun loadWords() {
        refreshJob?.cancel()
        progressBar.visibility = View.VISIBLE

        scope.launch {
            val ctx = selectedWords.joinToString(" ")
            val words = api.getNextWords(ctx, selectedWords)
            progressBar.visibility = View.GONE

            api.lastError?.let { error ->
                Toast.makeText(this@MainActivity, "API: $error", Toast.LENGTH_LONG).show()
            }

            displayWords(words)
        }
    }

    private fun displayWords(words: List<String>) {
        chipGroup.removeAllViews()
        for (word in words) {
            val chip = Chip(this).apply {
                text = word
                textSize = 24f
                isClickable = true
                isCheckable = false
                chipBackgroundColor = chipBg
                setTextColor(textColor)
                chipStrokeWidth = 0.5f
                chipStrokeColor = ColorStateList.valueOf(0x22FFFFFF)
                chipCornerRadius = 14f
                chipMinHeight = 58f
                chipStartPadding = 16f
                chipEndPadding = 16f
                setOnClickListener { onWordSelected(this, word) }
            }
            chipGroup.addView(chip)
        }
    }

    private fun updateRawWordsDisplay() {
        tvRawWords.text = if (selectedWords.isEmpty()) "" else selectedWords.joinToString(" \u203A ")
    }

    private fun schedulePolish() {
        polishJob?.cancel()
        if (selectedWords.size < 2) return
        val now = selectedWords.size % 2 == 0
        polishJob = scope.launch {
            if (!now) delay(800)
            val polished = api.polishText(selectedWords)
            tvPolishedText.text = polished
            scrollText.post { scrollText.fullScroll(View.FOCUS_DOWN) }
        }
    }

    private fun undoLastWord() {
        if (selectedWords.isNotEmpty()) {
            selectedWords.removeAt(selectedWords.lastIndex)
            updateRawWordsDisplay()
            tvPolishedText.text = if (selectedWords.isEmpty()) {
                getString(R.string.hint_start)
            } else {
                selectedWords.joinToString(" ")
            }
            loadWords()
            if (selectedWords.size >= 2) schedulePolish()
        }
    }

    private fun clearAll() {
        selectedWords.clear()
        updateRawWordsDisplay()
        tvPolishedText.text = getString(R.string.hint_start)
        polishJob?.cancel()
        refreshJob?.cancel()
        loadWords()
    }

    private fun regenerateWords() {
        api.clearCache()
        loadWords()
    }

    private fun copyText() {
        val text = tvPolishedText.text.toString()
        if (text != getString(R.string.hint_start) && text.isNotBlank()) {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("WordComplet", text))
            Toast.makeText(this, R.string.text_copied, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
