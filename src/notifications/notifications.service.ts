import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

const RECENT_LIMIT = 50;

/**
 * Generic, domain-agnostic notification store — any feature can call
 * create()/createForMany() with its own `type` string and payload shape,
 * no schema or gateway change needed for a new event type. First consumer
 * is OffersService (offer created / artist decision), see its comments for
 * the actual event types/payloads in use today.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(userId: string, type: string, payload: object) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, payload: payload as Prisma.InputJsonValue },
    });
    this.gateway.emitToUser(userId, notification);
    return notification;
  }

  async createForMany(userIds: string[], type: string, payload: object) {
    await Promise.all(userIds.map((userId) => this.create(userId, type, payload)));
  }

  findMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      take: RECENT_LIMIT,
      orderBy: { createdAt: 'desc' },
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) {
      throw new ForbiddenException('This notification does not belong to you');
    }
    if (notification.readAt) return notification;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
