import { ArrowLeft } from 'lucide-react';

export function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-[color:var(--tm-muted)] hover:bg-[var(--tm-line)] transition-[opacity,transform] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
      aria-label='返回'
    >
      <ArrowLeft className='w-full h-full' />
    </button>
  );
}
