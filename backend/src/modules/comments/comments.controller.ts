import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';
import { CommentsService } from './comments.service';

class CreateCommentDto {
  @IsString() @IsNotEmpty() entityType: string;
  @IsUUID() entityId: string;
  @IsString() @IsNotEmpty() @MaxLength(10000) body: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) mentionUserIds?: string[];
}

class UpdateCommentDto {
  @IsString() @IsNotEmpty() @MaxLength(10000) body: string;
}

/** Access follows the record being discussed (see EntityAccessService). */
@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('entityType') entityType: string, @Query('entityId', ParseUUIDPipe) entityId: string) {
    return this.comments.list(user, entityType, entityId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCommentDto) {
    return this.comments.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCommentDto) {
    return this.comments.update(user, id, dto.body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.comments.remove(user, id);
  }
}
