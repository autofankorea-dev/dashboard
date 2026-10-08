import { cn } from "@/lib/utils";

type Props = {
  stale?: boolean;
  children: React.ReactNode;
  className?: string;
};

/** 백그라운드 재조회 중 기존 화면의 밝기와 내용을 유지한다. */
export function StaleWhileRevalidateShell({
  stale = false,
  children,
  className,
}: Props) {
  return (
    <div
      className={cn("relative", className)}
      aria-busy={stale || undefined}
    >
      {children}
    </div>
  );
}
