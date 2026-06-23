const DATA_VERSION = '20260623';

const state = {
  allProducts: [],
  filteredProducts: []
};

const els = {};

function cacheEls() {
  Object.assign(els, {
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
  });
}

async function init() {
  cacheEls();

  try {
    const config = await loadJson(`./data/site-config.json?v=${DATA_VERSION}`, {});
    const products = await loadJson(`./data/products.json?v=${DATA_VERSION}`, []);

    if (els.siteTitle) {
      els.siteTitle.textContent = config.siteTitle || '厨具热销原品清单';
    }

    state.allProducts = Array.isArray(products) ? products : [];

    fillCategory2Options();
    bindEvents();
    applyFilters();

    if (!state.allProducts.length) {
      showToast('未加载到商品数据，请检查 data/products.json');
    }
  } catch (err) {
    console.error('页面初始化失败：', err);
    state.allProducts = [];
    state.filteredProducts = [];
    renderCards();
    showToast('页面初始化失败，请检查数据文件');
  }
}

async function loadJson(url, fallbackValue) {
  try {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    console.warn(`加载失败：${url}`, err);
    return fallbackValue;
  }
}

function bindEvents() {
  on(els.keyword, ['input', 'change'], applyFilters);
  on(els.minPrice, ['input', 'change'], applyFilters);
  on(els.maxPrice, ['input', 'change'], applyFilters);

  // 选择二级类目后，三级类目联动更新
  on(els.category2, ['change'], () => {
    refillCategory3Options();

    if (els.category3) {
      els.category3.value = '';
    }

    applyFilters();
  });

  on(els.category3, ['change'], applyFilters);
  on(els.priority, ['change'], applyFilters);
  on(els.sortBy, ['change'], applyFilters);

  on(els.resetBtn, ['click'], () => {
    if (els.keyword) els.keyword.value = '';
    if (els.category2) els.category2.value = '';
    refillCategory3Options();
    if (els.category3) els.category3.value = '';
    if (els.priority) els.priority.value = '';
    if (els.minPrice) els.minPrice.value = '';
    if (els.maxPrice) els.maxPrice.value = '';
    if (els.sortBy) els.sortBy.value = 'default';

    applyFilters();
  });

  on(els.exportBtn, ['click'], exportCurrentCsv);
}

function on(el, events, handler) {
  if (!el || !Array.isArray(events) || typeof handler !== 'function') return;

  events.forEach(eventName => {
    el.addEventListener(eventName, handler);
  });
}

// 页面二级类目下拉框：显示 products.json 的 category1
function fillCategory2Options() {
  if (!els.category2) return;

  els.category2.innerHTML = '<option value="">二级类目(全部)</option>';

  const values = uniqueValues(state.allProducts, item => item.category1);

  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    els.category2.appendChild(option);
  });

  refillCategory3Options();
}

// 页面三级类目下拉框：显示 products.json 的 category2
function refillCategory3Options() {
  if (!els.category3) return;

  els.category3.innerHTML = '<option value="">三级类目(全部)</option>';

  const selectedCategory2 = getValue(els.category2);

  let source = state.allProducts;

  if (selectedCategory2) {
    source = source.filter(item => item.category1 === selectedCategory2);
  }

  const values = uniqueValues(source, item => item.category2);

  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    els.category3.appendChild(option);
  });
}

function uniqueValues(list, getter) {
  return [
    ...new Set(
      list
        .map(getter)
        .map(value => String(value || '').trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function applyFilters() {
  const keyword = getValue(els.keyword).trim().toLowerCase();

  // 页面二级类目，对应 JSON 字段 category1
  const selectedCategory2 = getValue(els.category2);

  // 页面三级类目，对应 JSON 字段 category2
  const selectedCategory3 = getValue(els.category3);

  const priority = getValue(els.priority);
  const minPrice = readNumberInput(els.minPrice);
  const maxPrice = readNumberInput(els.maxPrice);
  const sortBy = getValue(els.sortBy) || 'default';

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

    // 二级类目筛选 category1
    const okCategory2 = !selectedCategory2 || item.category1 === selectedCategory2;

    // 三级类目筛选 category2
    const okCategory3 = !selectedCategory3 || item.category2 === selectedCategory3;

    const okPriority = !priority || item.priority === priority;

    const price = toNumber(item.targetPrice);
    const okMin = Number.isNaN(minPrice) || price >= minPrice;
    const okMax = Number.isNaN(maxPrice) || price <= maxPrice;

    return okKeyword && okCategory2 && okCategory3 && okPriority && okMin && okMax;
  });

  if (sortBy === 'priceAsc') {
    list.sort((a, b) => toNumber(a.targetPrice) - toNumber(b.targetPrice));
  } else if (sortBy === 'priceDesc') {
    list.sort((a, b) => toNumber(b.targetPrice) - toNumber(a.targetPrice));
  } else if (sortBy === 'dateDesc') {
    list.sort((a, b) => String(b.updateDate || '').localeCompare(String(a.updateDate || '')));
  }

  state.filteredProducts = list;
  renderCards();
}

function renderCards() {
  if (els.filteredCount) {
    els.filteredCount.textContent = state.filteredProducts.length;
  }

  if (!els.cardGrid) return;

  if (!state.filteredProducts.length) {
    els.cardGrid.innerHTML = '';

    if (els.emptyState) {
      els.emptyState.classList.remove('hidden');
    }

    return;
  }

  if (els.emptyState) {
    els.emptyState.classList.add('hidden');
  }

  els.cardGrid.innerHTML = state.filteredProducts.map(item => {
    const priorityText = item.priority || '-';
    const pClass = String(priorityText).toLowerCase().replace(/[^a-z0-9_-]/g, '');

    const imageUrl = normalizeUrl(item.image);
    const originUrl = normalizeUrl(item.originLink);
    const link1688Url = normalizeUrl(item.link1688);

    const imagePart = imageUrl
      ? `<img class="card-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" />`
      : `<div class="img-fallback">暂无图片</div>`;

    const badge = item.pricingLink
      ? `<a class="priority-link" href="${escapeHtml(normalizeUrl(item.pricingLink))}" target="_blank" rel="noopener noreferrer"><span class="priority-badge ${pClass}">${escapeHtml(priorityText)}</span></a>`
      : `<span class="priority-badge ${pClass}">${escapeHtml(priorityText)}</span>`;

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

            ${
              originUrl
                ? `<a class="link-btn link-origin" href="${escapeHtml(originUrl)}" target="_blank" rel="noopener noreferrer">原品 &gt;&gt;&gt;</a>`
                : `<span></span>`
            }

            ${
              link1688Url
                ? `<a class="link-btn link-1688" href="${escapeHtml(link1688Url)}" target="_blank" rel="noopener noreferrer">1688链接 &gt;&gt;&gt;</a>`
                : `<span></span>`
            }
          </div>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.invitation-box').forEach(el => {
    el.addEventListener('click', async () => {
      const value = el.getAttribute('data-copy');
      if (!value) return;

      const copied = await copyText(value);

      if (copied) {
        showToast(`已复制：${value}`);
      } else {
        showToast('复制失败，请手动复制');
      }
    });
  });
}

function normalizeUrl(value) {
  let url = String(value || '').trim();

  if (!url) return '';

  // 从类似「相似款：https://detail.1688.com/...」里提取第一个真实链接
  const httpMatch = url.match(/https?:\/\/[^\s，,；;]+/i);
  if (httpMatch) {
    url = httpMatch[0];
  }

  // 兼容 //img.xxx.com 或 //detail.1688.com
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  // 兼容 detail.1688.com/xxx、m.1688.com/xxx、img.alicdn.com/xxx 这类缺少协议的链接
  if (!/^https?:\/\//i.test(url) && /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(url)) {
    url = `https://${url}`;
  }

  url = url.replace(/[，,。；;]+$/g, '');

  if (!/^https?:\/\//i.test(url)) {
    return '';
  }

  return url;
}

function exportCurrentCsv() {
  if (!state.filteredProducts.length) {
    showToast('当前没有可导出结果');
    return;
  }

  const rows = state.filteredProducts;
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));

  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = 'filtered-model-cards.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function getValue(el) {
  return el ? String(el.value || '') : '';
}

function readNumberInput(el) {
  const value = getValue(el).trim();

  if (!value) {
    return NaN;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function toNumber(value) {
  const text = String(value || '').replace(/[^\d.-]/g, '');
  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
  return toNumber(value).toFixed(2);
}

function csvEscape(value) {
  const text = String(value ?? '');

  return /[",\n]/.test(text)
    ? '"' + text.replace(/"/g, '""') + '"'
    : text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function copyText(value) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API 复制失败，尝试备用方案：', err);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand('copy');
    textarea.remove();

    return success;
  } catch (err) {
    console.warn('备用复制方案失败：', err);
    return false;
  }
}

let toastTimer = null;

function showToast(message) {
  if (!els.toast) return;

  els.toast.textContent = message;
  els.toast.classList.remove('hidden');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 1800);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
