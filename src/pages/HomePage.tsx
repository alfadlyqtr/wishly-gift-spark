import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/LanguageToggle';
import { LazyMotion, domAnimation, m as motion } from 'framer-motion';
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
    <LazyMotion features={domAnimation}>
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
              className="h-28 sm:h-32 w-28 sm:w-32 rounded-full object-cover drop-shadow-lg"
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
            className="relative block"
          >
            <div className="relative w-full aspect-square max-w-[320px] sm:max-w-[450px] lg:max-w-[600px] mx-auto">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-primary/20 to-brand-warm-start/20 rounded-full blur-3xl animate-pulse" />

              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-[8%] right-[4%] w-40 sm:w-52 lg:w-64 bg-white/80 backdrop-blur-xl p-2 sm:p-3 lg:p-4 rounded-xl sm:rounded-2xl shadow-2xl border border-white/30 z-20"
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-brand-warm-start/20 flex items-center justify-center text-brand-warm-start">
                    <Gift className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-[10px] sm:text-sm">{t('home.card_birthday_title', "Hassan's Birthday")}</div>
                    <div className="text-[8px] sm:text-xs text-muted-foreground">{t('home.card_birthday_meta', '5 items added')}</div>
                  </div>
                </div>
                <div className="h-1.5 sm:h-2 bg-muted rounded-full w-full mb-1 sm:mb-2 overflow-hidden">
                  <div className="h-full bg-brand-warm-start w-2/3" />
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-[20%] left-[4%] w-44 sm:w-56 lg:w-72 rounded-2xl lg:rounded-3xl bg-gradient-to-br from-primary/10 via-white to-brand-warm-start/20 p-[1.5px] shadow-[0_18px_45px_rgba(15,23,42,0.35)] z-20"
              >
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 bg-white/95 backdrop-blur-2xl rounded-xl lg:rounded-[1.35rem] px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 border border-white/70">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center text-white shadow-lg shadow-gray-900/40">
                    {/* Apple logo */}
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  </div>
                  <div>
                    <div className="font-bold text-[10px] sm:text-xs lg:text-sm">{t('home.card_product_title', 'AirPods Pro')}</div>
                    <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
                      <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] lg:text-[11px] font-medium bg-primary/5 text-primary/90">
                        {t('home.card_product_meta', 'Added by')} <span className="text-primary font-semibold ml-1">{t('home.card_product_name', 'Mozah')}</span>
                      </span>
                      <span className="h-[3px] w-10 rounded-full bg-gradient-to-r from-primary/60 via-accent/70 to-brand-warm-start/80" />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="ml-auto rounded-full px-2 sm:px-3 lg:px-4 text-[10px] sm:text-xs lg:text-sm h-6 sm:h-7 lg:h-8 bg-brand-warm-start hover:bg-brand-warm-end text-white border-0"
                  >
                    {t('home.card_gift_button', 'Gift')}
                  </Button>
                </div>
              </motion.div>

              {/* Second product card – middle left */}
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute top-[35%] left-[2%] w-36 sm:w-48 lg:w-64 rounded-2xl lg:rounded-3xl bg-gradient-to-br from-accent/15 via-white to-primary/15 p-[1.5px] shadow-[0_14px_35px_rgba(15,23,42,0.30)] z-20"
              >
                <div className="flex items-center gap-2 sm:gap-3 bg-white/95 backdrop-blur-2xl rounded-xl lg:rounded-[1.35rem] px-2 sm:px-3 py-1.5 sm:py-2 lg:py-2.5 border border-white/70">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/40">
                    {/* Nike swoosh */}
                    <svg className="w-4 h-3 sm:w-5 sm:h-3.5 lg:w-6 lg:h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21 8.719L7.836 14.303C6.74 14.768 5.818 15 5.075 15c-.836 0-1.445-.295-1.819-.884-.485-.76-.273-1.982.559-3.272.494-.754 1.122-1.446 1.734-2.108-.144.234-1.415 2.349-.025 3.345.275.197.618.298 1.02.298.409 0 .873-.117 1.395-.35L21 8.719z"/></svg>
                  </div>
                  <div>
                    <div className="font-bold text-[9px] sm:text-xs lg:text-sm">{t('home.card_product2_title', 'Nike Air Max')}</div>
                    <span className="inline-flex items-center px-1 sm:px-1.5 lg:px-2 py-0.5 rounded-full text-[7px] sm:text-[9px] lg:text-[10px] font-medium bg-accent/10 text-accent/90">
                      {t('home.card_product2_meta', 'Added by')} <span className="text-accent font-semibold ml-1">{t('home.card_product2_name', 'Alanoud')}</span>
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Third product card – bottom right */}
              <motion.div
                animate={{ y: [0, 18, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                className="absolute bottom-[6%] right-[4%] w-36 sm:w-48 lg:w-60 rounded-2xl lg:rounded-3xl bg-gradient-to-br from-brand-warm-start/15 via-white to-accent/15 p-[1.5px] shadow-[0_14px_35px_rgba(15,23,42,0.30)] z-20"
              >
                <div className="flex items-center gap-2 sm:gap-3 bg-white/95 backdrop-blur-2xl rounded-xl lg:rounded-[1.35rem] px-2 sm:px-3 py-1.5 sm:py-2 lg:py-2.5 border border-white/70">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white shadow-lg shadow-blue-600/40">
                    {/* PlayStation logo */}
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.876c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.393-1.502zm4.656 16.242l6.296-2.275c.715-.258.826-.625.246-.818-.586-.192-1.637-.139-2.357.123l-4.185 1.5v-2.385l.24-.085s1.201-.42 2.913-.615c1.696-.18 3.778.029 5.422.744 1.858.615 2.066 1.523 1.595 2.156-.478.63-1.651 1.106-1.651 1.106l-8.519 3.08v-2.531zm-9.585 2.193c-1.87-.631-2.164-1.941-1.317-2.61.784-.627 2.119-1.1 2.119-1.1l5.529-1.985v2.533l-3.978 1.441c-.715.263-.826.631-.246.823.586.192 1.637.139 2.357-.123l1.867-.681v2.257c-.186.035-.378.07-.577.1-1.768.27-3.65.058-5.754-.655z"/></svg>
                  </div>
                  <div>
                    <div className="font-bold text-[9px] sm:text-xs lg:text-sm">{t('home.card_product3_title', 'PS5 Controller')}</div>
                    <span className="inline-flex items-center px-1 sm:px-1.5 lg:px-2 py-0.5 rounded-full text-[7px] sm:text-[9px] lg:text-[10px] font-medium bg-brand-warm-start/10 text-brand-warm-start">
                      {t('home.card_product3_meta', 'Added by')} <span className="text-brand-warm-start font-semibold ml-1">{t('home.card_product3_name', 'Jabor')}</span>
                    </span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0.9, rotate: 3, scale: 0.98 }}
                animate={{ opacity: 1, rotate: 6, scale: 1, y: [0, -6, 0] }}
                transition={{ duration: 14, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                className="absolute inset-0 bg-gradient-to-tr from-primary/18 via-accent/12 to-brand-warm-start/18 rounded-[3rem] border border-white/60 backdrop-blur-lg shadow-[0_40px_100px_rgba(15,23,42,0.28)] z-10"
              />

              <motion.div
                animate={{ x: [0, 24, 0], y: [0, -16, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                className="absolute -top-10 left-[-6%] w-48 h-48 rounded-3xl bg-gradient-to-br from-brand-warm-start via-accent/90 to-primary/80 opacity-80 blur-lg z-[5]"
              />

              <motion.div
                animate={{ x: [0, -20, 0], y: [0, 18, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                className="absolute -bottom-16 right-[-8%] w-56 h-56 rounded-[2.5rem] bg-gradient-to-tl from-primary via-brand-cool-end/80 to-brand-warm-end opacity-75 blur-lg z-[5]"
              />

              {/* Third floating shape – top-right accent */}
              <motion.div
                animate={{ x: [0, -14, 0], y: [0, 12, 0] }}
                transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                className="absolute -top-6 right-[-4%] w-40 h-40 rounded-full bg-gradient-to-br from-accent via-brand-cool-start/80 to-primary/70 opacity-75 blur-lg z-[5]"
              />
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
            {t('footer.copyright', '© 2026 Wishly. All rights reserved.')}
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
                href="https://wakti.xyz/"
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-primary hover:underline"
              >
                {t('footer.made_by_name', 'wakti LLC')}
              </a>
            </span>
          </div>
        </div>
      </footer>
      </div>
    </LazyMotion>
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
