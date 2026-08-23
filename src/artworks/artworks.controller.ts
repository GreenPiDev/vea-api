import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  // Must come before ':id' so "organization" isn't swallowed as an artwork id.
  @Get('organization')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listMyOrganizationArtworks(@CurrentUser() user: JwtPayload, @Query() query: PaginationQueryDto) {
    if (!user.organizationId) {
      throw new ForbiddenException('This admin is not assigned to an organization');
    }
    return this.artworks.findByOrganization(user.organizationId, query.take, query.skip);
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
}
