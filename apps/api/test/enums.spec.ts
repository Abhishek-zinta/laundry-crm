import * as P from '@prisma/client';
import * as S from '@rinseops/shared';

/** The shared package mirrors the Prisma enums; this keeps them in sync. */
describe('shared enums match the database schema', () => {
  const pairs: Array<[string, Record<string, string>, Record<string, string>]> = [
    ['Role', P.Role, S.Role],
    ['OrderStatus', P.OrderStatus, S.OrderStatus],
    ['OrderPaymentStatus', P.OrderPaymentStatus, S.OrderPaymentStatus],
    ['PaymentMethod', P.PaymentMethod, S.PaymentMethod],
    ['PaymentStatus', P.PaymentStatus, S.PaymentStatus],
    ['UnitType', P.UnitType, S.UnitType],
    ['TaskType', P.TaskType, S.TaskType],
    ['TaskStatus', P.TaskStatus, S.TaskStatus],
    ['GarmentIssue', P.GarmentIssue, S.GarmentIssue],
    ['DeliveryMode', P.DeliveryMode, S.DeliveryMode],
    ['RackRemovalReason', P.RackRemovalReason, S.RackRemovalReason],
  ];
  it.each(pairs)('%s', (_name, prismaEnum, sharedEnum) => {
    expect(Object.values(sharedEnum).sort()).toEqual(Object.values(prismaEnum).sort());
  });
});
