export type RootCutoverRoutingOptions = {
  nextOrigin: string;
};

export type RootCutoverUpstream = {
  origin: string;
  url: string;
  legacy: false;
};

export function buildRootCutoverUpstream(
  requestUrl: URL,
  options: RootCutoverRoutingOptions,
): RootCutoverUpstream {
  const pathname = requestUrl.pathname;
  const search = requestUrl.search ?? "";

  return {
    origin: options.nextOrigin,
    url: `${options.nextOrigin}${pathname}${search}`,
    legacy: false,
  };
}
