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
import { GraduationCap, School, ChevronLeft, Trash2, LogIn } from 'lucide-react';
import { useAppStore } from './lib/store';
import { useBackendStore } from './lib/useBackendStore';
import { getCurrentTeacher, logOut, Teacher } from './lib/auth';
import { getTaskFromCode } from './lib/taskCodes';
import { authApi, setStudentToken, getStudentToken, sessionsApi } from './lib/api';

// Mock Insights
const MOCK_INSIGHTS = [
  { name: 'Add Example', value: 12 },
  { name: 'Define Term', value: 8 },
  { name: 'Fix Structure', value: 5 },
  { name: 'Check ATQ', value: 3 },
];

type ViewMode = 'landing' | 'teacher_login' | 'student_flow' | 'teacher_dashboard' | 'teacher_review' | 'student_revision';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('landing');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Teacher Authentication State
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Use backend store for logged-in teachers, localStorage store for demo mode
  const localStore = useAppStore(isDemoMode ? undefined : currentTeacher?.id);
  const backendStore = useBackendStore(currentTeacher?.id);

  // Choose which store to use based on mode
  const isUsingBackend = currentTeacher && !isDemoMode;
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
    regenerateFeedback
  } = store;

  // Student Local State
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [studentTaskId, setStudentTaskId] = useState<string | null>(null); // Track which task student is working on
  const [studentSessionId, setStudentSessionId] = useState<string | null>(null); // Backend session ID
  const [studentTask, setStudentTask] = useState<{id: string; title: string; prompt: string; successCriteria: string[]} | null>(null);

  // Teacher Review State
  const [reviewingStudentId, setReviewingStudentId] = useState<string | null>(null);

  // Check for logged-in teacher or demo mode on mount
  useEffect(() => {
    const teacher = getCurrentTeacher();
    if (teacher) {
      setCurrentTeacher(teacher);
      setIsDemoMode(false);
      setCurrentView('teacher_dashboard');
    } else if (sessionStorage.getItem('lara-demo-mode') === 'active') {
      // Restore demo mode on refresh
      setIsDemoMode(true);
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

  // Polling effect to check for feedback approval
  useEffect(() => {
    if (currentView === 'student_flow' && currentStudentId) {
      const interval = setInterval(async () => {
        // If using backend, poll for feedback
        if (studentSessionId && getStudentToken()) {
          try {
            const response = await sessionsApi.getFeedback(studentSessionId, currentStudentId);
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
            // Ignore polling errors
          }
        } else {
          // Demo mode - just check local status
          getStudentStatus(currentStudentId);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentView, currentStudentId, studentSessionId, getStudentStatus]);

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

    // If we have a backend session, submit via API
    if (studentSessionId && getStudentToken()) {
      try {
        await sessionsApi.submitWork(studentSessionId, content, timeElapsed);
        // Update local state to show waiting
        if (currentStudentId) {
          submitWork(currentStudentId, actualTaskId, content, null, timeElapsed);
        }
      } catch (error) {
        console.error('Failed to submit work:', error);
      }
    } else if (currentStudentId && actualTaskId) {
      // Demo mode - use local store
      submitWork(currentStudentId, actualTaskId, content, feedback, timeElapsed);
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
      sessionStorage.removeItem('lara-demo-mode'); // Clear demo mode when logging in
      setCurrentTeacher(teacher);
      setIsDemoMode(false);
      setCurrentView('teacher_dashboard');
    }
  };

  const handleTeacherLogout = () => {
    logOut();
    sessionStorage.removeItem('lara-demo-mode');
    setCurrentTeacher(null);
    setIsDemoMode(false);
    setCurrentView('landing');
  };

  // ---------------------------------------------------------------------------
  // View Rendering Logic
  // ---------------------------------------------------------------------------

  if (currentView === 'landing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 relative">
        <button 
          onClick={resetDemo}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 transition-colors z-50"
          title="Reset Demo Data"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-400 via-brand-600 to-slate-900"></div>
                <div className="w-20 h-20 bg-brand-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-2xl shadow-brand-500/50 relative z-10">
                    <GraduationCap className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 relative z-10">LARA</h1>
                <p className="text-brand-100 text-sm font-medium tracking-wide opacity-80 relative z-10">Learning Assessment & Response Assistant</p>
            </div>
            
            <div className="p-8 space-y-6">
                <div className="space-y-4">
                    <p className="text-center text-slate-500 text-sm mb-6">Select a persona to explore the prototype:</p>

                    <button
                        onClick={() => setCurrentView('teacher_login')}
                        className="w-full group relative flex items-center p-4 rounded-xl border-2 border-brand-300 hover:border-brand-400 bg-brand-50 hover:bg-brand-100 transition-all duration-200"
                    >
                        <div className="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                            <LogIn className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-slate-900">Teacher Login</h3>
                            <p className="text-xs text-slate-600">Sign in to manage your tasks and students</p>
                        </div>
                        <div className="absolute right-4 text-brand-500">
                            <ChevronLeft className="w-5 h-5 rotate-180" />
                        </div>
                    </button>

                    <button
                        onClick={() => {
                          sessionStorage.setItem('lara-demo-mode', 'active');
                          setIsDemoMode(true);
                          setCurrentView('teacher_dashboard');
                        }}
                        className="w-full group relative flex items-center p-4 rounded-xl border border-slate-200 hover:border-brand-300 bg-white hover:bg-brand-50/30 transition-all duration-200"
                    >
                        <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                            <School className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-slate-900">Demo Mode</h3>
                            <p className="text-xs text-slate-500">Quick demo without login</p>
                        </div>
                        <div className="absolute right-4 text-slate-300 group-hover:text-brand-400">
                            <ChevronLeft className="w-5 h-5 rotate-180" />
                        </div>
                    </button>

                    <button 
                        onClick={() => setCurrentView('student_flow')}
                        className="w-full group relative flex items-center p-4 rounded-xl border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-all duration-200"
                    >
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                            <GraduationCap className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-slate-900">Student View</h3>
                            <p className="text-xs text-slate-500">Write response & receive feedback</p>
                        </div>
                        <div className="absolute right-4 text-slate-300 group-hover:text-emerald-400">
                            <ChevronLeft className="w-5 h-5 rotate-180" />
                        </div>
                    </button>
                </div>
            </div>
            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Interactive Demo v2.1 (React 18)</p>
            </div>
        </div>
      </div>
    );
  }

  if (currentView === 'teacher_login') {
    return (
      <TeacherLogin
        onLoginSuccess={handleTeacherLogin}
        onBack={() => setCurrentView('landing')}
      />
    );
  }

  if (currentView === 'teacher_dashboard') {
    return (
        <DashboardLayout
            activeTab={activeTab}
            onNavigate={setActiveTab}
            onExit={() => {
              sessionStorage.removeItem('lara-demo-mode');
              setCurrentView('landing');
            }}
            teacherName={currentTeacher?.name}
            onLogout={handleTeacherLogout}
        >
            <TeacherDashboard
                activeTab={activeTab}
                onNavigate={setActiveTab}
                insights={MOCK_INSIGHTS}
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
              onClick={() => setCurrentView('landing')}
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
              onClick={() => setCurrentView('landing')}
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