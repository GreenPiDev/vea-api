import { slugify } from './slugify';

describe('slugify', () => {
  it('converts Turkish characters to their ASCII equivalents', () => {
    expect(slugify('Mustafa Akagündüz')).toBe('mustafa-akagunduz');
  });

  it('handles the full Turkish special-character set', () => {
    expect(slugify('ÇĞİıÖŞÜçğıöşü')).toBe('cgiiosucgiosu');
  });

  it('collapses whitespace/punctuation runs into a single hyphen', () => {
    expect(slugify('  Ayşe   Öztürk!! ')).toBe('ayse-ozturk');
  });

  it('strips leading/trailing hyphens', () => {
    expect(slugify('-Zeynep-')).toBe('zeynep');
  });
});
