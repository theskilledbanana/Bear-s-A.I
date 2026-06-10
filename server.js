import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API Routes FIRST
app.post("/api/chat", async (req, res) => {
  // ... (keep existing API implementation)
  try {
    const { message, history, personality, botName = "Bear" } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });
    const ai = getGenAI();
    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash", 
      input: message,
      system_instruction: personality || `You are '${botName}', an epic, witty, and slightly chaotic digital companion.`,
      generation_config: { temperature: 0.8, top_p: 0.9 },
      previous_interaction_id: history && history.length > 0 ? history[history.length - 1].interactionId : undefined
    });
    let fullOutput = "";
    for (const step of interaction.steps) {
      if (step.type === 'model_output') {
        const textContent = step.content?.find(c => c.type === 'text');
        if (textContent && textContent.text) fullOutput += textContent.text;
      }
    }
    res.json({ text: fullOutput || interaction.output_text || "", interactionId: interaction.id });
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(error.status || 500).json({ error: error.message || "Internal system error" });
  }
});

// Lazy Gemini client initialization
let genAI = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode (Vite Middleware)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom", // Use 'custom' to handle index.html manually for more control
    });
    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        // Only serve index.html for non-API, non-asset routes
        if (url.startsWith('/api') || url.includes('.')) {
          return next();
        }
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    console.log("Starting server in PRODUCTION mode (Static Serving)");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server:", err);
});
