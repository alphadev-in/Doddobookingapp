import { useState } from 'react';

export default function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2.5 text-sm">{url}</code>
      <button type="button" className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white"
        onClick={async () => {
          await navigator.clipboard.writeText(url).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}>{copied ? 'Copied ✓' : 'Copy booking link'}</button>
    </div>
  );
}
