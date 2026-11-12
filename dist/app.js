import { demoRoutes, drawDemo } from './demo.js';
import { findRoutes, loadMaps, priceRoute, rankRoutes } from './routes.js';

const el = id => document.getElementById(id);
const yen = value => value === null ? '不明' : '¥' + value.toLocaleString('ja-JP');
const distance = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 });
const duration = minutes => minutes >= 60 ? Math.floor(minutes / 60) + '時間 ' + minutes % 60 + '分' : minutes + '分';
const presetButtons = [...document.querySelectorAll('[data-budget]')];

const keyStorageName = 'yosan-drive.maps-key';
let savedKey = '';
try {
  savedKey = localStorage.getItem(keyStorageName) ?? '';
} catch {
  // Search can still use a key for the lifetime of this page.
}
let key = savedKey;
let api;
let map;
let overlays = [];
let results;
let selected;

function conditions() {
  return {
    origin: el('origin').value.trim(), destination: el('destination').value.trim(),
    budget: el('budget').valueAsNumber, scope: el('scope').value,
    fuel: el('fuel').valueAsNumber, efficiency: el('efficiency').valueAsNumber,
    pass: el('pass').value,
  };
}

function clearMap() {
  for (const overlay of overlays) {
    if (overlay.setMap) overlay.setMap(null);
    else overlay.map = null;
  }
  overlays = [];
}

function updateMap(fit) {
  const demo = results?.demo;
  const routes = results?.routes ?? [];
  el('demo-map').hidden = !demo;
  el('live-map').hidden = !!demo || !routes.length;
  el('map-note').hidden = !demo && !!routes.length;
  el('map-note').textContent = demo ? '概略図 · 東京駅 → 箱根湯本駅' : 'ルートが表示されます';
  el('mode').textContent = demo ? 'デモ地図' : key ? 'Google Maps' : 'ルート地図';
  el('legend').replaceChildren(...routes.map(route => {
    const item = document.createElement('span');
    item.append(dot(route.color), document.createTextNode(route.name));
    return item;
  }));
  clearMap();
  if (demo) {
    drawDemo(el('demo-map'), routes, selected);
    return;
  }
  if (!routes.length) return;
  map ??= new api.Map(el('live-map'), {
    center: { lat: 35.68, lng: 139.76 }, zoom: 9, mapId: 'DEMO_MAP_ID',
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'cooperative',
  });
  const bounds = new api.LatLngBounds();
  for (const route of routes) {
    const active = route.id === selected;
    const path = route.path.map(({ lat, lng }) => ({ lat, lng }));
    for (const point of path) bounds.extend(point);
    overlays.push(new api.Polyline({
      map, path, strokeColor: route.color, strokeOpacity: active ? 1 : .6,
      strokeWeight: active ? 6 : 4, zIndex: active ? 2 : 1,
    }));
  }
  const path = routes.find(route => route.id === selected)?.path ?? routes[0].path;
  for (const [point, title] of [[path[0], results.input.origin], [path.at(-1), results.input.destination]]) {
    overlays.push(new api.AdvancedMarkerElement({ map, position: { lat: point.lat, lng: point.lng }, title }));
  }
  if (fit) map.fitBounds(bounds, 45);
}

function dot(color) {
  const element = document.createElement('i');
  element.className = 'dot';
  element.style.background = color;
  return element;
}

function card(route, scope) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card';
  button.dataset.route = route.id;
  button.setAttribute('aria-pressed', String(route.id === selected));
  const badge = route.rank === 0 ? '予算内' : route.rank === 1 ? '予算オーバー' : '料金不明';
  const amount = route.cost === null ? '料金不明' : yen(route.cost);
  const breakdown = scope === 'total' ? '<span>燃料 ' + yen(route.fuelCost) + '</span>' : '';
  // Markup uses only provider-independent labels and formatted numbers.
  button.innerHTML =
    '<div class="card-top"><span class="route-name"></span><span class="pill ' + (route.rank ? 'over' : '') + '">' + badge + '</span></div>' +
    '<div class="card-main"><strong>' + amount + '</strong><span>' + duration(route.minutes) + ' · ' + distance.format(route.km) + ' km</span></div>' +
    '<div class="card-meta"><span>通行料 ' + yen(route.toll) + '</span>' + breakdown + '</div>';
  button.querySelector('.route-name').append(dot(route.color), document.createTextNode(route.name));
  button.addEventListener('click', () => {
    selected = route.id;
    for (const item of el('cards').children) item.setAttribute('aria-pressed', String(Number(item.dataset.route) === selected));
    updateMap(false);
  });
  return button;
}

function render(fit = false) {
  if (!results) {
    el('cards').replaceChildren();
    updateMap(false);
    return;
  }
  const { input } = results;
  const routes = rankRoutes(results.routes.map(route => priceRoute(route, input)), el('sort').value);
  selected ??= routes[0]?.id;
  const count = routes.filter(route => route.rank === 0).length;
  const summary = routes.length === 0 ? '経路が見つかりませんでした。住所や地名を変えてお試しください。'
    : count ? count + '件が予算 ' + yen(input.budget) + ' 以内'
    : '取得した候補のうち、予算 ' + yen(input.budget) + ' 以内と確認できたルートはありません';
  const prefix = results.demo ? 'デモ料金・所要時間 ｜ ' : input.origin + ' → ' + input.destination + ' ｜ ';
  el('status').textContent = prefix + summary + (results.partial ? '（一部の候補を取得できませんでした）' : '');
  el('cards').replaceChildren(...routes.map(route => card(route, input.scope)));
  updateMap(fit);
}

function showDemo(input) {
  results = { input, demo: true, routes: demoRoutes(input.pass) };
  selected = undefined;
  render();
}

async function search(event) {
  event.preventDefault();
  const input = conditions();
  if (!input.origin || !input.destination || input.origin === input.destination) {
    el('status').textContent = '異なる出発地と目的地を入力してください。';
    results = null;
    render();
    return;
  }
  if (!key) {
    if (input.origin === '東京駅' && input.destination === '箱根湯本駅') {
      showDemo(input);
    } else {
      results = null;
      el('status').textContent = 'デモは「東京駅 → 箱根湯本駅」です。他の区間は検索設定から API キーを設定してください。';
      render();
    }
    return;
  }
  if (!navigator.onLine) {
    el('status').textContent = '実際のルート検索にはインターネット接続が必要です。';
    return;
  }
  results = null;
  selected = undefined;
  el('submit').disabled = true;
  el('settings').disabled = true;
  el('status').textContent = '通行料とルート候補を取得しています…';
  render();
  try {
    api = await loadMaps(key);
    results = { input, ...await findRoutes(api, input) };
    render(true);
  } catch (error) {
    results = null;
    el('status').textContent = error.message || '検索できませんでした。';
    render();
  } finally {
    el('submit').disabled = false;
    el('settings').disabled = false;
  }
}

el('search').addEventListener('submit', search);
el('sort').addEventListener('change', () => render());
el('swap').addEventListener('click', () => {
  const origin = el('origin');
  const destination = el('destination');
  [origin.value, destination.value] = [destination.value, origin.value];
});
function updatePresets() {
  for (const button of presetButtons) button.setAttribute('aria-pressed', String(Number(button.dataset.budget) === el('budget').valueAsNumber));
}
for (const button of presetButtons) {
  button.addEventListener('click', () => {
    el('budget').value = button.dataset.budget;
    updatePresets();
  });
}
el('budget').addEventListener('input', updatePresets);

el('settings').addEventListener('click', () => {
  el('key').value = key;
  el('remember-key').checked = !key || !!savedKey;
  el('config-status').hidden = true;
  el('config').showModal();
});
el('cancel').addEventListener('click', () => el('config').close());
el('config-form').addEventListener('submit', event => {
  event.preventDefault();
  const nextKey = el('key').value.trim();
  const nextSavedKey = el('remember-key').checked ? nextKey : '';
  if (nextSavedKey !== savedKey) {
    try {
      if (nextSavedKey) localStorage.setItem(keyStorageName, nextSavedKey);
      else localStorage.removeItem(keyStorageName);
      savedKey = nextSavedKey;
    } catch {
      el('config-status').textContent = 'このブラウザではキーを保存・削除できませんでした。保存の設定を確認してください。';
      el('config-status').hidden = false;
      return;
    }
  }
  const reload = nextKey && savedKey && api && nextKey !== key;
  key = nextKey;
  el('key').value = '';
  el('config').close();
  if (reload) {
    location.reload();
  } else if (key) {
    results = null;
    render();
    el('status').textContent = 'API キーを設定しました。「予算でルートを探す」を押してください。';
  } else {
    el('search').requestSubmit();
  }
});

new ResizeObserver(() => {
  if (results?.demo) drawDemo(el('demo-map'), results.routes, selected);
}).observe(el('demo-map').parentElement);
updatePresets();
if (key) {
  render();
  el('status').textContent = '保存済みの API キーで検索できます。';
} else {
  showDemo(conditions());
}
