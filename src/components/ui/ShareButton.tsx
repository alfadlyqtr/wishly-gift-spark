import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Share2, X, MessageCircle, Mail, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import './ShareButton.css';

// Social platform icons as SVG components
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-.809-.329-1.224-.72-1.227-1.153-.015-.345.27-.659.707-.824.152-.074.346-.104.539-.104.121 0 .285.015.436.074.399.18.779.27 1.078.3.15 0 .27-.029.359-.074-.015-.18-.027-.359-.044-.539l-.003-.06c-.104-1.627-.225-3.654.3-4.848 1.59-3.545 4.95-3.821 5.94-3.821h.393z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const MessagesIcon = () => (
  <MessageCircle className="w-5 h-5" />
);

interface ShareButtonProps {
  url?: string;
  title?: string;
  text?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  url,
  title = 'Check this out!',
  text = '',
  className = '',
  size = 'md',
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = text || title;

  // Close on Escape (works with the portaled menu)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  };

  const socialSizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const handleShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    switch (platform) {
      case 'email':
        window.open(`mailto:?subject=${encodedText}&body=${encodedUrl}`, '_self');
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, '_blank');
        break;
      case 'link':
        navigator.clipboard.writeText(shareUrl);
        toast.success(t('share.copied', 'Link copied to clipboard!'));
        break;
      case 'instagram':
        // Instagram doesn't have direct share URL, copy link instead
        navigator.clipboard.writeText(shareUrl);
        toast.success(t('share.copied_instagram', 'Link copied! Share it on Instagram'));
        break;
      case 'snapchat':
        window.open(`https://www.snapchat.com/share?url=${encodedUrl}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
        break;
      case 'messages':
        // Use native share if available, otherwise SMS link
        if (navigator.share) {
          navigator.share({ title, text: shareText, url: shareUrl });
        } else {
          window.open(`sms:?body=${encodedText}%20${encodedUrl}`, '_blank');
        }
        break;
    }
    setIsOpen(false);
  };

  // Social buttons configuration
  const socialButtons = [
    { id: 'email', icon: Mail, color: 'bg-[#ff4d4f] hover:brightness-110', textClass: 'text-white' },
    { id: 'whatsapp', icon: WhatsAppIcon, color: 'bg-[#25D366] hover:brightness-110', textClass: 'text-white' },
    { id: 'link', icon: Link2, color: 'bg-[#7c3aed] hover:brightness-110', textClass: 'text-white' },
    { id: 'messages', icon: MessagesIcon, color: 'bg-[#0B93F6] hover:brightness-110', textClass: 'text-white' },
    { id: 'facebook', icon: FacebookIcon, color: 'bg-[#1877F2] hover:brightness-110', textClass: 'text-white' },
    { id: 'snapchat', icon: SnapchatIcon, color: 'bg-[#FFFC00] hover:brightness-110', textClass: 'text-black' },
    { id: 'instagram', icon: InstagramIcon, color: 'bg-[#E4405F] hover:brightness-110', textClass: 'text-white' },
  ];

  // Fixed radial positions to mirror the provided overlay layout
  const radialPositions = [
    'share-pos-0',
    'share-pos-1',
    'share-pos-2',
    'share-pos-3',
    'share-pos-4',
    'share-pos-5',
    'share-pos-6',
  ];

  return (
    <div 
      ref={containerRef}
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      <ShareMenu
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        socialButtons={socialButtons}
        radialPositions={radialPositions}
        socialSizeClasses={socialSizeClasses}
        size={size}
        sizeClasses={sizeClasses}
        handleShare={handleShare}
        t={t}
      />

      {/* Main share button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-purple-600 to-purple-800 
          border border-purple-500/50 flex items-center justify-center text-white 
          transition-all duration-300 active:scale-95 shadow-lg shadow-purple-500/25
          hover:from-purple-500 hover:to-purple-700 z-20`}
        aria-label={isOpen ? 'Close share menu' : 'Share'}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Share2 className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};

// Separate Menu component to be portaled
const ShareMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  socialButtons: any[];
  radialPositions: string[];
  socialSizeClasses: any;
  size: 'sm' | 'md' | 'lg';
  sizeClasses: any;
  handleShare: (id: string) => void;
  t: any;
}> = ({
  isOpen,
  onClose,
  socialButtons,
  radialPositions,
  socialSizeClasses,
  size,
  sizeClasses,
  handleShare,
  t,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/55 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div
        className="relative w-[260px] h-[260px] max-w-[90vw] max-h-[90vh] select-none"
        onClick={(e) => e.stopPropagation()}
      >
            {socialButtons.map((social, idx) => {
          const Icon = social.icon;
          const posClass = radialPositions[idx % radialPositions.length];
          return (
            <button
              key={social.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleShare(social.id);
              }}
              className={`absolute left-1/2 top-1/2 share-orb ${posClass} ${socialSizeClasses[size]} rounded-full text-sm font-semibold shadow-xl transition active:scale-95 ${social.color} ${social.textClass || 'text-white'} flex items-center justify-center z-[100000] pointer-events-auto`}
              aria-label={`Share on ${social.id}`}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${sizeClasses[size]} rounded-full bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-2xl border border-white/40 flex items-center justify-center transition hover:from-purple-500 hover:to-purple-700 active:scale-95 z-[100001] pointer-events-auto`}
          aria-label={t('common.close', 'Close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default ShareButton;
