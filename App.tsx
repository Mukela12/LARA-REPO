import React, { useState, useEffect } from 'react';
import { FeedbackView } from './components/student/FeedbackView';
import { StudentEntry } from './components/student/StudentEntry';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { TeacherReviewView } from './components/teacher/TeacherReviewView';
import { TeacherLogin } from './components/teacher/TeacherLogin';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Button } from './components/ui/Button';
import { FeedbackSession, NextStep } from './types';
import { GraduationCap, School, ChevronLeft, Trash2, LogIn } from 'lucide-react';
import { useAppStore } from './lib/store';
import { getCurrentTeacher, logOut, Teacher } from './lib/auth';

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

  // Store actions (now teacher-scoped)
  const { state, addTask, addStudent, submitWork, approveFeedback, updateFeedback, getStudentStatus, selectTask, resetDemo, setSelectedNextStep } = useAppStore(currentTeacher?.id);

  // Student Local State
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);

  // Teacher Review State
  const [reviewingStudentId, setReviewingStudentId] = useState<string | null>(null);

  // Check for logged-in teacher on mount
  useEffect(() => {
    const teacher = getCurrentTeacher();
    if (teacher) {
      setCurrentTeacher(teacher);
    }
  }, []);

  // Check for taskCode or studentId in URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskCode = params.get('taskCode');
    const studentId = params.get('studentId');

    if (taskCode) {
      // New flow: Task code provided - go to student flow
      // The StudentEntry component will handle joining with the task code
      setCurrentView('student_flow');
    } else if (studentId) {
      // Legacy flow: Student ID provided - restore session
      const status = getStudentStatus(studentId);
      if (status) {
        // Valid student - restore their session
        setCurrentStudentId(studentId);
        setCurrentView('student_flow');
      } else {
        // Invalid student ID - clear URL and go to landing
        window.history.replaceState({}, '', window.location.pathname);
        setCurrentView('landing');
      }
    }
  }, [getStudentStatus]);

  // Polling effect to check for feedback approval
  useEffect(() => {
    if (currentView === 'student_flow' && currentStudentId) {
      const interval = setInterval(() => {
        // Force re-render to check status from store
        // In a real app, this would be a socket listener or swr
        const status = getStudentStatus(currentStudentId);
        // Note: The StudentEntry component uses isPending prop which drives the view
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentView, currentStudentId, getStudentStatus]);

  const handleStudentJoin = (name: string) => {
    const student = addStudent(name);
    setCurrentStudentId(student.id);

    // Add student ID to URL
    const url = new URL(window.location.href);
    url.searchParams.set('studentId', student.id);
    window.history.pushState({}, '', url);
  };

  const handleStudentSubmit = (content: string, feedback: FeedbackSession, timeElapsed?: number) => {
    if (currentStudentId && state.tasks[0]) {
      submitWork(currentStudentId, state.tasks[0].id, content, feedback, timeElapsed);
    }
  };

  const handleStudentContinue = (step: NextStep) => {
    setSelectedNextStep(step);
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
                        onClick={() => setCurrentView('teacher_dashboard')}
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
            onExit={() => setCurrentView('landing')}
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
                onCreateTask={addTask}
                onApproveFeedback={approveFeedback}
                onNavigateToReview={handleNavigateToReview}
                onSelectTask={selectTask}
            />
        </DashboardLayout>
    );
  }

  if (currentView === 'teacher_review' && reviewingStudentId) {
    const student = state.students.find(s => s.id === reviewingStudentId);
    const submission = state.submissions[reviewingStudentId];

    if (!student || !submission) {
      // Handle invalid state by going back to dashboard
      setCurrentView('teacher_dashboard');
      return null;
    }

    return (
      <TeacherReviewView
        student={student}
        submission={submission}
        onBack={handleBackFromReview}
        onApprove={(studentId) => {
          approveFeedback(studentId);
          handleBackFromReview();
        }}
        onUpdateFeedback={updateFeedback}
      />
    );
  }

  if (currentView === 'student_flow') {
    const status = currentStudentId ? getStudentStatus(currentStudentId) : null;
    const isFeedbackReady = status === 'feedback_ready' || status === 'revising';

    // Get taskCode from URL if present
    const params = new URLSearchParams(window.location.search);
    const urlTaskCode = params.get('taskCode');

    // Find the task - either by taskCode or use the current task
    let currentTask = state.tasks.find(t => t.id === state.currentTaskId);
    if (urlTaskCode) {
      const taskByCode = state.tasks.find(t => t.taskCode === urlTaskCode.toUpperCase());
      if (taskByCode) {
        currentTask = taskByCode;
      }
    }
    // Fallback to first task if no current task
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

    // If feedback approved, show feedback view
    if (isFeedbackReady && currentStudentId && state.submissions[currentStudentId]?.feedback) {
      return (
        <div className="bg-slate-50 min-h-screen">
          <FeedbackView
              sessionData={state.submissions[currentStudentId].feedback!}
              onContinue={handleStudentContinue}
          />
        </div>
      );
    }

    // Otherwise show entry/writing/waiting state
    return (
       <StudentEntry
          task={currentTask}
          onJoin={handleStudentJoin}
          onSubmitWork={handleStudentSubmit}
          isPending={status === 'submitted'}
          studentId={currentStudentId || undefined}
          taskCode={urlTaskCode || undefined}
       />
    );
  }

  if (currentView === 'student_revision') {
      const selectedStep = state.selectedNextStep;

      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
              <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 mx-auto animate-bounce">
                    <School className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Ready to Revise</h2>

                {selectedStep && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 text-left">
                    <h3 className="font-semibold text-emerald-900 mb-2">Your Selected Next Step:</h3>
                    <p className="text-sm text-emerald-800 mb-1">
                      <span className="font-medium">{selectedStep.actionVerb}</span> {selectedStep.target}
                    </p>
                    <p className="text-xs text-emerald-700">
                      Success looks like: {selectedStep.successIndicator}
                    </p>
                  </div>
                )}

                <p className="text-slate-600 mb-8 leading-relaxed">
                    Great choice! You have selected a next step.
                    <br/><span className="text-sm text-slate-400 mt-2 block">In the full app, the editor would open here with your selected focus area highlighted.</span>
                </p>
                <Button variant="outline" className="w-full" onClick={() => {
                  setCurrentView('landing');
                }}>
                    Back to Demo Start
                </Button>
              </div>
          </div>
      )
  }

  return null;
}

export default App;