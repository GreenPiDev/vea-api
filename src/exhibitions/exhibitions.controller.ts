import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExhibitionsService } from './exhibitions.service';
import { CreateExhibitionDto } from './dto/create-exhibition.dto';
import { UpdateExhibitionDto } from './dto/update-exhibition.dto';
import { SetExhibitionStatusDto } from './dto/set-exhibition-status.dto';
import { AddArtworkToExhibitionDto } from './dto/add-artwork-to-exhibition.dto';
import { UpdateExhibitionArtworkDto } from './dto/update-exhibition-artwork.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UserRole } from '@prisma/client';

@Controller('exhibitions')
export class ExhibitionsController {
  constructor(private readonly exhibitions: ExhibitionsService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.exhibitions.findPublic(query.take, query.skip);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listMine(@CurrentUser() user: JwtPayload) {
    return this.exhibitions.findOwn(user.organizationId);
  }

  @Get('mine/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getOneMine(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.exhibitions.findOneOwn(id, user.organizationId);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.exhibitions.findOneForView(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExhibitionDto) {
    return this.exhibitions.create(user.sub, user.organizationId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateExhibitionDto,
  ) {
    return this.exhibitions.update(id, user.organizationId, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  setStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetExhibitionStatusDto,
  ) {
    return this.exhibitions.setStatus(id, user.organizationId, dto.status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.exhibitions.remove(id, user.organizationId);
  }

  @Post(':id/artworks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  addArtwork(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddArtworkToExhibitionDto,
  ) {
    return this.exhibitions.addArtwork(id, user.organizationId, dto);
  }

  @Patch(':id/artworks/:artworkId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateArtwork(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('artworkId') artworkId: string,
    @Body() dto: UpdateExhibitionArtworkDto,
  ) {
    return this.exhibitions.updateArtworkLink(id, artworkId, user.organizationId, dto);
  }

  @Delete(':id/artworks/:artworkId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  removeArtwork(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('artworkId') artworkId: string,
  ) {
    return this.exhibitions.removeArtwork(id, artworkId, user.organizationId);
  }
}
