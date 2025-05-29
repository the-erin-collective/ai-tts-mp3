# AI TTS MP3 Generator

A modern Angular-based Text-to-Speech (TTS) application that converts text to high-quality audio using AI providers like OpenAI. Built with Angular 20+ and featuring advanced storage capabilities.

## Features

- 🎯 High-quality AI-powered text-to-speech conversion
- 💾 Dual storage support:
  - File System Access API for persistent storage
  - LocalStorage fallback for broader compatibility
- 📱 Modern, responsive UI with light/dark themes
- 📚 History management with audio playback

## Requirements

- Node.js 18.x or later
- NPM 9.x or later
- Modern web browser with File System Access API support (for enhanced storage features)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-tts-mp3.git
cd ai-tts-mp3
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:4200`

## Build

- For production:
```bash
npm run build
```

- For GitHub Pages:
```bash
npm run build:github-pages
```

- For static hosting:
```bash
npm run build:static
```

## Storage Options

### File System Storage
- Enables persistent storage of audio files in a user-selected folder
- Requires modern browser support

### LocalStorage Fallback
- Automatic fallback when File System Access API is not available
- 20MB storage limit
- Works in all modern browsers

## Development

### Project Structure
- `/src/common` - Shared utilities and common types
- `/src/domain` - Core domain entities and interfaces
- `/src/enactment` - Application services and business logic orchestration
- `/src/infrastructure` - Implementation of storage and TTS providers
- `/src/integration` - Integration services and Angular-specific adapters
- `/src/presentation` - Angular components and UI

### Available Scripts
- `npm start` - Start development server
- `npm run build` - Production build
- `npm run watch` - Development build with watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues automatically

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/new-voice-provider`)
3. Commit your changes (`git commit -m 'Add some new-voice-provider'`)
4. Push to the branch (`git push origin feature/new-voice-provider`)
5. Open a Pull Request

## License

This project is licensed under the terms of the AGPL v3 license, the full license is in the license file in the root directory.