const state = { allProducts: [], filteredProducts: [] };

const els = {
  siteTitle: document.getElementById('siteTitle'),
  keyword: document.getElementById('keyword'),

  // 页面上的二级类目下拉框，对应 products.json 里的 category1
  category2: document.getElementById('category2'),

  // 页面上的三级类目下拉框，对应 products.json 里的 category2
  category3: document.getElementById('category3'),

  priority: document.getElementById('priority'),
  minPrice: document.getElementById('minPrice'),
  maxPrice: document.getElementById('maxPrice'),
  sortBy: document.getElementById('sortBy'),
  resetBtn: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
  filteredCount: document.getElementById('filteredCount'),
  cardGrid: document.getElementById('cardGrid'),
  emptyState: document.getElementById('emptyState'),
  toast: document.getElementById('toast')
};

async function init() {
  const config = await fetch('./data/site-config.json').then(r => r.json());
  const products = await fetch('./data/products.json').then(r => r.json());

  els.siteTitle.textContent = config.siteTitle || '餐厨家具热销原品清单';
  state.allProducts = products;

  fillCategory2Options();
  bindEvents();
  applyFilters();
}

function bindEvents() {
  [els.keyword, els.minPrice, els.maxPrice].forEach(el => {
    ['input', 'change'].forEach(evt => el.addEventListener(evt, applyFilters));
  });

  // 二级类目变化时，重新生成三级类目选项
  els.category2.addEventListener('change', () => {
    refillCategory3Options();
    els.category3.value = '';
    applyFilters();
  });

  // 三级类目、优先级、排序变化时，直接筛选
  [els.category3, els.priority, els.sortBy].forEach(el => {
    el.addEventListener('change', applyFilters);
  });

  els.resetBtn.addEventListener('click', () => {
    els.keyword.value = '';
    els.category2.value = '';
    refillCategory3Options();
    els.category3.value = '';
    els.priority.value = '';
    els.minPrice.value = '';
    els.maxPrice.value = '';
    els.sortBy.value = 'default';
    applyFilters();
  });

  els.exportBtn.addEventListener('click', exportCurrentCsv);
}

// 填充页面上的二级类目下拉框，数据来自 products.json 的 category1
function fillCategory2Options() {
  els.category2.innerHTML = '<option value="">二级类目(全部)</option>';

  const values = [
    ...new Set(state.allProducts.map(x => x.category1).filter(Boolean))
  ].sort();

  values.forEach(v => {
    const op = document.createElement('option');
    op.value = v;
    op.textContent = v;
    els.category2.appendChild(op);
  });

  refillCategory3Options();
}

// 填充页面上的三级类目下拉框，数据来自 products.json 的 category2
function refillCategory3Options() {
  els.category3.innerHTML = '<option value="">三级类目(全部)</option>';

  const selectedCategory2 = els.category2.value;

  let source = state.allProducts;

  // 根据已选的二级类目，联动筛选三级类目
  if (selectedCategory2) {
    source = source.filter(x => x.category1 === selectedCategory2);
  }

  const values = [
    ...new Set(source.map(x => x.category2).filter(Boolean))
  ].sort();

  values.forEach(v => {
    const op = document.createElement('option');
    op.value = v;
    op.textContent = v;
    els.category3.appendChild(op);
  });
}

function applyFilters() {
  const keyword = (els.keyword.value || '').trim().toLowerCase();

  // 页面二级类目，对应 JSON category1
  const selectedCategory2 = els.category2.value;

  // 页面三级类目，对应 JSON category2
  const selectedCategory3 = els.category3.value;

  const priority = els.priority.value;
  const minPrice = parseFloat(els.minPrice.value);
  const maxPrice = parseFloat(els.maxPrice.value);
  const sortBy = els.sortBy.value;

  let list = state.allProducts.filter(item => {
    const haystack = [
      item.title,
      item.invitationId,
      item.itemId,
      item.modelId,
      item.specName,
      item.category1,
      item.category2
    ].join(' ').toLowerCase();

    const okKeyword = !keyword || haystack.includes(keyword);

    // 页面二级类目筛选 JSON category1
    const okCategory2 = !selectedCategory2 || item.category1 === selectedCategory2;

    // 页面三级类目筛选 JSON category2
    const okCategory3 = !selectedCategory3 || item.category2 === selectedCategory3;

    const okPriority = !priority || item.priority === priority;

    const price = Number(item.targetPrice || 0);
    const okMin = Number.isNaN(minPrice) || price >= minPrice;
    const okMax = Number.isNaN(maxPrice) || price <= maxPrice;

    return okKeyword && okCategory2 && okCategory3 && okPriority && okMin && okMax;
  });

  if (sortBy === 'priceAsc') {
    list.sort((a, b) => Number(a.targetPrice || 0) - Number(b.targetPrice || 0));
  } else if (sortBy === 'priceDesc') {
    list.sort((a, b) => Number(b.targetPrice || 0) - Number(a.targetPrice || 0));
  } else if (sortBy === 'dateDesc') {
    list.sort((a, b) => String(b.updateDate || '').localeCompare(String(a.updateDate || '')));
  }

  state.filteredProducts = list;
  renderCards();
}

function renderCards() {
  els.filteredCount.textContent = state.filteredProducts.length;

  if (!state.filteredProducts.length) {
    els.cardGrid.innerHTML = '';
    els.emptyState.classList.remove('hidden');
    return;
  }

  els.emptyState.classList.add('hidden');

  els.cardGrid.innerHTML = state.filteredProducts.map(item => {
    const pClass = (item.priority || '').toLowerCase();

    const imagePart = item.image
      ? `<img class="card-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" />`
      : `<div class="img-fallback">暂无图片</div>`;

    const badge = item.pricingLink
      ? `<a class="priority-link" href="${escapeHtml(item.pricingLink)}" target="_blank" rel="noopener noreferrer"><span class="priority-badge ${pClass}">${escapeHtml(item.priority || '-')}</span></a>`
      : `<span class="priority-badge ${pClass}">${escapeHtml(item.priority || '-')}</span>`;

    return `
      <article class="card">
        <div class="card-top">
          ${badge}
          <div class="card-image-wrap">${imagePart}</div>
        </div>

        <div class="card-bottom">
          <div class="title" title="${escapeHtml(item.title || '')}">${escapeHtml(item.title || '')}</div>

          <div class="price-row">
            <div class="price">¥${formatPrice(item.targetPrice)}</div>
            <div class="spec-name" title="${escapeHtml(item.specName || '')}">${escapeHtml(item.specName || '')}</div>
          </div>

          <div class="id-row">
            <div class="count-badge">共${escapeHtml(String(item.specCount || 1))}款</div>
            <div class="invitation-box" data-copy="${escapeHtml(item.invitationId || '')}">${escapeHtml(item.invitationId || '')}</div>
          </div>

          <div class="meta-row">
            <div class="meta"><strong>${escapeHtml(item.updateDate || '')}</strong>发布</div>
            <div class="meta" title="${escapeHtml(item.modelId || '')}">${escapeHtml(item.modelId || '')}</div>
            ${item.originLink ? `<a class="link-btn link-origin" href="${escapeHtml(item.originLink)}" target="_blank" rel="noopener noreferrer">原品 &gt;&gt;&gt;</a>` : `<span></span>`}
            ${item.link1688 ? `<a class="link-btn link-1688" href="${escapeHtml(item.link1688)}" target="_blank" rel="noopener noreferrer">1688链接 &gt;&gt;&gt;</a>` : `<span></span>`}
          </div>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.invitation-box').forEach(el => {
    el.addEventListener('click', async () => {
      const value = el.getAttribute('data-copy');
      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);
        showToast(`已复制：${value}`);
      } catch {
        showToast('复制失败，请手动复制');
      }
    });
  });
}

function exportCurrentCsv() {
  if (!state.filteredProducts.length) {
    return showToast('当前没有可导出结果');
  }

  const rows = state.filteredProducts;
  const headers = Object.keys(rows[0]);

  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))
  ].join('\n');

  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'filtered-model-cards.csv';
  a.click();

  URL.revokeObjectURL(url);
}

function formatPrice(v) {
  return Number(v || 0).toFixed(2);
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let timer = null;

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');

  clearTimeout(timer);
  timer = setTimeout(() => els.toast.classList.add('hidden'), 1800);
}

init();
