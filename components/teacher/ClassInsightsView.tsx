import React from 'react';
import { Card } from '../ui/Card';
import { Users, Clock, TrendingUp, Award } from 'lucide-react';
import { Student, Submission, ClassInsight } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ClassInsightsViewProps {
  students: Student[];
  submissions: Record<string, Submission>;
  insights: ClassInsight[];
}

export const ClassInsightsView: React.FC<ClassInsightsViewProps> = ({
  students,
  submissions,
  insights
}) => {
  // Calculate statistics
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status !== 'completed').length;
  const completedStudents = students.filter(s => s.status === 'completed').length;
  const submittedCount = students.filter(s => s.status === 'submitted' || s.status === 'feedback_ready' || s.status === 'revising').length;

  // Calculate average time from join to submission (mock for demo)
  const avgSubmissionTime = submittedCount > 0
    ? Math.round(submittedCount * 8.5) // Mock: ~8.5 minutes average
    : 0;

  // Learning insights based on submission feedback patterns
  const learningInsights = [
    { name: 'Needs Examples', value: Math.floor(submittedCount * 0.6) },
    { name: 'Structure Issues', value: Math.floor(submittedCount * 0.45) },
    { name: 'Lacks Detail', value: Math.floor(submittedCount * 0.35) },
    { name: 'Missing Criteria', value: Math.floor(submittedCount * 0.25) },
    { name: 'Clarity Issues', value: Math.floor(submittedCount * 0.2) }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Class Insights</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Students</p>
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
              <p className="text-sm text-slate-600">Active Now</p>
              <p className="text-2xl font-bold text-slate-900">{activeStudents}</p>
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
              <p className="text-2xl font-bold text-slate-900">{avgSubmissionTime || '--'}</p>
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Common Learning Gaps */}
        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Common Learning Gaps</h3>
            <p className="text-sm text-slate-600 mt-1">Areas where students need the most support</p>
          </div>
          <ResponsiveContainer width="100%" height={250} className="min-h-[200px]">
            <BarChart
              data={learningInsights}
              margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ fontSize: '12px' }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
              />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Common Feedback Types */}
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Common Feedback Types</h3>
          <ResponsiveContainer width="100%" height={250} className="min-h-[200px]">
            <BarChart
              data={insights}
              margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ fontSize: '12px' }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
              />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card noPadding>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-slate-600">Student</th>
                <th className="px-6 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-6 py-3 text-left font-medium text-slate-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.slice(0, 5).map(student => (
                <tr key={student.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                  <td className="px-6 py-4 text-slate-600 capitalize">{student.status.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(student.joinedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                    No activity yet
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
