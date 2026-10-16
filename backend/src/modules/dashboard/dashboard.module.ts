import { Module } from '@nestjs/common';
import { DashboardDataService } from './dashboard-data.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Role-based dashboards: widget catalogue + per-role default layouts (widgets.ts), per-user
 * customisation, and one data endpoint per widget, filtered by permission and data scope.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardDataService],
})
export class DashboardModule {}
