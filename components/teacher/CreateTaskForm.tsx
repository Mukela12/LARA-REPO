import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Plus, Trash2, Save } from 'lucide-react';
import { Task } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface CreateTaskFormProps {
  onSave: (task: Task) => void;
  onCancel: () => void;
}

export const CreateTaskForm: React.FC<CreateTaskFormProps> = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [criteria, setCriteria] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    
    // Simulate network delay
    setTimeout(() => {
      const newTask: Task = {
        id: uuidv4(),
        title,
        prompt,
        successCriteria: criteria.filter(c => c.trim() !== ''),
        universalExpectations: true
      };
      onSave(newTask);
      setIsSubmitting(false);
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Create New Task</h2>
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
              placeholder="What should the students write about?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Success Criteria</label>
            <span className="text-xs text-slate-500">LARA will use these to generate feedback</span>
          </div>
          
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
        </Card>

        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            size="lg" 
            isLoading={isSubmitting}
            leftIcon={<Save className="w-5 h-5" />}
          >
            Publish Task
          </Button>
        </div>
      </form>
    </div>
  );
};