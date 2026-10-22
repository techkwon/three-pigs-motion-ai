// 보고 페이지 동작. 글·표·카드는 이미 HTML에 있고(빌드 단계에서 data/results.json으로 만듦),
// 여기서는 그림(집·점·경사선)을 그리고, 실제 재생 클립과 스크롤 연출, 조작을 더한다.
import { sum, f1, fromResults } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const motion = () => !reduceMQ.matches;
reduceMQ.addEventListener('change', () => document.documentElement.classList.toggle('motion', motion()));
const h = (tag, attrs = {}, html) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else el.setAttribute(k, v === true ? '' : v);
  }
  if (html != null) el.innerHTML = html;
  return el;
};
const { CRIT, JUDGES, WORKS, ROUNDS, QUOTES, avgCrit, avgTotal, judgeTotal, votesText } = fromResults(JSON.parse($('#results-data').textContent));
// 블록 하나가 실패해도 나머지는 동작하게 가둔다(오류는 콘솔에 남김)
const safe = fn => { try { fn(); } catch (err) { console.error('[pigs]', err); } };
// 주소 쿼리 갱신(공유·새로고침용, 기록은 남기지 않음)
const setQuery = obj => {
  const u = new URL(location.href);
  Object.entries(obj).forEach(([k, v]) => (v == null || v === '' ? u.searchParams.delete(k) : u.searchParams.set(k, v)));
  if (u.href !== location.href) history.replaceState(history.state, '', u);
};
const R3 = ROUNDS[3];
const ORDER = R3.works; // 3라운드 평균 순위
const judgeName = Object.fromEntries(JUDGES.map(j => [j.k, j]));
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const shot = (k, n, size, ext) => `assets/shots/${k}/${n}-${size}.${ext}`;
const BUG_NOTE = ' (이 무렵 화면을 가로지르는 주황 띠는 첫째 돼지 팔이 늘어나는 버그)';
const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = u => (u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const decoded = img => (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
const onView = (el, fn, opts = { threshold: .25 }) => {
  if (!el) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }), opts);
  io.observe(el);
};
function setPicture(p, k, n, size, alt) {
  p.querySelector('source').srcset = shot(k, n, size, 'avif');
  const img = p.querySelector('img');
  img.loading = 'eager';
  img.src = shot(k, n, size, 'jpg');
  if (alt != null) img.alt = alt;
  return img;
}
function picture(k, n, size, alt) {
  const p = h('picture');
  p.append(h('source', { type: 'image/avif', srcset: shot(k, n, size, 'avif') }), h('img', { src: shot(k, n, size, 'jpg'), alt, decoding: 'async', width: size, height: Math.round(size * 9 / 16) }));
  return p;
}
let AVIF = false;
safe(() => {
  const t = new Image();
  t.onload = () => { AVIF = t.width > 0; };
  t.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
});
// 같은 시각 장면 목록(표지, 1초, 5~85초, 끝 화면)
const FR = [{ n: 'cover', t: null, label: '표지' }, { n: 's01', t: 1 }, ...Array.from({ length: 17 }, (_, i) => ({ n: 's' + String((i + 1) * 5).padStart(2, '0'), t: (i + 1) * 5 })), { n: 'end', t: null, label: '끝 화면' }];
const sceneAt = (w, f) => {
  if (f.t == null) return f.n === 'cover' ? '재생 전 표지' : '끝 화면 · 다시 보기';
  const W = WORKS[w];
  if (f.t > W.len) return `끝 화면(${W.len}초에 끝남)`;
  let s = W.scenes[0][1];
  W.scenes.forEach(([t, name]) => { if (t <= f.t) s = name; });
  return s;
};
const frLabel = (f, w) => (f.t == null ? f.label : `${mmss(f.t)} 장면`) + (w && f.t != null ? ` · ${sceneAt(w, f)}` : '');

/* ---------------- 테마 ---------------- */
safe(() => {
  const btn = $('#themeBtn');
  const sys = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : sys.matches);
  const sync = () => {
    root.classList.toggle('is-dark', isDark());
    btn.setAttribute('aria-label', isDark() ? '밝은 테마로 바꾸기' : '어두운 테마로 바꾸기');
    $$('meta[name="theme-color"]').forEach(m => { m.content = isDark() ? '#12141c' : '#f5efe3'; m.removeAttribute('media'); });
  };
  sync();
  sys.addEventListener('change', sync);
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem('pigs-theme', next); } catch (err) { /* 저장하지 못해도 이번 화면에는 적용된다 */ }
      sync();
    };
    if (!document.startViewTransition || !motion()) { apply(); return; }
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('vt-theme');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.6,0,.25,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
    vt.finished.finally(() => root.classList.remove('vt-theme')).catch(() => {});
  });
});

/* ---------------- 읽은 정도(대체), 현재 구간, 쪽 안 이동 ---------------- */
if (!CSS.supports('animation-timeline: scroll()')) {
  const bar = $('.progress span');
  let raf = 0;
  const upd = () => { raf = 0; const m = root.scrollHeight - innerHeight; bar.style.setProperty('--prog', m > 0 ? (scrollY / m).toFixed(4) : 0); };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  upd();
}
safe(() => {
  const nav = $('.nav');
  const links = new Map($$('a', nav).map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.removeAttribute('aria-current'));
      const a = links.get(e.target.id);
      if (!a) return;
      a.setAttribute('aria-current', 'true');
      if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: motion() ? 'smooth' : 'auto' });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  ['top', ...links.keys()].forEach(id => { const s = document.getElementById(id); if (s) io.observe(s); });
  // 쪽 안 링크: 부드럽게 이동하고 초점을 옮긴다(기본 스크롤 동작은 바꾸지 않는다)
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const t = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: motion() ? 'smooth' : 'auto', block: 'start' });
    history.pushState(null, '', a.hash);
    if (!t.matches('a, button, input, [tabindex]')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  });
});
// 첫 화면이 보이지 않으면 끝없이 도는 장식(바람, 스크롤 안내)을 멈춘다
new IntersectionObserver(([e]) => root.classList.toggle('hero-off', !e.isIntersecting)).observe($('#top'));

/* ---------------- 영상 공통: 화면에 보일 때만 재생, 사용자가 멈추면 그대로 ---------------- */
const playV = v => { const p = v.play(); return p && p.catch ? p.catch(() => {}) : Promise.resolve(); };
function bindToggle(btn, label) {
  const set = paused => { btn.setAttribute('aria-pressed', paused); btn.setAttribute('aria-label', `${label} ${paused ? '재생하기' : '멈추기'}`); };
  set(!motion());
  return set;
}

/* ---------------- 첫 화면: 1·2위 작품의 실제 재생 장면 ---------------- */
safe(() => {
  const fig = $('.hero-screen');
  if (!fig) return;
  const vids = $$('video', fig);
  const picks = $$('.pick', fig);
  const toggle = $('#heroToggle');
  const bar = $('.screen-bar', fig);
  let cur = 0, pinned = false, userPaused = !motion(), visible = false, started = false, raf = 0;
  const setToggle = bindToggle(toggle, '장면 영상');
  const show = i => {
    cur = i;
    vids.forEach((v, k) => { v.classList.toggle('on', k === i); if (k !== i) v.pause(); });
    picks.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-pressed', k === i); });
    fig.style.setProperty('--sc', `var(--${vids[i].dataset.w})`);
    bar.style.setProperty('--sc', `var(--${vids[i].dataset.w})`);
  };
  const tick = () => { const v = vids[cur]; bar.style.setProperty('--sp', v.duration ? (v.currentTime / v.duration).toFixed(4) : 0); raf = requestAnimationFrame(tick); };
  const run = () => {
    cancelAnimationFrame(raf);
    if (userPaused || !visible || !started) { vids.forEach(v => v.pause()); return; }
    vids[cur].loop = pinned;
    playV(vids[cur]);
    raf = requestAnimationFrame(tick);
  };
  vids.forEach((v, k) => v.addEventListener('playing', () => {
    const n = vids[1 - k];
    if (n.preload === 'none') { n.preload = 'auto'; n.load(); }
  }));
  vids.forEach((v, k) => v.addEventListener('ended', () => {
    if (pinned) return;
    const n = 1 - k; vids[n].currentTime = 0; show(n); run();
  }));
  picks.forEach((b, k) => b.addEventListener('click', () => {
    pinned = true; show(k); vids[k].currentTime = 0;
    if (userPaused) { userPaused = false; setToggle(false); }
    started = true; run();
  }));
  toggle.addEventListener('click', () => { userPaused = !userPaused; setToggle(userPaused); started = true; run(); });
  reduceMQ.addEventListener('change', () => { if (!motion()) { userPaused = true; setToggle(true); run(); } });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { threshold: .3 }).observe(fig);
  // 첫 화면의 글이 다 그려진 뒤에 영상을 받기 시작한다(첫 로드 용량에 넣지 않음)
  const begin = () => { started = true; run(); };
  if (document.readyState === 'complete') setTimeout(begin, 400); else addEventListener('load', () => setTimeout(begin, 400), { once: true });
  show(0);
});

/* ---------------- 결론: 순위 막대 ---------------- */
onView($('.sum-list'), l => l.classList.add('in'), { threshold: .3 });

/* ---------------- 실험 설계: 스크롤에 따라 조건 표가 켜짐 ---------------- */
safe(() => {
  const cond = $('#cond');
  const steps = $$('.story-steps .step');
  const live = $('#condLive');
  const COL = { 1: '1라운드 열', 2: '2라운드 열', 3: '3라운드 열', 4: '결과 줄' };
  const set = (s, say) => {
    cond.dataset.step = s;
    steps.forEach(st => { const on = st.dataset.step === String(s); st.classList.toggle('on', on); if (on) st.setAttribute('aria-current', 'step'); else st.removeAttribute('aria-current'); });
    if (say && live) live.textContent = `조건 표에서 ${COL[s]}을 강조했습니다.`;
  };
  const liveMQ = matchMedia('(min-width: 821px) and (prefers-reduced-motion: no-preference)');
  let raf = 0, near = false;
  const pickCenter = () => {
    raf = 0;
    const mid = innerHeight / 2;
    let best = null, bd = Infinity;
    steps.forEach(st => { const r = st.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = st; } });
    if (best) set(best.dataset.step);
  };
  new IntersectionObserver(([e]) => { near = e.isIntersecting; if (near) pickCenter(); }).observe($('#designStory'));
  addEventListener('scroll', () => { if (near && !raf) raf = requestAnimationFrame(pickCenter); }, { passive: true });
  set(1);
  const interactive = () => steps.forEach(st => { if (liveMQ.matches) st.tabIndex = 0; else st.removeAttribute('tabindex'); });
  steps.forEach(st => { const go = () => { if (liveMQ.matches) set(st.dataset.step, true); }; st.addEventListener('click', go); st.addEventListener('focus', go); });
  interactive(); liveMQ.addEventListener('change', interactive);
});

/* ---------------- 결과: 다섯 채의 집(고정된 스크롤 서사 + 직접 고르기) ---------------- */
const tip = h('div', { class: 'tip', 'aria-hidden': 'true' });
document.body.append(tip);
let tipTimer = 0;
const hideTip = () => { clearTimeout(tipTimer); tip.classList.remove('show'); };
const showTip = (text, x, y, ms) => {
  clearTimeout(tipTimer);
  tip.textContent = text;
  tip.classList.add('show');
  const w = tip.offsetWidth;
  tip.style.left = Math.min(innerWidth - w / 2 - 8, Math.max(w / 2 + 8, x)) + 'px';
  tip.style.top = Math.max(tip.offsetHeight + 8, y - 10) + 'px';
  if (ms) tipTimer = setTimeout(hideTip, ms);
};
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
safe(() => {
  const ol = $('#houses');
  const pin = $('#townPin');
  const town = $('.town', pin);
  const wrap = ol.parentElement;
  const say = $('#townSay');
  const live = $('#townLive');
  const prog = $('.town-prog', town);
  const replay = $('#townReplay');
  const grid = $$('.gridlines span', town);
  const stepBtns = $$('#townSteps button', town);
  wrap.append(h('div', { class: 'ground-line', 'aria-hidden': 'true' }));
  const items = {};
  const JSEQ = ['avg', 'sonnet', 'codex', 'argon', 'avg']; // 마지막에 본문 결론(세 명 평균)으로 돌아온다
  const SHORT = { opusp: 'Opus 솔로+', collab: '협업', gptp: 'GPT 솔로+', opus: 'Opus 단독', gpt: 'GPT 단독' };
  const valsOf = (j, w) => (j === 'avg' ? CRIT.map((_, i) => avgCrit(3, w, i)) : R3.judges[j][w]);
  const labelOf = j => (j === 'avg' ? '세 명 평균' : judgeName[j].short);
  const fmtOf = j => (j === 'avg' ? f1 : v => String(Math.round(v * 10) / 10));
  let judge = 'avg', crit = 'all', manual = false, pinMode = false, shownJ = 'avg', Hpx = 0, slotW = 0, olW = 0, lift = 48, leftTop = false;
  const detail = (w, vals, j) => `${WORKS[w].name}(${labelOf(j)}): ` + CRIT.map((c, k) => `${c.short} ${fmtOf(j)(vals[k])}`).join(' · ') + ` = ${fmtOf(j)(sum(vals))}점`;
  const floorTip = (ev, w, ms) => {
    const fl = ev.target.closest('.fl');
    if (!fl) { if (!ms) hideTip(); return; }
    const k = +fl.dataset.k;
    showTip(`${WORKS[w].name} · ${CRIT[k].name} ${fmtOf(shownJ)(valsOf(shownJ, w)[k])}점(${labelOf(shownJ)})`, ev.clientX, ev.clientY, ms);
  };
  // 누른 집에는 층마다 「항목 점수」 배지를 단다(다른 집은 1위 집만 층 이름)
  const setTags = w => {
    Object.entries(items).forEach(([k, it]) => {
      const on = k === w;
      it.li.classList.toggle('picked', on);
      it.btn.setAttribute('aria-pressed', String(on));
      const v = valsOf(shownJ, k), f = fmtOf(shownJ);
      it.tags.forEach((t, i) => setText(t, on ? `${CRIT[i].short} ${f(v[i])}` : CRIT[i].short));
    });
  };
  ORDER.forEach(w => {
    const li = h('li', { class: 'house', style: `--c:var(--${w})` });
    const btn = h('button', { class: 'h-btn', type: 'button', 'aria-pressed': 'false' });
    const body = h('span', { class: 'h-body', 'aria-hidden': 'true' });
    CRIT.forEach((c, k) => body.append(h('span', { class: 'fl', 'data-k': k })));
    CRIT.forEach((c, k) => body.append(h('span', { class: 'fl-tag' }, c.short)));
    // 자리를 바꾸는 동안에만 보이는 작품 이름표(집과 함께 움직여 누가 누구를 앞지르는지 보이게)
    body.append(h('span', { class: 'chimney' }), h('span', { class: 'roof' }), h('span', { class: 'door' }), h('span', { class: 'h-score num' }), h('span', { class: 'h-chip' }, SHORT[w].split(' ').map(t => `<span>${t}</span>`).join(' ')));
    btn.append(body, h('span', { class: 'h-name', 'aria-hidden': 'true' }, `<span class="h-rank"></span><span class="nm-l">${WORKS[w].name}</span><span class="nm-s">${SHORT[w].replace(' ', '<br>')}</span>`), h('span', { class: 'sr' }));
    li.append(btn);
    ol.append(li);
    items[w] = { li, btn, body, fl: $$('.fl', li), tags: $$('.fl-tag', li), roof: $('.roof', li), ch: $('.chimney', li), door: $('.door', li), sc: $('.h-score', li), rk: $('.h-rank', li), name: $('.h-name', li), sr: $('.sr', li) };
    // 마우스는 층 위에 올리면, 손가락은 층을 누르면(2.5초) 그 층의 점수
    body.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') floorTip(ev, w); });
    body.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') hideTip(); });
    body.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse') floorTip(ev, w, 2500); });
    btn.addEventListener('click', () => {
      // 서사 중에 집을 누르면 지금 보이는 채점관 그대로 직접 고르기로 바꿔 탐색 상태를 지킨다
      if (pinMode && !manual) {
        goManual();
        judge = shownJ; crit = 'all';
        const r = $(`#judgePick input[value="${judge}"]`); if (r) r.checked = true;
        $('#critPick input[value="all"]').checked = true;
        render(true);
      }
      setTags(w);
      say.setAttribute('aria-live', 'polite');
      say.textContent = detail(w, valsOf(shownJ, w), shownJ);
      live.textContent = '';
      syncUrl();
    });
  });
  const H = () => $('.h-body', ol).clientHeight;

  /* 집의 몸체(층·지붕·숫자 위치·문)를 그린다. ck = 고른 항목이면 그 층 하나만 높이 = 항목 점수(20점 만점) */
  function paintBody(it, vals, ck = null) {
    let o = 0;
    it.fl.forEach((fl, k) => {
      const v = ck == null ? vals[k] : k === ck ? vals[k] * 5 : 0;
      const base = ck == null ? o : 0;
      fl.style.transform = `translateY(${(-base / 100 * Hpx).toFixed(2)}px) scaleY(${(v / 20).toFixed(4)})`;
      const tg = it.tags[k], px = v / 100 * Hpx;
      tg.style.transform = `translate(-50%, calc(50% + ${(-(base + v / 2) / 100 * Hpx).toFixed(2)}px))`;
      tg.style.opacity = clamp01((px - 18) / 6).toFixed(2);
      if (ck == null) o += vals[k];
    });
    const top = ck == null ? o : vals[ck] * 5;
    const ty = (-top / 100 * Hpx).toFixed(2);
    it.roof.style.transform = `translateY(${ty}px)`;
    it.ch.style.transform = `translateY(calc(${ty}px - var(--roof) * .35))`;
    it.sc.style.transform = `translate(-50%, calc(${ty}px - var(--roof) - 8px))`;
    it.door.style.transform = `scaleY(${Math.min(1, top / 14).toFixed(3)})`;
    return top;
  }

  /* ---- 집 자리 옮기기: 서사·직접 고르기·쌓기 복귀가 모두 이 한 갈래(moveTo)를 쓴다 ----
     - 자리(x)는 「지금 DOM 순서의 칸」 기준 translate. 움직임이 모두 끝나면 DOM을 순위대로 다시 놓고 translate를 지운다(commit)
       → 화면은 그대로이고, 탭 순서·스크린리더 순서가 보이는 순위와 같아진다
     - 지금 위치는 getComputedStyle 대신 우리가 만든 키프레임과 애니메이션 시각(currentTime)으로 계산한다(레이아웃·스타일 읽기 없음)
     - 왼쪽(위 순위)으로 가는 집은 앞 레인: 원래 크기로 떠올라 호를 그림(멀리 갈수록 더 높이)
       오른쪽으로 가는 집은 뒤 레인: 땅에 붙은 채 .94배·투명도 .8(깊이)
     - 움직이는 동안 숫자·이름표·층 배지는 감추고(visibility, 페이드 없음) 작품 이름표(.h-chip)가 집을 따라간다. 도착하는 순간 한 번에 보인다 */
  const TWEEN = 900, EASE = 'cubic-bezier(.45, 0, .2, 1)';
  const bezier = (x1, y1, x2, y2) => t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 8; i++) {
      const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
      const d = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
      if (Math.abs(x) < 1e-5 || !d) break;
      u = clamp01(u - x / d);
    }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  };
  const EASEF = bezier(.45, 0, .2, 1);
  const OFF = [0, .15, .5, .85, 1];
  const DEPTH_S = .94, DEPTH_O = .8;
  const mv = {}; // 움직이는 집: { a: 집 애니메이션, b: 몸체 투명도 애니메이션, kf }
  const rest = {}; // 멈춘 자리(지금 DOM 칸 기준 x)
  let lastR = Object.fromEntries(ORDER.map((w, i) => [w, i]));
  const idx = w => Array.prototype.indexOf.call(ol.children, items[w].li);
  const now = w => {
    const m = mv[w];
    if (m && m.a.playState !== 'finished' && m.a.playState !== 'idle') {
      const e = EASEF(clamp01((Number(m.a.currentTime) || 0) / TWEEN));
      let i = 0;
      while (i < OFF.length - 2 && e > OFF[i + 1]) i++;
      const f = (e - OFF[i]) / (OFF[i + 1] - OFF[i]), A = m.kf[i], B = m.kf[i + 1];
      const L = k => A[k] + (B[k] - A[k]) * f;
      return { x: L('x'), y: L('y'), s: L('s'), o: L('o') };
    }
    return { x: rest[w] || 0, y: 0, s: 1, o: 1 };
  };
  const stopMoves = () => {
    Object.entries(mv).forEach(([w, m]) => { m.a.cancel(); m.b.cancel(); delete mv[w]; items[w].li.classList.remove('move', 'back'); items[w].li.style.zIndex = ''; });
    ol.classList.remove('tweening');
  };
  // 움직임이 모두 끝나면: DOM을 순위대로 다시 놓고 translate를 지운다(보이는 자리는 그대로). 집 안에 초점이 있으면 미룬다
  function commit() {
    if (Object.keys(mv).length || ol.contains(document.activeElement)) return;
    const order = ORDER.slice().sort((a, b) => lastR[a] - lastR[b]);
    if (order.every((w, i) => ol.children[i] === items[w].li) && order.every(w => !rest[w])) return;
    order.forEach(w => { ol.append(items[w].li); rest[w] = 0; items[w].li.style.transform = ''; });
  }
  ol.addEventListener('focusout', () => setTimeout(commit, 0));
  function landed(w) {
    const it = items[w];
    if (it.bump && motion()) { it.rk.classList.remove('bump'); void it.rk.offsetWidth; it.rk.classList.add('bump'); }
    it.bump = false;
  }
  // R: 작품 → 칸(0~4). animate가 거짓이면 바로 그 자리
  function moveTo(R, animate) {
    lastR = { ...R };
    const cur = Object.fromEntries(ORDER.map(w => [w, now(w)]));
    stopMoves();
    let n = 0;
    ORDER.forEach(w => {
      const it = items[w], x1 = (R[w] - idx(w)) * slotW, c = cur[w];
      rest[w] = x1;
      it.li.style.transform = Math.abs(x1) > .01 ? `translateX(${x1.toFixed(2)}px)` : '';
      const off = Math.abs(x1 - c.x) > 1 || Math.abs(c.y) > .5 || Math.abs(c.s - 1) > .005 || c.o < .99;
      if (!animate || !off) return;
      n++;
      const dx = Math.abs(x1 - c.x), slots = Math.max(1, dx / (slotW || 1));
      // 레인: 이미 레인에 있으면(떠 있거나 작아져 있으면) 그 레인을 지킨다 → 도중에 되돌려도 두 집이 위아래로 엇갈리지 않음. 아니면 방향으로(왼쪽 = 앞)
      const up = c.y < -1 ? true : c.s < .995 ? false : dx > 1 ? x1 < c.x : c.y < 0;
      const L = lift * (1 + .45 * (slots - 1));
      const kf = OFF.map((o, i) => {
        if (i === 0) return c;
        if (i === OFF.length - 1) return { x: x1, y: 0, s: 1, o: 1 };
        const x = c.x + (x1 - c.x) * o;
        return up ? { x, y: -L * (i === 2 ? 1 : .8), s: 1, o: 1 } : { x, y: 0, s: DEPTH_S, o: DEPTH_O };
      });
      it.li.style.zIndex = up ? 3 : 1; it.li.classList.add('move'); it.li.classList.toggle('back', !up);
      const a = it.li.animate(kf.map((k, i) => ({ offset: OFF[i], transform: `translate(${k.x.toFixed(2)}px, ${k.y.toFixed(2)}px) scale(${k.s.toFixed(3)})` })), { duration: TWEEN, easing: EASE });
      const b = it.body.animate(kf.map((k, i) => ({ offset: OFF[i], opacity: k.o })), { duration: TWEEN, easing: EASE });
      mv[w] = { a, b, kf };
      a.onfinish = () => {
        if (!mv[w] || mv[w].a !== a) return;
        delete mv[w]; b.cancel();
        it.li.classList.remove('move', 'back'); it.li.style.zIndex = '';
        landed(w);
        if (!Object.keys(mv).length) { ol.classList.remove('tweening'); commit(); }
      };
    });
    ol.classList.toggle('tweening', n > 0);
    if (!n) commit();
    return n;
  }

  /* 한 화면 그리기(서사의 단계와 직접 고르기 공통): 높이·숫자·순위를 바로 정하고 자리는 moveTo로 */
  function show(j, ck, animate) {
    Hpx = H();
    shownJ = j;
    const data = ORDER.map(w => { const v = valsOf(j, w); return { w, v, t: sum(v), key: ck == null ? sum(v) : v[ck] }; });
    data.sort((a, b) => b.key - a.key || b.t - a.t || avgTotal(3, b.w) - avgTotal(3, a.w));
    let rank = 0, prev = null;
    data.forEach((d, i) => { if (prev === null || Math.abs(d.key - prev) > 1e-9) rank = i + 1; d.rank = rank; d.slot = i; prev = d.key; });
    ol.dataset.crit = ck == null ? 'all' : String(ck);
    grid.forEach(g => { const v = +g.style.getPropertyValue('--v'); setText(g, String(ck == null ? v : v / 5)); });
    const fmt = fmtOf(j);
    data.forEach(d => {
      const it = items[d.w];
      paintBody(it, d.v, ck);
      // 숫자·순위는 바로 바꾼다: 움직이는 집은 어차피 도착할 때까지 감춰져 있고, 자리가 그대로인 집은 깜빡이지 않게
      setText(it.sc, fmt(d.key));
      const r = String(d.rank);
      it.bump = animate && it.rk.textContent !== r && !!it.rk.textContent;
      it.rk.textContent = r;
      it.li.classList.toggle('first', d.rank === 1);
      it.sr.textContent = `${d.rank}위 ${WORKS[d.w].name}, ${labelOf(j)} 기준 ` + (ck == null ? `합계 ${fmt(d.t)}점. ` : `${CRIT[ck].name} ${fmt(d.key)}점(20점 만점). `) + CRIT.map((c, k) => `${c.short} ${fmt(d.v[k])}`).join(', ');
    });
    data.moved = moveTo(Object.fromEntries(data.map(d => [d.w, d.slot])), animate);
    const picked = Object.keys(items).find(w => items[w].li.classList.contains('picked'));
    if (picked) setTags(picked);
    return data;
  }
  function render(animate) {
    const ck = crit === 'all' ? null : +crit;
    const data = show(judge, ck, animate && motion());
    const fmt = fmtOf(judge);
    const nm = d => `${WORKS[d.w].name}(${fmt(d.key)})`;
    say.textContent = ck == null && judge === 'avg'
      ? `세 채점관 평균입니다. 1위 표는 ${votesText(3)}로 갈렸습니다.`
      : ck == null
        ? `${labelOf(judge)}의 순위: 1위 ${nm(data[0])}, 2위 ${nm(data[1])}, 가장 낮은 작품은 ${nm(data[4])}입니다.`
        : `${CRIT[ck].name}(${labelOf(judge)}): 집 높이와 숫자가 이 항목 점수(20점 만점)입니다. 가장 높은 작품은 ${nm(data[0])}, 가장 낮은 작품은 ${nm(data[4])}입니다.`;
  }

  /* 스크롤 서사
     - 앞 20%(쌓기): 1층(스토리)이 서 있고 2~5층이 다섯 집에서 함께 쌓인다. 스크롤 타임라인을 지원하면 CSS(view-timeline)가
       합성 단계에서 그리고(스크롤마다 JS가 쓰는 스타일 없음), 지원하지 않으면 JS가 그린다. 숫자는 다 쌓인 뒤 한꺼번에
     - 그 뒤: 스크롤은 「단계」만 고른다(평균 → Sonnet → GPT 심사 → Argon → 다시 평균). 단계가 바뀌면 0.9초 시간 기반 전환
     - 고정 길이 400vh: 단계 하나에 약 0.6화면 */
  const G1 = .2;
  const TH = [.32, .5, .68, .86];
  const MID = [.26, .41, .59, .77, .93]; // 단계 점을 누르면 가는 곳
  const TL = CSS.supports('animation-timeline: view()') && CSS.supports('view-timeline-inset: 0px 0px');
  const rankIdx = j => { const o = [...ORDER].sort((a, b) => sum(valsOf(j, b)) - sum(valsOf(j, a)) || avgTotal(3, b) - avgTotal(3, a)); return Object.fromEntries(o.map((w, i) => [w, i])); };
  const RANK = Object.fromEntries(JSEQ.map(j => [j, rankIdx(j)]));
  // 쌓기 애니메이션(CSS)이 쓸 값: 층마다 바닥 위치(--gb)·높이 배율(--gs), 지붕이 지나는 다섯 높이(--gt0~4). 평균이라 한 번만 정한다
  ORDER.forEach(w => {
    const v = valsOf('avg', w), it = items[w];
    let o = 0;
    it.fl.forEach((fl, k) => { fl.style.setProperty('--gb', (o / 100).toFixed(4)); fl.style.setProperty('--gs', (v[k] / 20).toFixed(4)); o += v[k]; });
    let t = 0;
    v.forEach((x, k) => { t += x; it.body.style.setProperty(`--gt${k}`, (t / 100).toFixed(4)); });
  });
  const SAY0 = '층을 쌓고 있어요(세 채점관 평균): 스토리 → 흐름 → 화면 → 모션 → 기술.';
  // 마지막 문장은 다른 단계 문장과 같은 길이로(1위 표 이야기는 첫 단계에서 이미 했다)
  const SAYEND = `다시 세 채점관 평균: 1위 ${WORKS[ORDER[0]].name}(${f1(avgTotal(3, ORDER[0]))}), 2위 ${WORKS[ORDER[1]].name}(${f1(avgTotal(3, ORDER[1]))}), 가장 낮은 작품은 ${WORKS[ORDER[4]].name}(${f1(avgTotal(3, ORDER[4]))})입니다.`;
  const sayFor = j => { const o = Object.entries(RANK[j]).sort((a, b) => a[1] - b[1]).map(([w]) => w); const f = fmtOf(j); return `${labelOf(j)}의 순위: 1위 ${WORKS[o[0]].name}(${f(sum(valsOf(j, o[0])))}), 2위 ${WORKS[o[1]].name}(${f(sum(valsOf(j, o[1])))}), 가장 낮은 작품은 ${WORKS[o[4]].name}(${f(sum(valsOf(j, o[4])))})입니다.`; };
  const sayStage = st => (st === 4 ? SAYEND : st === 0 ? `세 채점관 평균입니다. 1위 표는 ${votesText(3)}로 갈렸습니다.` : sayFor(JSEQ[st]));
  // 서사 문장 중 가장 긴 것의 높이를 미리 잡아 둔다(문장이 바뀔 때 아래 집들이 위아래로 밀리지 않게)
  const fitSay = () => {
    const c = say.cloneNode(false);
    c.removeAttribute('id'); c.removeAttribute('aria-live'); c.setAttribute('aria-hidden', 'true');
    c.style.cssText = `position:absolute;visibility:hidden;left:0;top:0;width:${say.clientWidth}px;min-height:0`;
    say.parentElement.append(c);
    let mx = 0;
    [SAY0, 0, 1, 2, 3, 4].forEach(t => { c.textContent = typeof t === 'number' ? sayStage(t) : t; mx = Math.max(mx, c.getBoundingClientRect().height); });
    c.remove();
    say.style.minHeight = Math.ceil(mx) + 'px';
  };
  // 칸 너비·집 높이·떠오르는 높이를 잰다(크기가 바뀔 때만). 진행 중인 움직임은 끊고 DOM 순서 자리로
  const measureSlots = () => {
    stopMoves();
    ORDER.forEach(w => { rest[w] = 0; items[w].li.style.transform = ''; });
    const a = ol.children[0].getBoundingClientRect(), b = ol.children[1].getBoundingClientRect();
    slotW = b.left - a.left; olW = ol.clientWidth;
    Hpx = H();
    lift = (parseFloat(getComputedStyle(wrap).getPropertyValue('--pad')) || 40) + 8;
  };
  const measure = () => { fitSay(); measurePin(); measureSlots(); };

  // 단계 점: 지금 단계는 aria-current, 누르면 그 단계 가운데로. 단계가 0.3초 머물면 한 줄로 알려 준다(polite)
  let mode = null, shownSt = -1, annT = 0;
  const markStep = st => stepBtns.forEach((b, i) => { if (i === st) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  // 집이 다 움직인 뒤(움직이는 집이 있으면 0.9초 뒤) 0.3초가 지나도 같은 단계일 때만 읽어 준다(잠깐 거쳐 가는 단계는 읽지 않음)
  const announce = (st, wait) => { clearTimeout(annT); annT = setTimeout(() => { if (!manual && mode === 'stage' && shownSt === st) live.textContent = sayStage(st); }, wait + 300); };
  stepBtns.forEach((b, i) => b.addEventListener('click', () => {
    if (!pinMode) return;
    if (manual) resume();
    scrollTo({ top: pinTop - stickTop + MID[i] * pinSpan, behavior: motion() ? 'smooth' : 'auto' });
  }));

  // 쌓기 단계에 들어감: 평균 값·순위로 놓고, 자리에서 벗어난 집은 레인을 따라 제자리로(animate)
  function enterGrow(animate) {
    mode = 'grow'; shownSt = -1; clearTimeout(annT);
    ol.classList.add('grow'); town.classList.add('grow');
    show('avg', null, animate);
    if (say.dataset.k !== 'g') { say.dataset.k = 'g'; say.setAttribute('aria-live', 'off'); say.textContent = SAY0; }
    $('#judgePick input[value="avg"]').checked = true; $('#critPick input[value="all"]').checked = true;
    markStep(0);
  }
  const leaveGrow = () => { ol.classList.remove('grow'); town.classList.remove('grow'); };
  // 스크롤 타임라인이 없을 때만: 스크롤에 맞춰 층을 그린다
  function growPaint(p) {
    const seg = G1 / 4;
    ORDER.forEach(w => paintBody(items[w], valsOf('avg', w).map((v, k) => v * (k === 0 ? 1 : clamp01((p - (k - 1) * seg) / seg)))));
  }
  // 단계 st로: snap이면 바로, 아니면 시간 기반 전환
  function goStage(st, snap) {
    if (mode === 'stage' && st === shownSt) return;
    const j = JSEQ[st], prevJ = shownJ;
    mode = 'stage'; shownSt = st; leaveGrow();
    if (say.dataset.k !== String(st)) { say.dataset.k = String(st); say.setAttribute('aria-live', 'off'); say.textContent = sayStage(st); }
    const radio = $(`#judgePick input[value="${j}"]`); if (radio) radio.checked = true;
    $('#critPick input[value="all"]').checked = true;
    if (prevJ !== j && Object.keys(items).some(w => items[w].li.classList.contains('picked'))) setTags(null);
    const d = show(j, null, !snap && motion());
    markStep(st); announce(st, d.moved ? TWEEN : 0);
  }
  function apply(p, snap) {
    if (!TL) { const pv = p.toFixed(3); if (prog.style.getPropertyValue('--p') !== pv) prog.style.setProperty('--p', pv); }
    if (p < G1) {
      if (mode !== 'grow') enterGrow(!snap && motion());
      if (!TL) growPaint(p);
      return;
    }
    goStage(TH.filter(t => p >= t).length, snap || (mode !== 'stage' && mode !== 'grow'));
  }
  const stickTopCss = () => (parseFloat(getComputedStyle(root).getPropertyValue('--top')) || 60) + 8;
  // 고정했을 때의 카드 높이로 판단한다(고정하지 않은 모양은 단계 점이 빠져 더 낮아서 판단이 오락가락함)
  const pinOn = () => {
    if (!motion()) return false;
    const was = town.classList.contains('no-pin');
    if (was) town.classList.remove('no-pin');
    const hgt = town.offsetHeight;
    if (was) town.classList.add('no-pin');
    return hgt <= innerHeight - stickTopCss();
  };
  // 고정 위치·길이는 크기가 바뀔 때만 재고(measure), 스크롤 때는 scrollY만 쓴다.
  // 같은 값으로 CSS 스크롤 타임라인의 창(위·아래 여백)을 맞춰, CSS 진행률과 JS 진행률이 같게 한다
  let pinTop = 0, pinSpan = 0, stickTop = 0;
  const measurePin = () => {
    stickTop = parseFloat(getComputedStyle(town).top) || 0; pinTop = pin.getBoundingClientRect().top + scrollY; pinSpan = pin.offsetHeight - town.offsetHeight;
    pin.style.setProperty('--tl-a', `${stickTop.toFixed(1)}px`);
    pin.style.setProperty('--tl-b', `${Math.max(0, innerHeight - stickTop - town.offsetHeight).toFixed(1)}px`);
  };
  const progress = () => (pinSpan > 0 ? clamp01((scrollY + stickTop - pinTop) / pinSpan) : 0);
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!pinMode) return;
      const p = progress();
      if (manual) { if (p > .1) leftTop = true; else if (p <= 0 && leftTop) resume(); return; }
      apply(p);
    });
  };
  function resume() {
    stopMoves();
    manual = false; judge = 'avg'; crit = 'all'; ol.dataset.crit = 'all';
    $('#judgePick input[value="avg"]').checked = true; $('#critPick input[value="all"]').checked = true;
    grid.forEach(g => setText(g, g.style.getPropertyValue('--v').trim()));
    setTags(null);
    replay.hidden = true; town.classList.remove('manual');
    say.setAttribute('aria-live', 'off'); delete say.dataset.k;
    measure(); mode = null; apply(progress(), true);
    syncUrl();
  }
  function goManual() {
    if (manual) return;
    // 진행 중인 움직임은 끊지 않는다: 바로 뒤의 render(true)가 지금 자리에서 이어 간다
    manual = true; mode = null; leftTop = progress() > .1; replay.hidden = false; town.classList.add('manual');
    say.setAttribute('aria-live', 'polite');
    leaveGrow(); markStep(-1); clearTimeout(annT);
  }
  const pick = () => {
    if (pinMode) goManual();
    judge = $('#judgePick input:checked').value; crit = $('#critPick input:checked').value;
    render(true);
    syncUrl();
  };
  $('#judgePick').addEventListener('change', pick);
  $('#critPick').addEventListener('change', pick);
  replay.addEventListener('click', () => { resume(); pin.scrollIntoView({ behavior: motion() ? 'smooth' : 'auto', block: 'start' }); });
  // 주소에 고른 채점관·항목을 남기고(공유·새로고침), 들어올 때 되살린다
  function syncUrl() {
    const u = new URL(location.href);
    if (manual || !pinMode) { if (judge !== 'avg') u.searchParams.set('judge', judge); else u.searchParams.delete('judge'); if (crit !== 'all') u.searchParams.set('crit', CRIT[+crit].k); else u.searchParams.delete('crit'); }
    else { u.searchParams.delete('judge'); u.searchParams.delete('crit'); }
    if (u.href !== location.href) history.replaceState(history.state, '', u);
  }
  const setup = () => {
    fitSay(); // 문장 높이를 먼저 잡아야 「카드가 창에 들어가는지」를 바르게 잰다
    const on = pinOn();
    if (on && !pinMode) {
      pinMode = true; town.classList.remove('no-pin'); pin.classList.remove('unpinned');
      resume();
      addEventListener('scroll', onScroll, { passive: true });
    } else if (!on && pinMode) {
      cancelAnimationFrame(raf); raf = 0; pinMode = false; removeEventListener('scroll', onScroll); leaveGrow();
      manual = false; mode = null; replay.hidden = true; town.classList.remove('manual'); say.setAttribute('aria-live', 'polite');
      judge = $('#judgePick input:checked').value; crit = $('#critPick input:checked').value;
      measureSlots(); render(false);
    } else if (on && !manual) { measure(); mode = null; apply(progress(), true); }
    else if (H() !== Hpx || !slotW || ol.clientWidth !== olW) { measureSlots(); render(false); } // 가로 폭만 바뀌어도 칸 너비가 달라진다 // 고정하지 않거나 직접 고르는 중이면 크기가 바뀔 때 다시 그린다
    if (!on) { town.classList.add('no-pin'); pin.classList.add('unpinned'); }
  };
  // 주소에 채점관·항목이 있으면 그 상태로 시작(직접 고르기). setup이 주소를 지우기 전에 먼저 읽는다
  const q = new URLSearchParams(location.search), qj = q.get('judge'), qc = q.get('crit');
  const ci = qc ? CRIT.findIndex(c => c.k === qc) : -1;
  measureSlots();
  render(false);
  setup();
  {
    if ((qj && $(`#judgePick input[value="${qj}"]`)) || ci >= 0) {
      if (qj && $(`#judgePick input[value="${qj}"]`)) $(`#judgePick input[value="${qj}"]`).checked = true;
      if (ci >= 0) $(`#critPick input[value="${ci}"]`).checked = true;
      pick();
    }
  }
  new ResizeObserver(() => requestAnimationFrame(setup)).observe(ol);
  // 위쪽 내용·카드 높이가 바뀌면 고정할 수 있는지부터 다시 판단한다
  const ro = new ResizeObserver(() => requestAnimationFrame(() => { if (pinMode && pinOn()) { measurePin(); } else setup(); }));
  ro.observe(document.body); ro.observe(town);
  reduceMQ.addEventListener('change', setup);
});

/* ---------------- 채점관 점 ---------------- */
safe(() => {
  const box = $('#dots');
  ORDER.forEach((w, n) => {
    const ts = JUDGES.map(j => judgeTotal(3, j.k, w));
    const m = avgTotal(3, w);
    const row = h('div', { class: 'drow', role: 'listitem', tabindex: '0', style: `--c:var(--${w})` });
    const rowTip = () => { const b = row.querySelector('.drow-track').getBoundingClientRect(); showTip(`${WORKS[w].name}: ` + JUDGES.map((j, r) => `${j.short} ${ts[r]}`).join(' · '), b.left + b.width / 2, b.top); };
    row.addEventListener('focus', rowTip); row.addEventListener('blur', hideTip);
    row.append(h('div', { class: 'drow-name' }, WORKS[w].name));
    const tr = h('div', { class: 'drow-track', style: `--m:${m};--n:${n}` });
    tr.append(h('span', { class: 'd-range', style: `--a:${Math.min(...ts)};--b:${Math.max(...ts)}` }));
    tr.append(h('span', { class: 'd-avg', style: `--v:${m}` }));
    JUDGES.forEach((j, r) => {
      const same = ts.filter(t => t === ts[r]).length, idx = ts.slice(0, r).filter(t => t === ts[r]).length;
      const dy = same > 1 ? (idx - (same - 1) / 2) * 11 : 0;
      const label = `${WORKS[w].name} · ${j.short} ${ts[r]}점`;
      const d = h('span', { class: `dot ${j.k}`, style: `--v:${ts[r]};--r:${r};--dy:${dy}px`, 'aria-hidden': 'true' });
      const on = () => { const b = d.getBoundingClientRect(); showTip(label, b.left + b.width / 2, b.top); };
      d.addEventListener('pointerenter', on);
      d.addEventListener('pointerleave', hideTip);
      d.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { on(); tipTimer = setTimeout(hideTip, 2500); } });
      tr.append(d);
    });
    row.append(tr, h('div', { class: 'd-val' }, `평균 ${f1(m)}<small>${Math.min(...ts)}~${Math.max(...ts)}점</small>`),
      h('span', { class: 'sr' }, JUDGES.map((j, r) => `${j.short} ${ts[r]}점`).join(', ')));
    box.append(row);
  });
  const ax = h('div', { class: 'd-axis', 'aria-hidden': 'true' }, '<span></span><div></div><span></span>');
  [60, 70, 80, 90, 100].forEach(v => ax.children[1].append(h('span', { style: `left:${(v - 60) / 40 * 100}%` }, String(v))));
  box.append(ax);
  onView(box, b => b.classList.add('in'), { threshold: 0, rootMargin: '0px 0px -8% 0px' });
});

/* ---------------- 라운드 사이 경사 그림 ---------------- */
safe(() => {
  const fig = $('#slope'), svg = $('svg', fig);
  const NS = 'http://www.w3.org/2000/svg';
  const keep = [...svg.children].filter(n => n.tagName === 'title' || n.tagName === 'desc');
  const series = [
    { w: 'gpt', dy: [18, -14] }, { w: 'opus', dy: [-10, 24] }, { w: 'collab', dy: [0, -14] }, { w: 'opusp', dy: [0, 0] }, { w: 'gptp', dy: [0, 0] },
  ].map(s => ({ ...s, v: [1, 2, 3].map(r => (ROUNDS[r].works.includes(s.w) ? +f1(avgTotal(r, s.w)) : null)) }));
  const LINE = 850; // 선 하나를 그리는 시간(ms, CSS와 같게)
  let lastW = 0;
  function draw() {
    const W = Math.max(300, Math.round(fig.clientWidth));
    if (W === lastW) return;
    lastW = W;
    const small = W < 480;
    const labW = small ? 162 : 170, left = small ? 30 : 46;
    const H = small ? 300 : 330, top = 22, bot = H - 36;
    const X = [left + 36, left + 36 + (W - labW - left - 50) / 2, W - labW - 14];
    const Y = v => top + (100 - v) / 40 * (bot - top);
    svg.replaceChildren(...keep);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const s = (tag, a, txt) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (txt != null) e.textContent = txt; svg.append(e); return e; };
    [60, 70, 80, 90, 100].forEach(v => { s('line', { class: 'gl', x1: left, x2: X[2] + 8, y1: Y(v), y2: Y(v) }); s('text', { class: 'gt', x: left - 6, y: Y(v) + 4, 'text-anchor': 'end' }, v); });
    (small ? ['1R', '2R', '3R'] : ['1라운드', '2라운드', '3라운드']).forEach((t, i) => { s('line', { class: 'ax', x1: X[i], x2: X[i], y1: top - 8, y2: bot }); s('text', { class: 'axl', x: X[i], y: H - 12, 'text-anchor': 'middle' }, t); });
    const rightY = {};
    const ys = series.map(se => ({ w: se.w, y: Y(se.v[2]) })).sort((a, b) => a.y - b.y);
    ys.forEach((o, i) => { rightY[o.w] = i === 0 ? o.y : Math.max(o.y, rightY[ys[i - 1].w] + 22); });
    series.forEach((se, n) => {
      const col = `var(--${se.w})`;
      const idx = se.v.map((v, i) => (v == null ? null : i)).filter(i => i != null);
      const first = idx[0], last = idx[idx.length - 1];
      // 선이 각 라운드 축에 닿는 순간 점과 숫자가 켜진다
      const dl = i => (i === 2 ? LINE : last === first ? 0 : (i - first) / (2 - first) * LINE);
      const pts = idx.map(i => [X[i], Y(se.v[i])]);
      if (pts.length > 1) s('path', { class: 'ln', 'data-w': se.w, d: 'M' + pts.map(p => p.map(q => q.toFixed(1)).join(' ')).join(' L'), pathLength: 1, style: `stroke:${col};--n:${n}` });
      idx.forEach(i => {
        s('circle', { class: 'pt', 'data-w': se.w, cx: X[i], cy: Y(se.v[i]), r: 6, style: `fill:${col};--dl:${dl(i)}ms` });
        if (i < 2) s('text', { class: 'vl', 'data-w': se.w, x: X[i] + (i === 0 ? -11 : se.dx1 || 0), y: Y(se.v[i]) + se.dy[i] + 4, 'text-anchor': i === 0 ? 'end' : se.dx1 ? 'start' : 'middle', style: `fill:${col};--dl:${dl(i)}ms` }, f1(se.v[i]));
      });
      // 라벨을 비켜 놓았으면 점과 라벨을 짧은 선으로 잇는다
      if (Math.abs(rightY[se.w] - Y(se.v[2])) > 3) s('path', { class: 'lead', 'data-w': se.w, d: `M${X[2] + 7} ${Y(se.v[2]).toFixed(1)} L${X[2] + 11} ${rightY[se.w].toFixed(1)}`, style: `stroke:${col};--dl:${dl(2)}ms` });
      s('text', { class: 'lb', 'data-w': se.w, x: X[2] + 14, y: rightY[se.w] + 5, style: `fill:${col};--dl:${dl(2)}ms` }, `${WORKS[se.w].name} ${f1(se.v[2])}`);
    });
    if (focusW) highlight(focusW);
  }
  let focusW = null;
  const highlight = w => {
    fig.classList.toggle('focus', !!w);
    $$('[data-w]', svg).forEach(e => e.classList.toggle('hl', e.dataset.w === w));
  };
  const keys = $('#slopeKeys');
  series.forEach(se => {
    const b = h('button', { type: 'button', 'aria-pressed': 'false', style: `--c:var(--${se.w})` }, `<i aria-hidden="true"></i>${WORKS[se.w].name}`);
    b.addEventListener('click', () => {
      focusW = focusW === se.w ? null : se.w;
      $$('button', keys).forEach(x => x.setAttribute('aria-pressed', x === b && !!focusW));
      highlight(focusW);
    });
    b.addEventListener('pointerenter', () => { if (!focusW) highlight(se.w); });
    b.addEventListener('pointerleave', () => { if (!focusW) highlight(null); });
    keys.append(b);
  });
  draw();
  new ResizeObserver(draw).observe(fig);
  onView(fig, f => { f.classList.add('in'); setTimeout(() => f.classList.add('drawn'), 1300); }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
});

/* ---------------- 라운드 탭 ---------------- */
safe(() => {
  const tabs = $$('#rounds [role="tab"]');
  const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
  let ready = false;
  const show = tab => {
    tabs.forEach((t, i) => { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; panels[i].hidden = !on; });
    const i = tabs.indexOf(tab);
    if (ready) setQuery({ round: i === tabs.length - 1 ? null : i + 1 }); // 방향키·Home·End·본문 링크 모두
  };
  const select = (tab, focus) => {
    if (document.startViewTransition && motion()) {
      const vt = document.startViewTransition(() => show(tab));
      vt.ready.catch(() => {}); vt.finished.catch(() => {}); // 느린 기기에서 전환이 취소돼도 탭 내용은 이미 바뀌어 있다
    } else show(tab);
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
      else if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      else if (n) { e.preventDefault(); select(tabs[(i + n + tabs.length) % tabs.length], true); }
    });
  });
  const qr = +new URLSearchParams(location.search).get('round');
  show(tabs[qr >= 1 && qr <= tabs.length ? qr - 1 : tabs.findIndex(t => t.getAttribute('aria-selected') === 'true')]);
  ready = true;
  $$('a[data-tab]').forEach(a => a.addEventListener('click', () => show(tabs[+a.dataset.tab - 1])));
});

/* ---------------- 작품 창 ---------------- */
const dlg = $('#player');
const plMedia = $('#plMedia');
let lastFocus = null;
const quoteFor = (w, good) => QUOTES.find(q => q.w === w && q.good === good);
function openPlayer(w, opts = {}) {
  const W = WORKS[w];
  if (!dlg.open) lastFocus = document.activeElement;
  const go = () => {
    dlg.style.setProperty('--c', `var(--${w})`);
    $('#pl-who').textContent = `${W.name} · ${W.maker}`;
    $('#pl-title').textContent = opts.frame ? `「${W.title}」 ${opts.frameLabel}` : `「${W.title}」`;
    plMedia.classList.toggle('is-shot', !!opts.frame);
    plMedia.style.backgroundImage = opts.frame ? 'none' : `url("${shot(w, 'cover', 1280, 'jpg')}")`;
    plMedia.querySelectorAll('iframe, picture').forEach(n => n.remove());
    const loading = $('#plLoading');
    plMedia.querySelectorAll('.pl-nav').forEach(n => n.remove());
    if (opts.frame) {
      loading.hidden = true;
      const p = picture(w, opts.frame, 1280, `${W.name} 작품의 ${opts.frameLabel}`);
      p.className = 'pl-shot' + (opts.dir ? ' enter' : '');
      if (opts.dir) p.style.setProperty('--dir', opts.dir);
      plMedia.append(p);
      const i = FR.findIndex(f => f.n === opts.frame);
      const nav = (cls, label, d, path) => {
        const b = h('button', { class: `pl-nav ${cls}`, type: 'button', 'aria-label': label }, `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`);
        const j = i + d;
        if (j < 0 || j >= FR.length) b.disabled = true;
        else b.addEventListener('click', () => {
          openPlayer(w, { frame: FR[j].n, frameLabel: frLabel(FR[j], w), dir: d });
          const same = $(`.pl-nav.${cls}`, plMedia), other = $(`.pl-nav.${cls === 'prev' ? 'next' : 'prev'}`, plMedia);
          (same && !same.disabled ? same : other)?.focus();
        });
        plMedia.append(b);
      };
      nav('prev', '앞 장면 보기', -1, 'M15 5l-7 7 7 7');
      nav('next', '다음 장면 보기', 1, 'M9 5l7 7-7 7');
      dlg.dataset.frame = i;
      dlg.dataset.work = w;
    } else {
      delete dlg.dataset.frame;
      loading.hidden = false;
      const fr = h('iframe', { src: W.path + 'index.html', title: `${W.name} 작품: ${W.title}`, allow: 'fullscreen', sandbox: 'allow-scripts' });
      fr.addEventListener('load', () => { loading.hidden = true; }, { once: true });
      plMedia.append(fr);
    }
    const past = [1, 2].filter(n => ROUNDS[n].works.includes(w)).map(n => `${n}라운드 ${f1(avgTotal(n, w))}`).join(' · ');
    const g = quoteFor(w, true), b = quoteFor(w, false);
    $('#plInfo').innerHTML = `<dl>
      <dt>주제</dt><dd>${W.theme}</dd>
      <dt>구성</dt><dd>${W.parts} · ${W.len}초</dd>
      <dt>재생기</dt><dd>${W.player}</dd>
      <dt>제작</dt><dd>약 ${W.minutes}분 · 파일 ${W.size}</dd>
      <dt>점수</dt><dd><b>3라운드 ${ORDER.indexOf(w) + 1}위 · ${f1(avgTotal(3, w))}점</b>${past ? ` <span class="c-muted">(${past})</span>` : ''}</dd>
      <dt>메시지</dt><dd>${W.message}</dd>
    </dl>
    <div class="pl-said">
      ${g ? `<p><b>강점 · ${judgeName[g.j].short}</b>${g.text}</p>` : ''}
      ${b ? `<p><b>약점 · ${judgeName[b.j].short}</b>${b.text}</p>` : ''}
      ${W.bug ? `<p><b>알려진 문제</b>${W.bug}</p>` : ''}
    </div>
    <div class="pl-links">
      ${opts.frame ? `<button class="btn btn-solid" type="button" data-play="${w}">이 작품 재생하기</button>` : ''}
      <a class="btn" href="${W.path}index.html" target="_blank" rel="noopener">새 창에서 열기</a>
      <a class="btn" href="https://github.com/techkwon/three-pigs-motion-ai/tree/main/${W.path}">원본 폴더(GitHub)</a>
    </div>`;
    if (!dlg.open) { pauseAllClips(); dlg.showModal(); }
  };
  const from = opts.fromEl;
  if (from && document.startViewTransition && motion() && !dlg.open) {
    from.style.viewTransitionName = 'work-media';
    let ran = false;
    const vt = document.startViewTransition(() => { ran = true; from.style.viewTransitionName = ''; plMedia.style.viewTransitionName = 'work-media'; go(); });
    vt.ready.catch(() => {}); // 느린 기기에서 전환이 시간 초과로 취소돼도 창은 열린다
    vt.finished.finally(() => { plMedia.style.viewTransitionName = ''; if (!ran) go(); }).catch(() => {});
  } else go();
}
dlg.addEventListener('close', () => {
  plMedia.querySelectorAll('iframe, picture, .pl-nav').forEach(n => n.remove());
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  resumeClips();
});
$('#plClose').addEventListener('click', () => dlg.close());
dlg.addEventListener('keydown', e => {
  if (dlg.dataset.frame == null || !['ArrowLeft', 'ArrowRight'].includes(e.key) || e.target.closest('iframe')) return;
  const b = $(e.key === 'ArrowLeft' ? '.pl-nav.prev' : '.pl-nav.next', plMedia);
  if (b && !b.disabled) { e.preventDefault(); b.click(); }
});
// 장면 크게 보기에서 옆으로 밀면 앞/다음 장면
let swipeX = null;
plMedia.addEventListener('pointerdown', e => { if (dlg.dataset.frame != null && e.pointerType !== 'mouse') swipeX = e.clientX; });
plMedia.addEventListener('pointerup', e => {
  if (swipeX == null) return;
  const dx = e.clientX - swipeX; swipeX = null;
  if (Math.abs(dx) < 50) return;
  const b = $(dx > 0 ? '.pl-nav.prev' : '.pl-nav.next', plMedia);
  if (b && !b.disabled) b.click();
});
plMedia.addEventListener('pointercancel', () => { swipeX = null; });
dlg.addEventListener('click', e => {
  if (e.target === dlg) {
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  }
  const p = e.target.closest('[data-play]');
  if (p) openPlayer(p.dataset.play);
});

/* ---------------- 작품 카드: 화면 가운데에 가장 가까운 카드 한 편만 재생(나머지는 멈춘 사진) ---------------- */
const cardClips = [];
let pauseCompare = () => {};
function pauseAllClips() { cardClips.forEach(c => c.v.pause()); pauseCompare(); }
function resumeClips() { cardClips.forEach(c => c.sync()); }
let forcedClip = null, clipRaf = 0;
function pickClip() {
  let best = forcedClip && forcedClip.visible ? forcedClip : null;
  if (!best) {
    let bd = Infinity;
    cardClips.forEach(c => { if (!c.visible) return; const r = c.poster.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - innerHeight / 2); if (d < bd) { bd = d; best = c; } });
  }
  cardClips.forEach(c => { c.active = c === best; c.sync(); });
}
const queuePick = () => { clearTimeout(clipRaf); if (!cardClips.some(c => c.visible)) return; clipRaf = setTimeout(pickClip, 140); };
addEventListener('scroll', queuePick, { passive: true });
addEventListener('resize', queuePick);
$$('#works .wcard').forEach(li => {
  const w = li.dataset.w;
  const poster = $('.poster', li);
  const v = $('video', poster);
  const btn = $('.vid-toggle', poster);
  let userPaused = !motion();
  const setBtn = bindToggle(btn, `${WORKS[w].name} 장면 영상`);
  const c = { v, poster, visible: false, active: false, sync: () => { const on = c.active && !userPaused && !dlg.open; if (on) playV(v); else v.pause(); setBtn(!(c.active && !userPaused)); } };
  cardClips.push(c);
  btn.addEventListener('click', () => {
    if (c.active && !userPaused) { userPaused = true; if (forcedClip === c) forcedClip = null; c.sync(); return; }
    userPaused = false; forcedClip = c; pickClip();
  });
  reduceMQ.addEventListener('change', () => { if (!motion()) { userPaused = true; setBtn(true); c.sync(); } });
  new IntersectionObserver(([e]) => { c.visible = e.isIntersecting; if (!c.visible && forcedClip === c) forcedClip = null; pickClip(); }, { threshold: .5 }).observe(poster);
  const open = e => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); openPlayer(w, { fromEl: poster }); };
  $('.poster-link', poster).addEventListener('click', open);
  $('[data-open]', li).addEventListener('click', open);
  onView(li, () => $('.ring', li).classList.add('on'), { threshold: .3 });
});

/* ---------------- 같은 초: 사진 20장 / 영상 동시 재생 ---------------- */
safe(() => {
  const box = $('#compare');
  const range = $('#cmpRange'), play = $('#cmpPlay'), clock = $('#cmpClock'), lab = $('#cmpLabel'), nowEl = $('#cmpNow'), nowLab = $('#cmpNowLab');
  const ticks = $('.cmp-ticks', box), photoTicks = ticks.innerHTML;
  const vbtn = $('.cmp-mode button[data-mode="video"]', box);
  const conn = navigator.connection;
  if (conn && conn.saveData) { vbtn.disabled = true; vbtn.title = '데이터 절약 모드라 사진만 보여 줍니다'; }
  const cells = $$('#cmpGrid .cell').map(c => {
    const w = c.dataset.w;
    const fr = $('.frame', c);
    const [p1, p2] = $$('picture', fr);
    p2.querySelector('img').classList.add('back');
    const st = { w, fr, layers: [p1, p2], front: 0, scene: $('.cell-scene', c), bug: $('.frame-bug', c), v: null };
    fr.addEventListener('click', () => {
      const f = mode === 'video' ? nearestFR(master()?.currentTime || 0) : FR[shown];
      openPlayer(w, { frame: f.n, frameLabel: frLabel(f, w), fromEl: fr });
    });
    return st;
  });
  let mode = 'photo';
  const nearestFR = t => FR.filter(f => f.t != null).reduce((a, f) => (Math.abs(f.t - t) < Math.abs(a.t - t) ? f : a));

  /* 사진 모드 */
  let token = 0, shown = +range.value, preloadNear = () => {};
  function show(i) {
    const f = FR[i];
    const when = f.t == null ? f.label : mmss(f.t);
    const my = ++token;
    range.setAttribute('aria-valuetext', f.t == null ? f.label : `${f.t}초`);
    const imgs = cells.map(st => setPicture(st.layers[1 - st.front], st.w, f.n, 640, ''));
    // 늦어지면 「불러오는 중」만 보이고, 다섯 장이 다 준비됐을 때 한꺼번에 바꾼다
    const slow = setTimeout(() => { if (my === token && mode === 'photo') box.classList.add('loading'); }, 400);
    return Promise.all(imgs.map(decoded)).then(() => {
      clearTimeout(slow);
      if (my !== token || mode !== 'photo') return;
      box.classList.remove('loading');
      shown = i;
      preloadNear(i);
      clock.textContent = when; nowEl.textContent = when;
      lab.textContent = nowLab.textContent = f.t == null ? (f.n === 'cover' ? '재생 버튼을 누르기 전' : '끝까지 재생한 뒤') : '재생 버튼을 누른 뒤';
      setQuery({ t: f.n === 's40' ? null : f.n });
      cells.forEach((st, k) => {
        const name = sceneAt(st.w, f);
        st.scene.textContent = name;
        st.fr.setAttribute('aria-label', `${WORKS[st.w].name}, ${when}: ${name}. 크게 보기`);
        const bugOn = st.w === 'gptp' && f.t != null && f.t <= 50;
        st.bug?.classList.toggle('show', bugOn);
        if (bugOn) st.fr.setAttribute('aria-label', st.fr.getAttribute('aria-label') + BUG_NOTE);
        const back = st.layers[1 - st.front], old = st.layers[st.front];
        imgs[k].alt = `${WORKS[st.w].name} ${when} 장면: ${name}`;
        old.querySelector('img').alt = '';
        st.fr.insertBefore(back, st.bug);
        imgs[k].classList.remove('back');
        old.querySelector('img').classList.add('back');
        st.front = 1 - st.front;
      });
    });
  }

  /* 영상 모드: 다섯 녹화 영상을 같은 시각으로 맞춰 함께 재생(필요할 때만 받음) */
  const master = () => cells[0].v;
  const vClock = t => {
    const f = { n: 's', t: Math.max(0, t) };
    clock.textContent = nowEl.textContent = mmss(t);
    lab.textContent = nowLab.textContent = '녹화 영상 · 재생 버튼을 누른 뒤';
    range.setAttribute('aria-valuetext', `${Math.round(t)}초`);
    cells.forEach(st => {
      const name = sceneAt(st.w, f), bugOn = st.w === 'gptp' && t > .5 && t <= 50, slot = Math.round(t / 5);
      if (st.lastScene === name && st.lastBug === bugOn && st.lastSlot === slot) return;
      st.lastScene = name; st.lastBug = bugOn; st.lastSlot = slot;
      st.scene.textContent = name;
      st.fr.setAttribute('aria-label', `${WORKS[st.w].name}, 영상 ${mmss(Math.round(t / 5) * 5)} 무렵: ${name}. 가까운 사진 크게 보기` + (bugOn ? BUG_NOTE : ''));
      st.bug?.classList.toggle('show', bugOn);
    });
  };
  const seekAll = t => cells.forEach(st => { if (st.v && Math.abs(st.v.currentTime - t) > .05) st.v.currentTime = t; });
  let vPlaying = false;
  const setPlayBtn = on => { play.classList.toggle('playing', on); play.setAttribute('aria-label', on ? (mode === 'video' ? '영상 멈추기' : '자동 넘기기 멈추기') : (mode === 'video' ? '영상 함께 재생' : '자동으로 넘기기')); };
  function vPlay(on) {
    if (mode !== 'video') return;
    vPlaying = on; setPlayBtn(on);
    if (on && master().ended) seekAll(0);
    cells.forEach(st => (on ? playV(st.v) : st.v.pause()));
  }
  function enterVideo() {
    if (mode === 'video') return;
    stopPhoto(); token++; mode = 'video'; box.classList.add('video-mode'); box.classList.remove('loading');
    const t0 = FR[shown].t ?? 0;
    cells.forEach(st => {
      st.lastScene = null;
      const v = h('video', { muted: true, playsinline: true, preload: 'metadata', 'aria-hidden': 'true' },
        `<source src="assets/clips/${st.w}-full.webm" type="video/webm"><source src="assets/clips/${st.w}-full.mp4" type="video/mp4">`);
      v.muted = true;
      v.currentTime = t0; // 메타데이터 전에 정하면 그 위치부터 시작한다
      st.fr.insertBefore(v, st.bug);
      st.v = v;
    });
    const m = master();
    m.addEventListener('timeupdate', () => {
      if (mode !== 'video' || m !== master()) return;
      const t = m.currentTime;
      if (!dragging) range.value = t;
      vClock(t);
      // 다섯 영상이 모두 재생 가능해진 뒤에만 어긋남을 바로잡는다
      if (!m.seeking && cells.every(st => st.v.readyState >= 2)) cells.forEach(st => { const v = st.v; if (v !== m && !v.seeking && !v.ended && t < v.duration - .1 && Math.abs(v.currentTime - t) > .25) v.currentTime = t; });
    });
    m.addEventListener('ended', () => { if (mode === 'video' && m === master()) vPlay(false); });
    range.min = 0; range.max = 90; range.step = .5; range.value = t0;
    ticks.innerHTML = [0, 30, 60, 90].map(v => `<span style="left:${(v / 90 * 100).toFixed(3)}%">${mmss(v)}</span>`).join('');
    vClock(t0);
    vPlay(motion());
  }
  function exitVideo() {
    if (mode !== 'video') return;
    const t = master()?.currentTime || 0;
    vPlay(false);
    cells.forEach(st => { if (st.v) { st.v.pause(); st.v.removeAttribute('src'); st.v.replaceChildren(); st.v.load(); st.v.remove(); } st.v = null; });
    mode = 'photo'; box.classList.remove('video-mode');
    range.min = 0; range.max = FR.length - 1; range.step = 1;
    ticks.innerHTML = photoTicks;
    const f = nearestFR(t); const i = FR.indexOf(f);
    range.value = i; setPlayBtn(false); show(i);
  }
  let dragging = false;
  $$('.cmp-mode button', box).forEach(b => b.addEventListener('click', () => {
    $$('.cmp-mode button', box).forEach(x => x.setAttribute('aria-pressed', x === b));
    if (b.dataset.mode === 'video') enterVideo(); else exitVideo();
  }));
  let raf = 0;
  range.addEventListener('input', () => {
    if (mode === 'video') { dragging = true; const t = +range.value; seekAll(t); vClock(t); return; }
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => show(+range.value));
  });
  range.addEventListener('change', () => { dragging = false; });
  // 사진 자동 넘기기: 장면이 실제로 바뀐 뒤 다음 타이머
  let timer = 0, playing = false, run = 0;
  const stopPhoto = () => { playing = false; run++; clearTimeout(timer); setPlayBtn(false); };
  const tick = async my => {
    if (!playing || my !== run) return;
    const v = +range.value + 1;
    if (v > FR.length - 1) { stopPhoto(); return; }
    range.value = v;
    await show(v);
    if (playing && my === run) timer = setTimeout(() => tick(my), 1100);
  };
  play.addEventListener('click', async () => {
    if (mode === 'video') { vPlay(!vPlaying); return; }
    if (playing) { stopPhoto(); return; }
    if (+range.value >= FR.length - 1) range.value = 0;
    playing = true; const my = ++run; setPlayBtn(true);
    await show(+range.value);
    if (playing && my === run) timer = setTimeout(() => tick(my), 1100);
  });
  range.addEventListener('pointerdown', () => { if (mode === 'photo') stopPhoto(); });
  range.addEventListener('keydown', () => { if (mode === 'photo') stopPhoto(); });
  pauseCompare = () => { if (mode === 'video' && vPlaying) vPlay(false); else if (playing) stopPhoto(); };
  reduceMQ.addEventListener('change', () => { if (!motion()) pauseCompare(); });
  // 화면 밖으로 나가면 동시 재생도 멈춘다
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && mode === 'video' && vPlaying) vPlay(false); }, { threshold: 0 }).observe(box);
  // 비교 상자가 가까워지면 지금 장면의 앞뒤 두 장씩만 미리 받는다(데이터 절약 모드·느린 연결이면 받지 않음)
  const thrifty = () => { const c = navigator.connection; return !!c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')); };
  const got = new Set();
  preloadNear = i => {
    if (thrifty() || !near) return;
    for (let d = -2; d <= 2; d++) {
      const f = FR[i + d];
      if (!f) continue;
      ORDER.forEach(w => { const u = shot(w, f.n, 640, AVIF ? 'avif' : 'jpg'); if (!got.has(u)) { got.add(u); const im = new Image(); im.decoding = 'async'; im.src = u; } });
    }
  };
  let near = false;
  onView(box, () => { near = true; preloadNear(shown); }, { rootMargin: '300px 0px' });
  // 주소에 같은 초 장면(t=s55 등)이 있으면 그 장면으로 시작
  const qt = new URLSearchParams(location.search).get('t'), qi = FR.findIndex(f => f.n === qt);
  if (qi >= 0) { range.value = qi; show(qi); }
});

/* ---------------- 등장 ---------------- */
$$('.reveal').forEach(el => onView(el, t => t.classList.add('in'), { threshold: .05, rootMargin: '0px 0px -5% 0px' }));
$$('.finds .find, .cautions li').forEach((el, i) => el.style.setProperty('--d', i % 2));
onView($('#gantt'), g => g.classList.add('in'), { threshold: .05 });
$$('#gantt .g-seg').forEach(seg => {
  const on = ms => { const b = seg.getBoundingClientRect(); showTip(seg.dataset.tip, b.left + b.width / 2, b.top, ms); };
  seg.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') on(); });
  seg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hideTip(); });
  seg.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { e.stopPropagation(); on(3000); } });
});
$$('#gantt .g-bar').forEach(bar => {
  const on = () => { const b = bar.getBoundingClientRect(); showTip(bar.getAttribute('aria-label'), b.left + Math.min(b.width, 260) / 2, b.top); };
  bar.addEventListener('focus', on); bar.addEventListener('blur', hideTip);

});
// 핵심 숫자는 화면에 들어올 때 0부터 세어 올라간다(움직임 줄이기에서는 그대로)
$$('[data-count]').forEach(el => {
  const txt = el.textContent;
  if (!motion()) return;
  onView(el, () => {
    const t0 = performance.now(), D = 900;
    const step = now => {
      const u = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - u, 3);
      el.textContent = txt.replace(/\d+(?:\.\d+)?/g, m => { const d = (m.split('.')[1] || '').length; return (parseFloat(m) * e).toFixed(d); });
      if (u < 1) requestAnimationFrame(step); else el.textContent = txt;
    };
    requestAnimationFrame(step);
  }, { threshold: .6 });
});
// 모든 초기화가 끝난 뒤에야 등장 효과용으로 내용을 숨긴다(앞에서 오류가 나면 그대로 보임)
root.classList.add('js-ready');
