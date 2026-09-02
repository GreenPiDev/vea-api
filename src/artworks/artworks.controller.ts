import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import { ArtworksService } from './artworks.service';
import { CreateArtworkDto } from './dto/create-artwork.dto';
import { UpdateArtworkDto } from './dto/update-artwork.dto';
import { SetArtworkStatusDto } from './dto/set-artwork-status.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

@Controller('artworks')
export class ArtworksController {
  constructor(private readonly artworks: ArtworksService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.artworks.findPublic(query.take, query.skip);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: JwtPayload) {
    return this.artworks.findOwn(user.sub);
  }

  @Get('mine/stats')
  @UseGuards(JwtAuthGuard)
  getMyStats(@CurrentUser() user: JwtPayload) {
    return this.artworks.getStatsForArtist(user.sub);
  }

  // Must come before ':id' so "organization" isn't swallowed as an artwork id.
  @Get('organization')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GALLERY_ADMIN)
  listMyOrganizationArtworks(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'This admin is not assigned to an organization',
      );
    }
    return this.artworks.findByOrganization(
      user.organizationId,
      query.take,
      query.skip,
    );
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.artworks.findOneForView(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateArtworkDto) {
    return this.artworks.create(user.sub, dto);
  }

  // Returns a Cloudinary secure_url the caller then submits as
  // CreateArtworkDto.imageUrl / UpdateArtworkDto.imageUrl — this endpoint
  // never touches the Artwork row itself, upload and create/update stay
  // two separate steps (same shape as ASSID's member-logo upload).
  @Post('upload-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    }),
  )
  async uploadImage(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Dosya bulunamadı');
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Sadece PNG, JPEG veya WEBP dosyaları yüklenebilir',
      );
    }
    return this.artworks.uploadImage(user.sub, file);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateArtworkDto,
  ) {
    return this.artworks.update(id, user.sub, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  setStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetArtworkStatusDto,
  ) {
    return this.artworks.setStatus(id, user.sub, dto.status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  archive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.artworks.archive(id, user.sub);
  }

  @Patch(':id/unarchive')
  @UseGuards(JwtAuthGuard)
  unarchive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.artworks.unarchive(id, user.sub);
  }
}
