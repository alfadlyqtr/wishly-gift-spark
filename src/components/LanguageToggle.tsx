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
      className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-2 py-1 shadow-sm hover:shadow-md cursor-pointer select-none transition-shadow"
    >
      <Languages className="h-4 w-4 text-muted-foreground" />
      <div className="flex text-[11px] font-semibold rounded-full bg-muted/60 p-0.5">
        <span
          className={cn(
            'px-2 py-0.5 rounded-full transition-colors',
            isEn
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          )}
        >
          EN
        </span>
        <span
          className={cn(
            'px-2 py-0.5 rounded-full transition-colors',
            !isEn
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          )}
        >
          ع
        </span>
      </div>
    </div>
  );
};
