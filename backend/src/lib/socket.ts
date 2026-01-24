import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

export function initializeSocket(httpServer: HttpServer, allowedOrigins: string[]) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log('Socket connected:', socket.id);

    // Student joins their session room
    socket.on('student:join-room', ({ sessionId, studentId }) => {
      socket.join(`session:${sessionId}`);
      socket.join(`student:${studentId}`);
      console.log(`Student ${studentId} joined session ${sessionId}`);
    });

    // Teacher joins their sessions
    socket.on('teacher:join-room', ({ sessionId }) => {
      socket.join(`session:${sessionId}:teacher`);
      console.log(`Teacher joined session ${sessionId}`);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

// Emit to specific student
export function emitToStudent(studentId: string, event: string, data: any) {
  io?.to(`student:${studentId}`).emit(event, data);
}

// Emit to session teachers
export function emitToSessionTeacher(sessionId: string, event: string, data: any) {
  io?.to(`session:${sessionId}:teacher`).emit(event, data);
}

// Emit to entire session (all students)
export function emitToSession(sessionId: string, event: string, data: any) {
  io?.to(`session:${sessionId}`).emit(event, data);
}
