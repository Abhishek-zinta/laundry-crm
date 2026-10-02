import { createStaffSchema, updateStaffSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateStaffDto extends createZodDto(createStaffSchema) {}
export class UpdateStaffDto extends createZodDto(updateStaffSchema) {}
