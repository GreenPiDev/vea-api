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
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddOrgAdminDto } from './dto/add-org-admin.dto';
import {
  OrgArtistsQueryDto,
  OrgExhibitionsQueryDto,
  OrgOffersQueryDto,
} from './dto/org-overview-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

// Platform-vendor-only surface by default (class-level @Roles(SUPERADMIN)):
// creating organizations and assigning ADMIN users to them. The "mine/
// artists" routes below override that to ADMIN — a curator recruiting
// artists for their own gallery is a routine, frequent action, unrealistic
// to route through the platform vendor (unlike organization/admin setup,
// which is rare and SUPERADMIN-only stays right).
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizations.create(dto);
  }

  @Get()
  findAll() {
    return this.organizations.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizations.update(id, dto);
  }

  @Get(':id/admins')
  listAdmins(@Param('id') id: string) {
    return this.organizations.listAdmins(id);
  }

  @Post(':id/admins')
  addAdmin(@Param('id') id: string, @Body() dto: AddOrgAdminDto) {
    return this.organizations.addAdmin(id, dto.email);
  }

  @Delete(':id/admins/:userId')
  removeAdmin(@Param('id') id: string, @Param('userId') userId: string) {
    return this.organizations.removeAdmin(id, userId);
  }

  @Get('mine/artists')
  @Roles(UserRole.GALLERY_ADMIN)
  listMyArtists(@CurrentUser() user: JwtPayload) {
    return this.organizations.listArtists(this.requireOrg(user));
  }

  // Three segments, so it can't collide with the SUPERADMIN `:id/...`
  // routes below (all two segments) regardless of declaration order.
  @Get('mine/artists/:userId')
  @Roles(UserRole.GALLERY_ADMIN)
  getMyArtist(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ) {
    return this.organizations.getArtistDetail(this.requireOrg(user), userId);
  }

  @Post('mine/artists')
  @Roles(UserRole.GALLERY_ADMIN)
  addMyArtist(@CurrentUser() user: JwtPayload, @Body() dto: AddOrgAdminDto) {
    return this.organizations.addArtist(this.requireOrg(user), dto.email);
  }

  @Delete('mine/artists/:userId')
  @Roles(UserRole.GALLERY_ADMIN)
  removeMyArtist(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ) {
    return this.organizations.removeArtist(this.requireOrg(user), userId);
  }

  // ---- SUPERADMIN organization detail page (class-level @Roles) ----------
  // Declared AFTER the `mine/...` routes on purpose: Express matches in
  // declaration order, so a `:id/...` pattern above them would capture
  // `mine` as an id and the class-level SUPERADMIN role would 403 curators.
  // The artists route is also named `artists-overview`, not `artists`, so
  // it can never shadow GET mine/artists regardless of order.

  @Get(':id')
  getOverview(@Param('id') id: string) {
    return this.organizations.getOverview(id);
  }

  @Get(':id/exhibitions')
  listExhibitions(
    @Param('id') id: string,
    @Query() query: OrgExhibitionsQueryDto,
  ) {
    return this.organizations.listExhibitionsForOverview(id, query);
  }

  @Get(':id/artists-overview')
  listArtistsOverview(
    @Param('id') id: string,
    @Query() query: OrgArtistsQueryDto,
  ) {
    return this.organizations.listArtistsForOverview(id, query);
  }

  @Get(':id/offers')
  listOffers(@Param('id') id: string, @Query() query: OrgOffersQueryDto) {
    return this.organizations.listOffersForOverview(id, query);
  }

  // Defensive only — in practice an ADMIN always has an organizationId
  // (see ExhibitionsService.create's identical guard).
  private requireOrg(user: JwtPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'This admin is not assigned to an organization',
      );
    }
    return user.organizationId;
  }
}
