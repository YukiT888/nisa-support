import { clsx } from 'clsx';

export function Card({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-white/10 bg-kachi-tint/80 p-4 shadow-kachi backdrop-blur',
        className
      )}
    >
      {children}
    </div>
  );
}
