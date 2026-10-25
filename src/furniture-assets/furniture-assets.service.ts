import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFurnitureAssetDto } from './dto/create-furniture-asset.dto';
import { UpdateFurnitureAssetDto } from './dto/update-furniture-asset.dto';

@Injectable()
export class FurnitureAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string | null, dto: CreateFurnitureAssetDto) {
    // Defensive only — in practice a GALLERY_ADMIN always has an
    // organizationId, same reasoning as ExhibitionTemplatesService.create.
    if (!organizationId) {
      throw new ForbiddenException(
        'This admin is not assigned to an organization',
      );
    }
    return this.prisma.furnitureAsset.create({
      data: { organizationId, ...dto },
    });
  }

  // Platform defaults (organizationId null) unioned with this organization's
  // own uploads — the only two tiers of visibility furniture has. Used both
  // by the public by-organization lookup (any visitor viewing a published
  // exhibition needs this) and by the curator's own /mine listing.
  findByOrganization(organizationId: string | null) {
    return this.prisma.furnitureAsset.findMany({
      where: organizationId
        ? { OR: [{ organizationId: null }, { organizationId }] }
        : { organizationId: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(
    id: string,
    organizationId: string | null,
    dto: UpdateFurnitureAssetDto,
  ) {
    await this.assertOwnership(id, organizationId);
    return this.prisma.furnitureAsset.update({ where: { id }, data: dto });
  }

  async remove(id: string, organizationId: string | null) {
    await this.assertOwnership(id, organizationId);
    // Hard delete — no FK references this row (ExhibitionTemplate.roomShape's
    // furniture[] is opaque Json, not a relation). A template still
    // referencing this id simply drops that one placement next render (see
    // vea-frontend's backendAdapter.ts's resolveFurniture — unknown
    // furnitureId is silently skipped, same as an unresolved wallRunId).
    await this.prisma.furnitureAsset.delete({ where: { id } });
  }

  // A platform default (organizationId null) can never be edited/deleted by
  // any organization's admin — only this organization's own uploads are.
  private async assertOwnership(id: string, organizationId: string | null) {
    const asset = await this.prisma.furnitureAsset.findUnique({
      where: { id },
    });
    if (!asset) throw new NotFoundException('Furniture asset not found');
    if (
      !organizationId ||
      !asset.organizationId ||
      asset.organizationId !== organizationId
    ) {
      throw new ForbiddenException(
        'This furniture asset does not belong to your organization',
      );
    }
    return asset;
  }
}
