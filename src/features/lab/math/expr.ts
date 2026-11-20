/* A small, safe expression parser (no eval). Supports + - * / ^, unary minus,
   implicit multiplication (2x, 3(x+1), x sin x), functions and constants. */
export type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; n: string }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'neg'; a: Node }
  | { t: 'fn'; f: string; a: Node };

const FNS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function tokenize(src: string): string[] {
  const out: string[] = [];
  const s = src.replace(/\s+/g, '').replace(/π/g, 'pi').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; out.push(s.slice(i, j)); i = j; continue; }
    if (/[a-z]/i.test(c)) {
      let j = i; while (j < s.length && /[a-z]/i.test(s[j])) j++;
      let word = s.slice(i, j).toLowerCase();
      // split words like "xsinx" / "2pi" into known pieces
      while (word) {
        const known = [...Object.keys(FNS), ...Object.keys(CONSTS)].sort((a, b) => b.length - a.length).find((k) => word.startsWith(k));
        if (known) { out.push(known); word = word.slice(known.length); } else { out.push(word[0]); word = word.slice(1); }
      }
      i = j; continue;
    }
    if ('+-*/^(),'.includes(c)) { out.push(c); i++; continue; }
    throw new Error(`Unexpected character “${c}”`);
  }
  return out;
}

export function parse(src: string): Node {
  const tk = tokenize(src);
  let p = 0;
  const peek = () => tk[p];
  const eat = (x?: string) => { const t = tk[p++]; if (x && t !== x) throw new Error(`Expected “${x}”`); return t; };
  const startsAtom = (t?: string) => t != null && (/^[0-9.]/.test(t) || /^[a-z]/.test(t) || t === '(');
  function expr(): Node { let n = term(); while (peek() === '+' || peek() === '-') { const op = eat(); n = { t: 'bin', op, a: n, b: term() }; } return n; }
  function term(): Node {
    let n = unary();
    for (;;) {
      if (peek() === '*' || peek() === '/') { const op = eat(); n = { t: 'bin', op, a: n, b: unary() }; }
      else if (startsAtom(peek())) n = { t: 'bin', op: '*', a: n, b: power() }; // implicit multiplication
      else return n;
    }
  }
  function unary(): Node { if (peek() === '-') { eat(); return { t: 'neg', a: unary() }; } if (peek() === '+') { eat(); return unary(); } return power(); }
  function power(): Node { const base = atom(); if (peek() === '^') { eat(); return { t: 'bin', op: '^', a: base, b: unary() }; } return base; }
  function atom(): Node {
    const t = eat();
    if (t == null) throw new Error('Unexpected end of expression');
    if (/^[0-9.]/.test(t)) { const v = Number(t); if (Number.isNaN(v)) throw new Error(`Bad number “${t}”`); return { t: 'num', v }; }
    if (t === '(') { const n = expr(); eat(')'); return n; }
    if (FNS[t]) {
      if (peek() === '(') { eat('('); const a = expr(); eat(')'); return { t: 'fn', f: t, a }; }
      return { t: 'fn', f: t, a: power() };
    }
    if (t in CONSTS) return { t: 'num', v: CONSTS[t] };
    if (/^[a-z]$/.test(t)) return { t: 'var', n: t };
    throw new Error(`Unknown symbol “${t}”`);
  }
  const n = expr();
  if (p < tk.length) throw new Error(`Unexpected “${tk[p]}”`);
  return n;
}

export function evaluate(n: Node, vars: Record<string, number>): number {
  switch (n.t) {
    case 'num': return n.v;
    case 'var': if (!(n.n in vars)) throw new Error(`Unknown variable “${n.n}”`); return vars[n.n];
    case 'neg': return -evaluate(n.a, vars);
    case 'fn': return FNS[n.f](evaluate(n.a, vars));
    case 'bin': {
      const a = evaluate(n.a, vars); const b = evaluate(n.b, vars);
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : n.op === '/' ? a / b : Math.pow(a, b);
    }
  }
}

export function compile(src: string): (vars: Record<string, number>) => number {
  const tree = parse(src);
  return (vars) => evaluate(tree, vars);
}

export function variablesIn(src: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node): void => { if (n.t === 'var') out.add(n.n); else if (n.t === 'bin') { walk(n.a); walk(n.b); } else if (n.t === 'neg' || n.t === 'fn') walk(n.a); };
  walk(parse(src));
  return [...out];
}

export function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
