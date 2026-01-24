# LARA - Learning Assessment & Response Assistant

A real-time classroom feedback system that helps teachers provide AI-generated, personalized feedback to students.

## Features

- **Real-time Feedback**: Students receive feedback instantly via WebSocket when teachers approve it
- **AI-Powered Feedback Generation**: Uses Claude AI to generate personalized feedback based on student submissions
- **Teacher Dashboard**: Monitor student progress, generate and review feedback in real-time
- **Student Flow**: Simple task code entry, work submission, and feedback viewing
- **Task Management**: Create, organize, and manage tasks with folders

## Architecture

```
Frontend (React + Vite)          Backend (Express + Socket.io)
├── Student Entry               ├── REST API Routes
├── Teacher Dashboard           ├── WebSocket Server
├── Real-time Updates ◄────────►├── Redis (session cache)
└── Socket.io Client            └── PostgreSQL (persistence)
```

## Prerequisites

- Node.js >= 20.19.0
- PostgreSQL database
- Redis (optional, for session caching)
- Anthropic API key (for AI feedback generation)

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5173
PORT=3001
```

### Frontend (`.env.local`)
```
VITE_API_URL=http://localhost:3001
```

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   cd backend && npm install
   ```

2. Set up environment variables (see above)

3. Run the backend:
   ```bash
   cd backend && npm run dev
   ```

4. Run the frontend (in a new terminal):
   ```bash
   npm run dev
   ```

## Deployment

The app is configured for Railway deployment:

- **Backend**: Deploys from `backend/` directory
- **Frontend**: Deploys from root directory (Vite build)

## WebSocket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `student:join-room` | Client → Server | Student joins session room |
| `teacher:join-room` | Client → Server | Teacher joins session room |
| `feedback-ready` | Server → Client | Notify student feedback is approved |
| `student-submitted` | Server → Client | Notify teacher of new submission |

## License

ISC
