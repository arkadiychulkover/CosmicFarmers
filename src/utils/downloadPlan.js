import { cropImage } from '../data/crops.js';

const PAGE = { w: 210, h: 297, margin: 18 };
const CONTENT_W = PAGE.w - PAGE.margin * 2;
const CAPTIONS = ['Recommended next crop', 'Follow-up crop', 'Cycle completion'];

/** Стандартные шрифты PDF не содержат часть Unicode: оставляем безопасный набор. */
const safe = (text) =>
  String(text)
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/[^\x20-\x7E°±×]/g, '');

/** webp -> JPEG data URL, обрезанный "cover" под заданное соотношение сторон (jsPDF не читает webp). */
async function loadPhoto(url, ratio) {
  if (!url) return null;
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const width = 1200;
    const height = Math.round(width / ratio);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    canvas.getContext('2d').drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

function paragraph(doc, text, x, y, { size = 10, style = 'normal', color = 40, width = CONTENT_W } = {}) {
  doc.setFont('helvetica', style).setFontSize(size).setTextColor(color);
  const lines = doc.splitTextToSize(safe(text), width);
  doc.text(lines, x, y);
  return y + lines.length * size * 0.45;
}

/** Генерация PDF целиком на стороне пользователя; jsPDF подгружается только по клику. */
export async function downloadPlan(result, form) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { margin } = PAGE;

  let y = margin + 4;
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(30);
  doc.text('FIELD SHIFT', margin, y);
  y = paragraph(doc, 'Personalised 3-year crop rotation plan', margin, y + 8, { size: 12, color: 90 });

  y += 8;
  y = paragraph(doc, 'FIELD PROFILE', margin, y, { size: 9, style: 'bold', color: 120 }) + 1;
  for (const line of [
    `Location: lat ${form.lat}, lon ${form.lon}`,
    `Soil: pH ${form.ph}; N ${form.n}, P ${form.p}, K ${form.k} mg/kg`,
    `Previous season: ${result.previousName}`,
  ]) {
    y = paragraph(doc, line, margin, y + 2, { size: 10 });
  }

  y += 10;
  y = paragraph(doc, 'ROTATION OVERVIEW', margin, y, { size: 9, style: 'bold', color: 120 }) + 2;
  for (const entry of result.years) {
    doc.setDrawColor(200).line(margin, y, margin + CONTENT_W, y);
    y += 6;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(30);
    doc.text(`Year ${entry.year}`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(safe(entry.name), margin + 24, y);
    doc.setTextColor(120).text(`${entry.match}% match`, margin + CONTENT_W, y, { align: 'right' });
    y += 3;
  }
  doc.line(margin, y, margin + CONTENT_W, y);

  const photos = await Promise.all(result.years.map((e) => loadPhoto(cropImage(e.id), CONTENT_W / 70)));

  result.years.forEach((entry, i) => {
    doc.addPage();
    let py = margin;
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(120);
    doc.text(safe(`YEAR ${entry.year} - ${(CAPTIONS[i] ?? '').toUpperCase()}`), margin, py);
    py += 5;
    if (photos[i]) doc.addImage(photos[i], 'JPEG', margin, py, CONTENT_W, 70);
    py += 80;

    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(30);
    doc.text(safe(entry.name), margin, py);
    doc.setFontSize(20).setTextColor(90).text(`${entry.match}%`, margin + CONTENT_W, py, { align: 'right' });
    py = paragraph(doc, entry.tag, margin, py + 7, { size: 10, color: 110 }) + 6;

    for (const [title, text] of [
      ['Soil synergy', entry.why.soil],
      ['Climate match', entry.why.climate],
      ['Agronomic and stress advisory', entry.why.advisory],
    ]) {
      py = paragraph(doc, title, margin, py, { size: 10, style: 'bold', color: 30 });
      py = paragraph(doc, text, margin, py + 1, { size: 10, color: 70 }) + 5;
    }

    py = paragraph(doc, 'CANDIDATES CONSIDERED THIS YEAR', margin, py + 3, { size: 8, style: 'bold', color: 120 });
    paragraph(doc, entry.options.map((o) => `${o.name} ${o.percent}%`).join('   |   '), margin, py + 2, { size: 10, color: 70 });
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p).setFont('helvetica', 'normal').setFontSize(8).setTextColor(150);
    doc.text(`Field Shift - page ${p} / ${total}`, PAGE.w / 2, PAGE.h - 8, { align: 'center' });
  }

  doc.save('crop-plan.pdf');
}
