interface HeadersWithRaw {
  raw?: () => Record<string, string[]>;
}

/**
 * Set-Cookie nao pode ser combinado em um unico header. Quando o proxy do Next
 * recebe cookies da API, precisamos preservar cada header individualmente.
 */
export function forwardSetCookies(source: Headers, target: Headers): void {
  for (const cookie of readSetCookies(source)) {
    target.append('set-cookie', cookie);
  }
}

function readSetCookies(headers: Headers): string[] {
  const fromGetSetCookie = headers.getSetCookie();
  if (fromGetSetCookie?.length) return fromGetSetCookie;

  const fromRaw = (headers as HeadersWithRaw).raw?.()['set-cookie'];
  if (fromRaw?.length) return fromRaw;

  const combined = headers.get('set-cookie');
  return combined ? splitCombinedSetCookie(combined) : [];
}

function splitCombinedSetCookie(value: string): string[] {
  const cookies: string[] = [];
  let start = 0;
  let inExpires = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    const rest = value.slice(i);

    if (/^expires=/i.test(rest)) {
      inExpires = true;
      i += 'expires='.length - 1;
      continue;
    }

    if (inExpires && char === ';') {
      inExpires = false;
      continue;
    }

    if (!inExpires && char === ',' && /\s*[^=;,]+=/u.test(value.slice(i + 1))) {
      cookies.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }

  cookies.push(value.slice(start).trim());
  return cookies.filter(Boolean);
}
