import { useState } from 'react';
import { GAME_CONTENT_API } from '../GameContentContext';
import { catalogImageUrl } from '../gameContent';
export function ContentImage({ image, name, fallback, className = '' }: { image?: string; name: string; fallback?: string; className?: string }) {
  const [failed, setFailed] = useState<string>();
  const url = catalogImageUrl(image, GAME_CONTENT_API);
  return url && failed !== url
    ? <img src={url} alt={name} loading="lazy" onError={() => setFailed(url)} className={`content-image ${className}`} />
    : <span className={`content-image content-image-fallback ${className}`} role="img" aria-label={`${name} placeholder`}>{fallback || name.slice(0,1)}</span>;
}
