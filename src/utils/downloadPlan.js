// Note on Super Intelligence (SI) Assistance: SI tools assisted with PDF layout refactoring, transliteration helpers, and English copy proofreading.
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
    .replace(/³/g, '3')
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
    ? 'Agronomic Biomass & Harvest Yield'
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

  const profileLines = [
    `Location: lat ${form.lat}, lon ${form.lon}`,
    `Primary management goal: ${goalTitle} | Irrigation regime: ${irrigationText}`,
    `Raw SoilGrids Profile (${soilLabel}): pH ${phVal} | SOC ${socVal} g/kg | Total N ${nVal} g/kg | Clay ${clayVal}% / Sand ${sandVal}% / Silt ${siltVal}%`,
    `Previous season: ${result.previousName || 'None'}`,
  ];

  if (result.landCover) {
    const lc = result.landCover;
    const ackNote = lc.isArableSuitable === false ? ' [NON-ARABLE WARNING ACKNOWLEDGED]' : '';
    profileLines.push(
      `Land Cover Mask: ${lc.label} (${lc.category}) via ${lc.source} (${lc.resolution})${ackNote}`,
    );
  }
  if (result.precipitationSummary) {
    const ps = result.precipitationSummary;
    const pctl = ps.percentiles10Yr;
    const pctlText = pctl && Number.isFinite(Number(pctl.p25))
      ? ` | 10-yr p25/Med/p75: ${Math.round(pctl.p25)}/${Math.round(pctl.median ?? pctl.p50)}/${Math.round(pctl.p75)} mm`
      : '';
    profileLines.push(
      `Precipitation: 8-mo growing season ${ps.seasonPrecip8Mm} mm (${ps.monthlyMeanSeasonMm} mm/mo mean) | 12-mo annual ${ps.annualPrecip12Mm} mm${pctlText}`,
    );
  }
  if (result.terrainFallback) {
    profileLines.push(
      `Terrain Warning: ${result.terrainWarning || 'Elevation API unavailable; fallback terrain estimate (180m / 1.5 deg slope) used.'}`,
    );
  }

  for (const line of profileLines) {
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
    const ft = result.freezeThawDays ?? cs.freezeThawDays;
    y += 5;
    y = ensureSpace(doc, y, 28);
    y = paragraph(doc, 'OFF-SEASON BARE-SOIL & COVER SUMMARY', margin, y, { size: 9, style: 'bold', color: 120 }) + 1;
    y = paragraph(
      doc,
      `Bare/dark windows: ${cs.bareWindowsCount ?? 0} (${cs.totalBareMonths ?? 0} total bare mo) | Warm frost-free cover months: ${cs.warmCoverMonths ?? 0} | Frost-free season: ${cs.frostFreeDays ?? 0} days${ft !== undefined && ft !== null ? ` | Freeze-thaw transitions: ${ft} days` : ''}`,
      margin,
      y + 1,
      { size: 9.5, color: 45 },
    );
    if (cs.bareSoilSource || cs.satelliteNdvi) {
      const sat = cs.satelliteNdvi;
      const meanText = Number.isFinite(Number(cs.meanNdvi ?? sat?.meanNdvi))
        ? ` | Mean annual NDVI ${Number(cs.meanNdvi ?? sat?.meanNdvi).toFixed(2)}`
        : '';
      const obsText = Number.isFinite(Number(cs.observedBareMonths))
        ? ` (${cs.observedBareMonths} mo with NDVI < 0.25)`
        : '';
      y = paragraph(
        doc,
        `NDVI bare-soil telemetry: ${cs.bareSoilSource || sat?.bareSoilSource || 'MODIS Terra NDVI'}${meanText}${obsText}`,
        margin,
        y + 1,
        { size: 8.5, color: 75 },
      );
    }
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
    y = ensureSpace(doc, y, 36);
    y = paragraph(doc, '3-YEAR AGRONOMIC IMPACT SUMMARY', margin, y, { size: 9, style: 'bold', color: 120 }) + 2;
    for (const ind of result.indicators) {
      y = ensureSpace(doc, y, 16);
      y = paragraph(
        doc,
        `${ind.label}: ${ind.value} (${ind.score}/100) - ${ind.note}`,
        margin,
        y + 1.5,
        { size: 9.5, style: 'bold', color: 40 },
      );
      const d = ind.details;
      if (d && ind.key === 'water') {
        y = paragraph(
          doc,
          `FAO-56 3-yr ETc: ${d.cropEtc3YrMm ?? 'N/A'} mm (avg Kc ${d.avgKc ?? 'N/A'}) | Effective precip: ${d.effectivePrecip3YrMm ?? 'N/A'} mm | Irrigation demand: ${d.irrigationDemand3YrMm ?? 0} mm (${d.irrigationDemand3YrM3Ha ?? 0} m3/ha) | Water saved vs ${d.baselineCrop || 'monoculture'}: ${d.waterSavedMm ?? 0} mm (${d.waterSavedPct ?? 0}%)`,
          margin + 2,
          y + 0.5,
          { size: 8.5, color: 75, width: CONTENT_W - 2 },
        );
      } else if (d && ind.key === 'soil') {
        y = paragraph(
          doc,
          `Projected 3-yr SOC shift: ${d.deltaSocGkg >= 0 ? '+' : ''}${d.deltaSocGkg ?? 0} g/kg | Total N shift: ${d.deltaNitrogenGkg >= 0 ? '+' : ''}${d.deltaNitrogenGkg ?? 0} g/kg | N-fixing crops/covers: ${d.nFixingCrops ?? 0}/${d.nFixingCovers ?? 0} | Bare months bridged: ${d.bridgedBareMonths ?? 0}`,
          margin + 2,
          y + 0.5,
          { size: 8.5, color: 75, width: CONTENT_W - 2 },
        );
      } else if (d && ind.key === 'climate') {
        y = paragraph(
          doc,
          `Reliability: ${d.reliabilityLabel || 'Verified'} | Heat (>32C): ${d.heatDays ?? 0}d | Storms (>=25mm): ${d.stormDays ?? 0}d | Freeze-thaw (0C): ${d.freezeThawDays ?? 0}d | Frost-free: ${d.frostFreeDays ?? 0}d | Unique crops: ${d.uniqueCropCount ?? 0}`,
          margin + 2,
          y + 0.5,
          { size: 8.5, color: 75, width: CONTENT_W - 2 },
        );
      }
    }
  }

  const scenarioList = result.scenarioComparison?.scenarios || result.scenarios || [];
  if (Array.isArray(scenarioList) && scenarioList.length) {
    y += 7;
    y = ensureSpace(doc, y, 42);
    y = paragraph(doc, 'MULTI-SCENARIO PRECIPITATION COMPARISON', margin, y, { size: 9, style: 'bold', color: 120 }) + 1;
    if (result.scenarioComparison?.varianceSource) {
      y = paragraph(
        doc,
        `Baseline variance basis: ${result.scenarioComparison.varianceSource}`,
        margin,
        y + 1,
        { size: 8.5, color: 85 },
      );
    }
    for (const sc of scenarioList) {
      y = ensureSpace(doc, y, 16);
      const deltaSign = sc.suitabilityDeltaPct >= 0 ? '+' : '';
      const rainSign = sc.precipDeltaPct >= 0 ? '+' : '';
      y = paragraph(
        doc,
        `${sc.label} (${rainSign}${sc.precipDeltaPct}% rain | 8-mo ${sc.seasonPrecip8Mm} mm / 12-mo ${sc.annualPrecip12Mm} mm): Suitability ${sc.overallScore}/100 (${deltaSign}${sc.suitabilityDeltaPct}%), Risk: ${String(sc.riskLevel || 'moderate').toUpperCase()}`,
        margin,
        y + 2,
        { size: 9, style: 'bold', color: 45 },
      );
      y = paragraph(
        doc,
        `3-yr ETc ${sc.etc3YrMm} mm | Irrigation need ${sc.irrigationDemand3YrMm} mm (${sc.irrigationDemand3YrM3Ha} m3/ha) | Water ${sc.waterScore} / Soil ${sc.soilScore} / Climate ${sc.climateScore} - ${sc.note}`,
        margin + 2,
        y + 0.5,
        { size: 8, color: 80, width: CONTENT_W - 2 },
      );
    }
  }

  const strategyComparison = result.strategyComparison || [];
  if (strategyComparison.length) {
    y = ensureSpace(doc, y + 6, 36);
    y = paragraph(
      doc,
      'ROTATION STRATEGY COMPARISON (VS. EXISTING MONOCROP)',
      margin,
      y,
      { size: 9, style: 'bold', color: 120 },
    );
    y = paragraph(
      doc,
      'Comparison of business-as-usual continuous monoculture against all 3 NASA-guided strategies.',
      margin,
      y + 1,
      { size: 8, color: 90 },
    );

    for (const st of strategyComparison) {
      y = ensureSpace(doc, y, 28);
      const savedTxt = st.isBaseline
        ? `${st.metrics?.moistureDeficit3YrMm ?? 0} mm def | ${st.metrics?.irrigationDemand3YrM3Ha ?? 0} m3/ha irrig`
        : `${st.metrics?.waterSavedPct >= 0 ? '+' : ''}${st.metrics?.waterSavedPct ?? 0}% ETc vs base | ${st.metrics?.deltaSocGkg >= 0 ? '+' : ''}${st.metrics?.deltaSocGkg ?? 0} g/kg SOC`;
      y = paragraph(
        doc,
        `[${st.badge}] ${st.title}: ${st.sequenceLabel} (${st.metrics?.etc3YrMm ?? 0} mm ETc | ${savedTxt} | Resilience ${st.metrics?.climateScore ?? 0}/100)`,
        margin,
        y + 2,
        { size: 8.5, style: 'bold', color: 40 },
      );
      y = paragraph(
        doc,
        `Cover: ${st.coverLabel}. Why: ${st.why} Benefits: ${st.benefits}`,
        margin + 2,
        y + 0.5,
        { size: 8, color: 60, width: CONTENT_W - 2 },
      );
      y = paragraph(
        doc,
        `Missing info: ${st.gaps} Local risks: ${st.risks}`,
        margin + 2,
        y + 0.5,
        { size: 8, color: 85, width: CONTENT_W - 2 },
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

  doc.addPage();
  let dy = margin + 2;
  dy = paragraph(doc, 'DATA SOURCES, OPEN LICENSES & MANDATORY NOTICE', margin, dy, { size: 10, style: 'bold', color: 40 }) + 3;
  for (const attr of [
    'NASA POWER Agroclimatology (MERRA-2 / CERES) & NASA GIBS / MODIS Terra NDVI: U.S. Government / NASA Public Domain.',
    'ISRIC SoilGrids v2.0 (250 m soil properties): Licensed under CC BY 4.0 (ISRIC - World Soil Information).',
    'Open-Meteo Elevation API (SRTM / Copernicus DEM ~90 m): Licensed under CC BY 4.0.',
    'Esri / Impact Observatory Sentinel-2 10m Land Cover & ESA WorldCereal RDM / WorldCover: Licensed under CC BY 4.0.',
    'USGS NLCD Annual Land Cover (30 m CONUS) & USDA NRCS SSURGO / NASS CropScape CDL: U.S. Government Public Domain.',
    'OpenStreetMap (Overpass API, Basemap Tiles & Nominatim): Licensed under ODbL (OpenStreetMap contributors).',
    'Crop Visuals (src/crops/*.webp): All 26 species visuals are SI-generated & watermarked (no NASA branding): 13 via Google Gemini ("Gemini - SI") and 13 via xAI Grok ("Grok - SI" + native GROK mark), saved as 1204x672 WebP.',
  ]) {
    dy = paragraph(doc, `- ${attr}`, margin, dy + 1.5, { size: 8.5, color: 60 });
  }
  dy += 5;
  dy = paragraph(doc, 'NASA NON-ENDORSEMENT & NON-U.S. GOVERNMENT DATA-USE DISCLAIMER', margin, dy, { size: 9, style: 'bold', color: 35 }) + 1;
  paragraph(
    doc,
    'NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.',
    margin,
    dy + 1,
    { size: 9, color: 50 },
  );

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p).setFont('helvetica', 'normal').setFontSize(8).setTextColor(150);
    doc.text(`Field Shift - page ${p} / ${total}`, PAGE.w / 2, PAGE.h - 8, { align: 'center' });
  }

  doc.save('crop-plan.pdf');
}
