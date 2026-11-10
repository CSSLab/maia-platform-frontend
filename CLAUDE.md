# CLAUDE.md - AI Assistant Guide

## Project Overview

This is the Maia Chess Platform Frontend - a sophisticated chess analysis and training application featuring human-like chess AI (Maia) alongside traditional Stockfish engine capabilities.

## Technology Stack

- **Next.js 15.1.6** with App Router
- **React 18.3.1** with TypeScript 5.1.6
- **Tailwind CSS 3.4.10** for styling
- **Stockfish WebAssembly** + **ONNX Runtime Web** for chess engines
- **Framer Motion** for animations
- **Recharts** for data visualization

## Essential Commands

### Development

```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint -- --fix # Run ESLint (ALWAYS run before committing)
npx tsc --noEmit     # Check TypeScript errors
```

## Project Structure

```
src/
├── api/             # API client functions organized by feature
├── components/      # UI components organized by domain
├── contexts/        # React Context providers
├── hooks/           # Custom React hooks (business logic)
├── pages/           # Next.js pages/routes
├── providers/       # Context provider wrappers
├── styles/          # Global styles and Tailwind config
├── types/           # TypeScript type definitions
├── lib/           # Utility functions
└── workers/         # Web Worker files
```

## Architecture Patterns

### State Management

- **Controller Hooks** for business logic (useAnalysisController, usePlayController, etc.)
- **React Context** for global state (AuthContext, ModalContext)
- **Presentational Components** that receive data via props

### Component Organization

- Organized by feature domain
- Barrel exports (index.ts files) for clean imports
- Absolute imports from `src/` (configured in tsconfig.json)

## Code Conventions

### TypeScript

- Strict TypeScript configuration
- Interface-based type definitions in `src/types/`
- Proper typing for all components and hooks

### Component Pattern

```typescript
interface Props {
  // Props definition
}

export const ComponentName = (props: Props) => {
  // Component implementation
}
```

### Hook Pattern

```typescript
export const useFeatureController = () => {
  // State and logic
  return {
    // Return interface
  }
}
```

## Chess Engine Integration

### Stockfish Engine

- WebAssembly integration via `@lichess-org/stockfish-web` (Stockfish 19, small net)
- Files in `public/stockfish/`
- Managed through `useStockfishEngine` hook

### Maia Engine

- ONNX neural network model
- Client-side inference using `onnxruntime-web`
- Multiple model variants (1100-1900 rating levels)
- Weights in `public/maia2/`

## API Structure

- Backend proxy to `https://dock2.csslab.ca/api/`
- Feature-based API organization in `src/api/`
- Type-safe API client functions
- Base URL: `/api/v1/`

## Theme System

- Responsive design with custom breakpoints with breakpoints: 3xl (1920px), 4xl (2560px) (and also mobile)

## Key Files for Understanding

1. `src/hooks/useAnalysisController/` - Core analysis logic
2. `src/components/Analysis/` - Analysis UI components
3. `src/types/` - Type definitions
4. `src/api/` - API client functions
5. `src/pages/` - Route definitions
6. `tailwind.config.js` - Styling configuration
7. `next.config.js` - Build configuration

## Development Workflow

- Feature branches for development
- ESLint and Prettier for code quality
- **IMPORTANT**: Always run `npm run lint` before committing
- Vercel integration for deployments
