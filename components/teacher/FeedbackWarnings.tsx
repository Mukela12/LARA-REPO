import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { FeedbackWarning, WarningSeverity } from '../../lib/validation';

interface FeedbackWarningsProps {
  warnings: FeedbackWarning[];
  onDismiss: (warningId: string) => void;
  onDismissAll: () => void;
}

export const FeedbackWarnings: React.FC<FeedbackWarningsProps> = ({
  warnings,
  onDismiss,
  onDismissAll,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (warnings.length === 0) {
    return null;
  }

  const strongWarnings = warnings.filter(w => w.severity === 'strong');
  const softWarnings = warnings.filter(w => w.severity === 'soft');

  const getSeverityStyles = (severity: WarningSeverity) => {
    if (severity === 'strong') {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-600',
        title: 'text-red-800',
        text: 'text-red-700',
        badge: 'bg-red-100 text-red-700',
      };
    }
    return {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: 'text-amber-600',
      title: 'text-amber-800',
      text: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-700',
    };
  };

  const WarningIcon = ({ severity }: { severity: WarningSeverity }) => {
    if (severity === 'strong') {
      return <AlertTriangle className="w-4 h-4" />;
    }
    return <AlertCircle className="w-4 h-4" />;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-slate-900">Feedback Balance Check</h3>
          </div>
          <div className="flex items-center gap-2">
            {strongWarnings.length > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                {strongWarnings.length} worth reviewing
              </span>
            )}
            {softWarnings.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                {softWarnings.length} idea{softWarnings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismissAll();
            }}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            Dismiss All
          </button>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Warning List */}
      {isExpanded && (
        <div className="divide-y divide-slate-100">
          {/* Strong warnings first */}
          {strongWarnings.map((warning) => {
            const styles = getSeverityStyles(warning.severity);
            return (
              <div
                key={warning.id}
                className={`p-4 ${styles.bg} flex items-start gap-3`}
              >
                <div className={`mt-0.5 ${styles.icon}`}>
                  <WarningIcon severity={warning.severity} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-semibold text-sm ${styles.title}`}>
                      {warning.title}
                    </h4>
                    {warning.location && (
                      <span className={`text-xs px-2 py-0.5 rounded ${styles.badge}`}>
                        {warning.location}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${styles.text}`}>
                    {warning.description}
                  </p>
                  {warning.matchedText && (
                    <p className={`text-xs mt-2 ${styles.text} opacity-75 italic`}>
                      Found: "{warning.matchedText}"
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDismiss(warning.id)}
                  className={`p-1 rounded hover:bg-white/50 ${styles.icon}`}
                  title="Dismiss warning"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {/* Soft warnings */}
          {softWarnings.map((warning) => {
            const styles = getSeverityStyles(warning.severity);
            return (
              <div
                key={warning.id}
                className={`p-4 ${styles.bg} flex items-start gap-3`}
              >
                <div className={`mt-0.5 ${styles.icon}`}>
                  <WarningIcon severity={warning.severity} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-semibold text-sm ${styles.title}`}>
                      {warning.title}
                    </h4>
                    {warning.location && (
                      <span className={`text-xs px-2 py-0.5 rounded ${styles.badge}`}>
                        {warning.location}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${styles.text}`}>
                    {warning.description}
                  </p>
                  {warning.matchedText && (
                    <p className={`text-xs mt-2 ${styles.text} opacity-75 italic`}>
                      Found: "{warning.matchedText}"
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDismiss(warning.id)}
                  className={`p-1 rounded hover:bg-white/50 ${styles.icon}`}
                  title="Dismiss warning"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      {isExpanded && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            These are suggestions to help you refine feedback. They do not block approval.
          </p>
        </div>
      )}
    </div>
  );
};
