export type FeedbackType = 'task' | 'process' | 'self_reg';

export type StudentStatus = 'active' | 'submitted' | 'feedback_ready' | 'revising' | 'completed';

export interface Student {
  id: string;
  name: string;
  status: StudentStatus;
  joinedAt: number;
}

export interface Task {
  id: string;
  title: string;
  prompt: string;
  successCriteria: string[];
  universalExpectations: boolean;
  taskCode?: string; // 6-digit alphanumeric code for student access
  status: 'active' | 'inactive';
  folderId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  text: string;
  anchors?: string[]; // Quotes from student work
}

export interface NextStep {
  id: string;
  actionVerb: string;
  target: string;
  successIndicator: string;
  ctaText: string; // Max 30 chars
  actionType: 'revise' | 'improve_section' | 'reupload' | 'rehearse';
}

export interface FeedbackSession {
  goal: string;
  strengths: FeedbackItem[];
  growthAreas: FeedbackItem[];
  nextSteps: NextStep[];
}

export interface Submission {
  studentId: string;
  taskId: string;
  content: string;
  feedback: FeedbackSession | null;
  timestamp: number;
  timeElapsed?: number;      // Timer engagement metric (seconds)
  revisionCount: number;      // Number of revisions made
}

export interface ClassInsight {
  name: string;
  value: number;
}