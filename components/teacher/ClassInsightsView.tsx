import React, { useMemo } from 'react';
import { Card } from '../ui/Card';
import { Users, Clock, TrendingUp, Award, BarChart3, AlertTriangle, Lightbulb } from 'lucide-react';
import { Student, Submission, Task } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TaskSelector } from './TaskSelector';

interface ClassInsightsViewProps {
  students: Student[];
  submissions: Record<string, Submission>;
  tasks: Task[];
  selectedTaskId?: string;
  onSelectTask?: (taskId: string) => void;
}

export const ClassInsightsView: React.FC<ClassInsightsViewProps> = ({
  students,
  submissions,
  tasks,
  selectedTaskId,
  onSelectTask
}) => {
  const currentTask = tasks.find(t => t.id === selectedTaskId) || tasks[0];

  // Filter students for the selected task
  const taskStudents = useMemo(() => {
    if (!currentTask) return [];
    return students.filter(student => {
      const sub = submissions[student.id];
      if (sub && sub.taskId === currentTask.id) return true;
      if (student.taskId === currentTask.id) return true;
      return false;
    });
  }, [students, submissions, currentTask]);

  // Get all submissions with feedback for this task
  const taskSubmissions = useMemo((): Submission[] => {
    if (!currentTask) return [];
    return (Object.values(submissions) as Submission[]).filter(
      sub => sub.taskId === currentTask.id && sub.feedback
    );
  }, [submissions, currentTask]);

  // Aggregate common feedback patterns from real AI feedback
  const { feedbackTypes, learningGaps } = useMemo(() => {
    const strengthCounts: Record<string, number> = {};
    const growthCounts: Record<string, number> = {};

    taskSubmissions.forEach(sub => {
      if (!sub.feedback) return;

      // Count strength themes (use first ~40 chars as key to group similar)
      sub.feedback.strengths.forEach(s => {
        strengthCounts[s.text] = (strengthCounts[s.text] || 0) + 1;
      });

      // Count growth area themes
      sub.feedback.growthAreas.forEach(g => {
        growthCounts[g.text] = (growthCounts[g.text] || 0) + 1;
      });
    });

    // Sort by frequency and take top 5
    const truncate = (text: string, max: number) =>
      text.length > max ? text.substring(0, max).trim() + '...' : text;

    const feedbackTypes = Object.entries(strengthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([fullText, value]) => ({ name: truncate(fullText, 30), fullText, value }));

    const learningGaps = Object.entries(growthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([fullText, value]) => ({ name: truncate(fullText, 30), fullText, value }));

    return { feedbackTypes, learningGaps };
  }, [taskSubmissions]);

  // Aggregate next step patterns
  const nextStepPatterns = useMemo(() => {
    const stepCounts: Record<string, number> = {};
    taskSubmissions.forEach(sub => {
      if (!sub.feedback) return;
      sub.feedback.nextSteps.forEach(step => {
        const key = `${step.actionVerb} ${step.target}`;
        stepCounts[key] = (stepCounts[key] || 0) + 1;
      });
    });
    return Object.entries(stepCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [taskSubmissions]);

  // Statistics
  const totalStudents = taskStudents.length;
  const activeStudents = taskStudents.filter(s => s.status !== 'completed').length;
  const completedStudents = taskStudents.filter(s => s.status === 'completed').length;
  const feedbackCount = taskSubmissions.length;

  // Average time on task (from real timeElapsed data)
  const avgTime = useMemo(() => {
    const times = taskSubmissions
      .map(s => s.timeElapsed)
      .filter((t): t is number => t !== undefined && t > 0);
    if (times.length === 0) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length / 60); // in minutes
  }, [taskSubmissions]);

  const hasData = taskSubmissions.length > 0;

  // Custom tooltip that shows the full text on hover
  const InsightTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { fullText?: string; name: string; value: number } }> }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 max-w-xs">
        <p className="text-sm text-slate-700 mb-1">{data.fullText || data.name}</p>
        <p className="text-xs font-semibold text-slate-500">{data.value} {data.value === 1 ? 'learner' : 'learners'}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Class Insights</h1>
          <p className="text-sm text-slate-500 mt-1">
            Feedback patterns and learner analytics per task
          </p>
        </div>
        {tasks.length > 0 && onSelectTask && selectedTaskId && (
          <div className="max-w-sm">
            <TaskSelector
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
            />
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Learners</p>
              <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Feedback Generated</p>
              <p className="text-2xl font-bold text-slate-900">{feedbackCount}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Avg. Time (min)</p>
              <p className="text-2xl font-bold text-slate-900">{avgTime || '--'}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Completed</p>
              <p className="text-2xl font-bold text-slate-900">{completedStudents}</p>
            </div>
          </div>
        </Card>
      </div>

      {!hasData ? (
        <Card>
          <div className="text-center py-12 text-slate-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-slate-600">No feedback data yet</p>
            <p className="text-sm mt-1">
              Insights will appear here once LARA generates feedback for learners on this task.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Common Learning Gaps (from real growth areas) */}
            <Card className="!overflow-visible">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-semibold text-slate-900">Common Learning Gaps</h3>
                </div>
                <p className="text-sm text-slate-600">
                  Growth areas identified by LARA across learners on this task. Use these patterns to inform your teaching.
                </p>
              </div>
              {learningGaps.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, learningGaps.length * 50)}>
                  <BarChart
                    data={learningGaps}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#64748b"
                      tick={{ fontSize: 11 }}
                      width={200}
                    />
                    <Tooltip content={<InsightTooltip />} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 50 }} />
                    <Bar dataKey="value" fill="#f59e0b" name="Learners" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 py-8 text-center">No growth areas identified yet</p>
              )}
            </Card>

            {/* Common Feedback Types (from real strengths) */}
            <Card className="!overflow-visible">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-lg font-semibold text-slate-900">Common Strengths</h3>
                </div>
                <p className="text-sm text-slate-600">
                  Strengths identified by LARA across learners. These show what your class is doing well.
                </p>
              </div>
              {feedbackTypes.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, feedbackTypes.length * 50)}>
                  <BarChart
                    data={feedbackTypes}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#64748b"
                      tick={{ fontSize: 11 }}
                      width={200}
                    />
                    <Tooltip content={<InsightTooltip />} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 50 }} />
                    <Bar dataKey="value" fill="#10b981" name="Learners" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 py-8 text-center">No strengths identified yet</p>
              )}
            </Card>
          </div>

          {/* Common Next Steps */}
          {nextStepPatterns.length > 0 && (
            <Card>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-slate-900">Common Next Steps Suggested</h3>
                </div>
                <p className="text-sm text-slate-600">
                  The most frequent next steps LARA has suggested for this task. This can help you prioritise whole-class instruction.
                </p>
              </div>
              <div className="space-y-2">
                {nextStepPatterns.map((pattern, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-700 flex-1">{pattern.name}</span>
                    <span className="text-sm font-semibold text-blue-600 ml-4">
                      {pattern.value} {pattern.value === 1 ? 'learner' : 'learners'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Recent Activity Table */}
      <Card noPadding>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Learner Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-slate-600">Learner</th>
                <th className="px-6 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-6 py-3 text-left font-medium text-slate-600">Time on Task</th>
                <th className="px-6 py-3 text-left font-medium text-slate-600">Revisions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taskStudents.map(student => {
                const sub = submissions[student.id];
                const timeMin = sub?.timeElapsed ? Math.round(sub.timeElapsed / 60) : null;
                return (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                    <td className="px-6 py-4 text-slate-600 capitalize">{student.status.replace('_', ' ')}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {timeMin !== null ? `${timeMin} min` : '--'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {sub?.revisionCount || 0}
                    </td>
                  </tr>
                );
              })}
              {taskStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    No learners have joined this task yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
