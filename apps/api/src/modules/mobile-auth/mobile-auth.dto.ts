import { emailSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const mobileLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
  deviceName: z.string().trim().max(120).optional(),
});

export const mobileRefreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});

export class MobileLoginDto extends createZodDto(mobileLoginSchema) {}
export class MobileRefreshDto extends createZodDto(mobileRefreshSchema) {}
