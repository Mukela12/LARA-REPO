import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClassInsight, Student, Task, Submission } from '../../types';
import { Users, Clock, ArrowUpRight, Copy, Plus, ClipboardCheck, List, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CreateTaskForm } from './CreateTaskForm';
import { ClassInsightsView } from './ClassInsightsView';
import { StudentList } from './StudentList';
import { TaskList } from './TaskList';
import { TaskSelector } from './TaskSelector';
import { useAppStore } from '../../lib/store';
import { formatTaskCode } from '../../lib/taskCodes';

interface TeacherDashboardProps {
  insights: ClassInsight[];
  students: Student[];
  tasks: Task[];
  submissions: Record<string, Submission>;
  selectedTaskId: string;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onCreateTask: (task: Task) => void;
  onApproveFeedback: (studentId: string) => void;
  onNavigateToReview: (studentId: string) => void;
  onSelectTask: (taskId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  insights,
  students,
  tasks,
  submissions,
  selectedTaskId,
  activeTab,
  onNavigate,
  onCreateTask,
  onApproveFeedback,
  onNavigateToReview,
  onSelectTask
}) => {
  const [linkCopied, setLinkCopied] = useState(false);
  const activeStudents = students.filter(s => s.status !== 'completed').length;
  const currentTask = tasks.find(t => t.id === selectedTaskId) || tasks[0];

  // Copy task link to clipboard
  const handleCopyTaskLink = () => {
    if (!currentTask?.taskCode) return;

    const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
    const taskLink = `${baseUrl}?taskCode=${currentTask.taskCode}`;

    navigator.clipboard.writeText(taskLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy link:', err);
    });
  };

  // Helper for Student List Table
  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        active: "bg-slate-100 text-slate-600",
        submitted: "bg-blue-100 text-blue-700",
        feedback_ready: "bg-emerald-100 text-emerald-700",
        revising: "bg-amber-100 text-amber-700",
        completed: "bg-slate-800 text-white",
    };
    const labels: Record<string, string> = {
        active: "Writing",
        submitted: "Needs Review",
        feedback_ready: "Feedback Sent",
        revising: "Revising",
        completed: "Done"
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${styles[status]}`}>
            {labels[status]}
        </span>
    );
  };

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
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">All Tasks</h2>
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
          <TaskList
            tasks={tasks}
            submissions={submissions}
            students={students}
            selectedTaskId={selectedTaskId}
            onSelectTask={(taskId) => {
              onSelectTask(taskId);
              onNavigate('dashboard');
            }}
          />
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
        <div className="bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 mb-2">
                {currentTask?.title || "No Active Task"}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-slate-500 text-sm">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                  <Clock className="w-3.5 h-3.5" /> Live
                </span>
                {currentTask?.taskCode && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Task Code:</span>
                    <button
                      onClick={handleCopyTaskLink}
                      className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-2 hover:bg-brand-100 hover:text-brand-700 transition-colors"
                    >
                      {formatTaskCode(currentTask.taskCode)}
                      {linkCopied ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
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
              >
                New Task
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Active Students</h3>
            <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-slate-900">{activeStudents}</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-medium flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Live
                </span>
            </div>
        </Card>
        
        <Card className="border-blue-200 bg-blue-50">
             <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Waiting for Review</h3>
             <div className="flex items-center gap-3 mt-2">
                 <div className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold text-sm shadow-sm">
                   {students.filter(s => s.status === 'submitted').length}
                 </div>
                 <p className="text-sm text-blue-800 leading-tight">Students waiting for approval</p>
             </div>
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
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                          No students joined yet. Join using the Student View.
                        </td>
                      </tr>
                    ) : (
                      students.map(student => (
                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                            <td className="px-6 py-4"><StatusBadge status={student.status} /></td>
                            <td className="px-6 py-4 text-right">
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