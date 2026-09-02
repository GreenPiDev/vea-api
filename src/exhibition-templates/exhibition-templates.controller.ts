import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ExhibitionTemplatesService } from './exhibition-templates.service';
import { CreateExhibitionTemplateDto } from './dto/create-exhibition-template.dto';
import { UpdateExhibitionTemplateDto } from './dto/update-exhibition-template.dto';

// Entirely org-scoped, no public route — unlike ExhibitionsController there
// is no public "browse templates" use case, only the curator's own
// management table and the exhibition-creation picker (both authenticated).
@Controller('exhibition-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GALLERY_ADMIN)
export class ExhibitionTemplatesController {
  constructor(private readonly templates: ExhibitionTemplatesService) {}

  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.templates.findOwn(user.organizationId);
  }

  @Get('mine/:id')
  getOneMine(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.templates.findOneOwn(id, user.organizationId);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExhibitionTemplateDto) {
    return this.templates.create(user.organizationId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateExhibitionTemplateDto,
  ) {
    return this.templates.update(id, user.organizationId, dto);
  }
}
