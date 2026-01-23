export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string | null; // CSS selector for data-tutorial attribute, null for centered modal
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to LARA!',
    description: 'LARA helps you create writing tasks, collect student submissions, and provide AI-powered feedback. Let\'s take a quick tour to get you started.',
    target: null,
    position: 'center',
  },
  {
    id: 'create-task',
    title: 'Create Your First Task',
    description: 'Click here to create a new writing task for your students. You can set the prompt, success criteria, and customize feedback settings.',
    target: '[data-tutorial="create-task"]',
    position: 'bottom',
  },
  {
    id: 'share-task',
    title: 'Share with Students',
    description: 'Once you have a task, share this link with your students. They can join using the link or by entering the task code.',
    target: '[data-tutorial="share-task"]',
    position: 'top',
  },
  {
    id: 'generate-feedback',
    title: 'Generate AI Feedback',
    description: 'When students submit their work, you\'ll see them here. Click "Generate Feedback" to create personalized AI feedback for each student.',
    target: '[data-tutorial="generate-feedback"]',
    position: 'bottom',
  },
  {
    id: 'folders',
    title: 'Organize with Folders',
    description: 'Create folders to organize your tasks by class, topic, or any system that works for you. This helps keep everything tidy as you create more tasks.',
    target: '[data-tutorial="folders"]',
    position: 'right',
  },
];

export const ONBOARDING_KEY = 'lara-onboarding-completed';
