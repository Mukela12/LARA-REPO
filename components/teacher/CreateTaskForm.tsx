import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Plus, Trash2, Save, Edit3 } from 'lucide-react';
import { Task } from '../../types';
import { v4 as uuidv4 } from 'uuid';

// Universal Learning Expectations - EDberg Education standard criteria
export const UNIVERSAL_LEARNING_EXPECTATIONS = [
  "Clarity of response - Is the answer clear and easy to understand?",
  "Use of evidence and/or examples - Does the response include relevant evidence or examples?",
  "Reasoning and explanation - Is the thinking process explained?",
  "Organisation - Is the response well-structured?",
  "Language for audience and purpose - Is the language appropriate?"
];

interface CreateTaskFormProps {
  onSave: (task: Task) => void;
  onCancel: () => void;
  editTask?: Task | null; // Task to edit (null for create mode)
  onUpdate?: (taskId: string, updates: Partial<Task>) => void; // Update callback for edit mode
}

export const CreateTaskForm: React.FC<CreateTaskFormProps> = ({ onSave, onCancel, editTask, onUpdate }) => {
  const isEditMode = !!editTask;

  const [title, setTitle] = useState(editTask?.title || '');
  const [prompt, setPrompt] = useState(editTask?.prompt || '');
  const [useUniversalExpectations, setUseUniversalExpectations] = useState(
    editTask ? editTask.universalExpectations : false
  );
  const [criteria, setCriteria] = useState<string[]>(
    editTask?.successCriteria?.length ? editTask.successCriteria : ['']
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when editTask changes
  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setPrompt(editTask.prompt);
      setUseUniversalExpectations(editTask.universalExpectations);
      setCriteria(editTask.successCriteria?.length ? editTask.successCriteria : ['']);
    } else {
      setTitle('');
      setPrompt('');
      setUseUniversalExpectations(false);
      setCriteria(['']);
    }
  }, [editTask]);

  const handleAddCriteria = () => {
    setCriteria([...criteria, '']);
  };

  const handleCriteriaChange = (index: number, value: string) => {
    const newCriteria = [...criteria];
    newCriteria[index] = value;
    setCriteria(newCriteria);
  };

  const handleRemoveCriteria = (index: number) => {
    const newCriteria = criteria.filter((_, i) => i !== index);
    setCriteria(newCriteria);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Get the final criteria - use ULE if selected, otherwise custom
    const finalCriteria = useUniversalExpectations
      ? UNIVERSAL_LEARNING_EXPECTATIONS
      : criteria.filter(c => c.trim() !== '');

    // Simulate network delay
    setTimeout(() => {
      if (isEditMode && editTask && onUpdate) {
        // Update existing task
        onUpdate(editTask.id, {
          title,
          prompt,
          successCriteria: finalCriteria,
          universalExpectations: useUniversalExpectations,
        });
      } else {
        // Create new task
        const newTask: Task = {
          id: uuidv4(),
          title,
          prompt,
          successCriteria: finalCriteria,
          universalExpectations: useUniversalExpectations,
        };
        onSave(newTask);
      }
      setIsSubmitting(false);
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isEditMode && (
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <Edit3 className="w-5 h-5" />
            </div>
          )}
          <h2 className="text-xl font-bold text-slate-900">
            {isEditMode ? 'Edit Task' : 'Create New Task'}
          </h2>
        </div>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Title</label>
            <input 
              required
              type="text" 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              placeholder="e.g., Persuasive Essay: Climate Change"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Writing Prompt</label>
            <textarea 
              required
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              placeholder="What should the learners write about?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Success Criteria</label>
            <p className="text-xs text-slate-500">LARA will use these to generate feedback</p>
          </div>

          {/* Criteria Type Toggle */}
          <div className="flex p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setUseUniversalExpectations(true)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                useUniversalExpectations
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Universal Expectations
            </button>
            <button
              type="button"
              onClick={() => setUseUniversalExpectations(false)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                !useUniversalExpectations
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Criteria
            </button>
          </div>

          {/* Show ULE preview when selected */}
          {useUniversalExpectations ? (
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-brand-800">Universal Learning Expectations:</p>
              <ul className="space-y-1.5">
                {UNIVERSAL_LEARNING_EXPECTATIONS.map((exp, index) => (
                  <li key={index} className="text-sm text-brand-700 flex items-start gap-2">
                    <span className="text-brand-500 mt-0.5">•</span>
                    {exp}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            /* Custom criteria inputs */
            <>
              <div className="space-y-3">
                {criteria.map((criterion, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder={`Criterion ${index + 1}`}
                      value={criterion}
                      onChange={(e) => handleCriteriaChange(index, e.target.value)}
                    />
                    {criteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCriteria(index)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCriteria}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Add Criteria
                </Button>
              </div>
            </>
          )}
        </Card>

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            size="lg"
            isLoading={isSubmitting}
            leftIcon={isEditMode ? <Edit3 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          >
            {isEditMode ? 'Save Changes' : 'Publish Task'}
          </Button>
        </div>
      </form>
    </div>
  );
};