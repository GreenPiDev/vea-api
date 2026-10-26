import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FurnitureAssetsService } from '../furniture-assets/furniture-assets.service';
import { CreateExhibitionTemplateDto } from './dto/create-exhibition-template.dto';
import { UpdateExhibitionTemplateDto } from './dto/update-exhibition-template.dto';
import { RoomShapeDto } from './dto/room-shape.dto';
import { deriveTheme } from './theme';

// True only when the *wall-defining* part of the shape actually differs —
// width/depth for a rectangle, the cell set/spawn for a custom footprint.
// `ceilingLights` is deliberately excluded: it never affects wallRunIds (see
// backendAdapter.ts's backendTemplateWallRuns), so a curator can keep
// repositioning ceiling fixtures on an already-placed template without ever
// tripping the shape lock below.
function shapeChanged(stored: unknown, incoming: RoomShapeDto): boolean {
  const prev = stored as RoomShapeDto;
  if (prev.kind !== incoming.kind) return true;
  if (incoming.kind === 'rectangle') {
    const prevRect = prev as Extract<RoomShapeDto, { kind: 'rectangle' }>;
    return prevRect.width !== incoming.width || prevRect.depth !== incoming.depth;
  }
  const prevCustom = prev as Extract<RoomShapeDto, { kind: 'custom' }>;
  if (
    prevCustom.spawn.x !== incoming.spawn.x ||
    prevCustom.spawn.z !== incoming.spawn.z ||
    prevCustom.spawn.yaw !== incoming.spawn.yaw
  ) {
    return true;
  }
  if (prevCustom.cells.length !== incoming.cells.length) return true;
  const prevCells = new Set(prevCustom.cells.map((c) => `${c.x},${c.z}`));
  return incoming.cells.some((c) => !prevCells.has(`${c.x},${c.z}`));
}

@Injectable()
export class ExhibitionTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly furnitureAssets: FurnitureAssetsService,
  ) {}

  // Every furnitureId a curator places must resolve to a FurnitureAsset
  // actually visible to this organization (a platform default, or one of
  // its own uploads) — closes off referencing another organization's
  // private upload by id via a direct API call (the public by-organization
  // endpoint already only ever returns the right set, but this is the
  // server-side backstop). No-op when the shape has no furniture at all.
  private async assertFurnitureVisible(
    organizationId: string | null,
    roomShape: RoomShapeDto,
  ) {
    const ids = roomShape.furniture?.map((f) => f.furnitureId) ?? [];
    if (ids.length === 0) return;
    const visible = await this.furnitureAssets.findByOrganization(organizationId);
    const visibleIds = new Set(visible.map((a) => a.id));
    const unknown = ids.filter((id) => !visibleIds.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown or inaccessible furnitureId(s): ${unknown.join(', ')}`,
      );
    }
  }

  async create(organizationId: string | null, dto: CreateExhibitionTemplateDto) {
    // Defensive only — in practice a GALLERY_ADMIN always has an
    // organizationId, same reasoning as ExhibitionsService.create.
    if (!organizationId) {
      throw new ForbiddenException(
        'This admin is not assigned to an organization',
      );
    }
    await this.assertFurnitureVisible(organizationId, dto.roomShape);
    return this.prisma.exhibitionTemplate.create({
      data: {
        organizationId,
        name: dto.name,
        subtitle: dto.subtitle,
        roomShape: dto.roomShape as unknown as Prisma.InputJsonValue,
        wallHeight: dto.wallHeight,
        wallColor: dto.wallColor,
        floorColor: dto.floorColor,
        ceilingColor: dto.ceilingColor,
        floorTextureId: dto.textureIds?.floor,
        wallTextureId: dto.textureIds?.wall,
        ceilingTextureId: dto.textureIds?.ceiling,
        theme: deriveTheme({
          wallColor: dto.wallColor,
          floorColor: dto.floorColor,
          ceilingColor: dto.ceilingColor,
          floorTextureId: dto.textureIds?.floor,
          wallTextureId: dto.textureIds?.wall,
          ceilingTextureId: dto.textureIds?.ceiling,
        }) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Every GALLERY_ADMIN in the same Organization shares this list, same
  // reasoning as ExhibitionsService.findOwn — _count.exhibitions feeds the
  // curator table's "kaç sergide kullanılıyor" column via a single query,
  // no per-row round-trip.
  findOwn(organizationId: string | null) {
    if (!organizationId) return [];
    return this.prisma.exhibitionTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      // Soft-deleted exhibitions (Exhibition.deletedAt) don't actually use
      // the template anymore — without this filter a removed exhibition
      // keeps the template's room shape locked forever.
      include: {
        _count: { select: { exhibitions: { where: { deletedAt: null } } } },
      },
    });
  }

  async findOneOwn(id: string, organizationId: string | null) {
    return this.assertOwnership(id, organizationId);
  }

  // Full clone of an existing template under the same organization, so a
  // curator can tweak a copy (colors/textures/name) instead of rebuilding a
  // room shape from scratch. roomShape/theme are copied as-is (already-valid
  // JSON, no need to re-derive theme from colors) — the new row starts with
  // zero exhibitions, so its own room shape is unlocked even if the source
  // template's was locked by usage.
  async duplicate(id: string, organizationId: string | null) {
    const template = await this.assertOwnership(id, organizationId);
    return this.prisma.exhibitionTemplate.create({
      data: {
        organizationId: template.organizationId,
        name: `${template.name} (Kopya)`,
        subtitle: template.subtitle,
        roomShape: template.roomShape as Prisma.InputJsonValue,
        wallHeight: template.wallHeight,
        wallColor: template.wallColor,
        floorColor: template.floorColor,
        ceilingColor: template.ceilingColor,
        floorTextureId: template.floorTextureId,
        wallTextureId: template.wallTextureId,
        ceilingTextureId: template.ceilingTextureId,
        theme: template.theme as Prisma.InputJsonValue,
      },
    });
  }

  async update(
    id: string,
    organizationId: string | null,
    dto: UpdateExhibitionTemplateDto,
  ) {
    const template = await this.assertOwnership(id, organizationId);
    if (dto.roomShape) {
      await this.assertFurnitureVisible(organizationId, dto.roomShape);
    }
    // A template already placed under at least one Exhibition has its room
    // shape locked — changing rectangle dimensions or a custom grid's
    // cells/spawn would invalidate the wallRunId every already-placed
    // artwork's positionData points at (see backendAdapter.ts's
    // backendTemplateWallRuns), silently dropping them from the scene.
    // Color/texture/wallHeight stay editable regardless (cosmetic only, no
    // wallRunId is derived from them) — and so does `ceilingLights` (see
    // shapeChanged's doc comment), so ExhibitionTemplateForm.tsx always sends
    // a `roomShape` now (echoing the stored width/depth or cells/spawn
    // unchanged when shape-locked, only `ceilingLights` actually differs).
    // Enforced server-side too, not just hidden in the form, for direct API
    // calls.
    if (
      dto.roomShape &&
      template._count.exhibitions > 0 &&
      shapeChanged(template.roomShape, dto.roomShape)
    ) {
      throw new ConflictException(
        'Cannot change room shape while the template is used by an exhibition',
      );
    }
    const wallColor = dto.wallColor ?? template.wallColor;
    const floorColor = dto.floorColor ?? template.floorColor;
    const ceilingColor = dto.ceilingColor ?? template.ceilingColor;
    // ExhibitionTemplateForm.tsx always submits `textureIds` as a whole
    // object covering all 3 surfaces (never per-surface), including when
    // the admin switches a surface back from texture to flat color — that
    // case sends `{ floor: undefined, ... }`, which JSON drops entirely, so
    // dto.textureIds.floor being undefined must mean "cleared", not "field
    // omitted, keep old value". Only fall back to the stored textureId when
    // the whole `textureIds` key is absent (a direct API call that never
    // intended to touch textures at all). The `?? null` matters for Prisma
    // specifically: an `undefined` in its `update` data means "don't touch
    // this column" (old texture would silently survive), while `null`
    // actually clears it.
    const floorTextureId = dto.textureIds
      ? (dto.textureIds.floor ?? null)
      : (template.floorTextureId ?? undefined);
    const wallTextureId = dto.textureIds
      ? (dto.textureIds.wall ?? null)
      : (template.wallTextureId ?? undefined);
    const ceilingTextureId = dto.textureIds
      ? (dto.textureIds.ceiling ?? null)
      : (template.ceilingTextureId ?? undefined);

    return this.prisma.exhibitionTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        subtitle: dto.subtitle,
        roomShape: dto.roomShape
          ? (dto.roomShape as unknown as Prisma.InputJsonValue)
          : undefined,
        wallHeight: dto.wallHeight,
        wallColor,
        floorColor,
        ceilingColor,
        floorTextureId,
        wallTextureId,
        ceilingTextureId,
        // Re-derived any time a color/texture changes, so `theme` never
        // drifts from the flat fields it was computed from.
        theme: deriveTheme({
          wallColor,
          floorColor,
          ceilingColor,
          floorTextureId: floorTextureId ?? undefined,
          wallTextureId: wallTextureId ?? undefined,
          ceilingTextureId: ceilingTextureId ?? undefined,
        }) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Includes _count.exhibitions so both findOneOwn (surfaced to the edit
  // form, which locks the room-shape section when > 0) and update (the
  // room-shape lock check above) get the usage count without a second query.
  private async assertOwnership(id: string, organizationId: string | null) {
    const template = await this.prisma.exhibitionTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { exhibitions: { where: { deletedAt: null } } } },
      },
    });
    if (!template) throw new NotFoundException('Exhibition template not found');
    if (!organizationId || template.organizationId !== organizationId) {
      throw new ForbiddenException(
        'This template does not belong to your organization',
      );
    }
    return template;
  }
}
