'use client';

import React, { useState, useEffect } from 'react';
import { Rocket, BookOpen, Download, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
  onLoadSampleData: () => void;
  onStartFromScratch: () => void;
  storageKey?: string;
}

export function WelcomeModal({
  isOpen,
  onClose,
  onStartTour,
  onLoadSampleData,
  onStartFromScratch,
  storageKey = 'marginmaster-welcome-shown'
}: WelcomeModalProps) {
  const [open, setOpen] = useState(isOpen);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  const handleClose = () => {
    localStorage.setItem(storageKey, 'true');
    setOpen(false);
    onClose();
  };

  const handleStartTour = () => {
    handleClose();
    onStartTour();
  };

  const handleLoadSampleData = () => {
    handleClose();
    onLoadSampleData();
  };

  const handleStartFromScratch = () => {
    handleClose();
    onStartFromScratch();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-2xl">Welcome to MarginMaster!</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-base mt-4">
            Your powerful pricing simulation studio for e-commerce success. 
            Calculate margins, compare scenarios, and optimize your profitability.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {/* Option cards */}
          <Card 
            className="p-4 cursor-pointer hover:border-primary transition-colors"
            onClick={handleStartTour}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Play className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Take a Product Tour</h3>
                <p className="text-sm text-muted-foreground">
                  Get a guided walkthrough of all features and learn how to maximize your results
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-4 cursor-pointer hover:border-primary transition-colors"
            onClick={handleLoadSampleData}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Download className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Load Sample Data</h3>
                <p className="text-sm text-muted-foreground">
                  Start with pre-filled templates for electronics, clothing, or home goods
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-4 cursor-pointer hover:border-primary transition-colors"
            onClick={handleStartFromScratch}
          >
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Start from Scratch</h3>
                <p className="text-sm text-muted-foreground">
                  Jump right in and create your own pricing scenarios
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Key features */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-medium mb-3">Key Features:</h4>
          <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Multi-scenario comparison
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Real-time margin calculations
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              FBA fee integration
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              ROI & profitability metrics
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={handleClose}>
            Skip for now
          </Button>
          <p className="text-xs text-muted-foreground">
            You can access this again from the help menu
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage welcome modal state
export function useWelcomeModal(storageKey = 'marginmaster-welcome-shown') {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(storageKey) === 'true';
    if (!hasSeenWelcome) {
      // Delay to ensure page is loaded
      setTimeout(() => setShowWelcome(true), 1000);
    }
  }, [storageKey]);

  const resetWelcome = () => {
    localStorage.removeItem(storageKey);
    setShowWelcome(true);
  };

  return { showWelcome, setShowWelcome, resetWelcome };
}