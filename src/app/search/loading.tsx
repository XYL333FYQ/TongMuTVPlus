import RouteSkeleton from '@/components/shell/RouteSkeleton';

// 切页时先显示的占位，避免点下去后出现一段空白
export default function Loading() {
  return <RouteSkeleton path='/search' variant='list' />;
}
