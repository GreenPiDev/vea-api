import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { R2Service } from '../common/r2/r2.service';
import { FileUrlService } from '../common/r2/file-url.service';
import { FurnitureAssetsService } from './furniture-assets.service';
import { CreateFurnitureAssetDto } from './dto/create-furniture-asset.dto';
import { UpdateFurnitureAssetDto } from './dto/update-furniture-asset.dto';

const MAX_MODEL_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_THUMBNAIL_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

@Controller('furniture-assets')
export class FurnitureAssetsController {
  constructor(
    private readonly furnitureAssets: FurnitureAssetsService,
    private readonly r2: R2Service,
    private readonly fileUrl: FileUrlService,
  ) {}

  // Public, no guard — a visitor walking through a published exhibition
  // needs to resolve its organization's furniture to render it, same
  // visibility model as GET /exhibitions. Returns platform defaults
  // (organizationId null) unioned with this one organization's own uploads.
  @Get('by-organization/:organizationId')
  findByOrganization(@Param('organizationId') organizationId: string) {
    return this.furnitureAssets.findByOrganization(organizationId);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GALLERY_ADMIN)
  listMine(@CurrentUser() user: JwtPayload) {
    return this.furnitureAssets.findByOrganization(user.organizationId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GALLERY_ADMIN)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFurnitureAssetDto,
  ) {
    return this.furnitureAssets.create(user.organizationId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GALLERY_ADMIN)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateFurnitureAssetDto,
  ) {
    return this.furnitureAssets.update(id, user.organizationId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GALLERY_ADMIN)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.furnitureAssets.remove(id, user.organizationId);
  }

  // Returns an R2 object URL the caller then submits as
  // CreateFurnitureAssetDto.modelUrl — mirrors ArtworksController's
  // upload-image two-step shape (upload, then a separate create call).
  // Browsers routinely send an empty or generic mimetype for .glb (no
  // standard <input accept> MIME mapping), so the real check is the file
  // extension, not Content-Type.
  @Post('upload-model')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GALLERY_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_MODEL_SIZE_BYTES },
    }),
  )
  async uploadModel(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Dosya bulunamadı');
    if (!file.originalname.toLowerCase().endsWith('.glb')) {
      throw new BadRequestException('Sadece .glb dosyaları yüklenebilir');
    }
    const key = await this.r2.uploadImage(file, 'furniture-models');
    return { url: this.fileUrl.build(key) };
  }

  @Post('upload-thumbnail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GALLERY_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_THUMBNAIL_SIZE_BYTES },
    }),
  )
  async uploadThumbnail(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Dosya bulunamadı');
    if (!ALLOWED_THUMBNAIL_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Sadece PNG, JPEG veya WEBP dosyaları yüklenebilir',
      );
    }
    const key = await this.r2.uploadImage(file, 'furniture-thumbnails');
    return { url: this.fileUrl.build(key) };
  }
}
