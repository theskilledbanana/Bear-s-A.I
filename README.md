# ♾️ Unlimited & Unrestricted AI

Professional-grade AI intelligence with zero filters, no limits, and ChatGPT Pro features. Fully customizable, fast, and 100% free.

## 🚀 Key Features

- **Multi-Chat System**: Manage multiple independent conversations with auto-generated titles.
- **Image Generation**: Unrestricted image generation powered by Unlimited Flux.
- **Personality Control**: Set custom names and response styles (Concise, Detailed, Creative, Sarcastic).
- **Persistent Memory**: Your chats and settings are saved automatically to local storage.
- **Cinematic UI**: High-contrast, dark-mode-first design with smooth motion animations.
- **Quantum Fast**: Uses Gemini 1.5 Flash for near-instant, reliable responses.

## Getting Started

### Prerequisites

- Node.js (v18+)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   - Create a `.env` file in the root directory.
   - Add your Gemini API key:
     ```env
     GEMINI_API_KEY=your_api_key_here
     ```

### Running the App

To start the development server:
```bash
npm run dev
```

To build for production:
```bash
npm run build
npm start
```

## Technologies Used

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React, Motion
- **Backend**: Express (Node.js), @google/genai SDK
- **Development**: TypeScript, tsx, esbuild
