import React, { useState, useEffect, useCallback } from 'react';
import { FeedbackView } from './components/student/FeedbackView';
import { StudentEntry } from './components/student/StudentEntry';
import { StudentRevisionView } from './components/student/StudentRevisionView';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { TeacherReviewView } from './components/teacher/TeacherReviewView';
import { TeacherLogin } from './components/teacher/TeacherLogin';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OnboardingProvider } from './components/onboarding/OnboardingProvider';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { FeedbackSession, NextStep, Student } from './types';
import { GraduationCap, School } from 'lucide-react';
import { useAppStore } from './lib/store';
import { useBackendStore } from './lib/useBackendStore';
import { getCurrentTeacher, logOut, Teacher } from './lib/auth';
import { getTaskFromCode } from './lib/taskCodes';
import { authApi, setStudentToken, getStudentToken, sessionsApi, validateToken, clearToken, getToken } from './lib/api';
import { useStudentSocket, useTeacherSocket, useTeacherGlobalSocket, FeedbackReadyPayload, StudentJoinedPayload, GlobalStudentJoinedPayload } from './lib/useSocket';
import { playJoinSound, playSubmitSound } from './lib/sounds';

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
    updateTask,
    addStudent,
    restoreStudent,
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
    loadSessionDashboard,
    updateTaskLiveSessionId,
    addStudentFromWebSocket,
    updateStudentFromWebSocket,
  } = store;

  // Student Local State
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [studentTaskId, setStudentTaskId] = useState<string | null>(null); // Track which task student is working on
  const [studentSessionId, setStudentSessionId] = useState<string | null>(null); // Backend session ID
  const [studentTask, setStudentTask] = useState<{id: string; title: string; prompt: string; successCriteria: string[]} | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(false); // Loading state for session restore

  // Teacher Review State
  const [reviewingStudentId, setReviewingStudentId] = useState<string | null>(null);

  // Student submission error state
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [lastSubmittedContent, setLastSubmittedContent] = useState<{content: string; timeElapsed?: number; taskId?: string} | null>(null);

  // Polling backoff state
  const [pollFailureCount, setPollFailureCount] = useState(0);
  const maxPollFailures = 5; // Stop polling after 5 consecutive failures

  // WebSocket state for tracking real-time updates
  const [receivedFeedbackViaSocket, setReceivedFeedbackViaSocket] = useState(false);

  // Session persistence info for teacher dashboard
  const [sessionInfo, setSessionInfo] = useState<{
    id: string;
    isLive: boolean;
    dataPersisted: boolean;
    dataExpiresAt: string | null;
  } | null>(null);

  // WebSocket callback for real-time feedback updates
  const handleFeedbackReady = useCallback((payload: FeedbackReadyPayload) => {
    if (payload.studentId === currentStudentId) {
      // Mark that we received feedback via socket to stop polling
      setReceivedFeedbackViaSocket(true);

      // Update local state with feedback
      const actualTaskId = studentTaskId || state.currentTaskId;
      submitWork(
        currentStudentId,
        actualTaskId,
        state.submissions[currentStudentId]?.content || '',
        payload.feedback as FeedbackSession,
        undefined
      );

      // Update status based on mastery
      if (payload.masteryConfirmed) {
        markAsCompleted(currentStudentId);
      } else {
        approveFeedback(currentStudentId, payload.masteryConfirmed);
      }
    }
  }, [currentStudentId, studentTaskId, state.currentTaskId, state.submissions, submitWork, markAsCompleted, approveFeedback]);

  // Use WebSocket for real-time feedback when student is waiting
  useStudentSocket(studentSessionId, currentStudentId, handleFeedbackReady);

  // WebSocket callback for real-time student submission updates (teacher)
  const handleStudentSubmitted = useCallback((payload: { studentId: string }) => {
    // Play notification sound for teacher
    playSubmitSound();

    // OPTIMISTIC UPDATE: Immediately update student status to 'ready_for_feedback'
    if (updateStudentFromWebSocket) {
      updateStudentFromWebSocket({
        studentId: payload.studentId,
        status: 'ready_for_feedback',
      });
    }

    // Background refresh to get submission content (for full data consistency)
    const task = state.tasks.find(t => t.id === state.currentTaskId);
    if (task?.liveSessionId) {
      loadSessionDashboard(task.liveSessionId);
    }
  }, [state.tasks, state.currentTaskId, loadSessionDashboard, updateStudentFromWebSocket]);

  // WebSocket callback for real-time student join updates (teacher) - session-specific
  const handleStudentJoined = useCallback((payload: StudentJoinedPayload) => {
    console.log('Student joined:', payload.studentName);

    // OPTIMISTIC UPDATE: Add student directly to state (instant UI update!)
    if (addStudentFromWebSocket && state.currentSessionId) {
      addStudentFromWebSocket({
        id: payload.studentId,
        name: payload.studentName,
        sessionId: state.currentSessionId,
        taskId: state.currentTaskId,
      });
    }

    // No need to call loadSessionDashboard - optimistic update already shows the student
  }, [state.currentSessionId, state.currentTaskId, addStudentFromWebSocket]);

  // WebSocket callback for global student join updates (teacher) - receives from ALL sessions
  // This handles the case where liveSessionId doesn't exist yet on the task
  const handleGlobalStudentJoined = useCallback((payload: GlobalStudentJoinedPayload) => {
    console.log('[Global] Student joined:', payload.studentName, 'taskId:', payload.taskId, 'sessionId:', payload.sessionId);

    // Play notification sound for teacher
    playJoinSound();

    // Update task with liveSessionId if not already set
    if (updateTaskLiveSessionId) {
      updateTaskLiveSessionId(payload.taskId, payload.sessionId);
    }

    // OPTIMISTIC UPDATE: Add student directly to state (instant UI update!)
    if (addStudentFromWebSocket) {
      addStudentFromWebSocket({
        id: payload.studentId,
        name: payload.studentName,
        sessionId: payload.sessionId,
        taskId: payload.taskId,
      });
    }

    // Only call loadSessionDashboard for initial setup when switching to this task
    // The optimistic update already shows the student instantly
  }, [updateTaskLiveSessionId, addStudentFromWebSocket]);

  // Get current session ID for teacher WebSocket
  const currentSessionId = state.tasks.find(t => t.id === state.currentTaskId)?.liveSessionId || null;

  // Use WebSocket for real-time teacher updates (session-specific)
  useTeacherSocket(
    currentView === 'teacher_dashboard' ? currentSessionId : null,
    handleStudentSubmitted,
    handleStudentJoined
  );

  // Use global WebSocket for teacher to receive student joins even when liveSessionId is null
  useTeacherGlobalSocket(
    currentView === 'teacher_dashboard' ? currentTeacher?.id || null : null,
    handleGlobalStudentJoined
  );

  // Check for logged-in teacher on mount
  useEffect(() => {
    const teacher = getCurrentTeacher();
    if (teacher) {
      setCurrentTeacher(teacher);
      setCurrentView('teacher_dashboard');
    }
  }, []);

  // Validate token on app initialization - clear invalid tokens
  useEffect(() => {
    const validateSession = async () => {
      const token = getToken();
      if (token && currentTeacher) {
        const isValid = await validateToken();
        if (!isValid) {
          clearToken();
          setCurrentTeacher(null);
        }
      }
    };
    validateSession();
  }, [currentTeacher]);

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
      // Returning student - immediately show student flow with loading state
      setCurrentView('student_flow');
      setIsRestoringSession(true);
      setCurrentStudentId(studentId);

      // Restore their session from backend
      authApi.restoreSession(studentId)
        .then((response) => {
          // Set up the session state
          setStudentToken(response.token);
          setStudentSessionId(response.sessionId);
          setStudentTaskId(response.task.id);
          setStudentTask({
            id: response.task.id,
            title: response.task.title,
            prompt: response.task.prompt,
            successCriteria: response.task.successCriteria,
          });

          // Add the student to the local store
          restoreStudent(response.studentId, response.studentName, response.status as Student['status']);

          // If feedback is ready, update local state with submission and feedback
          if (response.feedbackReady && response.feedback) {
            submitWork(
              response.studentId,
              response.task.id,
              response.submission?.content || '',
              response.feedback as FeedbackSession,
              undefined
            );
            if (response.status === 'completed') {
              markAsCompleted(response.studentId);
            } else if (response.status === 'feedback_ready' || response.status === 'revising') {
              approveFeedback(response.studentId, response.masteryConfirmed);
            }
          }

          // Update URL to include sessionId
          const url = new URL(window.location.href);
          url.searchParams.set('sessionId', response.sessionId);
          window.history.replaceState({}, '', url);
        })
        .catch((error) => {
          console.error('Failed to restore session:', error);
        })
        .finally(() => {
          setIsRestoringSession(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount

  // Polling effect to check for feedback approval with exponential backoff
  // Only poll when waiting for feedback (status is ready_for_feedback or generating)
  // WebSocket provides real-time updates, but polling is kept as fallback
  const studentStatus = currentStudentId ? getStudentStatus(currentStudentId) : null;
  const submission = currentStudentId ? state.submissions[currentStudentId] : null;
  const alreadyHasFeedback = !!(submission?.feedback);
  const shouldPoll = currentView === 'student_flow' &&
                     currentStudentId &&
                     !alreadyHasFeedback &&
                     !receivedFeedbackViaSocket &&
                     (studentStatus === 'ready_for_feedback' || studentStatus === 'generating' || studentStatus === 'submitted' || !studentStatus);

  useEffect(() => {
    if (shouldPoll) {
      // Don't poll if we've hit max failures
      if (pollFailureCount >= maxPollFailures) {
        console.warn('Polling stopped after max failures');
        return;
      }

      // Poll every 5 seconds while waiting for feedback
      const pollInterval = 5000;

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
  }, [shouldPoll, studentSessionId, pollFailureCount]);

  // Polling effect for teacher dashboard - reduced to 10 seconds as WebSocket fallback
  useEffect(() => {
    if (currentView === 'teacher_dashboard' && currentTeacher && state.currentTaskId) {
      const task = state.tasks.find(t => t.id === state.currentTaskId);
      if (task?.liveSessionId) {
        // Initial load when task is selected
        loadSessionDashboard(task.liveSessionId).then((dashboard) => {
          if (dashboard) {
            setSessionInfo({
              id: dashboard.session.id,
              isLive: dashboard.session.isLive,
              dataPersisted: dashboard.session.dataPersisted,
              dataExpiresAt: dashboard.session.dataExpiresAt,
            });
          }
        });

        // Reduced polling as fallback (WebSocket handles real-time)
        const interval = setInterval(() => {
          loadSessionDashboard(task.liveSessionId!).then((dashboard) => {
            if (dashboard) {
              setSessionInfo({
                id: dashboard.session.id,
                isLive: dashboard.session.isLive,
                dataPersisted: dashboard.session.dataPersisted,
                dataExpiresAt: dashboard.session.dataExpiresAt,
              });
            }
          });
        }, 10000); // 10 seconds instead of 2

        return () => clearInterval(interval);
      } else {
        // Clear session info when no live session
        setSessionInfo(null);
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
      <OnboardingProvider>
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
                sessionFeedbacksGenerated={state.sessionFeedbacksGenerated}
                sessionInfo={sessionInfo}
                onCreateTask={addTask}
                onUpdateTask={updateTask}
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
                onSessionPersisted={() => {
                  // Reload session info after persisting
                  const task = state.tasks.find(t => t.id === state.currentTaskId);
                  if (task?.liveSessionId) {
                    loadSessionDashboard(task.liveSessionId).then((dashboard) => {
                      if (dashboard) {
                        setSessionInfo({
                          id: dashboard.session.id,
                          isLive: dashboard.session.isLive,
                          dataPersisted: dashboard.session.dataPersisted,
                          dataExpiresAt: dashboard.session.dataExpiresAt,
                        });
                      }
                    });
                  }
                }}
            />
        </DashboardLayout>
      </OnboardingProvider>
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
    const submission = currentStudentId ? state.submissions[currentStudentId] : null;

    // Get URL params
    const params = new URLSearchParams(window.location.search);
    const urlTaskCode = params.get('taskCode');
    const urlStudentId = params.get('studentId');

    // Check if we're restoring a session (studentId in URL without taskCode)
    const isRestoredSession = urlStudentId && !urlTaskCode;

    // Show loading state while restoring session OR while waiting for submission data to populate
    if (isRestoringSession || (isRestoredSession && !submission)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading your session...</p>
          </div>
        </div>
      );
    }

    // Check feedback status - use submission data as source of truth for restored sessions
    const hasFeedback = !!(submission?.feedback);
    const isMasteryConfirmed = submission?.masteryConfirmed === true;

    // Status can come from state.students OR be inferred from submission
    const isFeedbackReady = status === 'feedback_ready' || status === 'revising' || (hasFeedback && !isMasteryConfirmed);
    const isCompleted = status === 'completed' || isMasteryConfirmed;

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
            task={currentTask}
            submission={submission}
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

    // Submit revision to backend and update local state
    const handleRevisionSubmit = async (content: string, timeElapsed: number) => {
      if (currentStudentId && revisionTask) {
        // Call backend API to persist the revision
        if (studentSessionId && getStudentToken()) {
          try {
            await sessionsApi.submitWork(studentSessionId, content, timeElapsed);
          } catch (error) {
            console.error('Failed to submit revision:', error);
            // Could add error handling UI here
          }
        }
        // Update local state
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