import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PersonId } from '../../common/decorators/person-id.decorator';
import { StructuredMessagesService } from './structured-messages.service';

class SendMessageDto {
  @IsString() tripId!: string;
  @IsString() messageKey!: string;
}

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages/driver')
export class StructuredMessagesController {
  constructor(private readonly structuredMessages: StructuredMessagesService) {}

  @Post()
  send(@Body() dto: SendMessageDto, @PersonId() senderId: string) {
    return this.structuredMessages.send(dto.tripId, dto.messageKey, senderId);
  }

  @Get(':tripId')
  getForTrip(@Param('tripId') tripId: string) {
    return this.structuredMessages.getForTrip(tripId);
  }
}
