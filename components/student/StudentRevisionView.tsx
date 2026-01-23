import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Task, NextStep, Submission } from '../../types';
import { Send, BookOpen, Clock, Edit3, RefreshCw, CheckCircle } from 'lucide-react';

interface StudentRevisionViewProps {
  task: Task | undefined;
  selectedStep: NextStep | null;
  submission: Submission | null;
  onSubmitRevision: (content: string, timeElapsed: number) => void;
  onCancel: () => void;
}

export const StudentRevisionView: React.FC<StudentRevisionViewProps> = ({
  task,
  selectedStep,
  submission,
  onSubmitRevision,
  onCancel
}) => {
  const originalContent = submission?.content || '';
  const currentRevisionCount = submission?.revisionCount || 0;
  const maxRevisionsReached = currentRevisionCount >= 3;

  const [revisionContent, setRevisionContent] = useState(originalContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revisionTimeElapsed, setRevisionTimeElapsed] = useState(0);

  // Show max revisions reached screen - neutral language (MVP1 compliance)
  if (maxRevisionsReached) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Revisions Complete</h2>
            <p className="text-slate-600">
              You've submitted 3 revisions on this task. Your teacher has your responses.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Submission Recorded</span>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Thank you for revising your work.
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={onCancel}
          >
            Return to Feedback
          </Button>
        </Card>
      </div>
    );
  }

  // Timer for revision
  useEffect(() => {
    const timer = setInterval(() => {
      setRevisionTimeElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitRevision = async () => {
    if (!revisionContent.trim() || !task) return;

    setIsSubmitting(true);

    // MVP1: No AI call on revision - teacher will generate when ready
    // Just submit the revised content
    onSubmitRevision(revisionContent, revisionTimeElapsed);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-52">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="p-1.5 bg-emerald-50 rounded text-emerald-700 flex-shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">Revising: {task?.title}</span>
          </div>

          {/* Timer Display */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <Clock className="w-4 h-4 text-emerald-600" />
              <div className="text-base font-bold text-emerald-700 font-mono leading-none">
                {formatTime(revisionTimeElapsed)}
              </div>
            </div>
            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
              Revision #{(submission?.revisionCount || 0) + 1}
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Selected Next Step Guidance */}
        {selectedStep && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-5 h-5 text-emerald-700" />
              <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wide">Your Focus Area</h3>
            </div>
            <p className="text-emerald-900 font-medium mb-2">
              {selectedStep.actionVerb} {selectedStep.target}
            </p>
            <p className="text-sm text-emerald-700">
              <span className="font-medium">Success looks like:</span> {selectedStep.successIndicator}
            </p>
          </div>
        )}

        {/* Task Prompt Reminder */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Original Prompt</h3>
          </div>
          <p className="text-slate-700 text-sm">{task?.prompt}</p>
        </div>

        {/* Revision Editor */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 ml-1">
            Your Revised Response
          </label>
          <textarea
            className="w-full h-96 p-5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-lg leading-relaxed shadow-sm resize-none font-serif"
            placeholder="Revise your work here..."
            value={revisionContent}
            onChange={(e) => setRevisionContent(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-20">
          <div className="max-w-2xl mx-auto space-y-2">
            <div className="flex items-center justify-between text-sm px-1">
              <div className="flex items-center gap-2">
                {revisionContent.length >= 10 && revisionContent !== originalContent ? (
                  <>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-emerald-600 font-medium">Ready to submit revision!</span>
                  </>
                ) : revisionContent === originalContent ? (
                  <>
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600">Make some changes to submit</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500">{10 - revisionContent.length} more characters needed</span>
                  </>
                )}
              </div>
              <span className="text-slate-400 font-mono text-xs">
                {revisionContent.length} characters
              </span>
            </div>

            <Button
              onClick={handleSubmitRevision}
              className="w-full h-14 text-lg font-bold shadow-xl shadow-emerald-500/30 bg-emerald-600 hover:bg-emerald-700"
              disabled={revisionContent.length < 10 || revisionContent === originalContent || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Submitting Revision...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Submit Revision
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel & Return to Feedback
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};
