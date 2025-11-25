import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Lock, Check } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';
import wishlyLogo from '@/assets/wishly-logo.png';

const HomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) return;
    
    // Redirect to dashboard if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard');
      }
    });
  }, [navigate]);

  const steps = [
    {
      icon: Camera,
      title: t('how_it_works.step1_title'),
      description: t('how_it_works.step1_desc')
    },
    {
      icon: Lock,
      title: t('how_it_works.step2_title'),
      description: t('how_it_works.step2_desc')
    },
    {
      icon: Check,
      title: t('how_it_works.step3_title'),
      description: t('how_it_works.step3_desc')
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src={wishlyLogo} alt="Wishly" className="h-8 sm:h-10" />
        </div>
        <LanguageToggle />
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-primary">
          {t('hero.title')}
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          {t('hero.subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            onClick={() => navigate('/signup')}
            className="text-lg px-8 bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white hover:opacity-90"
          >
            {t('hero.cta_signup')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/login')}
          >
            {t('hero.cta_login')}
          </Button>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-4xl font-bold text-center mb-12 text-primary">
          {t('how_it_works.title')}
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <Card key={index} className="border-2 hover:border-primary/50 transition-colors bg-muted shadow-md">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                  <step.icon className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl font-bold mb-6 text-primary">{t('final_cta.title')}</h2>
        <Button
          size="lg"
          onClick={() => navigate('/signup')}
          className="text-lg px-12 bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white hover:opacity-90"
        >
          {t('final_cta.button')}
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 Wishly. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
