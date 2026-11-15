import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const NASA_DISCLAIMER_PART_1 =
  'NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites.';
const NASA_DISCLAIMER_PART_2 =
  'For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.';

describe('Static & UI Compliance Checks', () => {
  it('includes verbatim NASA Non-Endorsement disclaimer in DataSourcesModal.svelte, App.svelte, and downloadPlan.js', () => {
    for (const file of [
      'src/components/DataSourcesModal.svelte',
      'src/App.svelte',
      'src/utils/downloadPlan.js',
    ]) {
      const content = readRepoFile(file);
      const normalized = content.replace(/\s+/g, ' ');
      expect(normalized, `${file} missing NASA disclaimer part 1`).toContain(NASA_DISCLAIMER_PART_1);
      expect(normalized, `${file} missing NASA disclaimer part 2`).toContain(NASA_DISCLAIMER_PART_2);
    }
  });

  it('removes debug strip comparison text from TelemetryScreen.svelte', () => {
    const content = readRepoFile('src/screens/TelemetryScreen.svelte');
    expect(content).not.toMatch(/Comparing simplified strip/i);
  });

  it('shows .mobile-notice phone placeholder and hides panel/controls below 720px in App.svelte', () => {
    const content = readRepoFile('src/App.svelte');
    expect(content).toContain('.mobile-notice');
    expect(content).toContain('TO CALCULATE YOUR CROPPING STRATEGY OPEN A DESKTOP VERSION OF THE WEBSITE.');
    expect(content).toContain('.mobile-github');
    expect(content).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*?\.panel\s*\{\s*display:\s*none\s*!important;/);
  });

  it('removes hardcoded C:\\Users\\Max path from start.cmd', () => {
    const content = readRepoFile('start.cmd');
    expect(content).not.toMatch(/C:\\Users\\Max/i);
    expect(content).toContain('%~dp0');
  });

  it('removes Market Viability and commercial index strings across UI, PDF, options, and agronomy modules', () => {
    for (const file of [
      'src/screens/ResultsScreen.svelte',
      'src/utils/downloadPlan.js',
      'src/data/options.js',
      'src/lib/crop/goalData.js',
      'src/lib/crop/strategy.js',
    ]) {
      const content = readRepoFile(file);
      expect(content, `${file} still references Market Viability`).not.toMatch(/Market Viability/i);
      expect(content, `${file} still references 3-yr commercial index`).not.toMatch(/3-yr commercial index/i);
      expect(content, `${file} still references High demand`).not.toMatch(/High demand/i);
      expect(content, `${file} still references marketScore`).not.toMatch(/\bmarketScore\b/);
    }
  });

  it('fixes US-specific Clarion-Nicollet-Webster soil label and commercial yield text in src/data/options.js, registering all expanded crops', () => {
    const content = readRepoFile('src/data/options.js');
    expect(content).not.toMatch(/Clarion-Nicollet-Webster/i);
    expect(content).not.toMatch(/commercial output/i);
    for (const crop of ['alfalfa', 'sorghum', 'oats', 'millet', 'peanut']) {
      expect(content).toContain(`value: '${crop}'`);
    }
  });

  it('documents open data licenses in DataSourcesModal.svelte and downloadPlan.js', () => {
    for (const file of ['src/components/DataSourcesModal.svelte', 'src/utils/downloadPlan.js']) {
      const content = readRepoFile(file);
      expect(content, `${file} missing Public Domain`).toMatch(/Public Domain/i);
      expect(content, `${file} missing CC BY 4.0`).toContain('CC BY 4.0');
      expect(content, `${file} missing ODbL`).toContain('ODbL');
    }
  });

  it('provides OSM + NASA GIBS canvas & Nominatim fallback in GoogleMapModal.svelte', () => {
    const content = readRepoFile('src/components/GoogleMapModal.svelte');
    expect(content).toContain('tile.openstreetmap.org');
    expect(content).toContain('gibs.earthdata.nasa.gov');
    expect(content).toContain('nominatim.openstreetmap.org');
    expect(content).toContain('fallbackCanvas');
  });

  it('wires NDVI, freeze-thaw, terrainFallback, 8-mo vs 12-mo, and scenario comparison in RiskCalendar/Results/PDF', () => {
    const riskCal = readRepoFile('src/components/charts/RiskCalendar.svelte');
    expect(riskCal).toContain('MODIS NDVI');
    expect(riskCal).toContain('NDVI < 0.25');
    expect(riskCal).toContain('freezeThawDays');

    const soilChart = readRepoFile('src/components/charts/SoilSourceChart.svelte');
    expect(soilChart).toContain('class="soil-legend"');
    expect(soilChart).not.toMatch(/<rect[^>]*class="group-pill"/);

    const telemetry = readRepoFile('src/screens/TelemetryScreen.svelte');
    expect(telemetry).toContain('nonArableAckCoord');
    expect(telemetry).toContain('freezeThawDays');
    expect(telemetry).toMatch(/wide\s+source=\{cards\.ndvi/);

    const farmSoil = readRepoFile('src/screens/FarmSoilScreen.svelte');
    expect(farmSoil).toContain('nonArableAckCoord');
    expect(farmSoil).toContain('usCdlCrop');

    const results = readRepoFile('src/screens/ResultsScreen.svelte');
    expect(results).toContain('scenarioComparison');
    expect(results).toContain('8-mo');
    expect(results).toContain('12-mo');
    expect(results).toContain('m³/ha');
    expect(results).toContain('terrainFallback');

    const pdf = readRepoFile('src/utils/downloadPlan.js');
    expect(pdf).toContain('scenarioComparison');
    expect(pdf).toContain('8-mo');
    expect(pdf).toContain('12-mo');
    expect(pdf).toContain('m3/ha');
    expect(pdf).toContain('terrainFallback');
  });
});
