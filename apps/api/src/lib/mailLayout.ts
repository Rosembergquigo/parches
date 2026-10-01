/** Layout HTML + texto plano para correos transaccionales de Chapi. */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type MailCta = { label: string; href: string };

export type MailBrand = {
  tournamentName: string;
  tournamentHref?: string;
  sportLabel?: string;
  crestUrl?: string | null;
  orgName: string;
  orgHref?: string;
  orgCity?: string | null;
  orgDescription?: string | null;
};

export type MailLayoutInput = {
  preview: string;
  heading: string;
  /** Párrafos ya escapados o markup controlado (no input crudo). */
  bodyHtml: string;
  bodyText: string;
  cta?: MailCta;
  brand?: MailBrand;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toLocaleUpperCase('es-CO');
  }
  return name.trim().slice(0, 3).toLocaleUpperCase('es-CO') || 'CH';
}

function headerHtml(brand?: MailBrand): string {
  if (!brand) {
    return `<tr>
      <td style="padding-bottom:16px;">
        <span style="display:inline-block;width:32px;height:3px;background:#00e5ff;border-radius:2px;"></span>
      </td>
    </tr>`;
  }

  const name = escapeHtml(brand.tournamentName);
  const sport = brand.sportLabel ? escapeHtml(brand.sportLabel) : '';
  const href = brand.tournamentHref ? escapeHtml(brand.tournamentHref) : '';
  const title = href
    ? `<a href="${href}" style="color:#f4f4f8;font-weight:700;font-size:16px;text-decoration:none;">${name}</a>`
    : `<span style="color:#f4f4f8;font-weight:700;font-size:16px;">${name}</span>`;

  const mark = brand.crestUrl
    ? `<img src="${escapeHtml(brand.crestUrl)}" width="40" height="40" alt=""
         style="display:block;width:40px;height:40px;border-radius:10px;border:1px solid #2a2a36;object-fit:cover;" />`
    : `<div style="width:40px;height:40px;border-radius:10px;background:#00e5ff;color:#000;font-size:12px;font-weight:800;line-height:40px;text-align:center;">${escapeHtml(initials(brand.tournamentName))}</div>`;

  const nav = [
    href ? `<a href="${href}" style="color:#8b8b9a;font-size:12px;text-decoration:none;">Torneo</a>` : '',
    brand.orgHref
      ? `<a href="${escapeHtml(brand.orgHref)}" style="color:#8b8b9a;font-size:12px;text-decoration:none;">Organizador</a>`
      : '',
  ].filter(Boolean).join('<span style="color:#2a2a36;padding:0 8px;">·</span>');

  return `<tr>
    <td style="background:#16161e;border:1px solid #2a2a36;border-bottom:0;border-radius:16px 16px 0 0;padding:16px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="44" valign="middle">${mark}</td>
          <td valign="middle" style="padding-left:12px;">
            ${title}
            ${sport ? `<p style="margin:2px 0 0;color:#8b8b9a;font-size:12px;">${sport}</p>` : ''}
          </td>
        </tr>
        ${nav ? `<tr><td colspan="2" style="padding-top:12px;">${nav}</td></tr>` : ''}
      </table>
    </td>
  </tr>`;
}

function organizerHtml(brand?: MailBrand): string {
  if (!brand) return '';
  const name = escapeHtml(brand.orgName);
  const city = brand.orgCity?.trim() ? escapeHtml(brand.orgCity.trim()) : '';
  const desc = brand.orgDescription?.trim() ? escapeHtml(brand.orgDescription.trim()) : '';
  const href = brand.orgHref ? escapeHtml(brand.orgHref) : '';
  return `<tr>
    <td style="padding:20px 8px 4px;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8b8b9a;">Organiza</p>
      ${href
        ? `<a href="${href}" style="color:#f4f4f8;font-size:14px;font-weight:600;text-decoration:none;">${name}</a>`
        : `<p style="margin:0;color:#f4f4f8;font-size:14px;font-weight:600;">${name}</p>`}
      ${city ? `<p style="margin:4px 0 0;color:#8b8b9a;font-size:12px;">${city}</p>` : ''}
      ${desc ? `<p style="margin:8px 0 0;color:#8b8b9a;font-size:12px;line-height:1.5;">${desc}</p>` : ''}
    </td>
  </tr>`;
}

function organizerText(brand?: MailBrand): string[] {
  if (!brand) return [];
  const lines = ['', `Organiza: ${brand.orgName}`];
  if (brand.orgCity?.trim()) lines.push(brand.orgCity.trim());
  if (brand.orgDescription?.trim()) lines.push(brand.orgDescription.trim());
  if (brand.orgHref) lines.push(brand.orgHref);
  return lines;
}

export function renderMail(input: MailLayoutInput): { html: string; text: string } {
  const preview = escapeHtml(input.preview);
  const heading = escapeHtml(input.heading);
  const ctaLabel = input.cta ? escapeHtml(input.cta.label) : '';
  const ctaHref = input.cta ? escapeHtml(input.cta.href) : '';
  const brand = input.brand;
  const cardRadius = brand ? '0 0 16px 16px' : '16px';
  const cardBorderTop = brand ? 'border-top:0;' : '';

  const ctaHtml = input.cta
    ? `<p style="margin:28px 0 8px;">
        <a href="${ctaHref}"
           style="display:inline-block;background:#00e5ff;color:#000;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:8px;">
          ${ctaLabel}
        </a>
      </p>
      <p style="margin:0;color:#8b8b9a;font-size:12px;line-height:1.5;">
        Si el botón no abre: ${ctaHref}
      </p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;color:#f4f4f8;font-family:Inter,Helvetica,Arial,sans-serif;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${preview}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          ${headerHtml(brand)}
          <tr>
            <td style="background:#16161e;border:1px solid #2a2a36;${cardBorderTop}border-radius:${cardRadius};padding:28px 24px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#f4f4f8;">${heading}</h1>
              <div style="font-size:15px;line-height:1.6;color:#c8c8d4;">${input.bodyHtml}</div>
              ${ctaHtml}
            </td>
          </tr>
          ${organizerHtml(brand)}
          <tr>
            <td style="padding-top:16px;color:#8b8b9a;font-size:11px;letter-spacing:0.04em;">Enviado con Chapi</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textParts = [
    brand ? brand.tournamentName : '',
    brand?.sportLabel ?? '',
    '',
    input.heading,
    '',
    input.bodyText.trim(),
  ].filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== ''));
  if (input.cta) {
    textParts.push('', `${input.cta.label}: ${input.cta.href}`);
  }
  textParts.push(...organizerText(brand));
  textParts.push('', 'Enviado con Chapi');

  return { html, text: textParts.join('\n') };
}
