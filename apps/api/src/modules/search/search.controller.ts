import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission, searchQuerySchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentUser, RequireAnyPermission } from '../../common/auth/decorators';
import { SearchService } from './search.service';

class SearchQueryDto extends createZodDto(searchQuerySchema) {}

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @RequireAnyPermission(Permission.CUSTOMERS_VIEW, Permission.ORDERS_VIEW, Permission.GARMENTS_VIEW)
  @Get()
  search(@CurrentUser() ctx: AuthContext, @Query() query: SearchQueryDto) {
    return this.searchService.search(ctx, query);
  }
}
