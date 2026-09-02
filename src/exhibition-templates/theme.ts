/**
 * Full ExhibitionTheme shape vea-frontend's src/components/3d/exhibitions.ts
 * expects (mirrored by hand, no shared package — same cross-repo caveat as
 * SOCKET_EVENTS). Kept here (not imported from anywhere) since this backend
 * has no reason to depend on frontend source.
 */
export interface ExhibitionTheme {
  wallColor: string;
  wallRoughness: number;
  floorColor: string;
  floorRoughness: number;
  floorMetalness: number;
  ceilingColor: string;
  fogColor: string;
  backgroundColor: string;
  ambientColor: string;
  ambientIntensity: number;
  hemisphereSkyColor: string;
  hemisphereGroundColor: string;
  spotColor: string;
  spotIntensity: number;
  floorTextureId?: string;
  wallTextureId?: string;
  ceilingTextureId?: string;
}

export interface DeriveThemeInput {
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  floorTextureId?: string;
  wallTextureId?: string;
  ceilingTextureId?: string;
}

/**
 * An admin only picks 3 flat colors + optional textures when creating an
 * ExhibitionTemplate; everything else (roughness, fog/background/ambient/
 * spot colors, hemisphere) is a fixed/derived value tuned for a neutral,
 * gallery-appropriate look. This is a byte-for-byte port of
 * vea-frontend/src/components/3d/backendAdapter.ts's buildCustomTheme() —
 * keep the two in sync if the derivation ever changes.
 */
export function deriveTheme(input: DeriveThemeInput): ExhibitionTheme {
  return {
    wallColor: input.wallColor,
    wallRoughness: 0.85,
    floorColor: input.floorColor,
    floorRoughness: 0.35,
    floorMetalness: 0.05,
    ceilingColor: input.ceilingColor,
    fogColor: input.floorColor,
    backgroundColor: input.wallColor,
    ambientColor: '#fff4e0',
    ambientIntensity: 0.42,
    hemisphereSkyColor: '#ffffff',
    hemisphereGroundColor: input.floorColor,
    spotColor: '#fff4e0',
    spotIntensity: 22,
    floorTextureId: input.floorTextureId,
    wallTextureId: input.wallTextureId,
    ceilingTextureId: input.ceilingTextureId,
  };
}
