import { Controller, Get, Version, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Get application information' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application information retrieved successfully',
  })
  getAppInfo() {
    return this.appService.getAppInfo();
  }

  @Get('ping')
  @Version('1')
  @ApiOperation({ summary: 'Health ping endpoint' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pong response' })
  ping() {
    return this.appService.ping();
  }
}
