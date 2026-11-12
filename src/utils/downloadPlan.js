export function downloadPlan(result, form) {
  const lines = [
    'FIELD SHIFT: PERSONALISED CROP PLAN',
    '',
    `Field: lat ${form.lat}, lon ${form.lon}`,
    `Soil: pH ${form.ph}; N ${form.n}, P ${form.p}, K ${form.k} mg/kg`,
    '',
    'RECOMMENDED CROPS',
  ];

  for (const item of result.recommendations) {
    lines.push(
      '',
      `${item.name}: ${item.match}% match`,
      `  ${item.tag}`,
      `  Soil synergy: ${item.why.soil}`,
      `  Climate match: ${item.why.climate}`,
      `  Agronomic and stress advisory: ${item.why.advisory}`
    );
  }

  lines.push('', 'THREE-YEAR ROTATION');
  for (const entry of result.years) {
    lines.push(`  Year ${entry.year}: ${entry.name}`);
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'crop-plan.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}