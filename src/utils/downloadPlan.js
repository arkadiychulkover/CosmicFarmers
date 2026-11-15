import { cropImage } from '../data/crops.js';

const PAGE = { w: 210, h: 297, margin: 18 };
const CONTENT_W = PAGE.w - PAGE.margin * 2;
const CAPTIONS = ['Recommended next crop', 'Follow-up crop', 'Cycle completion'];

const CYRILLIC_MAP = {
  А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g',
  Ґ: 'G', ґ: 'g', Д: 'D', д: 'd', Е: 'E', е: 'e', Ё: 'Yo', ё: 'yo',
  Є: 'Ye', є: 'ye', Ж: 'Zh', ж: 'zh', З: 'Z', з: 'z', И: 'I', и: 'i',
  І: 'I', і: 'i', Ї: 'Yi', ї: 'yi', Й: 'Y', й: 'y', К: 'K', к: 'k',
  Л: 'L', л: 'l', М: 'M', м: 'm', Н: 'N', н: 'n', О: 'O', о: 'o',
  П: 'P', п: 'p', Р: 'R', р: 'r', С: 'S', с: 's', Т: 'T', т: 't',
  У: 'U', у: 'u', Ф: 'F', ф: 'f', Х: 'Kh', х: 'kh', Ц: 'Ts', ц: 'ts',
  Ч: 'Ch', ч: 'ch', Ш: 'Sh', ш: 'sh', Щ: 'Shch', щ: 'shch',
  Ъ: '', ъ: '', Ы: 'Y', ы: 'y', Ь: '', ь: '', Э: 'E', э: 'e',
  Ю: 'Yu', ю: 'yu', Я: 'Ya', я: 'ya',
};

function transliterate(input) {
  let out = '';
  for (const ch of String(input ?? '')) {
    out += CYRILLIC_MAP[ch] ?? ch;
  }
  return out;
}

export const safe = (text) =>
  transliterate(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/→/g, '->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/Δ/g, 'delta')
    .replace(/₂/g, '2')
    .replace(/·/g, ' - ')
    .replace(/…/g, '...')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E°±×]/g, '');

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

function ensureSpace(doc, y, needed = 24) {
  if (y + needed <= PAGE.h - PAGE.margin) return y;
  doc.addPage();
  return PAGE.margin + 4;
}

function formatIrrigation(result, form) {
  if (result?.irrigationLabel) return result.irrigationLabel;
  const raw = String(form?.irrigation || 'rainfed').toLowerCase();
  if (raw === 'irrigated') return 'Irrigated';
  if (raw === 'supplemental') return 'Supplemental';
  return 'Rainfed';
}

function formatCoverLine(cover) {
  if (!cover) return 'No cover window data';
  if (cover.isAlleyCover) {
    return `Alley cover: ${cover.coverCrop} (Sow ${cover.sowWindow?.label || 'Spring/Autumn'})`;
  }
  if (!cover.hasBareWindow) {
    return 'Continuous living cover (0 bare months)';
  }
  const sow = cover.sowWindow?.label ? `Sow ${cover.sowWindow.label}` : '';
  const term = cover.terminateWindow?.label ? cover.terminateWindow.label : '';
  return `${cover.coverCrop} (${cover.warmCoverMonths ?? 0} warm / ${cover.bareMonths ?? 0} bare mo) - ${[sow, term].filter(Boolean).join('; ')}`;
}

function coverSlug(name) {
  const s = String(name || '').toLowerCase();
  if (s.includes('rye')) return 'winter-rye';
  if (s.includes('radish')) return 'oilseed-radish';
  if (s.includes('oat') || s.includes('pea')) return 'oats-field-pea';
  if (s.includes('vetch')) return 'hairy-vetch';
  return 'crimson-clover';
}

export async function downloadPlan(result, form) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { margin } = PAGE;

  let y = margin + 4;
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(30);
  doc.text('FIELD SHIFT', margin, y);
  y = paragraph(doc, 'Personalized 3-year crop rotation plan', margin, y + 8, { size: 12, color: 90 });

  y += 6;
  y = paragraph(doc, 'FIELD PROFILE & MANAGEMENT', margin, y, { size: 9, style: 'bold', color: 120 }) + 1;
  const goalTitle = form.goal === 'water'
    ? 'Water Conservation'
    : form.goal === 'yield'
    ? 'Maximum Yield'
    : 'Soil Regeneration';

  const soil = result.soilProfile || form;
  const soilLabel = soil.soilLabel || soil.soil || 'Loam';
  const irrigationText = formatIrrigation(result, form);
  const phVal = Number(soil.ph ?? form.ph ?? 6.5).toFixed(1);
  const socVal = Number(soil.soc ?? form.soc ?? 18).toFixed(1);
  const nVal = Number(soil.nitrogen ?? form.nitrogen ?? 1.6).toFixed(2);
  const clayVal = Number(soil.clay ?? form.clay ?? 24).toFixed(1);
  const sandVal = Number(soil.sand ?? form.sand ?? 42).toFixed(1);
  const siltVal = Number(soil.silt ?? form.silt ?? 34).toFixed(1);

  for (const line of [
    `Location: lat ${form.lat}, lon ${form.lon}`,
    `Primary management goal: ${goalTitle} | Irrigation regime: ${irrigationText}`,
    `Raw SoilGrids Profile (${soilLabel}): pH ${phVal} | SOC ${socVal} g/kg | Total N ${nVal} g/kg | Clay ${clayVal}% / Sand ${sandVal}% / Silt ${siltVal}%`,
    `Previous season: ${result.previousName || 'None'}`,
  ]) {
    y = paragraph(doc, line, margin, y + 2, { size: 9.5 });
  }

  if (result.confidence) {
    const conf = result.confidence;
    const statusLabel = String(conf.status || 'high').toUpperCase();
    y += 4;
    y = paragraph(doc, 'MODEL CONFIDENCE & OOD STATUS', margin, y, { size: 9, style: 'bold', color: 120 }) + 1;
    y = paragraph(
      doc,
      `Status: ${statusLabel} (${conf.confidenceScore ?? 0}/100)${conf.isOod ? ' - Out-of-distribution penalty applied' : ''}`,
      margin,
      y + 1,
      { size: 9.5, color: conf.isOod ? 160 : 40 },
    );
    for (const reason of (conf.reasons || []).slice(0, 3)) {
      y = paragraph(doc, `- ${reason}`, margin + 2, y + 1, { size: 8.5, color: 85, width: CONTENT_W - 2 });
    }
  }

  if (result.coverSummary) {
    const cs = result.coverSummary;
    y += 5;
    y = ensureSpace(doc, y, 24);
    y = paragraph(doc, 'OFF-SEASON BARE-SOIL & COVER SUMMARY', margin, y, { size: 9, style: 'bold', color: 120 }) + 1;
    y = paragraph(
      doc,
      `Bare/dark windows: ${cs.bareWindowsCount ?? 0} (${cs.totalBareMonths ?? 0} total bare mo) | Warm frost-free cover months: ${cs.warmCoverMonths ?? 0} | Frost-free season: ${cs.frostFreeDays ?? 0} days`,
      margin,
      y + 1,
      { size: 9.5, color: 45 },
    );
  }

  y += 6;
  y = ensureSpace(doc, y, 36);
  y = paragraph(doc, 'ROTATION OVERVIEW (PLANTING, HARVEST & COVER WINDOWS)', margin, y, { size: 9, style: 'bold', color: 120 }) + 2;
  for (const entry of result.years || []) {
    const cw = entry.coverWindow;
    const hasCover = Boolean(cw?.hasBareWindow || cw?.isAlleyCover);
    y = ensureSpace(doc, y, hasCover ? 34 : 22);
    doc.setDrawColor(200).line(margin, y, margin + CONTENT_W, y);
    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(30);
    doc.text(`Year ${entry.year}`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(safe(entry.name), margin + 22, y);
    doc.setTextColor(100).text(`${entry.match}% match`, margin + CONTENT_W, y, { align: 'right' });
    y += 4.5;
    const sowLabel = entry.sowWindow?.label || 'Seasonal window';
    const harvestLabel = entry.harvestWindow?.label || 'Maturity window';
    y = paragraph(doc, `Planting: ${sowLabel}  |  Harvest: ${harvestLabel}`, margin + 2, y, { size: 8.5, color: 65, width: CONTENT_W - 2 });

    if (hasCover) {
      doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(42, 118, 62);
      doc.text(`Year ${entry.year}+`, margin + 2, y + 2);
      doc.text(safe(cw.coverCrop), margin + 22, y + 2);
      doc.setFont('helvetica', 'normal').setFontSize(8.5);
      doc.text(
        cw.isAlleyCover ? 'ALLEY COVER' : `${cw.warmCoverMonths ?? 0} warm / ${cw.bareMonths ?? 0} bare mo`,
        margin + CONTENT_W,
        y + 2,
        { align: 'right' },
      );
      y += 6;
      const covSow = cw.sowWindow?.label || 'Post-harvest';
      const covTerm = cw.terminateWindow?.label || 'Pre-plant termination';
      y = paragraph(doc, `Cover Sow: ${covSow}  |  ${covTerm}`, margin + 4, y, { size: 8.5, color: 45, width: CONTENT_W - 4 }) + 2;
    } else {
      y = paragraph(doc, `Off-season cover: ${formatCoverLine(cw)}`, margin + 2, y + 0.5, { size: 8.5, color: 50, width: CONTENT_W - 2 }) + 2;
    }
  }
  doc.setDrawColor(200).line(margin, y, margin + CONTENT_W, y);

  if (Array.isArray(result.indicators) && result.indicators.length) {
    y += 7;
    y = ensureSpace(doc, y, 28);
    y = paragraph(doc, '3-YEAR PLAN IMPACT SUMMARY', margin, y, { size: 9, style: 'bold', color: 120 }) + 2;
    for (const ind of result.indicators) {
      y = ensureSpace(doc, y, 12);
      y = paragraph(
        doc,
        `${ind.label}: ${ind.value} (${ind.score}/100) - ${ind.note}`,
        margin,
        y + 1.5,
        { size: 9.5, color: 50 },
      );
    }
  }

  const years = result.years || [];
  const [photos, coverPhotos] = await Promise.all([
    Promise.all(years.map((e) => loadPhoto(cropImage(e.id), CONTENT_W / 68))),
    Promise.all(
      years.map((e) => {
        const cw = e.coverWindow;
        if (!cw?.hasBareWindow && !cw?.isAlleyCover) return null;
        return loadPhoto(cropImage(cw.coverCropId || coverSlug(cw.coverCrop)), CONTENT_W / 68);
      }),
    ),
  ]);

  years.forEach((entry, i) => {
    doc.addPage();
    let py = margin;
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(120);
    doc.text(safe(`YEAR ${entry.year} - ${(CAPTIONS[i] ?? 'ROTATION STAGE').toUpperCase()}`), margin, py);
    py += 5;
    if (photos[i]) doc.addImage(photos[i], 'JPEG', margin, py, CONTENT_W, 68);
    py += 77;

    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(30);
    doc.text(safe(entry.name), margin, py);
    doc.setFontSize(20).setTextColor(90).text(`${entry.match}%`, margin + CONTENT_W, py, { align: 'right' });
    py = paragraph(doc, entry.tag, margin, py + 7, { size: 10, color: 110 }) + 4;

    py = paragraph(doc, 'PLANTING, HARVEST & COVER SCHEDULE', margin, py, { size: 8.5, style: 'bold', color: 120 });
    py = paragraph(
      doc,
      `Planting (Sow): ${entry.sowWindow?.label || 'N/A'}   |   Harvest: ${entry.harvestWindow?.label || 'N/A'}`,
      margin,
      py + 1.5,
      { size: 9.5, color: 40 },
    );
    py = paragraph(
      doc,
      `Off-season cover: ${formatCoverLine(entry.coverWindow)}`,
      margin,
      py + 1,
      { size: 9.5, color: 40 },
    );
    if (entry.coverWindow?.reason) {
      py = paragraph(doc, entry.coverWindow.reason, margin, py + 1, { size: 8.5, color: 90 });
    }
    py += 5;

    for (const [title, text] of [
      ['Soil synergy', entry.why?.soil || ''],
      ['Climate match', entry.why?.climate || ''],
      ['Agronomic and stress advisory', entry.why?.advisory || ''],
    ]) {
      py = ensureSpace(doc, py, 16);
      py = paragraph(doc, title, margin, py, { size: 10, style: 'bold', color: 30 });
      py = paragraph(doc, text, margin, py + 1, { size: 9.5, color: 70 }) + 4;
    }

    if (Array.isArray(entry.options) && entry.options.length) {
      py = ensureSpace(doc, py, 14);
      py = paragraph(doc, 'CANDIDATES CONSIDERED THIS YEAR', margin, py + 2, { size: 8, style: 'bold', color: 120 });
      paragraph(doc, entry.options.map((o) => `${o.name} ${o.percent}%`).join('   |   '), margin, py + 2, { size: 9.5, color: 70 });
    }

    const cw = entry.coverWindow;
    if (cw?.hasBareWindow || cw?.isAlleyCover) {
      doc.addPage();
      let cy = margin;
      const nextEntry = years[(i + 1) % years.length];
      const nextName = (nextEntry?.name || 'next crop').split(' (')[0];
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(42, 118, 62);
      doc.text(
        safe(
          cw.isAlleyCover
            ? `YEAR ${entry.year}+ - INTER-ROW ALLEY COVER CROP`
            : `YEAR ${entry.year}+ - OFF-SEASON COVER CROP (BEFORE ${nextName.toUpperCase()})`,
        ),
        margin,
        cy,
      );
      cy += 5;
      if (coverPhotos[i]) doc.addImage(coverPhotos[i], 'JPEG', margin, cy, CONTENT_W, 68);
      cy += 77;

      doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(30);
      doc.text(safe(cw.coverCrop), margin, cy);
      doc.setFontSize(12).setTextColor(42, 118, 62).text(
        cw.isAlleyCover ? 'ALLEY COVER' : 'COVER CROP',
        margin + CONTENT_W,
        cy,
        { align: 'right' },
      );
      cy = paragraph(
        doc,
        cw.coverTag || (cw.isAlleyCover ? 'Perennial Alley Cover' : 'Off-Season Cover Crop'),
        margin,
        cy + 7,
        { size: 10, color: 110 },
      ) + 4;

      cy = paragraph(doc, 'COVER WINDOW & TERMINATION SCHEDULE', margin, cy, { size: 8.5, style: 'bold', color: 120 });
      cy = paragraph(
        doc,
        `Cover Sow Window: ${cw.sowWindow?.label || 'N/A'}   |   ${cw.terminateWindow?.winterKills ? 'Winter-Kill' : 'Termination'}: ${cw.terminateWindow?.label || 'N/A'}`,
        margin,
        cy + 1.5,
        { size: 9.5, color: 40 },
      );
      cy = paragraph(
        doc,
        cw.isAlleyCover
          ? 'Coverage: Continuous living inter-row mulch alongside perennial crop'
          : `Off-season gap bridged: ${cw.warmCoverMonths ?? 0} warm frost-free months inside ${cw.bareMonths ?? 0} bare/dark months`,
        margin,
        cy + 1,
        { size: 9.5, color: 45 },
      ) + 5;

      const windowFitText = cw.isAlleyCover
        ? 'Perennial inter-row cover protects orchard/vineyard alleys from erosion and compaction through dormancy and active fruit growth.'
        : `${cw.warmCoverMonths ?? 0} warm frost-free months available after Year ${entry.year} harvest allow cover establishment before winter freeze and clean transition to ${nextName}.`;

      for (const [title, text] of [
        ['Soil & root role', cw.soilBenefit || cw.reason || 'Protects topsoil structure and suppresses weeds.'],
        ['Window & frost fit', windowFitText],
        ['Agronomic reason', cw.reason || ''],
      ]) {
        cy = ensureSpace(doc, cy, 16);
        cy = paragraph(doc, title, margin, cy, { size: 10, style: 'bold', color: 30 });
        cy = paragraph(doc, text, margin, cy + 1, { size: 9.5, color: 70 }) + 4;
      }
    }
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p).setFont('helvetica', 'normal').setFontSize(8).setTextColor(150);
    doc.text(`Field Shift - page ${p} / ${total}`, PAGE.w / 2, PAGE.h - 8, { align: 'center' });
  }

  doc.save('crop-plan.pdf');
}
