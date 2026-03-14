import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { parseScheduleImage, fileToBase64 } from '@/lib/api';
import { Upload, Image, FileText, ArrowRight, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function ScheduleUpload() {
  const { setStep, setClasses } = useAppStore();
  const [dragOver, setDragOver] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [parsedClasses, setParsedClasses] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast({ title: 'Invalid file', description: 'Please upload an image or PDF file.', variant: 'destructive' });
      return;
    }

    setUploaded(true);
    setParsing(true);
    setError(null);

    try {
      const base64 = await fileToBase64(file);
      const classes = await parseScheduleImage(base64);

      if (classes.length === 0) {
        setError('No courses found. Try a clearer screenshot.');
        setParsing(false);
        return;
      }

      setParsedClasses(classes);
      setClasses(classes);
      setParsed(true);
      setParsing(false);
    } catch (e) {
      console.error('Parse error:', e);
      setError(e instanceof Error ? e.message : 'Failed to parse schedule');
      setParsing(false);
      setUploaded(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const proceed = () => {
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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleInputChange}
        />

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
              <div className="text-sm text-muted-foreground">Found {parsedClasses.length} courses</div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}

        {/* Parsed results */}
        {parsed && parsedClasses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            {parsedClasses.map((c) => (
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
