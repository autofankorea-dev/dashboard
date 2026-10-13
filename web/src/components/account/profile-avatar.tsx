"use client";

import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  url: string | null;
  className?: string;
};

/** 계정 원. 사진이 없거나 읽기 실패면 사람 실루엣. */
export function ProfileAvatar({ url, className }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = Boolean(url) && failedUrl !== url;

  useEffect(() => {
    const img = imgRef.current;
    if (!url || !img) return;
    if (img.complete && img.naturalWidth === 0) setFailedUrl(url);
  }, [url]);

  return (
    <span
      className={cn(
        dashboardUi.headerAccountAvatar,
        "overflow-hidden",
        className,
      )}
    >
      {showPhoto && url ? (
        // 제공자 CDN. next/image 최적화 경로는 외부 호스트 허용이 필요하다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <User className="size-[1.25em]" strokeWidth={1.75} aria-hidden />
      )}
    </span>
  );
}
