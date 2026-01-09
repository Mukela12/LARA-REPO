import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Student, Task, FeedbackSession, Submission, NextStep, Folder } from '../types';
import { generateUniqueTaskCode, saveTaskCodeMapping, getAllTaskCodes } from './taskCodes';

// Initial Mock Data
const INITIAL_TASKS: Task[] = [
  {
    id: 'default-task',
    title: 'Creative Writing 101: The Forest',
    prompt: 'Write a descriptive paragraph about walking through a mysterious forest. Focus on sensory details (sight, sound, smell).',
    successCriteria: [
      'Include at least 3 distinct sensory details',
      'Use strong adjectives',
      'Create a clear mood or atmosphere'
    ],
    universalExpectations: true,
    status: 'active',
    folderId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export interface AppState {
  tasks: Task[];
  students: Student[];
  submissions: Record<string, Submission>;
  currentTaskId: string;
  selectedNextStep: NextStep | null;
  folders: Folder[];
}

// Get storage key for a teacher (or demo mode)
function getStorageKey(teacherId?: string): string {
  if (!teacherId) {
    return 'lara-demo-store-v2'; // Demo mode
  }
  return `lara-teacher-${teacherId}`;
}

export function useAppStore(teacherId?: string) {
  const storageKey = getStorageKey(teacherId);

  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load store", e);
    }
    return {
      tasks: INITIAL_TASKS,
      students: [],
      submissions: {},
      currentTaskId: 'default-task',
      selectedNextStep: null,
      folders: []
    };
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  const addTask = (task: Task) => {
    // Ensure new required fields are set
    const now = new Date();
    const taskWithDefaults: Task = {
      ...task,
      status: task.status || 'active',
      createdAt: task.createdAt || now,
      updatedAt: task.updatedAt || now,
      folderId: task.folderId || null
    };

    // Generate unique task code if not provided
    if (!taskWithDefaults.taskCode) {
      const existingCodes = getAllTaskCodes(teacherId);
      const taskCode = generateUniqueTaskCode(Object.keys(existingCodes));
      taskWithDefaults.taskCode = taskCode;

      // Save the mapping
      saveTaskCodeMapping(teacherId, taskCode, taskWithDefaults.id);
    }

    setState(prev => ({
      ...prev,
      tasks: [taskWithDefaults, ...prev.tasks],
      currentTaskId: taskWithDefaults.id
    }));
  };

  const addStudent = (name: string): Student => {
    const newStudent: Student = {
      id: uuidv4(),
      name,
      status: 'active',
      joinedAt: Date.now()
    };
    setState(prev => ({
      ...prev,
      students: [...prev.students, newStudent]
    }));
    return newStudent;
  };

  const submitWork = (studentId: string, taskId: string, content: string, feedback: FeedbackSession, timeElapsed?: number) => {
    setState(prev => ({
      ...prev,
      students: prev.students.map(s => s.id === studentId ? { ...s, status: 'submitted' } : s),
      submissions: {
        ...prev.submissions,
        [studentId]: {
          studentId,
          taskId,
          content,
          feedback,
          timestamp: Date.now(),
          timeElapsed,
          revisionCount: 0
        }
      }
    }));
  };

  const approveFeedback = (studentId: string) => {
    setState(prev => ({
      ...prev,
      students: prev.students.map(s => s.id === studentId ? { ...s, status: 'feedback_ready' } : s)
    }));
  };

  const updateFeedback = (studentId: string, updatedFeedback: FeedbackSession) => {
    setState(prev => ({
      ...prev,
      submissions: {
        ...prev.submissions,
        [studentId]: {
          ...prev.submissions[studentId],
          feedback: updatedFeedback
        }
      }
    }));
  };

  const getStudentStatus = (studentId: string) => {
    const student = state.students.find(s => s.id === studentId);
    return student?.status;
  };

  const selectTask = (taskId: string) => {
    setState(prev => ({
      ...prev,
      currentTaskId: taskId
    }));
  };

  const resetDemo = () => {
    localStorage.removeItem(storageKey);
    window.location.reload();
  };

  const setSelectedNextStep = (step: NextStep | null) => {
    setState(prev => ({
      ...prev,
      selectedNextStep: step
    }));
  };

  const deactivateTask = (taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.id === taskId
          ? { ...task, status: 'inactive' as const, updatedAt: new Date() }
          : task
      )
    }));
  };

  const reactivateTask = (taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.id === taskId
          ? { ...task, status: 'active' as const, updatedAt: new Date() }
          : task
      )
    }));
  };

  const createFolder = (name: string, description?: string, color?: string): string => {
    const folder: Folder = {
      id: uuidv4(),
      name,
      description,
      color: color || '#3b82f6',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setState(prev => ({
      ...prev,
      folders: [...prev.folders, folder]
    }));

    return folder.id;
  };

  const moveTaskToFolder = (taskId: string, folderId: string | null) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.id === taskId
          ? { ...task, folderId, updatedAt: new Date() }
          : task
      )
    }));
  };

  return {
    state,
    addTask,
    addStudent,
    submitWork,
    approveFeedback,
    updateFeedback,
    getStudentStatus,
    selectTask,
    resetDemo,
    setSelectedNextStep,
    deactivateTask,
    reactivateTask,
    createFolder,
    moveTaskToFolder
  };
}