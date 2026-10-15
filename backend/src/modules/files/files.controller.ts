import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsDateString, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import { FilesService } from './files.service';

class CreateUploadDto {
  @IsString() @IsNotEmpty() entityType: string;
  @IsUUID() entityId: string;
  @IsString() @IsNotEmpty() fileName: string;
  @IsString() @IsNotEmpty() mimeType: string;
  @IsInt() @Min(1) sizeBytes: number;
  @IsOptional() @IsLatitude() gpsLat?: number;
  @IsOptional() @IsLongitude() gpsLng?: number;
  @IsOptional() @IsDateString() capturedAt?: string;
}

/** Access follows the record the file is attached to (see EntityAccessService). */
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('uploads')
  createUpload(@CurrentUser() user: AuthUser, @Body() dto: CreateUploadDto) {
    return this.files.createUpload(user, dto);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.complete(user, id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('entityType') entityType: string, @Query('entityId', ParseUUIDPipe) entityId: string) {
    return this.files.listForEntity(user, entityType, entityId);
  }

  @Get(':id/url')
  url(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('inline') inline?: string) {
    return this.files.downloadUrl(user, id, inline === 'true');
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.remove(user, id);
  }
}
