import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AnyAudience } from '../../common/decorators/audience.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import { NotificationsService } from './notifications.service';

/** A user's own notifications. Served to staff and portal users alike; always scoped to the caller. */
@Controller('notifications')
@AnyAudience()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.notifications.listForUser(user.userId, { unreadOnly: unread === 'true', page: Number(page) || 1, pageSize: Number(pageSize) || 20 });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.userId);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.userId);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.userId, id);
  }
}
