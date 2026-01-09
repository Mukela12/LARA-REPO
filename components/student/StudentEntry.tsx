import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Task, FeedbackSession } from '../../types';
import { User, BookOpen, Clock, Send, FileText } from 'lucide-react';
import { generateFeedback } from '../../lib/gemini';
import confetti from 'canvas-confetti';

interface StudentEntryProps {
  task: Task;
  onJoin: (name: string) => void;
  onSubmitWork: (content: string, feedback: FeedbackSession, timeElapsed?: number) => void;
  isPending: boolean; // Is waiting for teacher approval
  studentId?: string; // Student ID for generating shareable link
  taskCode?: string; // Task code from URL (for task-specific access)
}

export const StudentEntry: React.FC<StudentEntryProps> = ({
  task,
  onJoin,
  onSubmitWork,
  isPending,
  studentId,
  taskCode
}) => {
  const [step, setStep] = useState<'name' | 'work' | 'analyzing' | 'waiting'>('name');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  // Timer state
  const [timeElapsed, setTimeElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update internal step if parent says we are pending
  useEffect(() => {
    if (isPending) {
      setStep('waiting');
    }
  }, [isPending]);

  // Timer logic - simplified
  useEffect(() => {
    if (step === 'work') {
      // Start timer when in work step
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      // Stop timer when not in work step
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [step]);

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Confetti animation
  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'];

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.1, 0.3),
          y: Math.random() - 0.2
        },
        colors: colors
      });

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.7, 0.9),
          y: Math.random() - 0.2
        },
        colors: colors
      });
    }, 250);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onJoin(name);
      setStep('work');
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setStep('analyzing');
    triggerConfetti(); // Trigger confetti animation

    try {
      // Call Gemini API
      const feedback = await generateFeedback(task.prompt, task.successCriteria, content);

      // Submit to store with timeElapsed (which sets status to 'submitted')
      onSubmitWork(content, feedback, timeElapsed);
      // Parent component will re-render and might keep us in 'waiting' if not approved
    } catch (error) {
      console.error('Failed to generate feedback:', error);
      setStep('work'); // Return to work state so student can retry

      // Show user-friendly error message
      alert(
        'Sorry, we could not generate feedback at this time. ' +
        'Please check your internet connection and try again. ' +
        'If the problem persists, contact your teacher.'
      );
    }
  };

  if (step === 'name') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full p-8 space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Student Login</h2>
            <p className="text-slate-500 text-sm mt-1">Join the session to start writing</p>
          </div>

          {/* Show task info if joining via task code */}
          {taskCode && task && (
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-brand-900">{task.title}</p>
                  <p className="text-xs text-brand-700 mt-1 line-clamp-2">{task.prompt}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
              <input 
                autoFocus
                required
                type="text" 
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base" size="lg">
              Join Session
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (step === 'analyzing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center space-y-6 max-w-md"
        >
          {/* Animated Icon */}
          <div className="relative">
            <motion.div
              animate={{
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center shadow-2xl shadow-brand-500/50"
            >
              <FileText className="w-10 h-10 text-white" />
            </motion.div>

            {/* Pulsing rings */}
            <motion.div
              animate={{
                scale: [1, 1.3],
                opacity: [0.5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut"
              }}
              className="absolute inset-0 rounded-full border-4 border-brand-500"
            />
          </div>

          {/* Loading Messages */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2"
          >
            <h2 className="text-2xl font-bold text-slate-900">
              Analyzing your work...
            </h2>
            <p className="text-sm text-slate-500">
              LARA is preparing personalized feedback for you
            </p>
          </motion.div>

          {/* Progress Bar */}
          <div className="w-full max-w-xs">
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "easeInOut" }}
                className="h-full bg-brand-500"
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (step === 'waiting' || isPending) {
    const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;

    // Generate shareable link with both taskCode and studentId when available
    let shareableLink = '';
    if (taskCode && studentId) {
      shareableLink = `${baseUrl}?taskCode=${taskCode}&studentId=${studentId}`;
    } else if (studentId) {
      shareableLink = `${baseUrl}?studentId=${studentId}`;
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Clock className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Waiting for Approval</h2>
              <p className="text-slate-600">
                Your teacher has received your work and is reviewing the feedback.
              </p>
            </div>

            {/* Shareable Link */}
            {shareableLink && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Save this link to check your feedback later:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareableLink}
                    className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(shareableLink);
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
       <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 shadow-sm">
         <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
           <div className="flex items-center gap-2 min-w-0 flex-1">
             <div className="p-1.5 bg-brand-50 rounded text-brand-700 flex-shrink-0">
                <BookOpen className="w-4 h-4" />
             </div>
             <span className="font-semibold text-slate-900 text-sm truncate">{task.title}</span>
           </div>

           {/* Timer Display */}
           <div className="flex items-center gap-3 flex-shrink-0">
             <div className="flex items-center gap-2 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200">
               <Clock className="w-4 h-4 text-brand-600" />
               <div className="text-right">
                 <div className="text-base font-bold text-brand-700 font-mono leading-none">
                   {formatTime(timeElapsed)}
                 </div>
               </div>
             </div>
             <span className="text-xs text-slate-500 hidden sm:inline">{name}</span>
           </div>
         </div>
       </div>

       <main className="max-w-2xl mx-auto p-4 space-y-6">
         <div className="bg-brand-50 border border-brand-100 rounded-xl p-5">
           <h3 className="text-sm font-bold text-brand-800 uppercase tracking-wide mb-2">Prompt</h3>
           <p className="text-slate-800 leading-relaxed">{task.prompt}</p>
         </div>

         <div className="space-y-2">
           <label className="block text-sm font-medium text-slate-700 ml-1">Your Response</label>
           <textarea 
              className="w-full h-96 p-5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-lg leading-relaxed shadow-sm resize-none font-serif"
              placeholder="Start typing here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
           />
         </div>

         <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-20">
            <div className="max-w-2xl mx-auto space-y-2">
              {/* Character Counter */}
              <div className="flex items-center justify-between text-sm px-1">
                <div className="flex items-center gap-2">
                  {content.length >= 10 ? (
                    <>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-emerald-600 font-medium">
                        Ready to submit!
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500">
                        {10 - content.length} more characters needed
                      </span>
                    </>
                  )}
                </div>
                <span className="text-slate-400 font-mono text-xs">
                  {content.length} characters
                </span>
              </div>

              {/* Enhanced Submit Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleSubmit}
                  className="w-full h-14 text-lg font-bold shadow-xl shadow-brand-500/30"
                  disabled={content.length < 10}
                >
                  <Send className="w-5 h-5 mr-2" />
                  {content.length >= 10 ? 'Submit for Feedback!' : `Write ${10 - content.length} more...`}
                </Button>
              </motion.div>
            </div>
         </div>
       </main>
    </div>
  );
};