import { publicBookingSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class PublicBookingDto extends createZodDto(publicBookingSchema) {}
