import { createStoreSchema, updateStoreSchema, updateTenantSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateTenantDto extends createZodDto(updateTenantSchema) {}
export class CreateStoreDto extends createZodDto(createStoreSchema) {}
export class UpdateStoreDto extends createZodDto(updateStoreSchema) {}
