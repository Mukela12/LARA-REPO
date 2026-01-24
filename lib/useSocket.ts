// React hook for WebSocket events
import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket } from './socket';
import { FeedbackSession } from '../types';

export interface FeedbackReadyPayload {
  studentId: string;
  feedback: FeedbackSession;
  masteryConfirmed: boolean;
  status: string;
}

export function useStudentSocket(
  sessionId: string | null,
  studentId: string | null,
  onFeedbackReady: (payload: FeedbackReadyPayload) => void
) {
  // Use ref to track the callback to avoid reconnecting on callback changes
  const callbackRef = useRef(onFeedbackReady);
  callbackRef.current = onFeedbackReady;

  useEffect(() => {
    if (!sessionId || !studentId) return;

    const socket = connectSocket();

    // Join room
    socket.emit('student:join-room', { sessionId, studentId });

    // Listen for feedback
    const handleFeedbackReady = (payload: FeedbackReadyPayload) => {
      callbackRef.current(payload);
    };

    socket.on('feedback-ready', handleFeedbackReady);

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Socket connected, rejoining room');
      socket.emit('student:join-room', { sessionId, studentId });
    });

    return () => {
      socket.off('feedback-ready', handleFeedbackReady);
      socket.off('connect');
      disconnectSocket();
    };
  }, [sessionId, studentId]);
}

export interface StudentSubmittedPayload {
  studentId: string;
  studentName: string;
  timestamp: number;
}

export function useTeacherSocket(
  sessionId: string | null,
  onStudentSubmitted?: (payload: StudentSubmittedPayload) => void
) {
  // Use ref to track the callback to avoid reconnecting on callback changes
  const callbackRef = useRef(onStudentSubmitted);
  callbackRef.current = onStudentSubmitted;

  useEffect(() => {
    if (!sessionId) return;

    const socket = connectSocket();

    // Join teacher room
    socket.emit('teacher:join-room', { sessionId });

    // Listen for student submissions
    const handleStudentSubmitted = (payload: StudentSubmittedPayload) => {
      callbackRef.current?.(payload);
    };

    socket.on('student-submitted', handleStudentSubmitted);

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Socket connected, rejoining teacher room');
      socket.emit('teacher:join-room', { sessionId });
    });

    return () => {
      socket.off('student-submitted', handleStudentSubmitted);
      socket.off('connect');
      disconnectSocket();
    };
  }, [sessionId]);
}
