import React, { useState, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ArrowLeft, CheckCircle, Edit2, AlertCircle, RefreshCw, Clock, Target, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
import { Student, Submission, FeedbackSession, Task } from '../../types';
import { FeedbackEditForm } from './FeedbackEditForm';
import { FeedbackWarnings } from './FeedbackWarnings';
import { validateFeedback, FeedbackWarning } from '../../lib/validation';

interface TeacherReviewViewProps {
  student: Student;
  submission: Submission;
  task?: Task; // Task for validation against success criteria
  onBack: () => void;
  onApprove: (studentId: string, isMastered?: boolean) => void;
  onUpdateFeedback: (studentId: string, feedback: FeedbackSession) => void;
  onRegenerateFeedback: (studentId: string) => Promise<boolean>;
}

export const TeacherReviewView: React.FC<TeacherReviewViewProps> = ({
  student,
  submission,
  task,
  onBack,
  onApprove,
  onUpdateFeedback,
  onRegenerateFeedback
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showPreviousContent, setShowPreviousContent] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());

  // Mastery toggle - initialize from AI suggestion
  const aiSuggestsMastery = submission.feedback?.masteryAchieved ?? false;
  const [markAsMastered, setMarkAsMastered] = useState(aiSuggestsMastery);

  // Run validation on feedback
  const allWarnings = useMemo(() => {
    if (!submission.feedback) return [];
    return validateFeedback(submission.feedback, task?.successCriteria || []);
  }, [submission.feedback, task?.successCriteria]);

  // Filter out dismissed warnings
  const activeWarnings = useMemo(() => {
    return allWarnings.filter(w => !dismissedWarnings.has(w.id));
  }, [allWarnings, dismissedWarnings]);

  const handleDismissWarning = (warningId: string) => {
    setDismissedWarnings(prev => new Set([...prev, warningId]));
  };

  const handleDismissAllWarnings = () => {
    setDismissedWarnings(new Set(allWarnings.map(w => w.id)));
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    // Clear dismissed warnings when regenerating
    setDismissedWarnings(new Set());
    await onRegenerateFeedback(student.id);
    setIsRegenerating(false);
  };

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

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const Badge = ({ variant, children }: { variant: string; children: React.ReactNode }) => {
    const styles: Record<string, string> = {
      blue: "bg-blue-100 text-blue-700 border-blue-200",
      green: "bg-emerald-100 text-emerald-700 border-emerald-200",
      amber: "bg-amber-100 text-amber-700 border-amber-200",
      purple: "bg-purple-100 text-purple-700 border-purple-200"
    };
    return (
      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${styles[variant]}`}>
        {children}
      </span>
    );
  };

  const isRevision = submission.revisionCount > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Redesigned with 3-row layout */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Row 1: Navigation + Title */}
          <div className="flex items-center gap-4 py-4 border-b border-slate-100">
            <button
              onClick={onBack}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-slate-900">Review Feedback</h1>
          </div>

          {/* Row 2: Student Info Bar */}
          <div className="flex items-center justify-between py-3">
            {/* Left: Student identity */}
            <div className="flex items-center gap-3">
              <span className="text-base font-medium text-slate-900">{student.name}</span>
              {isRevision && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold">
                  Revision #{submission.revisionCount}
                </span>
              )}
            </div>

            {/* Right: Metadata */}
            {submission.timeElapsed && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Clock className="w-4 h-4" />
                <span>{formatTime(submission.timeElapsed)}</span>
              </div>
            )}
          </div>

          {/* Row 3: Actions */}
          <div className="flex items-center justify-between py-3 border-t border-slate-100">
            {/* Left: Secondary Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="text-slate-600"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Regenerate
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-slate-600"
              >
                <Edit2 className="w-4 h-4 mr-1.5" />
                Edit
              </Button>
              <span className="text-xs text-slate-400 ml-1">1 credit</span>
            </div>

            {/* Right: Primary Actions */}
            <div className="flex items-center gap-3">
              {/* Simplified Mastery Toggle */}
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={markAsMastered}
                  onChange={(e) => setMarkAsMastered(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className={`text-sm font-medium ${markAsMastered ? 'text-emerald-700' : 'text-slate-600'}`}>
                  Mastered
                </span>
                {aiSuggestsMastery && (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" title="AI Suggested" />
                )}
              </label>

              {/* Primary Approve Button */}
              <Button
                variant="primary"
                size="md"
                onClick={() => onApprove(student.id, markAsMastered)}
                className={markAsMastered ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve & Send
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Two-Column Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Student's Work */}
          <div className="space-y-4">
            {/* Selected Next Step - Show if this is a revision */}
            {isRevision && submission.selectedNextStep && (
              <Card className="border-purple-200 bg-purple-50">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-purple-900">Student's Selected Focus Area</h3>
                  </div>
                  <p className="text-purple-800">
                    <span className="font-medium">{submission.selectedNextStep.actionVerb}</span>{' '}
                    {submission.selectedNextStep.target}
                  </p>
                  <p className="text-sm text-purple-700">
                    Success indicator: {submission.selectedNextStep.successIndicator}
                  </p>
                </div>
              </Card>
            )}

            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {isRevision ? 'Revised Submission' : 'Student Submission'}
                  </h2>
                  <Badge variant={isRevision ? 'purple' : 'blue'}>
                    {isRevision ? 'Revised Work' : 'Original Work'}
                  </Badge>
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

                {/* Previous Content Comparison - Show if this is a revision */}
                {isRevision && submission.previousContent && (
                  <div className="border-t border-slate-200 pt-4">
                    <button
                      onClick={() => setShowPreviousContent(!showPreviousContent)}
                      className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      {showPreviousContent ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      {showPreviousContent ? 'Hide' : 'Show'} Previous Version
                    </button>

                    {showPreviousContent && (
                      <div className="mt-3 bg-amber-50 rounded-lg p-4 border border-amber-200">
                        <p className="text-xs font-medium text-amber-700 uppercase mb-2">Previous Submission</p>
                        <p className="text-slate-600 whitespace-pre-wrap leading-relaxed text-sm">
                          {submission.previousContent}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right: LARA-Generated Feedback */}
          <div className="space-y-4">
            {/* Validation Warnings */}
            {activeWarnings.length > 0 && (
              <FeedbackWarnings
                warnings={activeWarnings}
                onDismiss={handleDismissWarning}
                onDismissAll={handleDismissAllWarnings}
              />
            )}

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
