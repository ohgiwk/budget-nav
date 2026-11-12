import { colors } from './routes.js';

const samples = [
  { name: '東名高速経由', km: 92.4, minutes: 83, toll: 2160, path: [[83,23],[79,27],[72,28],[65,33],[59,32],[50,39],[45,46],[36,49],[29,58],[25,69],[17,75]] },
  { name: '高速と一般道を利用', km: 96.2, minutes: 107, toll: 1310, path: [[83,23],[80,30],[74,34],[68,38],[62,38],[56,43],[49,48],[45,55],[37,57],[32,62],[29,68],[23,72],[17,75]] },
  { name: '一般道のみ', km: 101.3, minutes: 154, toll: 0, path: [[83,23],[82,34],[77,41],[71,45],[67,50],[61,55],[55,58],[48,65],[42,66],[37,72],[30,77],[23,79],[17,75]] },
];

export function demoRoutes(pass) {
  return samples.map((route, id) => ({
    ...route, id, color: colors[id], toll: route.toll + (route.toll && !pass ? 300 : 0),
  }));
}

export function drawDemo(canvas, routes, selected) {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const x = n => n * width / 100;
  const y = n => n * height / 100;
  function path(points) {
    ctx.beginPath();
    points.forEach(([px, py], i) => i ? ctx.lineTo(x(px), y(py)) : ctx.moveTo(x(px), y(py)));
  }
  function fill(points, color) {
    path(points);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function stroke(points, color, lineWidth) {
    path(points);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.fillStyle = '#e9eee2';
  ctx.fillRect(0, 0, width, height);
  fill([[0,0],[31,0],[29,13],[34,25],[27,33],[33,46],[24,54],[25,65],[17,76],[0,83]], '#d6e4ce');
  fill([[100,24],[91,26],[89,37],[83,41],[84,50],[75,55],[75,62],[65,69],[58,69],[54,81],[46,84],[35,84],[25,79],[20,85],[24,100],[100,100]], '#c9e2e8');
  fill([[100,47],[94,53],[93,66],[87,70],[86,81],[91,86],[100,82]], '#e5ebdd');
  for (let i = 0; i < 25; i++) {
    const points = Array.from({ length: 17 }, (_, j) => {
      const py = j * 6.5 - 7;
      const px = i * 5.5 - 24 + py * .25 + Math.sin(j * .7 + i * 1.4) * 3;
      return [px, py];
    }).filter(([px, py]) => py < 22 || px < 98 - py * .63 || px > 94 && py > 57);
    if (points.length > 1) stroke(points, '#f9faf2', i % 4 === 0 ? 2.7 : 1.1);
  }
  for (let i = 0; i < 15; i++) {
    const points = Array.from({ length: 16 }, (_, j) => {
      const px = j * 7;
      return [px, i * 7.3 - px * .19 + Math.sin(j * .8 + i) * 3];
    }).filter(([px, py]) => py < 22 || px < 97 - py * .71);
    if (points.length > 1) stroke(points, '#f9faf4', i % 3 === 0 ? 2.9 : 1.1);
  }
  ctx.font = '600 11px sans-serif';
  ctx.fillStyle = '#546e60';
  for (const [name, px, py] of [['相模原',44,32],['厚木',38,61],['横浜',69,59],['川崎',77,43],['小田原',24,89],['東京湾',88,62],['相模湾',56,89]]) {
    ctx.fillText(name, x(px), y(py));
  }
  const ordered = [...routes].sort((a, b) => Number(a.id === selected) - Number(b.id === selected));
  for (const route of ordered) {
    const active = route.id === selected;
    stroke(route.path, '#fff', active ? 9 : 6);
    stroke(route.path, route.color, active ? 5.5 : 3);
  }
  for (const [name, px, py, right] of [['東京駅',83,23,true],['箱根湯本駅',17,75,false]]) {
    ctx.font = 'bold 12px sans-serif';
    const labelWidth = ctx.measureText(name).width + 16;
    const left = Math.max(4, Math.min(width - labelWidth - 4, x(px) + (right ? -labelWidth + 5 : -7)));
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(left, y(py) - 34, labelWidth, 23, 5);
    ctx.fill();
    ctx.fillStyle = '#204333';
    ctx.fillText(name, left + 8, y(py) - 18);
    ctx.beginPath();
    ctx.arc(x(px), y(py), 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
