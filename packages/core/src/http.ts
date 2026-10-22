import type { Http } from './types';

export const USER_AGENT =
  'Mozilla/5.0 (compatible; BlackerBot/0.1; prywatny monitor promocji, 1 zapytanie / kilka sekund)';

export class BlockedError extends Error {}

interface Options {
  /** Minimum gap between requests to the same host. */
  delayMs?: number;
  timeoutMs?: number;
}

/** Polite HTTP client: per-host rate limit, robots.txt, timeouts, one retry on 5xx. */
export function createHttp({ delayMs = 3000, timeoutMs = 20000 }: Options = {}): Http {
  const nextSlot = new Map<string, number>();
  const robots = new Map<string, Promise<RobotsRules>>();

  async function waitTurn(host: string) {
    const now = Date.now();
    const at = Math.max(now, nextSlot.get(host) ?? 0);
    nextSlot.set(host, at + delayMs);
    if (at > now) await new Promise((r) => setTimeout(r, at - now));
  }

  async function rawGet(url: string, accept: string): Promise<Response> {
    const host = new URL(url).host;
    await waitTurn(host);
    return fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: accept, 'Accept-Language': 'pl-PL,pl;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async function get(url: string, accept: string): Promise<Response> {
    const u = new URL(url);
    if (!robots.has(u.host)) robots.set(u.host, loadRobots(u.origin, (r) => rawGet(r, 'text/plain')));
    if (!(await robots.get(u.host)!).allows(u.pathname + u.search)) {
      throw new BlockedError(`robots.txt disallows ${url}`);
    }

    for (let attempt = 0; ; attempt++) {
      const res = await rawGet(url, accept);
      if (res.ok) return res;
      if (res.status === 403 || res.status === 429) {
        throw new BlockedError(`${res.status} from ${u.host} (antybot/limit) - pomijam`);
      }
      if (res.status >= 500 && attempt === 0) continue;
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
  }

  return {
    async text(url, init) {
      return (await get(url, init?.accept ?? 'text/html,application/xhtml+xml,application/xml')).text();
    },
    async json(url) {
      return (await get(url, 'application/json')).json();
    },
  };
}

interface RobotsRules {
  allows(path: string): boolean;
}

async function loadRobots(origin: string, fetchRobots: (url: string) => Promise<Response>): Promise<RobotsRules> {
  try {
    const res = await fetchRobots(`${origin}/robots.txt`);
    if (!res.ok) return { allows: () => true };
    return parseRobots(await res.text());
  } catch {
    return { allows: () => true };
  }
}

/** Minimal robots.txt: groups for "*" or "BlackerBot", longest matching rule wins, supports * and $. */
export function parseRobots(body: string, agent = 'blackerbot'): RobotsRules {
  type Rule = { allow: boolean; re: RegExp; len: number };
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | undefined;
  let lastWasAgent = false;

  for (const line of body.split(/\r?\n/)) {
    const [rawKey, ...rest] = line.replace(/#.*/, '').split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (!key) continue;
    if (key === 'user-agent') {
      if (!lastWasAgent || !current) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current || (key !== 'allow' && key !== 'disallow') || !value) continue;
    const pattern = value.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    current.rules.push({ allow: key === 'allow', re: new RegExp('^' + pattern), len: value.length });
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
  const rules = (specific.length ? specific : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules);

  return {
    allows(path) {
      let best: Rule | undefined;
      for (const r of rules) if (r.re.test(path) && (!best || r.len > best.len)) best = r;
      return !best || best.allow;
    },
  };
}
