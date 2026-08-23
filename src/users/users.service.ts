import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findOrCreateByEmail(email: string) {
    return this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });
  }

  // Promotes (or re-promotes) a user to ADMIN within a given Organization.
  // Reuses findOrCreateByEmail's upsert-by-email shape — a SUPERADMIN can
  // add someone who has never logged in before, and they simply pick up
  // the ADMIN role/org the next time they complete the normal email-OTP
  // flow (no separate invite/password system needed). Reassigning an
  // existing ADMIN to a different org is allowed (superadmin-trusted action).
  setAdminForOrganization(email: string, organizationId: string) {
    return this.prisma.user.upsert({
      where: { email },
      update: { role: UserRole.ADMIN, organizationId },
      create: { email, role: UserRole.ADMIN, organizationId },
    });
  }

  async removeFromOrganization(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) {
      throw new ConflictException('User does not belong to this organization');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.VISITOR, organizationId: null },
    });
  }
}
