import { createPaymentSchema, paymentListQuerySchema, refundPaymentSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class CreatePaymentDto extends createZodDto(createPaymentSchema) {}
export class RefundPaymentDto extends createZodDto(refundPaymentSchema) {}
export class PaymentListQueryDto extends createZodDto(paymentListQuerySchema) {}
