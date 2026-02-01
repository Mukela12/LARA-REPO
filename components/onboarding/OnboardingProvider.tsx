import React, { createContext, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { tutorialSteps, TutorialStep, ONBOARDING_KEY } from './tutorialSteps';
import { TutorialOverlay } from './TutorialOverlay';

interface OnboardingContextType {
  isActive: boolean;
  currentStep: number;
  currentStepData: TutorialStep | null;
  totalSteps: number;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
}

export const OnboardingContext = createContext<OnboardingContextType | null>(null);

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Small delay to let the UI render first
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    setHasCheckedStorage(true);
  }, []);

  const currentStepData = isActive ? tutorialSteps[currentStep] : null;

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete the tutorial
      localStorage.setItem(ONBOARDING_KEY, 'true');
      setIsActive(false);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsActive(false);
  }, []);

  const completeTutorial = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsActive(false);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skipTutorial();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        prevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, prevStep, skipTutorial]);

  const value: OnboardingContextType = {
    isActive,
    currentStep,
    currentStepData,
    totalSteps: tutorialSteps.length,
    startTutorial,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {isActive && typeof document !== 'undefined' && createPortal(
        <TutorialOverlay />,
        document.body
      )}
    </OnboardingContext.Provider>
  );
};
