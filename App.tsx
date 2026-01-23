import React, { useState, useEffect } from 'react';
import { FeedbackView } from './components/student/FeedbackView';
import { StudentEntry } from './components/student/StudentEntry';
import { StudentRevisionView } from './components/student/StudentRevisionView';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { TeacherReviewView } from './components/teacher/TeacherReviewView';
import { TeacherLogin } from './components/teacher/TeacherLogin';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { FeedbackSession, NextStep } from './types';
import { GraduationCap, School } from 'lucide-react';
import { useAppStore } from './lib/store';
import { useBackendStore } from './lib/useBackendStore';
import { getCurrentTeacher, logOut, Teacher } from './lib/auth';
import { getTaskFromCode } from './lib/taskCodes';
import { authApi, setStudentToken, getStudentToken, sessionsApi } from './lib/api';

type ViewMode = 'teacher_login' | 'student_flow' | 'teacher_dashboard' | 'teacher_review' | 'student_revision';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('teacher_login');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Teacher Authentication State
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);

  // Use backend store for logged-in teachers
  const localStore = useAppStore(currentTeacher?.id);
  const backendStore = useBackendStore(currentTeacher?.id);

  // Choose which store to use based on mode
  const isUsingBackend = !!currentTeacher;
  const store = isUsingBackend ? backendStore : localStore;

  // Destructure from the active store
  const {
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
    saveSelectedNextStep,
    submitRevision,
    markAsCompleted,
    deactivateTask,
    reactivateTask,
    createFolder,
    moveTaskToFolder,
    deleteFolder,
    updateFolder,
    generateFeedbackForStudent,
    generateFeedbackBatch,
    regenerateFeedback,
    loadSessionDashboard
  } = store;

  // Student Local State
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [studentTaskId, setStudentTaskId] = useState<string | null>(null); // Track which task student is working on
  const [studentSessionId, setStudentSessionId] = useState<string | null>(null); // Backend session ID
  const [studentTask, setStudentTask] = useState<{id: string; title: string; prompt: string; successCriteria: string[]} | null>(null);

  // Teacher Review State
  const [reviewingStudentId, setReviewingStudentId] = useState<string | null>(null);

  // Student submission error state
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [lastSubmittedContent, setLastSubmittedContent] = useState<{content: string; timeElapsed?: number; taskId?: string} | null>(null);

  // Polling backoff state
  const [pollFailureCount, setPollFailureCount] = useState(0);
  const maxPollFailures = 5; // Stop polling after 5 consecutive failures

  // Check for logged-in teacher on mount
  useEffect(() => {
    const teacher = getCurrentTeacher();
    if (teacher) {
      setCurrentTeacher(teacher);
      setCurrentView('teacher_dashboard');
    }
  }, []);

  // Check for taskCode or studentId in URL parameters on mount ONLY
  // This should only run once - not on every state change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskCode = params.get('taskCode');
    const studentId = params.get('studentId');

    if (taskCode) {
      // New flow: Task code provided - get task from global mapping (works without teacher context)
      const taskFromGlobal = getTaskFromCode(taskCode);
      if (taskFromGlobal) {
        setStudentTaskId(taskFromGlobal.id);
      }
      setCurrentView('student_flow');
    } else if (studentId) {
      // Legacy flow: Student ID provided - restore session
      setCurrentStudentId(studentId);
      setCurrentView('student_flow');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount

  // Polling effect to check for feedback approval with exponential backoff
  useEffect(() => {
    if (currentView === 'student_flow' && currentStudentId) {
      // Don't poll if we've hit max failures
      if (pollFailureCount >= maxPollFailures) {
        console.warn('Polling stopped after max failures');
        return;
      }

      // Calculate polling interval with exponential backoff
      const baseInterval = 2000; // 2 seconds
      const backoffMultiplier = Math.pow(2, pollFailureCount);
      const pollInterval = Math.min(baseInterval * backoffMultiplier, 30000); // Max 30 seconds

      const poll = async () => {
        // If using backend, poll for feedback
        if (studentSessionId && getStudentToken()) {
          try {
            const response = await sessionsApi.getFeedback(studentSessionId, currentStudentId);
            // Reset failure count on success
            setPollFailureCount(0);

            if (response.feedbackReady && response.feedback) {
              // Update local state with feedback
              const actualTaskId = studentTaskId || state.currentTaskId;
              submitWork(currentStudentId, actualTaskId, state.submissions[currentStudentId]?.content || '', response.feedback as FeedbackSession, undefined);
              // Update status
              if (response.masteryConfirmed) {
                markAsCompleted(currentStudentId);
              } else {
                approveFeedback(currentStudentId, response.masteryConfirmed);
              }
            }
          } catch (error) {
            // Increment failure count for backoff
            setPollFailureCount(prev => prev + 1);
            console.error('Polling failed, backing off:', error);
          }
        } else {
          // Demo mode - just check local status
          getStudentStatus(currentStudentId);
        }
      };

      const interval = setInterval(poll, pollInterval);
      return () => clearInterval(interval);
    }
  }, [currentView, currentStudentId, studentSessionId, getStudentStatus, pollFailureCount]);

  // Polling effect for teacher dashboard - refresh session data every 5 seconds
  useEffect(() => {
    if (currentView === 'teacher_dashboard' && currentTeacher && state.currentTaskId) {
      const task = state.tasks.find(t => t.id === state.currentTaskId);
      if (task?.liveSessionId) {
        // Initial load when task is selected
        loadSessionDashboard(task.liveSessionId);

        // Poll every 5 seconds for updates
        const interval = setInterval(() => {
          loadSessionDashboard(task.liveSessionId!);
        }, 5000);

        return () => clearInterval(interval);
      }
    }
  }, [currentView, currentTeacher, state.currentTaskId, state.tasks, loadSessionDashboard]);

  const handleStudentJoin = async (name: string, taskId?: string) => {
    // Check if we have a task code in URL for backend join
    const params = new URLSearchParams(window.location.search);
    const urlTaskCode = params.get('taskCode');

    if (urlTaskCode) {
      // Use backend API to join session
      try {
        const response = await authApi.joinSession(urlTaskCode, name);
        setStudentToken(response.token);
        setCurrentStudentId(response.studentId);
        setStudentSessionId(response.sessionId);
        setStudentTaskId(response.task.id);
        setStudentTask(response.task);

        // Update URL with student ID
        const url = new URL(window.location.href);
        url.searchParams.set('studentId', response.studentId);
        url.searchParams.set('sessionId', response.sessionId);
        window.history.pushState({}, '', url);
      } catch (error) {
        console.error('Failed to join session:', error);
        // Fallback to local mode
        const student = addStudent(name);
        setCurrentStudentId(student.id);
        if (taskId) setStudentTaskId(taskId);
      }
    } else {
      // Demo mode - use local store
      const student = addStudent(name);
      setCurrentStudentId(student.id);

      if (taskId) {
        setStudentTaskId(taskId);
      }

      // Add student ID to URL
      const url = new URL(window.location.href);
      url.searchParams.set('studentId', student.id);
      window.history.pushState({}, '', url);
    }
  };

  const handleStudentSubmit = async (content: string, feedback: FeedbackSession | null, timeElapsed?: number, taskId?: string) => {
    // Use the provided taskId, or fall back to studentTaskId, or the current selected task
    const actualTaskId = taskId || studentTaskId || state.currentTaskId;

    // Clear any previous submission error
    setSubmissionError(null);

    // If we have a backend session, submit via API
    if (studentSessionId && getStudentToken()) {
      try {
        await sessionsApi.submitWork(studentSessionId, content, timeElapsed);
        // Clear saved content on success
        setLastSubmittedContent(null);
        // Update local state to show waiting
        if (currentStudentId) {
          submitWork(currentStudentId, actualTaskId, content, null, timeElapsed);
        }
      } catch (error) {
        console.error('Failed to submit work:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to submit your work. Please try again.';
        setSubmissionError(errorMessage);
        // Save content for retry
        setLastSubmittedContent({ content, timeElapsed, taskId: actualTaskId });
      }
    } else if (currentStudentId && actualTaskId) {
      // Demo mode - use local store
      submitWork(currentStudentId, actualTaskId, content, feedback, timeElapsed);
    }
  };

  const handleRetrySubmit = () => {
    if (lastSubmittedContent) {
      handleStudentSubmit(lastSubmittedContent.content, null, lastSubmittedContent.timeElapsed, lastSubmittedContent.taskId);
    }
  };

  const handleStudentContinue = (step: NextStep) => {
    setSelectedNextStep(step);
    // Save the selected step to the submission for teacher visibility
    if (currentStudentId) {
      saveSelectedNextStep(currentStudentId, step);
    }
    setCurrentView('student_revision');
  };

  const handleNavigateToReview = (studentId: string) => {
    setReviewingStudentId(studentId);
    setCurrentView('teacher_review');
  };

  const handleBackFromReview = () => {
    setReviewingStudentId(null);
    setCurrentView('teacher_dashboard');
  };

  const handleTeacherLogin = () => {
    const teacher = getCurrentTeacher();
    if (teacher) {
      setCurrentTeacher(teacher);
      setCurrentView('teacher_dashboard');
    }
  };

  const handleTeacherLogout = () => {
    logOut();
    setCurrentTeacher(null);
    setCurrentView('teacher_login');
  };

  // ---------------------------------------------------------------------------
  // View Rendering Logic
  // ---------------------------------------------------------------------------

  if (currentView === 'teacher_login') {
    return (
      <TeacherLogin
        onLoginSuccess={handleTeacherLogin}
      />
    );
  }

  if (currentView === 'teacher_dashboard') {
    return (
        <DashboardLayout
            activeTab={activeTab}
            onNavigate={setActiveTab}
            onExit={handleTeacherLogout}
            teacherName={currentTeacher?.name}
            onLogout={handleTeacherLogout}
        >
            <TeacherDashboard
                activeTab={activeTab}
                onNavigate={setActiveTab}
                insights={[]}
                students={state.students}
                tasks={state.tasks}
                submissions={state.submissions}
                selectedTaskId={state.currentTaskId}
                folders={state.folders}
                credits={state.credits}
                onCreateTask={addTask}
                onApproveFeedback={approveFeedback}
                onNavigateToReview={handleNavigateToReview}
                onSelectTask={selectTask}
                onDeactivateTask={deactivateTask}
                onReactivateTask={reactivateTask}
                onCreateFolder={createFolder}
                onMoveTaskToFolder={moveTaskToFolder}
                onDeleteFolder={deleteFolder}
                onUpdateFolder={updateFolder}
                onGenerateFeedback={generateFeedbackForStudent}
                onGenerateFeedbackBatch={generateFeedbackBatch}
            />
        </DashboardLayout>
    );
  }

  if (currentView === 'teacher_review' && reviewingStudentId) {
    const student = state.students.find(s => s.id === reviewingStudentId);
    const submission = state.submissions[reviewingStudentId];
    const task = submission ? state.tasks.find(t => t.id === submission.taskId) : undefined;

    if (!student || !submission) {
      // Handle invalid state by going back to dashboard
      setCurrentView('teacher_dashboard');
      return null;
    }

    return (
      <TeacherReviewView
        student={student}
        submission={submission}
        task={task}
        onBack={handleBackFromReview}
        onApprove={(studentId, isMastered) => {
          approveFeedback(studentId, isMastered);
          handleBackFromReview();
        }}
        onUpdateFeedback={updateFeedback}
        onRegenerateFeedback={regenerateFeedback}
      />
    );
  }

  if (currentView === 'student_flow') {
    const status = currentStudentId ? getStudentStatus(currentStudentId) : null;
    const isFeedbackReady = status === 'feedback_ready' || status === 'revising';
    const isCompleted = status === 'completed';
    const submission = currentStudentId ? state.submissions[currentStudentId] : null;

    // Get taskCode from URL if present
    const params = new URLSearchParams(window.location.search);
    const urlTaskCode = params.get('taskCode');

    // Find the task - prioritize: backend task > global task lookup > studentTaskId > currentTaskId > first task
    let currentTask: typeof state.tasks[0] | undefined;

    // FIRST: Use task from backend join response if available
    if (studentTask) {
      currentTask = {
        id: studentTask.id,
        title: studentTask.title,
        prompt: studentTask.prompt,
        successCriteria: studentTask.successCriteria,
        universalExpectations: true,
        status: 'active' as const,
        folderId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // SECOND: Try to get task from global mapping (this works without teacher context)
    if (!currentTask && urlTaskCode) {
      const taskFromGlobal = getTaskFromCode(urlTaskCode);
      if (taskFromGlobal) {
        currentTask = taskFromGlobal;
      }
    }

    // THIRD: Try to use the studentTaskId (set when student joined or from submission)
    if (!currentTask && studentTaskId) {
      currentTask = state.tasks.find(t => t.id === studentTaskId);
    }

    // FOURTH: Fallback to first task if nothing else works (demo mode)
    if (!currentTask) {
      currentTask = state.tasks[0];
    }

    // Validate task status - show error if inactive
    if (currentTask && currentTask.status === 'inactive') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <Card className="max-w-md w-full p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <School className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Task Inactive</h2>
            <p className="text-slate-600">
              This task is currently inactive. Please contact your teacher for access.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCurrentView('teacher_login')}
            >
              Back to Start
            </Button>
          </Card>
        </div>
      );
    }

    // If student has completed the task, show completion view
    if (isCompleted && currentStudentId) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <Card className="max-w-md w-full p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <GraduationCap className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Task Complete!</h2>
              <p className="text-slate-600">
                Great work! You've successfully completed this task.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCurrentView('teacher_login')}
            >
              Back to Start
            </Button>
          </Card>
        </div>
      );
    }

    // If feedback approved, show feedback view
    if (isFeedbackReady && currentStudentId && submission?.feedback) {
      const handleComplete = () => {
        markAsCompleted(currentStudentId);
      };

      return (
        <div className="bg-slate-50 min-h-screen">
          <FeedbackView
            sessionData={submission.feedback}
            onContinue={handleStudentContinue}
            masteryConfirmed={submission.masteryConfirmed}
            onComplete={handleComplete}
          />
        </div>
      );
    }

    // Otherwise show entry/writing/waiting state
    return (
       <StudentEntry
          task={currentTask}
          onJoin={(name) => handleStudentJoin(name, currentTask?.id)}
          onSubmitWork={(content, feedback, timeElapsed) => handleStudentSubmit(content, feedback, timeElapsed, currentTask?.id)}
          isPending={status === 'ready_for_feedback' || status === 'generating' || status === 'submitted'}
          studentId={currentStudentId || undefined}
          taskCode={urlTaskCode || undefined}
          submissionError={submissionError}
          onRetrySubmit={handleRetrySubmit}
       />
    );
  }

  if (currentView === 'student_revision') {
    const selectedStep = state.selectedNextStep;
    const submission = currentStudentId ? state.submissions[currentStudentId] : null;

    // Find task for context
    let revisionTask = studentTaskId ? state.tasks.find(t => t.id === studentTaskId) : state.tasks[0];

    // Get taskCode from URL if present for global lookup
    const params = new URLSearchParams(window.location.search);
    const urlTaskCode = params.get('taskCode');
    if (urlTaskCode && !revisionTask) {
      revisionTask = getTaskFromCode(urlTaskCode) || undefined;
    }

    // MVP1: Revisions saved but no AI feedback generated (deferred feature)
    const handleRevisionSubmit = (content: string, timeElapsed: number) => {
      if (currentStudentId && revisionTask) {
        submitRevision(currentStudentId, revisionTask.id, content, timeElapsed);
        setSelectedNextStep(null);
        setCurrentView('student_flow');
      }
    };

    return (
      <StudentRevisionView
        task={revisionTask}
        selectedStep={selectedStep}
        submission={submission}
        onSubmitRevision={handleRevisionSubmit}
        onCancel={() => setCurrentView('student_flow')}
      />
    );
  }

  return null;
}

export default App;