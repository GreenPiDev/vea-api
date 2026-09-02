import { deriveTheme } from './theme';

describe('deriveTheme', () => {
  it('passes through the 3 picked colors and derives the rest as fixed/reused values', () => {
    const theme = deriveTheme({
      wallColor: '#112233',
      floorColor: '#445566',
      ceilingColor: '#778899',
    });

    expect(theme.wallColor).toBe('#112233');
    expect(theme.floorColor).toBe('#445566');
    expect(theme.ceilingColor).toBe('#778899');
    // fog/background reuse the picked colors, not independent picks
    expect(theme.fogColor).toBe('#445566');
    expect(theme.backgroundColor).toBe('#112233');
    expect(theme.hemisphereGroundColor).toBe('#445566');
    // fixed constants, same as vea-frontend's buildCustomTheme()
    expect(theme.wallRoughness).toBe(0.85);
    expect(theme.floorRoughness).toBe(0.35);
    expect(theme.floorMetalness).toBe(0.05);
    expect(theme.ambientColor).toBe('#fff4e0');
    expect(theme.ambientIntensity).toBe(0.42);
    expect(theme.hemisphereSkyColor).toBe('#ffffff');
    expect(theme.spotColor).toBe('#fff4e0');
    expect(theme.spotIntensity).toBe(22);
  });

  it('carries optional texture ids through untouched, omitting them when unset', () => {
    const withTextures = deriveTheme({
      wallColor: '#111111',
      floorColor: '#222222',
      ceilingColor: '#333333',
      floorTextureId: 'oak',
      wallTextureId: 'plaster',
      ceilingTextureId: 'stucco',
    });
    expect(withTextures.floorTextureId).toBe('oak');
    expect(withTextures.wallTextureId).toBe('plaster');
    expect(withTextures.ceilingTextureId).toBe('stucco');

    const withoutTextures = deriveTheme({
      wallColor: '#111111',
      floorColor: '#222222',
      ceilingColor: '#333333',
    });
    expect(withoutTextures.floorTextureId).toBeUndefined();
    expect(withoutTextures.wallTextureId).toBeUndefined();
    expect(withoutTextures.ceilingTextureId).toBeUndefined();
  });
});
