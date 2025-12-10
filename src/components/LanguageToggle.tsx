import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LanguageToggle = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
  };

  const isEn = i18n.language === 'en';

  return (
    <div
      role="switch"
      aria-checked={isEn}
      onClick={toggleLanguage}
      className="inline-flex items-center gap-2 rounded-full border border-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] px-[3px] py-[3px] shadow-[0_8px_20px_rgba(0,0,0,0.18)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.22)] cursor-pointer select-none transition-all duration-300"
    >
      <div className="flex items-center gap-2 rounded-full bg-background/90 px-2 py-1 shadow-[inset_0_1px_2px_rgba(255,255,255,0.65)]">
        <Languages className="h-4 w-4 text-muted-foreground/80" />
        <div className="flex text-[11px] font-semibold rounded-full bg-muted/60 p-0.5">
          <span
            className={cn(
              'px-2 py-0.5 rounded-full transition-colors',
              isEn
                ? 'bg-[hsl(var(--brand-cool-start))] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_4px_10px_rgba(15,23,42,0.35)]'
                : 'text-muted-foreground/80'
            )}
          >
            EN
          </span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full transition-colors',
              !isEn
                ? 'bg-[hsl(var(--brand-warm-end))] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_4px_10px_rgba(15,23,42,0.35)]'
                : 'text-muted-foreground/80'
            )}
          >
            ع
          </span>
        </div>
      </div>
    </div>
  );
};
