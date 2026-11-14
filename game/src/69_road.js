/* ============================ REWARD ROAD ============================ */
// Every player level pays gems; some levels also unlock a shop item that cannot be bought (it.lvl in SKINS).
const ROAD_MAX = 25;
const SLOT_N = { color: 'رنگ', hat: 'کلاه', trail: 'رد پا', pet: 'همراه', boom: 'افکت مرگ' };
const roadItems = lv => { const out = []; for (const slot in SKINS) for (const it of SKINS[slot]) if (it.lvl === lv) out.push({ slot, it }); return out; };
const lockedLv = it => !!it.lvl && XP.lvl(ST.xp) < it.lvl;
function renderRoad() {
  const L = XP.lvl(ST.xp), a = XP.need(L), b = XP.need(L + 1), k = clamp(((ST.xp || 0) - a) / (b - a), 0, 1);
  $('roadHead').innerHTML = `<b>⭐ سطح ${faNum(L)}</b><span class="xpbar"><i style="transform:scaleX(${k.toFixed(3)})"></i></span><small>${faNum((ST.xp || 0) - a)} / ${faNum(b - a)} تا سطح ${faNum(L + 1)}</small>`;
  let h = '';
  for (let lv = 2; lv <= ROAD_MAX; lv++) {
    const got = L >= lv, items = roadItems(lv);
    h += `<div class="road${got ? ' got' : ''}${lv === L + 1 ? ' next' : ''}${items.length ? ' big' : ''}"><div class="rl">${faNum(lv)}</div>
      <div class="rr"><span>💎 ${faNum(lv * 10)}</span>${items.map(({ slot, it }) => `<span class="ri">${it.i} ${it.n} <small>(${SLOT_N[slot]})</small></span>`).join('')}</div>
      <div class="rs">${got ? '✔' : '🔒'}</div></div>`;
  }
  $('roadList').innerHTML = h;
  const nx = $('roadList').querySelector('.next'); if (nx) setTimeout(() => nx.scrollIntoView({ block: 'center' }), 30);
}
$('xpBox').addEventListener('click', () => { Sound.init(); Sound.play('click'); renderRoad(); app.open('sRoad'); });
$('bRoadShop').onclick = () => { Sound.play('click'); renderShop(); app.open('sShop'); if (!shopAnim) { shopAnim = 1; requestAnimationFrame(shopPreview); } };
