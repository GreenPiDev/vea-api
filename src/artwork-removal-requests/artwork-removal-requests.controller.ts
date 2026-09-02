import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ArtworkRemovalRequestsService } from './artwork-removal-requests.service';
import { CreateRemovalRequestDto } from './dto/create-removal-request.dto';
import { DecideRemovalRequestDto } from './dto/decide-removal-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('artwork-removal-requests')
@UseGuards(JwtAuthGuard)
export class ArtworkRemovalRequestsController {
  constructor(
    private readonly removalRequests: ArtworkRemovalRequestsService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRemovalRequestDto,
  ) {
    return this.removalRequests.create(user.sub, dto);
  }

  // Must come before ':id' so "organization" isn't swallowed as a request id.
  @Get('organization')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GALLERY_ADMIN)
  listOrganizationRequests(@CurrentUser() user: JwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException(
        'This admin is not assigned to an organization',
      );
    }
    return this.removalRequests.findByOrganization(user.organizationId);
  }

  @Patch(':id/decision')
  @UseGuards(RolesGuard)
  @Roles(UserRole.GALLERY_ADMIN)
  decide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DecideRemovalRequestDto,
  ) {
    return this.removalRequests.decide(
      id,
      user.sub,
      user.organizationId,
      dto.decision,
      dto.responseMessage,
    );
  }
}
