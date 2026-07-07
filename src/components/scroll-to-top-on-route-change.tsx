"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function ScrollToTopOnRouteChange() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.hash) {
      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [pathname, search]);

  return null;
}
