import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/LanguageToggle';
import { motion } from 'framer-motion';
import { Camera, Lock, Check, Gift, Heart, Share2, Store, Users, Sparkles } from 'lucide-react';

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

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

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
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Background decor */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl animate-pulse" />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-warm-start/5 blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>

      {/* Header (keep) */}
      <header className="relative z-10 container mx-auto px-4 py-6 flex justify-between items-center backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <img
            src="/wishly logo trans.png"
            alt="Wishly"
            className="h-14 sm:h-16 w-14 sm:w-16 rounded-full object-cover drop-shadow-lg"
          />
        </div>
        <LanguageToggle />
      </header>

      {/* HERO */}
      <section className="relative z-10 container mx-auto px-4 pt-12 pb-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="text-center lg:text-left space-y-8"
          >
            <motion.div variants={fadeIn} className="inline-block">
              <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-brand-warm-start/15 via-primary/10 to-accent/10 border border-primary/10 text-primary font-semibold text-xs tracking-wide uppercase flex items-center gap-2 w-fit mx-auto lg:mx-0 shadow-sm">
                <Sparkles className="w-4 h-4" />
                {t('home.hero_badge', 'The #1 social wishlist app')}
              </span>
            </motion.div>

            <motion.h1
              variants={fadeIn}
              className="text-5xl md:text-7xl font-bold tracking-tight text-primary leading-[1.1]"
            >
              {t('hero.title')}
            </motion.h1>

            <motion.p
              variants={fadeIn}
              className="text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              {t('hero.subtitle')}
            </motion.p>

            <motion.div
              variants={fadeIn}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button
                size="lg"
                onClick={() => navigate('/signup')}
                className="h-14 px-8 text-lg rounded-full bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white shadow-lg shadow-brand-warm-end/25 hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                {t('hero.cta_signup')}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/login')}
                className="h-14 px-8 text-lg rounded-full border-2 hover:bg-primary/5 transition-all duration-300"
              >
                {t('hero.cta_login')}
              </Button>
            </motion.div>

            <motion.div
              variants={fadeIn}
              className="pt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-muted-foreground/70"
            >
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 shadow-xs">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{t('home.hero_stat_gifters', 'Join 10k+ gifters')}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-warm-start/5 border border-brand-warm-start/20 shadow-xs">
                <Gift className="w-4 h-4 text-brand-warm-start" />
                <span className="text-sm font-medium">{t('home.hero_stat_free', '100% free')}</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Floating wish visuals */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative hidden lg:block"
          >
            <div className="relative w-full aspect-square max-w-[600px] mx-auto">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-primary/20 to-brand-warm-start/20 rounded-full blur-3xl animate-pulse" />

              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-[10%] right-[8%] w-64 bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/30 z-20"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-brand-warm-start/20 flex items-center justify-center text-brand-warm-start">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{t('home.card_birthday_title', 'Birthday wishlist')}</div>
                    <div className="text-xs text-muted-foreground">{t('home.card_birthday_meta', '5 items added')}</div>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full w-full mb-2 overflow-hidden">
                  <div className="h-full bg-brand-warm-start w-2/3" />
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-[18%] left-[4%] w-72 bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/30 z-30"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-lg">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold">{t('home.card_product_title', 'AirPods Pro')}</div>
                    <div className="text-sm text-muted-foreground">{t('home.card_product_meta', 'Added by Sarah')}</div>
                  </div>
                  <Button
                    size="sm"
                    className="ml-auto rounded-full px-4 bg-brand-warm-start hover:bg-brand-warm-end text-white border-0"
                  >
                    {t('home.card_gift_button', 'Gift')}
                  </Button>
                </div>
              </motion.div>

              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-brand-warm-start/10 rounded-[3rem] rotate-6 border border-white/40 backdrop-blur-sm z-10" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="relative z-10 container mx-auto px-4 py-24">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold text-primary">
            {t('home.features_title', 'Everything you need to wish better')}
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('home.features_subtitle', 'Wishly brings the joy back to gifting with features designed for real connections.')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: Share2,
              title: t('home.feature_share_title', 'Share anywhere'),
              desc: t('home.feature_share_desc', 'One link for all your wishes. Share on Instagram, TikTok, or WhatsApp.')
            },
            {
              icon: Lock,
              title: t('home.feature_privacy_title', 'Smart privacy'),
              desc: t('home.feature_privacy_desc', 'Control exactly who sees what. Keep some lists for friends, others for everyone.')
            },
            {
              icon: Gift,
              title: t('home.feature_nodupes_title', 'No duplicate gifts'),
              desc: t('home.feature_nodupes_desc', 'We track reservations so you never unwrap the same gift twice.')
            },
            {
              icon: Camera,
              title: t('home.feature_ai_title', 'AI magic'),
              desc: t('home.feature_ai_desc', 'Snap a photo of any product and let our AI fill in the details instantly.')
            },
            {
              icon: Heart,
              title: t('home.feature_social_title', 'Social wish feed'),
              desc: t('home.feature_social_desc', 'See what your friends are wishing for and get inspired for your own list.')
            },
            {
              icon: Store,
              title: t('home.feature_brands_title', 'Brand connect'),
              desc: t('home.feature_brands_desc', 'Follow your favourite brands and discover drops that match your wishlist.')
            }
          ].map((feature, i) => (
            <MagicCard key={feature.title} icon={feature.icon} title={feature.title} desc={feature.desc} index={i} />
          ))}
        </div>
      </section>

      {/* PERSONAL VS BUSINESS CTA */}
      <section className="relative z-10 container mx-auto px-4 py-24">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 p-12 text-center hover:shadow-2xl hover:shadow-primary/25 transition-all duration-500 border border-primary/15">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 text-primary text-xs font-semibold uppercase tracking-wide shadow-sm">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {t('home.personal_title', 'For you')}
              </div>
              <div className="w-16 h-16 mx-auto bg-white rounded-2xl shadow-lg flex items-center justify-center text-primary">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold">{t('home.personal_title', 'For you')}</h3>
              <p className="text-muted-foreground">
                {t('home.personal_body', 'Create lists, share with friends, and finally get the gifts you actually want.')}
              </p>
              <Button
                onClick={() => navigate('/signup/user')}
                variant="outline"
                className="rounded-full border-primary/30 hover:bg-primary hover:text-white"
              >
                {t('home.personal_cta', 'Create personal account')}
              </Button>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-warm-start/10 via-brand-warm-end/5 to-accent/10 p-12 text-center hover:shadow-2xl hover:shadow-brand-warm-end/25 transition-all duration-500 border border-brand-warm-start/25">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-warm-start/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 text-brand-warm-start text-xs font-semibold uppercase tracking-wide shadow-sm">
                <span className="w-2 h-2 rounded-full bg-brand-warm-start" />
                {t('home.business_title', 'For brands')}
              </div>
              <div className="w-16 h-16 mx-auto bg-white rounded-2xl shadow-lg flex items-center justify-center text-brand-warm-start">
                <Store className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold">{t('home.business_title', 'For brands')}</h3>
              <p className="text-muted-foreground">
                {t('home.business_body', 'Showcase your products, connect with gifters, and see what people are saving.')}
              </p>
              <Button
                onClick={() => navigate('/signup/business')}
                className="rounded-full bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white shadow-lg border-0"
              >
                {t('home.business_cta', 'Create business account')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS – upgraded visuals but same content */}
      <section className="relative z-10 container mx-auto px-4 py-24 bg-muted/40 rounded-[3rem]">
        <h2 className="text-4xl font-bold text-center mb-12 text-primary">
          {t('how_it_works.title')}
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.title as string}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              viewport={{ once: true }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-3xl transform group-hover:scale-105 transition-transform duration-500" />
              <div className="relative p-8 text-center space-y-6 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/60 shadow-xl">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <step.icon className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FINAL CTA – keep text, upgrade styling */}
      <section className="relative z-10 container mx-auto px-4 py-32 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto bg-primary text-white rounded-[3rem] p-12 md:p-24 relative overflow-hidden shadow-2xl"
        >
          <div className="absolute inset-0 opacity-10 mix-blend-overlay bg-[radial-gradient(circle_at_0_0,#fff,transparent_60%),radial-gradient(circle_at_100%_100%,#ffe4b5,transparent_55%)]" />
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-warm-start/40 rounded-full blur-[110px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/40 rounded-full blur-[110px] translate-x-1/2 translate-y-1/2" />

          <div className="relative z-10 space-y-8">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
              {t('final_cta.title')}
            </h2>
            <p className="text-xl text-white/85 max-w-2xl mx-auto">
              {t('home.final_cta_subtitle', 'Join thousands of people who are already making their wishes come true.')}
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/signup')}
              className="h-16 px-12 text-xl rounded-full bg-white text-primary hover:bg-white/90 hover:scale-105 transition-all duration-300 shadow-xl"
            >
              {t('final_cta.button')}
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer (keep, extended) */}
      <footer className="border-t py-6 mt-20 text-sm">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-muted-foreground">
          <p className="text-center md:text-left">
            {t('footer.copyright', '© 2025 Wishly. All rights reserved.')}
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
            <a href="#contact" className="hover:text-primary transition-colors">
              {t('footer.contact', 'Contact us')}
            </a>
            <a href="#privacy" className="hover:text-primary transition-colors">
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

type MagicCardProps = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  desc: string;
  index: number;
};

const MagicCard = ({ icon: Icon, title, desc, index }: MagicCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      viewport={{ once: true }}
      className="group relative p-1 rounded-3xl bg-gradient-to-br from-brand-warm-start via-primary to-brand-cool-end shadow-lg/40 transition-transform duration-500 hover:scale-[1.01]"
    >
      <div className="relative h-full bg-white rounded-[1.4rem] p-8 transition-colors shadow-xl group-hover:shadow-2xl group-hover:-translate-y-1 duration-300">
        <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors text-primary">
          <Icon className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold mb-3 text-primary group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-brand-warm-end transition-all">
          {title}
        </h3>
        <p className="text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
};

export default HomePage;
