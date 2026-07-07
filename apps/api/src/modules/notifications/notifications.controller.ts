import { Controller, Get, Post, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  getMine(@CurrentUser() user: JwtPayload) {
    return this.svc.findMine(user.sub);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.svc.getUnreadCount(user.sub).then((count) => ({ count }));
  }

  @Post(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.markRead(id, user.sub);
  }

  @Post('mark-all-read')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.svc.markAllRead(user.sub);
  }
}
