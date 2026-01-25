import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClassInsight, Student, Task, Submission, Folder, TeacherCredits } from '../../types';
import { Users, Clock, ArrowUpRight, Plus, ClipboardCheck, List, Power, PowerOff, Zap, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CreateTaskForm } from './CreateTaskForm';
import { ClassInsightsView } from './ClassInsightsView';
import { StudentList } from './StudentList';
import { TaskList } from './TaskList';
import { TaskSelector } from './TaskSelector';
import { FolderManagement } from './FolderManagement';
import { ShareTaskCard } from './ShareTaskCard';
import { useAppStore } from '../../lib/store';

interface TeacherDashboardProps {
  insights: ClassInsight[];
  students: Student[];
  tasks: Task[];
  submissions: Record<string, Submission>;
  selectedTaskId: string;
  activeTab: string;
  folders: Folder[];
  credits: TeacherCredits;
  sessionFeedbacksGenerated?: number;
  onNavigate: (tab: string) => void;
  onCreateTask: (task: Task) => void;
  onApproveFeedback: (studentId: string) => void;
  onNavigateToReview: (studentId: string) => void;
  onSelectTask: (taskId: string) => void;
  onDeactivateTask: (taskId: string) => void;
  onReactivateTask: (taskId: string) => void;
  onCreateFolder: (name: string, description?: string, color?: string) => string;
  onMoveTaskToFolder: (taskId: string, folderId: string | null) => void;
  onDeleteFolder: (folderId: string) => void;
  onUpdateFolder: (folderId: string, name: string, description?: string, color?: string) => void;
  onGenerateFeedback: (studentId: string) => Promise<boolean>;
  onGenerateFeedbackBatch: (studentIds: string[]) => Promise<{ success: number; failed: number }>;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  insights,
  students,
  tasks,
  submissions,
  selectedTaskId,
  activeTab,
  folders,
  credits,
  sessionFeedbacksGenerated,
  onNavigate,
  onCreateTask,
  onApproveFeedback,
  onNavigateToReview,
  onSelectTask,
  onDeactivateTask,
  onReactivateTask,
  onCreateFolder,
  onMoveTaskToFolder,
  onDeleteFolder,
  onUpdateFolder,
  onGenerateFeedback,
  onGenerateFeedbackBatch
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [generatingStudentId, setGeneratingStudentId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const currentTask = tasks.find(t => t.id === selectedTaskId) || tasks[0];

  // Filter students to only show those who have submissions for the current task
  const taskStudents = students.filter(student => {
    const submission = submissions[student.id];
    return submission && submission.taskId === currentTask?.id;
  });

  const activeStudents = taskStudents.filter(s => s.status !== 'completed').length;

  // Helper for Student List Table
  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        active: "bg-slate-100 text-slate-600",
        ready_for_feedback: "bg-purple-100 text-purple-700",
        generating: "bg-blue-100 text-blue-700",
        submitted: "bg-blue-100 text-blue-700",
        feedback_ready: "bg-emerald-100 text-emerald-700",
        revising: "bg-amber-100 text-amber-700",
        completed: "bg-slate-800 text-white",
    };
    const labels: Record<string, string> = {
        active: "Writing",
        ready_for_feedback: "Ready for Feedback",
        generating: "Generating...",
        submitted: "Needs Review",
        feedback_ready: "Feedback Sent",
        revising: "Revising",
        completed: "Done"
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${styles[status] || styles.active}`}>
            {labels[status] || status}
        </span>
    );
  };

  // Handle generating feedback for a single student
  const handleGenerateFeedback = async (studentId: string) => {
    setGeneratingStudentId(studentId);
    await onGenerateFeedback(studentId);
    setGeneratingStudentId(null);
  };

  // Handle batch generation
  const handleBatchGenerate = async () => {
    const readyStudents = taskStudents.filter(s => s.status === 'ready_for_feedback');
    if (readyStudents.length === 0) return;

    setIsBatchGenerating(true);
    await onGenerateFeedbackBatch(readyStudents.map(s => s.id));
    setIsBatchGenerating(false);
  };

  // Count students ready for feedback
  const readyForFeedbackCount = taskStudents.filter(s => s.status === 'ready_for_feedback').length;

  if (activeTab === 'create') {
    return (
      <div className="p-4 lg:p-8">
        <CreateTaskForm
          onSave={(task) => {
            onCreateTask(task);
            onNavigate('dashboard');
          }}
          onCancel={() => onNavigate('dashboard')}
        />
      </div>
    );
  }

  if (activeTab === 'students') {
    return (
      <div className="p-4 lg:p-8">
        <StudentList
          students={students}
          submissions={submissions}
          onNavigateToReview={onNavigateToReview}
        />
      </div>
    );
  }

  if (activeTab === 'insights') {
    return (
      <div className="p-4 lg:p-8">
        <ClassInsightsView
          students={students}
          submissions={submissions}
          insights={insights}
        />
      </div>
    );
  }

  if (activeTab === 'tasks') {
    return (
      <div className="p-4 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">All Tasks</h2>
              <p className="text-sm text-slate-500 mt-1">
                Manage your tasks, organize into folders, and control task availability
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('create')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Task
            </Button>
          </div>

          <div className="flex gap-6">
            {/* Folder Sidebar */}
            <div className="w-64 flex-shrink-0">
              <Card className="sticky top-4" data-tutorial="folders">
                <FolderManagement
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  onCreateFolder={onCreateFolder}
                  onSelectFolder={setSelectedFolderId}
                  onDeleteFolder={onDeleteFolder}
                  onUpdateFolder={onUpdateFolder}
                />
              </Card>
            </div>

            {/* Task List */}
            <div className="flex-1">
              <TaskList
                tasks={tasks}
                submissions={submissions}
                students={students}
                selectedTaskId={selectedTaskId}
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelectTask={(taskId) => {
                  onSelectTask(taskId);
                  onNavigate('dashboard');
                }}
                onDeactivateTask={onDeactivateTask}
                onReactivateTask={onReactivateTask}
                onMoveTaskToFolder={onMoveTaskToFolder}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: dashboard view
  const showOverview = activeTab === 'dashboard';

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        {/* Task Selector */}
        {tasks.length > 0 && (
          <div className="lg:max-w-md">
            <TaskSelector
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
            />
          </div>
        )}

        {/* Current Task Info */}
        <div className={`bg-white p-4 lg:p-6 rounded-xl border shadow-sm ${
          currentTask?.status === 'inactive' ? 'border-slate-300 bg-slate-50' : 'border-slate-200'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className={`text-xl lg:text-2xl font-bold mb-2 ${
                currentTask?.status === 'inactive' ? 'text-slate-500' : 'text-slate-900'
              }`}>
                {currentTask?.title || "No Active Task"}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-slate-500 text-sm">
                {/* Task Status Badge */}
                {currentTask?.status === 'inactive' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-200 rounded text-slate-600">
                    <PowerOff className="w-3.5 h-3.5" /> Inactive
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 rounded text-emerald-700">
                    <Power className="w-3.5 h-3.5" /> Live
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Quick Toggle for Task Status */}
              {currentTask && (
                <Button
                  variant={currentTask.status === 'inactive' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (currentTask.status === 'inactive') {
                      onReactivateTask(currentTask.id);
                    } else {
                      onDeactivateTask(currentTask.id);
                    }
                  }}
                  leftIcon={currentTask.status === 'inactive' ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  className={currentTask.status !== 'inactive' ? 'text-amber-600 border-amber-300 hover:bg-amber-50' : ''}
                >
                  {currentTask.status === 'inactive' ? 'Activate' : 'Deactivate'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('tasks')}
                leftIcon={<List className="w-4 h-4" />}
              >
                All Tasks
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('create')}
                leftIcon={<Plus className="w-4 h-4" />}
                data-tutorial="create-task"
              >
                New Task
              </Button>
            </div>
          </div>
          {/* Warning Banner for Inactive Task */}
          {currentTask?.status === 'inactive' && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>This task is inactive.</strong> Students cannot access it using the task code.
              Click "Activate" to make it available again.
            </div>
          )}
        </div>

        {/* Share Task Card */}
        {currentTask?.taskCode && (
          <ShareTaskCard
            taskCode={currentTask.taskCode}
            isDisabled={currentTask.status === 'inactive'}
          />
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Active Students</h3>
            <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-slate-900">{activeStudents}</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-medium flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Live
                </span>
            </div>
        </Card>

        {/* Ready for Feedback - with batch generate button */}
        <Card className="border-purple-200 bg-purple-50" data-tutorial="generate-feedback">
             <h3 className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Ready for Feedback</h3>
             <div className="flex items-center justify-between mt-2">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-white text-purple-600 flex items-center justify-center font-bold text-sm shadow-sm">
                     {readyForFeedbackCount}
                   </div>
                   <p className="text-sm text-purple-800 leading-tight">Students waiting</p>
                 </div>
                 {readyForFeedbackCount > 0 && (
                   <Button
                     size="sm"
                     variant="primary"
                     onClick={handleBatchGenerate}
                     disabled={isBatchGenerating}
                     className="bg-purple-600 hover:bg-purple-700"
                   >
                     {isBatchGenerating ? (
                       <Loader2 className="w-4 h-4 animate-spin" />
                     ) : (
                       <>
                         <Zap className="w-3 h-3 mr-1" />
                         Generate All ({readyForFeedbackCount})
                       </>
                     )}
                   </Button>
                 )}
             </div>
        </Card>

        {/* Needs Review */}
        <Card className="border-blue-200 bg-blue-50">
             <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Needs Review</h3>
             <div className="flex items-center gap-3 mt-2">
                 <div className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold text-sm shadow-sm">
                   {taskStudents.filter(s => s.status === 'submitted').length}
                 </div>
                 <p className="text-sm text-blue-800 leading-tight">Feedback ready for approval</p>
             </div>
        </Card>

        {/* Credits Display */}
        <Card className="border-slate-200">
             <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Feedback Credits</h3>
             <div className="flex items-end justify-between mt-2">
                 <div>
                   <span className="text-2xl font-bold text-slate-900">{credits.remaining}</span>
                   <span className="text-sm text-slate-500 ml-1">remaining</span>
                 </div>
                 <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                   {credits.used} used
                 </span>
             </div>
             {sessionFeedbacksGenerated !== undefined && (
               <div className="text-sm text-slate-600 mt-2">
                 Feedbacks used this session: <span className="font-semibold">{sessionFeedbacksGenerated}</span>
               </div>
             )}
        </Card>
      </div>

      {/* Student List */}
      <Card noPadding>
          <div className="px-6 py-4 border-b border-slate-100 bg-white">
            <h3 className="font-semibold text-slate-900">Student Progress</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-3">Student Name</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {taskStudents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                          No students have joined this task yet. Share the task code to invite students.
                        </td>
                      </tr>
                    ) : (
                      taskStudents.map(student => (
                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                            <td className="px-6 py-4"><StatusBadge status={student.status} /></td>
                            <td className="px-6 py-4 text-right">
                                {student.status === 'ready_for_feedback' && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleGenerateFeedback(student.id)}
                                    disabled={generatingStudentId === student.id}
                                    className="bg-purple-600 hover:bg-purple-700"
                                  >
                                    {generatingStudentId === student.id ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="w-4 h-4 mr-1" />
                                        Generate Feedback
                                      </>
                                    )}
                                  </Button>
                                )}
                                {student.status === 'generating' && (
                                  <span className="text-blue-600 text-xs font-medium flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Generating...
                                  </span>
                                )}
                                {student.status === 'submitted' && (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => onNavigateToReview(student.id)}
                                    leftIcon={<ClipboardCheck className="w-4 h-4" />}
                                  >
                                    Review
                                  </Button>
                                )}
                                {student.status === 'active' && (
                                  <span className="text-slate-400 text-xs italic">Writing...</span>
                                )}
                                {student.status === 'feedback_ready' && (
                                  <span className="text-emerald-600 text-xs font-medium">Feedback Sent</span>
                                )}
                                {student.status === 'revising' && (
                                  <span className="text-amber-600 text-xs font-medium">Revising work...</span>
                                )}
                                {student.status === 'completed' && (
                                  <span className="text-slate-600 text-xs font-medium">Completed</span>
                                )}
                            </td>
                        </tr>
                      ))
                    )}
                </tbody>
            </table>
          </div>
      </Card>
    </div>
  );
};