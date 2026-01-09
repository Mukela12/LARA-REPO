import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ArrowLeft, CheckCircle, Edit2, AlertCircle } from 'lucide-react';
import { Student, Submission, FeedbackSession } from '../../types';
import { FeedbackEditForm } from './FeedbackEditForm';

interface TeacherReviewViewProps {
  student: Student;
  submission: Submission;
  onBack: () => void;
  onApprove: (studentId: string) => void;
  onUpdateFeedback: (studentId: string, feedback: FeedbackSession) => void;
}

export const TeacherReviewView: React.FC<TeacherReviewViewProps> = ({
  student,
  submission,
  onBack,
  onApprove,
  onUpdateFeedback
}) => {
  const [isEditing, setIsEditing] = useState(false);

  if (!submission.feedback) {
    return null;
  }

  const handleSaveFeedback = (updatedFeedback: FeedbackSession) => {
    onUpdateFeedback(student.id, updatedFeedback);
    setIsEditing(false);
  };

  // If editing, show edit form
  if (isEditing) {
    return (
      <FeedbackEditForm
        initialFeedback={submission.feedback}
        onSave={handleSaveFeedback}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  const Badge = ({ variant, children }: { variant: string; children: React.ReactNode }) => {
    const styles: Record<string, string> = {
      blue: "bg-blue-100 text-blue-700 border-blue-200",
      green: "bg-emerald-100 text-emerald-700 border-emerald-200"
    };
    return (
      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${styles[variant]}`}>
        {children}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Back Button */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Review Feedback</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Student: {student.name}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Feedback
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => onApprove(student.id)}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve & Send to Student
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Two-Column Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Student's Work */}
          <div>
            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Student Submission
                  </h2>
                  <Badge variant="blue">Original Work</Badge>
                </div>

                <div className="prose prose-sm max-w-none">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {submission.content}
                    </p>
                  </div>
                </div>

                <div className="text-sm text-slate-500">
                  Submitted: {new Date(submission.timestamp).toLocaleString()}
                </div>
              </div>
            </Card>
          </div>

          {/* Right: LARA-Generated Feedback */}
          <div>
            <Card>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    LARA-Generated Feedback
                  </h2>
                  <Badge variant="green">Ready to Review</Badge>
                </div>

                {/* Goal */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Learning Goal</h3>
                  <p className="text-slate-600">{submission.feedback.goal}</p>
                </div>

                {/* Strengths */}
                <div>
                  <h3 className="text-sm font-medium text-emerald-700 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Working Well
                  </h3>
                  <div className="space-y-3">
                    {submission.feedback.strengths.map((strength, idx) => (
                      <div key={idx} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-sm text-emerald-900">{strength.text}</p>
                        {strength.anchors && strength.anchors.length > 0 && (
                          <div className="mt-2 text-xs text-emerald-700 italic">
                            "{strength.anchors[0]}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Growth Areas */}
                <div>
                  <h3 className="text-sm font-medium text-amber-700 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Needs Focus
                  </h3>
                  <div className="space-y-3">
                    {submission.feedback.growthAreas.map((area, idx) => (
                      <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm text-amber-900">{area.text}</p>
                        {area.anchors && area.anchors.length > 0 && (
                          <div className="mt-2 text-xs text-amber-700 italic">
                            "{area.anchors[0]}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Steps */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Suggested Next Steps</h3>
                  <div className="space-y-2">
                    {submission.feedback.nextSteps.map((step, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-slate-900">
                          {step.actionVerb} {step.target}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {step.successIndicator}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};
