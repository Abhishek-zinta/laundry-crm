import { changePasswordSchema, loginSchema, registerSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(loginSchema) {}
export class RegisterDto extends createZodDto(registerSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
