import { useState } from 'react';
import { BowlFoodIcon } from '@phosphor-icons/react';
import { safeHttpUrl } from '../lib/recipe';

interface Props {
  src: string | null;
  alt?: string;
  className?: string;
  /** Load eagerly for above-the-fold hero images. */
  priority?: boolean;
  iconSize?: number;
}

/** Recipe photo with lazy loading and a graceful placeholder for missing or broken links. */
export default function RecipeImage({ src, alt = '', className = '', priority = false, iconSize = 40 }: Readonly<Props>) {
  const url = safeHttpUrl(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!url || failedUrl === url) {
    return (
      <div
        className={`grid place-items-center bg-gradient-to-br from-brand-50 via-stone-50 to-accent-50 text-stone-300 ${className}`}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        <BowlFoodIcon size={iconSize} weight="duotone" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      // Many recipe sites block hot-linked images when a foreign Referer is sent.
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
    />
  );
}
