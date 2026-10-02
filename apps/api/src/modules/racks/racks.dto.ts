import { assignRackSchema, createRackSchema, createRackSlotSchema, updateRackSchema, updateRackSlotSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateRackDto extends createZodDto(createRackSchema) {}
export class UpdateRackDto extends createZodDto(updateRackSchema) {}
export class CreateRackSlotDto extends createZodDto(createRackSlotSchema) {}
export class UpdateRackSlotDto extends createZodDto(updateRackSlotSchema) {}
export class AssignRackDto extends createZodDto(assignRackSchema) {}
