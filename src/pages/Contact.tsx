import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, MessageCircle, Send, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Contact = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language && i18n.language.startsWith('ar');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !topic || !message) {
      toast.error(t('contact.fill_required', 'Please fill in all required fields'));
      return;
    }
    
    setSubmitting(true);
    try {
      // Get current user if logged in
      const { data: { user } } = await supabase.auth.getUser();

      // Rate limit: max 1 message per 24h per email
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const normalizedEmail = email.toLowerCase();

      // Client-side fallback lock: one message per 24h per email in this browser
      const lockKey = `wishly_contact_last_sent_${normalizedEmail}`;
      const lastSentRaw = typeof window !== 'undefined' ? window.localStorage.getItem(lockKey) : null;
      if (lastSentRaw) {
        const lastSent = parseInt(lastSentRaw, 10);
        if (!Number.isNaN(lastSent) && Date.now() - lastSent < 24 * 60 * 60 * 1000) {
          toast.error(t('contact.rate_limited', 'You already sent us a message today. Please wait before sending another.'));
          setSubmitting(false);
          return;
        }
      }

      const { count: recentCount, error: recentError } = await (supabase as any)
        .from('contact_messages')
        .select('id', { count: 'exact', head: true })
        .ilike('email', normalizedEmail)
        .gte('created_at', twentyFourHoursAgo);

      if (recentError) {
        console.error('Error checking contact rate limit:', recentError);
      } else if ((recentCount ?? 0) > 0) {
        toast.error(t('contact.rate_limited', 'You already sent us a message recently. Please wait before sending another.'));
        setSubmitting(false);
        return;
      }
      
      const { error } = await (supabase as any)
        .from('contact_messages')
        .insert({
          user_id: user?.id || null,
          name,
          email: normalizedEmail,
          topic,
          message,
          status: 'new',
        });
      
      if (error) throw error;
      
      setSubmitted(true);
      toast.success(t('contact.success', 'Your message has been sent successfully!'));
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(lockKey, Date.now().toString());
      }
      // Reset form
      setName('');
      setEmail('');
      setTopic('');
      setMessage('');
    } catch (err: any) {
      console.error('Error submitting contact form:', err);
      toast.error(t('errors.failed_to_send', 'Failed to send message. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-warm-start/5 blur-3xl"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <header className="relative z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/wishly logo trans.png"
              alt="Wishly"
              className="h-12 w-12 rounded-full object-cover drop-shadow-lg"
            />
            <div className={isAr ? 'text-right' : ''}>
              <h1 className="text-lg font-semibold tracking-tight">
                {isAr ? 'تواصل معنا' : 'Contact us'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? 'نسعد بسماع ملاحظاتك أو استفساراتك حول وشلي.'
                  : 'Wed love to hear your feedback or questions about Wishly.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href="/">{t('footer.back_home', 'Back to home')}</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-10 md:py-16">
        <div className="max-w-4xl mx-auto grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
          {/* Form side */}
          <section className={`space-y-6 bg-card/80 backdrop-blur rounded-3xl border border-border/50 p-6 md:p-8 shadow-xl ${
            isAr ? 'text-right' : ''
          }`}
          dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary">
                {isAr ? 'أرسل لنا رسالة' : 'Send us a message'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? 'استخدم النموذج أدناه للتواصل معنا. سنحاول الرد عليك في أقرب وقت ممكن.'
                  : 'Use the form below to reach out. Well get back to you as soon as we can.'}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1" htmlFor="name">
                  <span>{isAr ? 'الاسم' : 'Name'}</span>
                  <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isAr ? 'اسمك الكامل' : 'Your full name'}
                  className="bg-background/60"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1" htmlFor="email">
                  <span>{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
                  <span className="text-red-500">*</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAr ? 'بريدك الإلكتروني' : 'Your email address'}
                  className="bg-background/60"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1" htmlFor="topic">
                  <span>{isAr ? 'الموضوع' : 'Topic'}</span>
                  <span className="text-red-500">*</span>
                </label>
                <Select name="topic" required value={topic} onValueChange={setTopic} disabled={submitting}>
                  <SelectTrigger id="topic" className="bg-background/60">
                    <SelectValue
                      placeholder={
                        isAr
                          ? 'اختر نوع الرسالة (إساءة، ملاحظة، استفسار، مشكلة تقنية، طلب ميزة...)'
                          : 'Choose a topic (abuse, feedback, question, tech issue, feature request...)'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abuse">{isAr ? 'إبلاغ عن إساءة أو مخالفة' : 'Report abuse or violation'}</SelectItem>
                    <SelectItem value="feedback">{isAr ? 'ملاحظات عامة' : 'General feedback'}</SelectItem>
                    <SelectItem value="question">{isAr ? 'استفسار' : 'Question'}</SelectItem>
                    <SelectItem value="tech_issue">{isAr ? 'مشكلة تقنية' : 'Technical issue'}</SelectItem>
                    <SelectItem value="feature_request">{isAr ? 'طلب ميزة جديدة' : 'Feature request'}</SelectItem>
                    <SelectItem value="other">{isAr ? 'أخرى' : 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1" htmlFor="message">
                  <span>{isAr ? 'الرسالة' : 'Message'}</span>
                  <span className="text-red-500">*</span>
                </label>
                <Textarea
                  id="message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={isAr ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                  className="bg-background/60 resize-none"
                  disabled={submitting}
                />
              </div>

              <p className="text-[11px] text-muted-foreground/80">
                {isAr
                  ? 'ملاحظة: لا ترسل معلومات حساسة مثل كلمات المرور أو البيانات المالية عبر هذا النموذج.'
                  : 'Note: Please dont send sensitive information like passwords or full payment details in this form.'}
              </p>

              <Button type="submit" className="w-full md:w-auto rounded-full px-6" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : submitted ? (
                  <CheckCircle className="w-4 h-4 mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {submitting 
                  ? (isAr ? 'جاري الإرسال...' : 'Sending...') 
                  : submitted 
                    ? (isAr ? 'تم الإرسال' : 'Sent!') 
                    : (isAr ? 'إرسال الرسالة' : 'Send message')}
              </Button>
            </form>
          </section>

          {/* Info side */}
          <aside className={`space-y-6 ${isAr ? 'text-right' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-primary">
                {isAr ? 'طرق أخرى للتواصل' : 'Other ways to reach us'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? 'إذا كنت تفضّل، يمكنك التواصل معنا عبر البريد الإلكتروني أو قنواتنا الرسمية في متاجر التطبيقات.'
                  : 'If you prefer, you can also reach us via email or through our official channels in the app stores.'}
              </p>
            </div>

            <div className="space-y-4 rounded-3xl bg-card/80 border border-border/50 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    {isAr ? 'البريد الإلكتروني للدعم' : 'Support email'}
                  </p>
                  <p className="text-muted-foreground break-all">
                    support@wishly.app
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full bg-brand-warm-start/10 p-2 text-brand-warm-start">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    {isAr ? 'قنوات التواصل' : 'Communication channels'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {isAr
                      ? 'يمكنك العثور على روابط قنواتنا الرسمية داخل التطبيق أو في صفحة وشلي في متاجر التطبيقات.'
                      : 'You can find links to our official channels inside the app or on the Wishly page in the app stores.'}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground/80">
              {isAr
                ? 'نحاول قراءة جميع الرسائل، ولكن قد يستغرق الرد بعض الوقت حسب عدد الطلبات.'
                : 'We try to read every message, but response times may vary depending on request volume.'}
            </p>
          </aside>
        </div>
      </main>

      {/* Footer (same as HomePage) */}
      <footer className="border-t py-6 mt-20 text-sm">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-muted-foreground">
          <p className="text-center md:text-left">
            {t('footer.copyright', '© 2025 Wishly. All rights reserved.')}
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
            <a href="/contact" className="hover:text-primary transition-colors">
              {t('footer.contact', 'Contact us')}
            </a>
            <a href="/privacy" className="hover:text-primary transition-colors">
              {t('footer.privacy_terms', 'Privacy & Terms')}
            </a>
            <span className="inline-flex items-center gap-1">
              <span>{t('footer.made_by', 'Made by')}</span>
              <a
                href="https://tmw.qa/"
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-primary hover:underline"
              >
                {t('footer.made_by_name', 'TMW')}
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Contact;
