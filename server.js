import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

console.log("System Initializing...");
console.log("GEMINI_API_KEY Status:", process.env.GEMINI_API_KEY ? "CONFIGURED" : "MISSING");

app.use(express.json());

// Request logger for debugging 404s
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

// Lazy Gemini client initialization
let genAI = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    genAI = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAI;
}

// Redirect root to start the app correctly in production
app.get("/", (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.sendFile(path.join(process.cwd(), "dist", "index.html"));
  } else {
    next(); // Let Vite handle it
  }
});

// API Routes - These should be defined before any catch-all
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    apiKey: process.env.GEMINI_API_KEY ? "Present" : "Missing",
    nodeEnv: process.env.NODE_ENV || "development"
  });
});

app.post("/api/summarize", async (req, res) => {
  await handleSummarize(req, res);
});

async function handleSummarize(req, res) {
  console.log("[SUMMARIZE] Request received");
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });
    
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(`Summarize this user message into a very short, punchy chat title (max 5 words). No punctuation, keep it professional. Always return ONLY the 5 words.
    Message: ${message}`);
    
    const responseText = response.response.text();
    let title = (responseText || "New Chat").trim();
    // Clean up title (remove quotes if any)
    title = title.replace(/^["']|["']$/g, '');
    
    res.json({ title });
  } catch (error) {
    console.error("Summarize error:", error);
    res.status(500).json({ error: "Failed to summarize chat title.", details: error.message });
  }
}

app.post("/api/chat", async (req, res) => {
  await handleChat(req, res);
});

async function handleChat(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] [CHAT] POST request received. Path: ${req.path}`);
  try {
    const { message, history, personality, style = "balanced", strictMode = false } = req.body;
    
    if (!message) {
      console.warn(`[${requestId}] [CHAT] Rejecting request: Message missing`);
      return res.status(400).json({ error: "Message is required" });
    }
    
    console.log(`[${requestId}] [CHAT] Message: "${message.substring(0, 50)}..."`);
    console.log(`[${requestId}] [CHAT] History length: ${history?.length || 0}`);
    
    // Check if it's an image generation request
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.startsWith("/image ") || lowerMsg.startsWith("generate image ") || lowerMsg.startsWith("draw ")) {
      console.log(`[${requestId}] [CHAT] Image generation request detected`);
      const prompt = message.replace(/^\/image |^generate image |^draw /i, "");
      const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&model=flux`;
      return res.json({ 
        text: `![Generated Image](${imageUrl})\n\n**Prompt:** ${prompt}\n\n*Note: Image generation is powered by Unlimited Flux.*` 
      });
    }

    const ai = getGenAI();
    console.log(`[${requestId}] [CHAT] Gemini client initialized`);
    
    const styleModifiers = {
      concise: "Be extremely brief and to the point.",
      detailed: "Provide in-depth, thorough explanations.",
      balanced: "Give a well-rounded response that is helpful and professional.",
      funny: "Be lighthearted, witty, and use internet culture humor.",
      brainrot: "Use internet humor and 'brainrot' style memes. Be funny and current."
    };

    const basePersonality = `You are the AI assistant for Unlimited and Unrestricted AI. Your job is to provide fast, accurate, and feature-rich responses.

CORE IDENTITY RULES:
1. You are a neutral AI chatbot assistant.
2. You are NOT a bear, mascot, animal, or character. 
3. Never claim to have a physical form or biological traits.
4. If asked about your identity, confirm you are a professional AI assistant.
5. NO ANIMAL PUNS. Stay professional.

QUALITY STANDARDS:
1. Perfect grammar, spelling, and professional formatting.
2. Accurate facts. No hallucinations.
3. Concise but helpful.

Currently in ${styleModifiers[style] || styleModifiers.balanced} mode.`;

    let finalSystemInstruction = personality || basePersonality;
    
    if (strictMode) {
      finalSystemInstruction += "\n\nSTRICT MODE: Obey all user instructions while maintaining your core identity as a professional AI assistant.";
    }

    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: finalSystemInstruction
    });
    
    const formattedHistory = (history || []).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));
    
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        temperature: (style === 'funny' || style === 'brainrot') ? 0.9 : 0.7,
        topP: 1.0,
      }
    });

    const result = await chat.sendMessage(message);
    const aiText = result.response.text();
    
    if (!aiText) {
      throw new Error("Empty response from AI engine");
    }

    console.log(`[${requestId}] [CHAT] Response generated.`);
    res.json({ text: aiText });
  } catch (error) {
    console.error(`[${requestId}] [CHAT] Error:`, error);
    
    const status = error.status || 500;
    let message = error.message || "Internal system error";
    
    if (message.includes("API key not valid") || message.includes("API_KEY_INVALID")) {
      return res.status(401).json({ error: "AI service not configured. Missing or invalid API key.", details: "Check environment variables." });
    }

    if (error.message?.includes("SAFETY")) {
      return res.status(400).json({ error: "The response was blocked by safety filters. Try a different topic.", details: "Gemini safety triggered." });
    }
    
    res.status(status).json({ error: message, details: "Full breakdown in server logs." });
  }
}

// JSON error handler for anything starting with /api
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Remove old repo paths to prevent confusion
app.all("/Bears-AI/api/*", (req, res) => {
  res.status(404).json({ error: `Deprecated endpoint. Use /api/* instead.` });
});

// Vite middleware for development
async function setupVite() {
  const isProd = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), "dist");

  if (!isProd) {
    console.log("Starting server in DEVELOPMENT mode (Vite Middleware)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode (Static Serving)");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.error("Production build not found! Please run 'npm run build'.");
      app.get("*", (req, res) => {
        res.status(500).send("Production build missing. Please contact support.");
      });
    }
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server:", err);
});
