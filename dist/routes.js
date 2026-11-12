export const colors = ['#17664c', '#436da0', '#9b672c', '#76558a', '#566a70', '#a04b52'];

export function tollCost(route) {
  const tollInfo = route.travelAdvisory?.tollInfo;
  if (!tollInfo) return 0;
  const prices = tollInfo.estimatedPrices;
  if (prices?.length !== 1 || prices[0].currencyCode !== 'JPY') return null;
  const amount = prices[0].units + (prices[0].nanos ?? 0) / 1e9;
  return Number.isFinite(amount) && amount >= 0 ? Math.ceil(amount) : null;
}

export function priceRoute(route, { budget, scope, fuel, efficiency }) {
  const fuelCost = Math.ceil(route.km / efficiency * fuel);
  const cost = route.toll === null ? null : route.toll + (scope === 'total' ? fuelCost : 0);
  const rank = cost === null ? 2 : cost <= budget ? 0 : 1;
  return { ...route, fuelCost, cost, rank };
}

export function rankRoutes(routes, sort) {
  return [...routes].sort((a, b) => {
    const costDifference = (a.cost ?? Infinity) - (b.cost ?? Infinity);
    return sort === 'cost'
      ? costDifference || a.minutes - b.minutes
      : a.rank - b.rank || a.minutes - b.minutes || costDifference;
  });
}

let loadedKey;
let loader;
export function loadMaps(key) {
  if (loader && loadedKey === key) return loader;
  if (loadedKey) return Promise.reject(new Error('キーを変更するには、ページを再読み込みしてから検索設定を開いてください。'));
  loadedKey = key;
  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail('Google Maps の読み込みがタイムアウトしました。'), 15000);
    function fail(message) {
      clearTimeout(timer);
      script.remove();
      delete window.yosanMapsReady;
      reject(new Error(message));
    }
    window.gm_authFailure = () => fail('Google Maps の認証に失敗しました。API キー、API の有効化、課金設定を確認してください。');
    window.yosanMapsReady = async () => {
      try {
        const [maps, routes, core, marker] = await Promise.all(
          ['maps', 'routes', 'core', 'marker'].map(name => google.maps.importLibrary(name))
        );
        clearTimeout(timer);
        delete window.yosanMapsReady;
        resolve({ ...maps, ...routes, ...core, ...marker });
      } catch {
        fail('Google Maps の読み込みに失敗しました。');
      }
    };
    const query = new URLSearchParams({ key, v: 'weekly', language: 'ja', region: 'JP', loading: 'async', callback: 'yosanMapsReady' });
    script.src = 'https://maps.googleapis.com/maps/api/js?' + query;
    script.async = true;
    script.onerror = () => fail('Google Maps に接続できませんでした。ページを再読み込みしてお試しください。');
    document.head.append(script);
  });
  return loader;
}

export async function findRoutes(api, { origin, destination, pass }) {
  const request = {
    origin, destination, travelMode: 'DRIVING', region: 'JP',
    routingPreference: 'TRAFFIC_AWARE', extraComputations: ['TOLLS'],
    fields: ['path', 'distanceMeters', 'durationMillis', 'travelAdvisory'],
  };
  const requests = [false, true].map(avoidTolls => api.Route.computeRoutes({
    ...request, computeAlternativeRoutes: !avoidTolls,
    routeModifiers: { avoidTolls, avoidFerries: true, tollPasses: pass ? [pass] : [] },
  }));
  const responses = await Promise.allSettled(requests);
  if (responses.every(response => response.status === 'rejected')) {
    throw new Error('ルート検索に失敗しました。地名・住所と API キーの設定を確認してください。');
  }
  const unique = new Map();
  for (const response of responses) {
    if (response.status !== 'fulfilled') continue;
    for (const route of response.value.routes ?? []) {
      if (!route.path?.length || !Number.isFinite(route.distanceMeters) || !Number.isFinite(route.durationMillis)) continue;
      const id = route.path.map(p => p.lat.toFixed(5) + ',' + p.lng.toFixed(5)).join('|');
      if (unique.has(id) && tollCost(unique.get(id)) !== null) continue;
      unique.set(id, route);
    }
  }
  return {
    partial: responses.some(response => response.status === 'rejected'),
    routes: Array.from(unique.values(), (route, index) => ({
      id: index, color: colors[index % colors.length], path: route.path,
      name: tollCost(route) === 0 ? '通行料なしのルート' : 'ルート ' + (index + 1),
      km: route.distanceMeters / 1000, minutes: Math.ceil(route.durationMillis / 60000), toll: tollCost(route),
    })),
  };
}
