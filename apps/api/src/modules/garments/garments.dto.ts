import { bulkGarmentStatusSchema, changeGarmentStatusSchema, garmentListQuerySchema, updateGarmentSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateGarmentDto extends createZodDto(updateGarmentSchema) {}
export class ChangeGarmentStatusDto extends createZodDto(changeGarmentStatusSchema) {}
export class BulkGarmentStatusDto extends createZodDto(bulkGarmentStatusSchema) {}
export class GarmentListQueryDto extends createZodDto(garmentListQuerySchema) {}
