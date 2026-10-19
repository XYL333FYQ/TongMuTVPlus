import { ArrowLeft } from 'lucide-react';

export function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-muted hover:bg-line transition-[opacity,transform] min-h-[44px] tm-press min-w-[44px]'
      aria-label='返回'
    >
      <ArrowLeft className='w-full h-full' />
    </button>
  );
}
