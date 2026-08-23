import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddOrgAdminDto } from './dto/add-org-admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// Platform-vendor-only surface: creating organizations and assigning ADMIN
// users to them is a SUPERADMIN action, not something an ADMIN/curator can
// do for themselves (see exhibitions.controller.ts for the org-scoped
// ADMIN endpoints this unlocks).
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
}
