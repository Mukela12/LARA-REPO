import React from 'react';
import { Student } from '../../types';
import { Card } from '../ui/Card';
import { ChevronRight, Clock } from 'lucide-react';

interface StudentListProps {
  students: Student[];
  onNavigateToReview?: (studentId: string) => void;
}

export const StudentList: React.FC<StudentListProps> = ({ students, onNavigateToReview }) => {
  // Shared Badge Component
  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        active: "bg-slate-100 text-slate-600",
        submitted: "bg-blue-100 text-blue-700",
        feedback_ready: "bg-purple-100 text-purple-700",
        revising: "bg-amber-100 text-amber-700",
        completed: "bg-emerald-100 text-emerald-700",
    };
    
    return (
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${styles[status] || styles.active}`}>
            {status.replace('_', ' ')}
        </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
        <h3 className="font-semibold text-slate-900">Learner Progress</h3>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
          {students.length} Learners
        </span>
      </div>

      {/* DESKTOP TABLE VIEW (Hidden on Mobile) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                    <th className="px-6 py-3">Learner Name</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Last Action</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {students.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                        <td className="px-6 py-4"><StatusBadge status={student.status} /></td>
                        <td className="px-6 py-4 text-slate-500 flex items-center gap-2">
                           <Clock className="w-3 h-3 text-slate-400" />
                           <span>2m ago</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <button onClick={() => onNavigateToReview?.(student.id)} className="text-brand-600 hover:text-brand-700 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity">View Details</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* MOBILE LIST VIEW (Hidden on Desktop) */}
      <div className="lg:hidden divide-y divide-slate-100">
        {students.map(student => (
          <div key={student.id} onClick={() => onNavigateToReview?.(student.id)} className="p-4 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer">
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-slate-900">{student.name}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={student.status} />
                <span className="text-xs text-slate-400">• 2m ago</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </div>
        ))}
      </div>
    </div>
  );
};