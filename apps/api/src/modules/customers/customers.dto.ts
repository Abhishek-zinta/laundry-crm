import { addressSchema, createCustomerSchema, customerListQuerySchema, updateCustomerSchema } from '@rinseops/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCustomerDto extends createZodDto(createCustomerSchema) {}
export class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}
export class CustomerListQueryDto extends createZodDto(customerListQuerySchema) {}
export class AddressDto extends createZodDto(addressSchema) {}
export class UpdateAddressDto extends createZodDto(addressSchema.partial()) {}
