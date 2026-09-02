import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExhibitionTemplateDto } from './dto/create-exhibition-template.dto';
import { UpdateExhibitionTemplateDto } from './dto/update-exhibition-template.dto';
import { deriveTheme } from './theme';

@Injectable()
export class ExhibitionTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string | null, dto: CreateExhibitionTemplateDto) {
    // Defensive only — in practice a GALLERY_ADMIN always has an
    // organizationId, same reasoning as ExhibitionsService.create.
    if (!organizationId) {
      throw new ForbiddenException('This admin is not assigned to an organization');
    }
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
      include: { _count: { select: { exhibitions: true } } },
    });
  }

  async findOneOwn(id: string, organizationId: string | null) {
    return this.assertOwnership(id, organizationId);
  }

  async update(id: string, organizationId: string | null, dto: UpdateExhibitionTemplateDto) {
    const template = await this.assertOwnership(id, organizationId);
    // A template already placed under at least one Exhibition has its room
    // shape locked — changing rectangle dimensions or a custom grid's
    // cells/spawn would invalidate the wallRunId every already-placed
    // artwork's positionData points at (see backendAdapter.ts's
    // backendTemplateWallRuns), silently dropping them from the scene.
    // Color/texture/wallHeight stay editable regardless (cosmetic only, no
    // wallRunId is derived from them). Enforced server-side too, not just
    // hidden in the form — ExhibitionTemplateForm.tsx never sends
    // roomShape once locked, but this guards direct API calls as well.
    if (dto.roomShape && template._count.exhibitions > 0) {
      throw new ConflictException(
        'Cannot change room shape while the template is used by an exhibition',
      );
    }
    const wallColor = dto.wallColor ?? template.wallColor;
    const floorColor = dto.floorColor ?? template.floorColor;
    const ceilingColor = dto.ceilingColor ?? template.ceilingColor;
    const floorTextureId = dto.textureIds?.floor ?? template.floorTextureId ?? undefined;
    const wallTextureId = dto.textureIds?.wall ?? template.wallTextureId ?? undefined;
    const ceilingTextureId = dto.textureIds?.ceiling ?? template.ceilingTextureId ?? undefined;

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
          floorTextureId,
          wallTextureId,
          ceilingTextureId,
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
      include: { _count: { select: { exhibitions: true } } },
    });
    if (!template) throw new NotFoundException('Exhibition template not found');
    if (!organizationId || template.organizationId !== organizationId) {
      throw new ForbiddenException('This template does not belong to your organization');
    }
    return template;
  }
}
