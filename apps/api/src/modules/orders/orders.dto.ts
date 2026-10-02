import { cancelOrderSchema, changeOrderStatusSchema, createOrderSchema, orderListQuerySchema, updateOrderSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateOrderDto extends createZodDto(createOrderSchema) {}
export class UpdateOrderDto extends createZodDto(updateOrderSchema) {}
export class ChangeOrderStatusDto extends createZodDto(changeOrderStatusSchema) {}
export class CancelOrderDto extends createZodDto(cancelOrderSchema) {}
export class OrderListQueryDto extends createZodDto(orderListQuerySchema) {}
