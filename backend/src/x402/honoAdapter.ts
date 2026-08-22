import type { Context } from "hono";
import type { HTTPAdapter, HTTPRequestContext } from "@x402/core/http";

// Bridges Hono's Fetch-API Context to @x402/core's transport-agnostic
// HTTPAdapter, so the same x402ResourceServer works regardless of framework.
export function honoAdapter(c: Context): HTTPAdapter {
  const url = new URL(c.req.url);
  return {
    getHeader: (name: string) => c.req.header(name) ?? undefined,
    getMethod: () => c.req.method,
    getPath: () => url.pathname,
    getUrl: () => c.req.url,
    getAcceptHeader: () => c.req.header("accept") ?? "",
    getUserAgent: () => c.req.header("user-agent") ?? "",
    getQueryParams: () => Object.fromEntries(url.searchParams),
    getQueryParam: (name: string) => url.searchParams.get(name) ?? undefined,
  };
}

export function requestContext(c: Context, routePattern?: string): HTTPRequestContext {
  return {
    adapter: honoAdapter(c),
    path: new URL(c.req.url).pathname,
    method: c.req.method,
    paymentHeader: c.req.header("X-PAYMENT") ?? undefined,
    routePattern,
  };
}
