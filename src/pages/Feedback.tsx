import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, MessageSquare, Bug, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type FeedbackType = 'suggestion' | 'bug' | 'feedback';

const feedbackTypes = [
  { id: 'suggestion' as FeedbackType, label: 'Suggestion', icon: Lightbulb, description: 'Feature idea or improvement' },
  { id: 'bug' as FeedbackType, label: 'Bug Report', icon: Bug, description: 'Something not working' },
  { id: 'feedback' as FeedbackType, label: 'General Feedback', icon: MessageSquare, description: 'Comments or questions' },
];

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = 'wku_feedback_last_submit';

const Feedback = () => {
  const [type, setType] = useState<FeedbackType>('feedback');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Check cooldown on mount and update timer
  useEffect(() => {
    const checkCooldown = () => {
      const lastSubmit = localStorage.getItem(STORAGE_KEY);
      if (lastSubmit) {
        const elapsed = Math.floor((Date.now() - parseInt(lastSubmit)) / 1000);
        const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed);
        setCooldownRemaining(remaining);
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cooldownRemaining > 0) {
      toast.error(`Please wait ${cooldownRemaining} seconds before submitting again`);
      return;
    }
    
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (message.trim().length < 10) {
      toast.error('Please provide more detail (at least 10 characters)');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-feedback', {
        body: { type, message: message.trim(), email: email.trim() || undefined }
      });

      if (error) throw error;
      
      if (data?.error === 'rate_limited') {
        toast.error('Too many submissions. Please try again later.');
        return;
      }

      // Set cooldown
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      setCooldownRemaining(COOLDOWN_SECONDS);

      toast.success('Feedback sent! Thank you for helping improve WKU Transit.');
      setMessage('');
      setEmail('');
      setType('feedback');
    } catch (error) {
      console.error('Error sending feedback:', error);
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = isSubmitting || !message.trim() || cooldownRemaining > 0;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Send Feedback</h1>
            <p className="text-xs text-muted-foreground">Help improve WKU Transit</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Feedback type selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">What type of feedback?</label>
            <div className="grid grid-cols-3 gap-2">
              {feedbackTypes.map((ft) => (
                <button
                  key={ft.id}
                  type="button"
                  onClick={() => setType(ft.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    type === ft.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <ft.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{ft.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">
              {feedbackTypes.find(ft => ft.id === type)?.description}
            </p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium text-foreground">
              Your message
            </label>
            <Textarea
              id="message"
              placeholder={
                type === 'bug' 
                  ? "Describe what happened and what you expected..."
                  : type === 'suggestion'
                  ? "Describe your idea or suggestion..."
                  : "Share your thoughts..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px] resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">{message.length}/1000</p>
          </div>

          {/* Optional email */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Only if you'd like a response to your feedback
            </p>
          </div>

          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isDisabled}
          >
            {isSubmitting ? (
              'Sending...'
            ) : cooldownRemaining > 0 ? (
              `Wait ${cooldownRemaining}s`
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Feedback
              </>
            )}
          </Button>
        </form>
      </div>
    </main>
  );
};

export default Feedback;
