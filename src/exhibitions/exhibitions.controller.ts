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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('exhibitions')
export class ExhibitionsController {
  constructor(private readonly exhibitions: ExhibitionsService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.exhibitions.findPublic(query.take, query.skip);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: JwtPayload) {
    return this.exhibitions.findOwn(user.sub);
  }

  @Get('mine/:id')
  @UseGuards(JwtAuthGuard)
  getOneMine(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.exhibitions.findOneOwn(id, user.sub);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.exhibitions.findOneForView(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExhibitionDto) {
    return this.exhibitions.create(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateExhibitionDto,
  ) {
    return this.exhibitions.update(id, user.sub, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  setStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetExhibitionStatusDto,
  ) {
    return this.exhibitions.setStatus(id, user.sub, dto.status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.exhibitions.remove(id, user.sub);
  }

  @Post(':id/artworks')
  @UseGuards(JwtAuthGuard)
  addArtwork(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddArtworkToExhibitionDto,
  ) {
    return this.exhibitions.addArtwork(id, user.sub, dto);
  }

  @Patch(':id/artworks/:artworkId')
  @UseGuards(JwtAuthGuard)
  updateArtwork(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('artworkId') artworkId: string,
    @Body() dto: UpdateExhibitionArtworkDto,
  ) {
    return this.exhibitions.updateArtworkLink(id, artworkId, user.sub, dto);
  }

  @Delete(':id/artworks/:artworkId')
  @UseGuards(JwtAuthGuard)
  removeArtwork(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('artworkId') artworkId: string,
  ) {
    return this.exhibitions.removeArtwork(id, artworkId, user.sub);
  }
}
