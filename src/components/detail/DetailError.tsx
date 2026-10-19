import { AlertCircle } from 'lucide-react';

export default function DetailError({ message }: { message: string }) {
  return (
    <p className='tm-detail-error' role='alert'>
      <AlertCircle size={20} aria-hidden='true' />
      <span>{message}</span>
    </p>
  );
}
