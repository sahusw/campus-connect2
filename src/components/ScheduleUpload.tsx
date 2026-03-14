import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { MOCK_CLASSES } from '@/lib/mockData';
import { Upload, Image, FileText, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ScheduleUpload() {
  const { setStep, setClasses } = useAppStore();
  const [dragOver, setDragOver] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    simulateUpload();
  }, []);

  const handleFileSelect = () => {
    simulateUpload();
  };

  const simulateUpload = () => {
    setUploaded(true);
    setParsing(true);
    // Simulate AI parsing
    setTimeout(() => {
      setParsing(false);
      setParsed(true);
      setClasses(MOCK_CLASSES);
    }, 2000);
  };

  const proceed = () => {
    if (!parsed) {
      setClasses(MOCK_CLASSES);
    }
    setStep('dashboard');
  };

  return (
    <div className="min-h-screen campus-gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg space-y-6"
      >
        <div>
          <h1 className="text-3xl font-display mb-2">Upload your schedule</h1>
          <p className="text-muted-foreground">
            Drop a screenshot of your weekly class schedule. We support Canvas, Google Calendar, and more.
          </p>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={handleFileSelect}
          className={`campus-card cursor-pointer border-2 border-dashed p-12 text-center transition-all ${
            dragOver ? 'border-primary bg-campus-sage-light' : 'border-border hover:border-primary/40'
          } ${uploaded ? 'border-primary bg-campus-sage-light' : ''}`}
        >
          {!uploaded ? (
            <div className="space-y-3">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
              <div className="font-medium">Drop your schedule screenshot here</div>
              <div className="text-sm text-muted-foreground">or click to browse</div>
              <div className="flex justify-center gap-4 pt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Image className="w-3 h-3" /> PNG, JPG
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="w-3 h-3" /> PDF
                </div>
              </div>
            </div>
          ) : parsing ? (
            <div className="space-y-3">
              <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
              <div className="font-medium">Parsing your schedule with AI...</div>
              <div className="text-sm text-muted-foreground">Extracting courses, times, and days</div>
            </div>
          ) : (
            <div className="space-y-3">
              <Check className="w-10 h-10 mx-auto text-primary" />
              <div className="font-medium">Schedule parsed successfully!</div>
              <div className="text-sm text-muted-foreground">Found {MOCK_CLASSES.length} courses</div>
            </div>
          )}
        </div>

        {/* Parsed results */}
        {parsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            {MOCK_CLASSES.map((c) => (
              <div key={c.id} className={`campus-card p-3 flex items-center gap-3 border-l-4 ${c.color}`}>
                <div className="flex-1">
                  <div className="font-medium text-sm">{c.abbreviation}</div>
                  <div className="text-xs text-muted-foreground">{c.name}</div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{c.days.join('/')}</div>
                  <div>{c.startTime}–{c.endTime}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={proceed}>
            Skip for now
          </Button>
          <Button onClick={proceed} disabled={parsing} className="gap-2">
            {parsed ? 'Build My Week' : 'Continue'}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
