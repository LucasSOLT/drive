import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ElevenLabs Proxy
  app.post("/api/tts", async (req, res) => {
    const { text, voiceId, stability, similarity_boost, style, use_speaker_boost } = req.body;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "ELEVENLABS_API_KEY is not set" });
    }

    try {
      // Using the with-timestamps endpoint for word-level highlighting
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || process.env.ELEVENLABS_VOICE_ID || 'F1QAmjRIjqM9llULermx'}/with-timestamps`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: stability ?? 0.5,
              similarity_boost: similarity_boost ?? 0.75,
              style: style ?? 0.0,
              use_speaker_boost: use_speaker_boost ?? true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }

      const data = await response.json();
      // data contains { audio_base64: string, alignment: { characters: string[], character_start_times_seconds: number[], character_end_times_seconds: number[] } }
      res.json(data);
    } catch (error) {
      console.error("ElevenLabs API Error:", error);
      res.status(500).json({ error: "Failed to fetch from ElevenLabs" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
